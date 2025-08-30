use crate::{constant::BUCKET_SIZE, task::Task};

pub struct BucketLayer {
  buckets: Vec<Option<Vec<Task>>>,
  layer_index: usize,
  size: usize,
}
impl BucketLayer {
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
  pub fn insert(&mut self, mut task: Task) {
    let bucket = task.get_bucket_index(self.layer_index);
    self.buckets[bucket].get_or_insert_default().push(task);
    self.size += 1;
  }

  pub fn is_empty(&self) -> bool {
    self.size == 0
  }

  pub fn dropdown(&mut self, bucket: usize) -> Option<Vec<Task>> {
    let tasks = self.buckets[bucket].take();
    if let Some(tasks) = tasks.as_ref() {
      self.size -= tasks.len();
    }
    tasks
  }
}
