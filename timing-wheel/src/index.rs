use crate::constant::{BUCKET_MASK, BUCKET_SIZE_BIT, MAX_BUCKET_INDEX};

pub struct BucketIndexes {
  indexes: [usize; MAX_BUCKET_INDEX],
  len: usize,
}
impl BucketIndexes {
  #[inline]
  pub fn new(scheduled_at: usize) -> Self {
    let mut len = 0;
    let mut current = scheduled_at;
    let mut indexes = [0; MAX_BUCKET_INDEX];
    while current > 0 {
      indexes[len] = current & BUCKET_MASK;
      current >>= BUCKET_SIZE_BIT;
      len += 1;
    }
    Self { indexes, len }
  }

  #[inline]
  pub fn len(&self) -> usize {
    self.len
  }

  #[inline]
  pub fn get(&self, index: usize) -> Option<&usize> {
    if index >= self.len {
      return None;
    }
    Some(&self.indexes[index])
  }
}

impl std::ops::Index<usize> for BucketIndexes {
  type Output = usize;

  #[inline]
  fn index(&self, index: usize) -> &Self::Output {
    &self.indexes[index]
  }
}
