use std::collections::HashMap;

use napi::{Env, JsNumber, Result, bindgen_prelude::Reference};

use crate::{
  TestingTimer,
  constant::{MAX_BUCKET_COUNT, MAX_DELAY, MIN_DELAY},
  index::BucketIndexes,
  layer::{Bucket, BucketLayer},
  pointer::{IntoUnsafePtr, TaskRef, UnsafePtr},
  task::{Task, TaskId, VoidCallback},
  timer::{SystemTimer, Timer},
};

#[napi]
pub struct TimingWheel {
  tasks: HashMap<TaskId, TaskRef>,
  layers: Vec<BucketLayer>,
  timer: Box<dyn Timer>,
  current_tick: usize,
  ref_count: usize,
  last_id: TaskId,
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
    Self {
      tasks: Default::default(),
      layers: Vec::with_capacity(MAX_BUCKET_COUNT),
      timer: Box::new(timer),
      current_tick: 0,
      ref_count: 0,
      last_id: 0,
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

  #[napi]
  pub fn register(
    &mut self,
    delay: JsNumber,
    callback: VoidCallback,
    is_interval: bool,
  ) -> Result<TaskId> {
    let delay = convert_delay(delay)?;
    if self.tasks.is_empty() {
      self.timer.reset();
      self.current_tick = 0;
    }
    let id = self.last_id;
    self.last_id += 1;

    let task = Task::new(id, self.timer.now(), delay, callback, is_interval);
    self.register_task_ref(task.create_ptr());
    Ok(id)
  }

  #[napi]
  pub fn unregister(&mut self, id: TaskId) {
    self.unregister_task(id);
  }

  #[inline]
  fn unregister_task(&mut self, id: TaskId) -> bool {
    let task = match self.tasks.remove(&id) {
      Some(task) => task,
      None => return false,
    };

    if task.borrow().has_ref() {
      self.ref_count -= 1;
    }
    true
  }

  #[inline]
  fn dropdown(&mut self, indexes: &BucketIndexes) -> Option<Bucket> {
    let mut dropdown: Option<Bucket> = None;

    for (i, layer) in self.layers.iter_mut().enumerate().rev() {
      match (layer.is_empty(), dropdown.take()) {
        (true, None) => continue,
        (_, Some(tasks)) => tasks.into_iter().for_each(|task| layer.insert(task)),
        _ => {}
      }

      dropdown = indexes.get(i).and_then(|i| layer.dropdown(i));
    }

    self.reduce_layers();
    dropdown
  }

  #[napi]
  pub fn tick(&mut self, env: &Env) -> Result<()> {
    let now = self.timer.now();

    let mut indexes = BucketIndexes::new(self.current_tick);
    for current in (self.current_tick + 1)..=now {
      indexes.advance();

      match self.dropdown(&indexes) {
        Some(tasks) => self.execute_tasks(env, tasks, current)?,
        None => continue,
      }

      if self.tasks.is_empty() {
        self.layers.clear();
        break;
      }
    }

    self.current_tick = now;
    Ok(())
  }

  #[inline]
  fn execute_tasks(&mut self, env: &Env, tasks: Bucket, current: usize) -> Result<()> {
    for mut task in tasks {
      let task_ref = task.borrow();
      if current != task_ref.get_execute_at() {
        continue;
      }

      if !self.unregister_task(task_ref.get_id()) {
        let _ = task.deref();
        continue;
      }

      if !task_ref.is_interval() {
        task.deref().execute(&env)?;
        continue;
      }

      task.borrow_mut().set_scheduled_at(current);
      self.register_task_ref(task);
      task.borrow().execute(&env)?;
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
    while self.layers.len() < layer_size {
      self.layers.push(BucketLayer::new(self.layers.len()));
    }
  }
}

#[inline]
fn convert_delay(delay: JsNumber) -> Result<usize> {
  delay
    .get_int64()
    .map(|n| n.max(MIN_DELAY).min(MAX_DELAY) as usize)
}
