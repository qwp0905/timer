use std::{
  collections::HashMap,
  thread::{JoinHandle, spawn},
};

use crossbeam::channel::{Receiver, Sender, bounded, unbounded};
use napi::{Env, JsNumber, Result};

use crate::{
  channel::MustSend,
  task::{Task, TaskId, VoidCallback},
  timer::SystemTimer,
  wheel::{Message, TimingWheel},
};

struct TaskInfo {
  callback: VoidCallback,
  is_interval: bool,
  has_ref: bool,
  delay: usize,
}
impl TaskInfo {
  fn new(callback: VoidCallback, is_interval: bool, delay: usize) -> Self {
    Self {
      callback,
      is_interval,
      has_ref: true,
      delay,
    }
  }
}

struct TimingWheelThreadCore {
  thread: JoinHandle<()>,
  input: Sender<Message>,
  waker: Sender<()>,
  callbacks: HashMap<TaskId, TaskInfo>,
  output: Receiver<Task>,
  ref_count: usize,
  idle: bool,
}
impl TimingWheelThreadCore {
  fn new() -> Self {
    let (waker, waker_recv) = bounded(1);
    let (input, input_recv) = unbounded();
    let (output_tx, output) = unbounded();

    let thread = spawn(move || {
      let timer = Box::new(SystemTimer::new());
      let mut wheel = TimingWheel::new(timer, output_tx, input_recv);
      while let Ok(_) = waker_recv.recv() {
        wheel.start_loop();
      }
    });

    Self {
      thread,
      input,
      waker,
      callbacks: Default::default(),
      output,
      ref_count: 0,
      idle: true,
    }
  }

  #[inline]
  fn send(&mut self, message: Message) {
    self.input.must_send(message);
    if !self.idle {
      return;
    }
    self.idle = false;
    self.waker.must_send(());
  }
}

#[napi]
pub struct TimingWheelThread {
  core: Option<TimingWheelThreadCore>,
  last_id: TaskId,
}
#[napi]
impl TimingWheelThread {
  #[napi(constructor)]
  pub fn new() -> Self {
    Self {
      core: None,
      last_id: 0,
    }
  }

  #[inline]
  fn get_core(&mut self) -> &mut TimingWheelThreadCore {
    self.core.get_or_insert_with(TimingWheelThreadCore::new)
  }

  #[napi]
  pub fn tick(&mut self, env: Env) -> Result<()> {
    let core = match self.core.as_mut() {
      Some(c) => c,
      None => return Ok(()),
    };

    while let Ok(task) = core.output.try_recv() {
      let id = task.get_id();
      let info = match core.callbacks.get(&id) {
        Some(info) => info,
        None => continue,
      };

      if info.is_interval {
        core.input.must_send(Message::New(id, info.delay));
        if core.idle {
          core.idle = false;
          core.waker.must_send(());
        }
        info.callback.borrow_back(&env)?.call(())?;
        continue;
      }

      let info = core.callbacks.remove(&id).unwrap();
      info.callback.borrow_back(&env)?.call(())?;
    }

    if core.callbacks.is_empty() && !core.idle {
      core.idle = true;
      core.input.must_send(Message::Idle);
    }

    Ok(())
  }

  #[napi]
  pub fn close(&mut self) {
    let core = match self.core.take() {
      Some(c) => c,
      None => return,
    };
    drop(core.waker);
    drop(core.input);
    let _ = core.thread.join();
  }

  #[napi]
  pub fn unregister(&mut self, id: TaskId) {
    if let Some(core) = self.core.as_mut() {
      if let Some(task) = core.callbacks.remove(&id) {
        if task.has_ref {
          core.ref_count -= 1;
        }
      };
    }
  }

  #[napi]
  pub fn register(
    &mut self,
    delay: JsNumber,
    callback: VoidCallback,
    is_interval: bool,
  ) -> Result<TaskId> {
    let delay = convert_delay(delay)?;
    let id = self.last_id;
    self.last_id += 1;

    let core = self.get_core();

    let info = TaskInfo::new(callback, is_interval, delay);
    if core.callbacks.insert(id, info).is_none() {
      core.ref_count += 1;
    };

    core.send(Message::New(id, delay));
    Ok(id)
  }

  #[napi]
  pub fn refresh(&mut self, id: TaskId) {
    let core = match self.core.as_mut() {
      Some(c) => c,
      None => return,
    };
    if let Some(info) = core.callbacks.get(&id) {
      core.send(Message::New(id, info.delay));
    }
  }

  #[napi]
  pub fn has_ref(&mut self, id: TaskId) -> bool {
    let core = match self.core.as_mut() {
      Some(c) => c,
      None => return false,
    };
    match core.callbacks.get(&id) {
      Some(info) => info.has_ref,
      None => false,
    }
  }

  #[napi]
  pub fn set_ref(&mut self, id: TaskId) {
    let core = match self.core.as_mut() {
      Some(c) => c,
      None => return,
    };

    if let Some(info) = core.callbacks.get_mut(&id) {
      if info.has_ref {
        return;
      }
      info.has_ref = true;
      core.ref_count += 1;
    }
  }

  #[napi]
  pub fn clear_ref(&mut self, id: TaskId) {
    let core = match self.core.as_mut() {
      Some(c) => c,
      None => return,
    };

    if let Some(info) = core.callbacks.get_mut(&id) {
      if !info.has_ref {
        return;
      }
      info.has_ref = false;
      core.ref_count -= 1;
    }
  }

  #[napi]
  pub fn is_ref_empty(&mut self) -> bool {
    let core = match self.core.as_mut() {
      Some(c) => c,
      None => return true,
    };
    core.ref_count == 0
  }

  #[napi]
  pub fn is_empty(&mut self) -> bool {
    let core = match self.core.as_mut() {
      Some(c) => c,
      None => return true,
    };
    core.callbacks.is_empty()
  }
}
impl Drop for TimingWheelThread {
  fn drop(&mut self) {
    self.close()
  }
}

#[inline]
fn convert_delay(delay: JsNumber) -> Result<usize> {
  delay
    .get_int64()
    .map(|n| n.max(1).min(0xffff_ffff) as usize)
}
