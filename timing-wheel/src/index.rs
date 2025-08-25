use crate::constant::{BUCKET_MASK, BUCKET_SIZE_BIT, MAX_BUCKET_INDEX};

pub type BucketIndexes = Vec<usize>;

#[inline]
pub fn get_bucket_indexes(scheduled_at: usize) -> Vec<usize> {
  let mut indexes = Vec::with_capacity(MAX_BUCKET_INDEX);
  let mut current = scheduled_at;
  while current > 0 {
    indexes.push(current & BUCKET_MASK);
    current >>= BUCKET_SIZE_BIT;
  }
  indexes
}
