use crate::constant::{BUCKET_COUNT_BIT, BUCKET_MASK, MAX_BUCKET_COUNT};

pub struct BucketIndexes {
  indexes: [usize; MAX_BUCKET_COUNT],
  len: usize,
}
impl BucketIndexes {
  #[inline]
  pub fn new(scheduled_at: usize) -> Self {
    let mut len = 0;
    let mut current = scheduled_at;
    let mut indexes = [0; MAX_BUCKET_COUNT];
    while current > 0 {
      indexes[len] = current & BUCKET_MASK;
      current >>= BUCKET_COUNT_BIT;
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
    for i in 0..self.len {
      if self.indexes[i] < BUCKET_MASK {
        self.indexes[i] += 1;
        return;
      }

      self.indexes[i] = 0;
    }

    self.indexes[self.len] = 1;
    self.len += 1;
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
