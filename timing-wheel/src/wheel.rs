use std::{
  collections::{HashMap, HashSet},
  ptr::NonNull,
};

use napi::{Env, Result, bindgen_prelude::Reference};

use crate::{
  TestingTimer,
  layer::BucketLayer,
  pointer::Pointer,
  task::{Task, VoidCallback, get_bucket_indexes},
  timer::{SystemTimer, Timer},
};

#[napi]
pub struct TimingWheel {
  refs: HashSet<u32>,
  tasks: HashMap<u32, NonNull<Task>>,
  layers: Vec<BucketLayer>,
  timer: Box<dyn Timer>,
  current_tick: u32,
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
      refs: Default::default(),
      layers: Vec::new(),
      timer: Box::new(timer),
      current_tick: 0,
    }
  }

  #[napi]
  pub fn set_ref(&mut self, id: u32) {
    self.refs.insert(id);
  }
  #[napi]
  pub fn clear_ref(&mut self, id: u32) {
    self.refs.remove(&id);
  }

  #[napi]
  pub fn is_ref_empty(&self) -> bool {
    self.refs.is_empty()
  }
  #[napi]
  pub fn has_ref(&self, id: u32) -> bool {
    self.refs.contains(&id)
  }

  #[napi(getter)]
  pub fn length(&self) -> u32 {
    self.tasks.len() as u32
  }

  #[napi]
  pub fn is_empty(&self) -> bool {
    self.tasks.is_empty()
  }

  #[inline]
  fn register_task(&mut self, task: Task) {
    let pointer = NonNull::from_box(task);
    self.register_task_ref(pointer);
  }

  #[inline]
  fn register_task_ref(&mut self, task: NonNull<Task>) {
    let task_ref = task.refs();

    let layer_size = task_ref.layer_size();
    while self.layers.len() < layer_size {
      self.layers.push(BucketLayer::new(self.layers.len()));
    }

    let id = task_ref.get_id();
    self.tasks.insert(id, task);
    self.layers[layer_size - 1].insert(task);
  }

  #[napi]
  pub fn refresh(&mut self, id: u32) {
    let now = self.timer.now();
    self
      .tasks
      .get_mut(&id)
      .map(|task| {
        task.muts().set_scheduled_at(now);
        task.clone()
      })
      .map(|ptr| self.register_task_ref(ptr));
  }

  #[napi]
  pub fn register(
    &mut self,
    id: u32,
    delay: u32,
    callback: VoidCallback,
    is_interval: bool,
  ) -> Result<()> {
    if self.tasks.is_empty() {
      self.timer.reset();
      self.current_tick = 0;
    }

    let task = Task::new(id, self.timer.now(), delay, callback, is_interval);
    self.register_task(task);
    self.set_ref(id);
    Ok(())
  }

  #[napi]
  pub fn unregister(&mut self, id: u32) {
    if self.tasks.remove(&id).is_none() {
      return;
    }
    self.clear_ref(id);
  }

  #[napi]
  pub fn tick(&mut self, env: Env) -> Result<()> {
    let now = self.timer.now();
    let mut dropdown: Vec<NonNull<Task>> = Vec::new();

    for current in (self.current_tick + 1)..=now {
      let mut indexes: Option<Vec<usize>> = None;
      for (i, layer) in self.layers.iter_mut().enumerate().rev() {
        if layer.is_empty() && dropdown.is_empty() {
          continue;
        }

        for task in dropdown.drain(..) {
          layer.insert(task);
        }

        let index = match indexes
          .get_or_insert_with(|| get_bucket_indexes(current))
          .get(i)
        {
          None => continue,
          Some(index) => *index,
        };

        let tasks = layer.dropdown(index);
        if let Some(tasks) = tasks {
          dropdown = tasks;
        }
      }

      while let Some(layer) = self.layers.last() {
        if !layer.is_empty() {
          break;
        }
        self.layers.pop();
      }

      for mut task in dropdown.drain(..) {
        let id = task.refs().get_id();
        if current != task.refs().get_execute_at() {
          continue;
        }

        if self.tasks.remove(&id).is_none() {
          let _ = task.into_raw();
          continue;
        }

        if let Some(next) = task.refs().next_schedule() {
          task.muts().set_scheduled_at(next);
          self.register_task_ref(task);
          task.refs().execute(&env)?;
          continue;
        }

        self.clear_ref(id);
        task.into_raw().execute(&env)?;
      }
    }

    self.current_tick = now;
    Ok(())
  }
}
