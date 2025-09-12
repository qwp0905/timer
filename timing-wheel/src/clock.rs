use std::ops::Index;

use crate::constant::{LAYER_PER_BUCKET_BIT, LAYER_PER_BUCKET_MASK, MAX_LAYER_PER_BUCKET};

pub struct ClockHands {
  hands: [usize; MAX_LAYER_PER_BUCKET],
  len: usize,
  timestamp: usize,
}
impl ClockHands {
  #[inline]
  pub fn new(timestamp: usize) -> Self {
    let mut current = timestamp;
    let mut hands = [0; MAX_LAYER_PER_BUCKET];
    for len in 0..MAX_LAYER_PER_BUCKET {
      if current == 0 {
        return Self {
          hands,
          len,
          timestamp,
        };
      }
      hands[len] = current & LAYER_PER_BUCKET_MASK;
      current >>= LAYER_PER_BUCKET_BIT;
    }

    Self {
      hands,
      len: MAX_LAYER_PER_BUCKET,
      timestamp,
    }
  }

  #[inline]
  pub fn timestamp(&self) -> usize {
    self.timestamp
  }

  #[inline]
  pub fn reset(&mut self) {
    self.len = 0;
    self.hands = [0; MAX_LAYER_PER_BUCKET];
    self.timestamp = 0;
  }

  #[inline]
  pub fn len(&self) -> usize {
    self.len
  }

  #[inline]
  pub fn advance(&mut self) {
    self.timestamp += 1;
    for i in self.hands.iter_mut().take(self.len) {
      if *i < LAYER_PER_BUCKET_MASK {
        *i += 1;
        return;
      }

      *i = 0;
    }

    self.hands[self.len] = 1;
    self.len += 1;
  }

  #[inline]
  pub fn get(&self, index: usize) -> Option<usize> {
    if index >= self.len {
      return None;
    }

    Some(self.hands[index])
  }

  #[inline]
  pub fn is_before(&self, now: usize) -> bool {
    self.timestamp < now
  }
}

impl Index<usize> for ClockHands {
  type Output = usize;

  #[inline]
  fn index(&self, index: usize) -> &Self::Output {
    &self.hands[index]
  }
}
