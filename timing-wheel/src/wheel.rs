use std::{
  collections::{HashMap, HashSet},
  ptr::NonNull,
  time::SystemTime,
};

use napi::{Env, Result, bindgen_prelude::Function};

use crate::{
  layer::BucketLayer,
  pointer::Pointer,
  task::{Task, get_bucket_indexes},
};

#[napi]
pub struct TimingWheel {
  refs: HashSet<u32>,
  tasks: HashMap<u32, NonNull<Task>>,
  layers: Vec<BucketLayer>,
  started_at: u128,
  current_tick: u32,
}

#[napi]
impl TimingWheel {
  #[napi(constructor)]
  pub fn new() -> Self {
    Self {
      tasks: Default::default(),
      refs: Default::default(),
      layers: Vec::new(),
      started_at: now(),
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
    if self.tasks.is_empty() {
      self.started_at = now();
      self.current_tick = 0;
    }

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
    let now = self.get_now();
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
    callback: Function<(), ()>,
    is_interval: bool,
  ) -> Result<()> {
    if self.tasks.is_empty() {
      self.started_at = now();
      self.current_tick = 0;
    }

    let task = Task::new(
      id,
      self.get_now(),
      delay.max(1),
      callback.create_ref()?,
      is_interval,
    );
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
    let now = self.get_now();
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

      for task in dropdown.drain(..) {
        let id = task.refs().get_id();
        if current != task.refs().get_execute_at() {
          continue;
        }

        let mut task = task.into_raw();
        self.clear_ref(id);
        if self.tasks.remove(&id).is_none() {
          continue;
        }

        task.execute(&env)?;
        if !task.is_interval() {
          continue;
        }

        task.set_scheduled_at(current + 1);
        self.register_task(task);
      }
    }

    self.current_tick = now;
    Ok(())
  }

  #[inline]
  pub fn get_now(&self) -> u32 {
    (now() - self.started_at) as u32
  }
}

fn now() -> u128 {
  SystemTime::now()
    .duration_since(SystemTime::UNIX_EPOCH)
    .unwrap()
    .as_millis()
}
