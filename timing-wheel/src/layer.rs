use crate::{
  constant::BUCKET_SIZE,
  pointer::{Pointer, TaskRef},
};

pub struct BucketLayer {
  buckets: Vec<Option<Vec<TaskRef>>>,
  layer_index: usize,
  size: usize,
}
impl BucketLayer {
  #[inline]
  pub fn new(layer_index: usize) -> Self {
    let mut buckets = Vec::new();
    buckets.resize_with(BUCKET_SIZE, || None);
    Self {
      buckets,
      layer_index,
      size: 0,
    }
  }

  #[inline]
  pub fn insert(&mut self, task: TaskRef) {
    let bucket = task.refs().get_bucket_index(self.layer_index);
    self.buckets[bucket].get_or_insert_default().push(task);
    self.size += 1;
  }

  #[inline]
  pub fn is_empty(&self) -> bool {
    self.size == 0
  }

  #[inline]
  pub fn dropdown(&mut self, bucket: usize) -> Option<Vec<TaskRef>> {
    let tasks = match self.buckets[bucket].take() {
      Some(t) => t,
      None => return None,
    };
    self.size -= tasks.len();
    Some(tasks)
  }
}
impl Drop for BucketLayer {
  fn drop(&mut self) {
    if self.size == 0 {
      return;
    }
    for bucket in self.buckets.iter_mut() {
      let tasks = match bucket.take() {
        Some(tasks) => tasks,
        None => continue,
      };
      for task in tasks {
        let _ = task.into_raw();
      }
    }
  }
}
