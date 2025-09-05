use std::ops::Index;

use crate::constant::{LAYER_PER_BUCKET_BIT, LAYER_PER_BUCKET_MASK, MAX_LAYER_PER_BUCKET};

pub struct BucketIndexes {
  indexes: [usize; MAX_LAYER_PER_BUCKET],
  len: usize,
}
impl BucketIndexes {
  #[inline]
  pub fn new(scheduled_at: usize) -> Self {
    let mut len = 0;
    let mut current = scheduled_at;
    let mut indexes = [0; MAX_LAYER_PER_BUCKET];
    while current > 0 {
      indexes[len] = current & LAYER_PER_BUCKET_MASK;
      current >>= LAYER_PER_BUCKET_BIT;
      len += 1;
    }
    Self { indexes, len }
  }

  #[inline]
  pub fn len(&self) -> usize {
    self.len
  }

  #[inline]
  pub fn advance(&mut self) {
    for i in self.indexes.iter_mut().take(self.len) {
      if *i < LAYER_PER_BUCKET_MASK {
        *i += 1;
        return;
      }

      *i = 0;
    }

    self.indexes[self.len] = 1;
    self.len += 1;
  }

  #[inline]
  pub fn get(&self, index: usize) -> Option<usize> {
    if index >= self.len {
      return None;
    }

    Some(self.indexes[index])
  }
}

impl Index<usize> for BucketIndexes {
  type Output = usize;

  #[inline]
  fn index(&self, index: usize) -> &Self::Output {
    &self.indexes[index]
  }
}
