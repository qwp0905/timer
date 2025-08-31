use napi::{Env, Result, bindgen_prelude::FunctionRef};

use crate::index::{BucketIndexes, get_bucket_indexes};

#[napi]
pub type VoidCallback = FunctionRef<(), ()>;

#[napi]
pub type TaskId = u32;

pub struct Task {
  id: TaskId,
  scheduled_at: usize,
  delay: usize,
  indexes: BucketIndexes,
  callback: VoidCallback,
  is_interval: bool,
  refed: bool,
}
impl Task {
  pub fn new(
    id: TaskId,
    scheduled_at: usize,
    delay: usize,
    callback: VoidCallback,
    is_interval: bool,
  ) -> Self {
    Self {
      id,
      scheduled_at,
      delay,
      indexes: get_bucket_indexes(scheduled_at + delay),
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
    self.scheduled_at + self.delay
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
    self.scheduled_at = scheduled_at;
    self.indexes = get_bucket_indexes(scheduled_at + self.delay);
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
