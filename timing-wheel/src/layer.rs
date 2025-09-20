use crate::{constant::LAYER_PER_BUCKET, pointer::UnsafePtr, task::TaskRef};

pub type Bucket = Vec<TaskRef>;

pub struct BucketLayer {
  buckets: [Option<Bucket>; LAYER_PER_BUCKET],
  layer_index: usize,
  size: usize,
}
impl BucketLayer {
  #[inline]
  pub fn new(layer_index: usize) -> Self {
    Self {
      buckets: [const { None }; LAYER_PER_BUCKET],
      layer_index,
      size: 0,
    }
  }

  #[inline]
  pub fn insert(&mut self, task: TaskRef) {
    let bucket = task.borrow().get_bucket_index(self.layer_index);
    self.buckets[bucket].get_or_insert_default().push(task);
    self.size += 1;
  }

  #[inline]
  pub fn is_empty(&self) -> bool {
    self.size == 0
  }

  #[inline]
  pub fn dropdown(&mut self, bucket: usize) -> Option<Bucket> {
    let tasks = self.buckets[bucket].take()?;
    self.size -= tasks.len();
    Some(tasks)
  }
}
impl Drop for BucketLayer {
  #[inline]
  fn drop(&mut self) {
    if self.size == 0 {
      return;
    }

    for task in self.buckets.iter_mut().flat_map(|b| b.take()).flatten() {
      task.drop();
    }
  }
}
