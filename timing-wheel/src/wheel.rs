use std::{collections::HashMap, ptr::NonNull};

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
  tasks: HashMap<u32, NonNull<Task>>,
  layers: Vec<BucketLayer>,
  timer: Box<dyn Timer>,
  current_tick: usize,
  ref_count: usize,
  last_id: u32,
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
      layers: Vec::new(),
      timer: Box::new(timer),
      current_tick: 0,
      ref_count: 0,
      last_id: 0,
    }
  }

  #[napi]
  pub fn set_ref(&mut self, id: u32) {
    let task = match self.tasks.get_mut(&id) {
      Some(task) => task.muts(),
      None => return,
    };
    if task.has_ref() {
      return;
    }

    task.set_ref();
    self.ref_count += 1;
  }
  #[napi]
  pub fn clear_ref(&mut self, id: u32) {
    let task = match self.tasks.get_mut(&id) {
      Some(task) => task.muts(),
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
  pub fn has_ref(&self, id: u32) -> bool {
    match self.tasks.get(&id) {
      Some(task) => task.refs().has_ref(),
      None => false,
    }
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
    if self.tasks.insert(id, task).is_none() && task_ref.has_ref() {
      self.ref_count += 1
    };
    self.layers[layer_size - 1].insert(task);
  }

  #[napi]
  pub fn refresh(&mut self, id: u32) {
    let now = self.timer.now();
    let mut task = match self.tasks.get_mut(&id) {
      Some(task) => task.clone(),
      None => return,
    };
    task.muts().set_scheduled_at(now);
    self.register_task_ref(task);
  }

  #[napi]
  pub fn register(&mut self, delay: u32, callback: VoidCallback, is_interval: bool) -> Result<u32> {
    if self.tasks.is_empty() {
      self.timer.reset();
      self.current_tick = 0;
    }
    let id = self.last_id;
    self.last_id += 1;

    let task = Task::new(id, self.timer.now(), delay as usize, callback, is_interval);
    self.register_task(task);
    Ok(id)
  }

  #[napi]
  pub fn unregister(&mut self, id: u32) {
    self.unregister_task(id);
  }

  #[inline]
  fn unregister_task(&mut self, id: u32) -> bool {
    let task = match self.tasks.remove(&id) {
      Some(task) => task,
      None => return false,
    };
    if !task.refs().has_ref() {
      return true;
    }
    self.ref_count -= 1;
    true
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
        let task_ref = task.refs();
        let id = task_ref.get_id();
        if current != task_ref.get_execute_at() {
          continue;
        }

        if !self.unregister_task(id) {
          let _ = task.into_raw();
          continue;
        }

        if !task_ref.is_interval() {
          task.into_raw().execute(&env)?;
          continue;
        }

        task.muts().set_scheduled_at(current);
        self.register_task_ref(task);
        task.refs().execute(&env)?;
      }
    }

    self.current_tick = now;
    Ok(())
  }
}
