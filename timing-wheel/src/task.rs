use napi::{Env, Result, bindgen_prelude::FunctionRef};

use crate::constant::{BUCKET_MASK, BUCKET_SIZE_BIT};

#[napi]
pub type VoidCallback = FunctionRef<(), ()>;

pub struct Task {
  id: u32,
  scheduled_at: usize,
  delay: usize,
  indexes: Vec<usize>,
  callback: VoidCallback,
  is_interval: bool,
  refed: bool,
}
impl Task {
  pub fn new(
    id: u32,
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

  pub fn get_id(&self) -> u32 {
    self.id
  }

  pub fn get_execute_at(&self) -> usize {
    self.scheduled_at + self.delay
  }

  pub fn get_bucket_index(&self, layer_index: usize) -> usize {
    self.indexes[layer_index]
  }

  pub fn layer_size(&self) -> usize {
    self.indexes.len()
  }

  pub fn execute(&self, env: &Env) -> Result<()> {
    self.callback.borrow_back(env)?.call(())
  }

  pub fn is_interval(&self) -> bool {
    self.is_interval
  }

  pub fn set_scheduled_at(&mut self, scheduled_at: usize) {
    self.scheduled_at = scheduled_at;
    self.indexes = get_bucket_indexes(scheduled_at + self.delay);
  }

  pub fn has_ref(&self) -> bool {
    self.refed
  }

  pub fn set_ref(&mut self) {
    self.refed = true
  }

  pub fn clear_ref(&mut self) {
    self.refed = false
  }
}

#[inline]
pub fn get_bucket_indexes(scheduled_at: usize) -> Vec<usize> {
  let mut indexes = Vec::new();
  let mut current = scheduled_at;
  while current > 0 {
    indexes.push(current & BUCKET_MASK);
    current >>= BUCKET_SIZE_BIT;
  }
  indexes
}
