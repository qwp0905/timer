use napi::bindgen_prelude::FunctionRef;

use crate::index::{BucketIndexes, get_bucket_indexes};

#[napi]
pub type VoidCallback = FunctionRef<(), ()>;

#[napi]
pub type TaskId = u32;

pub struct Task {
  id: TaskId,
  scheduled_at: usize,
  indexes: Option<BucketIndexes>,
}
impl Task {
  pub fn new(id: TaskId, scheduled_at: usize) -> Self {
    Self {
      id,
      scheduled_at,
      indexes: None,
    }
  }

  #[inline]
  pub fn get_id(&self) -> TaskId {
    self.id
  }

  #[inline]
  pub fn get_bucket_index(&mut self, layer_index: usize) -> usize {
    self.indexes()[layer_index]
  }

  pub fn layer_size(&mut self) -> usize {
    self.indexes().len()
  }

  fn indexes(&mut self) -> &BucketIndexes {
    self
      .indexes
      .get_or_insert_with(|| get_bucket_indexes(self.scheduled_at))
  }
}
