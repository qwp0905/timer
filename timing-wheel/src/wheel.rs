use std::{collections::HashMap, env};

use napi::{JsNumber, bindgen_prelude::*};

use crate::{
  TestingTimer,
  clock::ClockHands,
  constant::{MAX_DELAY, MAX_LAYER_PER_BUCKET, MIN_DELAY},
  layer::{Bucket, BucketLayer},
  pointer::{IntoUnsafePtr, UnsafePtr},
  pool::VectorPool,
  task::{Task, TaskId, TaskRef, VoidCallback},
  timer::{SystemTimer, Timer},
};

#[napi]
pub struct TimingWheel {
  tasks: HashMap<TaskId, TaskRef>,
  layers: Vec<BucketLayer>,
  clock_hands: ClockHands,
  timer: Box<dyn Timer>,
  ref_count: usize,
  last_id: TaskId,
  pool: VectorPool,
}

#[napi]
impl TimingWheel {
  #[napi(constructor)]
  pub fn new() -> Self {
    Self::with_timer(SystemTimer::new())
  }

  #[napi(factory)]
  pub fn with_testing(test: Reference<TestingTimer>) -> Self {
    Self::with_timer(test)
  }

  #[inline]
  fn with_timer(timer: impl Timer + 'static) -> Self {
    let mut pool = VectorPool::new(
      env::var("TW_BUFFER_POOL_SIZE")
        .unwrap_or("1024".to_string())
        .parse()
        .unwrap_or(1024),
    );
    Self {
      tasks: Default::default(),
      layers: Vec::with_capacity(MAX_LAYER_PER_BUCKET),
      timer: Box::new(timer),
      clock_hands: ClockHands::new(0, pool.acquire()),
      ref_count: 0,
      last_id: 0,
      pool,
    }
  }

  #[napi]
  pub fn set_ref(&mut self, id: TaskId) {
    let task = match self.tasks.get_mut(&id) {
      Some(task) => task.borrow_mut(),
      None => return,
    };
    if task.has_ref() {
      return;
    }

    task.set_ref();
    self.ref_count += 1;
  }
  #[napi]
  pub fn clear_ref(&mut self, id: TaskId) {
    let task = match self.tasks.get_mut(&id) {
      Some(task) => task.borrow_mut(),
      None => return,
    };
    if !task.has_ref() {
      return;
    }

    task.clear_ref();
    self.ref_count -= 1;
  }

  #[napi]
  pub fn is_ref_empty(&self) -> bool {
    self.ref_count == 0
  }
  #[napi]
  pub fn has_ref(&self, id: TaskId) -> bool {
    match self.tasks.get(&id) {
      Some(task) => task.borrow().has_ref(),
      None => false,
    }
  }

  #[napi]
  pub fn is_empty(&self) -> bool {
    self.tasks.is_empty()
  }

  #[inline]
  fn register_task_ref(&mut self, task: TaskRef) {
    let task_ref = task.borrow();

    let layer_size = task_ref.layer_size();
    self.expand_layers(layer_size);

    if self.tasks.insert(task_ref.get_id(), task).is_none() && task_ref.has_ref() {
      self.ref_count += 1
    };
    self.layers[layer_size - 1].insert(task);
  }

  #[napi]
  pub fn refresh(&mut self, id: TaskId) {
    let mut task = match self.tasks.get_mut(&id) {
      Some(task) => *task,
      None => return,
    };

    task.borrow_mut().set_scheduled_at(self.timer.now());
    self.register_task_ref(task);
  }

  #[inline]
  pub fn new_id(&mut self) -> TaskId {
    let id = self.last_id;
    self.last_id = self.last_id.checked_add(1).unwrap_or(0);
    id
  }

  #[inline]
  fn reset(&mut self) {
    self.timer.reset();
    self.clock_hands.reset();
  }

  #[napi]
  pub fn register(
    &mut self,
    delay: JsNumber,
    callback: VoidCallback,
    is_interval: bool,
  ) -> Result<TaskId> {
    let delay = convert_delay(delay)?;
    if self.tasks.is_empty() {
      self.reset();
    }

    let id = self.new_id();
    let task = Task::new(
      id,
      self.timer.now(),
      delay,
      callback,
      is_interval,
      self.pool.acquire(),
    );
    self.register_task_ref(task.create_ptr());
    Ok(id)
  }

  #[napi]
  pub fn unregister(&mut self, id: TaskId) {
    self.unregister_task(id);
  }

  #[inline]
  fn unregister_task(&mut self, id: TaskId) -> bool {
    if match self.tasks.remove(&id) {
      Some(task) => task.borrow().has_ref(),
      None => return false,
    } {
      self.ref_count -= 1;
    };

    true
  }

  #[inline]
  fn dropdown(&mut self) -> Option<Bucket> {
    let mut dropdown: Option<Bucket> = None;

    for (i, layer) in self.layers.iter_mut().enumerate().rev() {
      match (layer.is_empty(), dropdown.take()) {
        (true, None) => continue,
        (_, Some(tasks)) => tasks.into_iter().for_each(|task| layer.insert(task)),
        _ => {}
      }

      dropdown = self.clock_hands.get(i).and_then(|i| layer.dropdown(i));
    }

    self.reduce_layers();
    dropdown
  }

  #[napi]
  pub fn tick(&mut self, env: &Env) -> Result<()> {
    let now = self.timer.now();

    while self.clock_hands.advance_until(now) {
      match self.dropdown() {
        Some(tasks) => self.execute_tasks(env, tasks)?,
        None => continue,
      }

      if self.tasks.is_empty() {
        self.layers.clear();
        break;
      }
    }

    Ok(())
  }

  #[inline]
  fn execute_tasks(&mut self, env: &Env, tasks: Bucket) -> Result<()> {
    let current = self.clock_hands.timestamp();
    for mut task in tasks {
      let task_ref = task.borrow_mut();
      if current != task_ref.get_execute_at() {
        continue;
      }

      if !self.unregister_task(task_ref.get_id()) {
        let _ = task.deref();
        continue;
      }

      if !task_ref.is_interval() {
        task.deref().execute(env)?;
        continue;
      }

      task_ref.set_scheduled_at(current);
      self.register_task_ref(task);
      task.borrow().execute(env)?;
    }
    Ok(())
  }

  #[inline]
  fn reduce_layers(&mut self) {
    while let Some(true) = self.layers.last().map(|l| l.is_empty()) {
      self.layers.pop();
    }
  }

  #[inline]
  fn expand_layers(&mut self, layer_size: usize) {
    for len in self.layers.len()..layer_size {
      self.layers.push(BucketLayer::new(len));
    }
  }
}

#[inline]
fn convert_delay(delay: JsNumber) -> Result<usize> {
  delay
    .get_int64()
    .map(|n| n.max(MIN_DELAY).min(MAX_DELAY) as usize)
}
