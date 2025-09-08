use std::ptr::NonNull;

use napi::{Env, Result, bindgen_prelude::FunctionRef};

use crate::index::BucketIndexes;

#[napi]
pub type VoidCallback = FunctionRef<(), ()>;

#[napi]
pub type TaskId = u32;

pub struct Task {
  id: TaskId,
  execute_at: usize,
  delay: usize,
  indexes: BucketIndexes,
  callback: VoidCallback,
  is_interval: bool,
  refed: bool,
}
impl Task {
  #[inline]
  pub fn new(
    id: TaskId,
    scheduled_at: usize,
    delay: usize,
    callback: VoidCallback,
    is_interval: bool,
  ) -> Self {
    let execute_at = scheduled_at + delay;
    Self {
      id,
      execute_at,
      delay,
      indexes: BucketIndexes::new(execute_at),
      callback,
      is_interval,
      refed: true,
    }
  }

  #[inline]
  pub fn get_id(&self) -> TaskId {
    self.id
  }

  #[inline]
  pub fn get_execute_at(&self) -> usize {
    self.execute_at
  }

  #[inline]
  pub fn get_bucket_index(&self, layer_index: usize) -> usize {
    self.indexes[layer_index]
  }

  #[inline]
  pub fn layer_size(&self) -> usize {
    self.indexes.len()
  }

  #[inline]
  pub fn execute(&self, env: &Env) -> Result<()> {
    self.callback.borrow_back(env)?.call(())
  }

  #[inline]
  pub fn is_interval(&self) -> bool {
    self.is_interval
  }

  #[inline]
  pub fn set_scheduled_at(&mut self, scheduled_at: usize) {
    self.execute_at = scheduled_at + self.delay;
    self.indexes = BucketIndexes::new(self.execute_at);
  }

  #[inline]
  pub fn has_ref(&self) -> bool {
    self.refed
  }

  #[inline]
  pub fn set_ref(&mut self) {
    self.refed = true
  }

  #[inline]
  pub fn clear_ref(&mut self) {
    self.refed = false
  }
}

pub type TaskRef = NonNull<Task>;
