use std::ops::Index;

use crate::constant::{LAYER_PER_BUCKET_BIT, LAYER_PER_BUCKET_MASK, MAX_LAYER_PER_BUCKET};

#[inline]
fn init_hands(hands: &mut [usize; MAX_LAYER_PER_BUCKET], timestamp: usize) -> usize {
  let mut current = timestamp;
  for len in 0..MAX_LAYER_PER_BUCKET {
    if current == 0 {
      return len;
    }
    hands[len] = current & LAYER_PER_BUCKET_MASK;
    current >>= LAYER_PER_BUCKET_BIT;
  }
  MAX_LAYER_PER_BUCKET
}

pub struct ClockHands {
  hands: [usize; MAX_LAYER_PER_BUCKET],
  len: usize,
  timestamp: usize,
}
impl ClockHands {
  #[inline]
  pub fn new(timestamp: usize) -> Self {
    let mut hands = [0; MAX_LAYER_PER_BUCKET];
    let len = init_hands(&mut hands, timestamp);
    Self {
      hands,
      len,
      timestamp,
    }
  }

  #[inline]
  pub fn set_timestamp(&mut self, timestamp: usize) {
    self.timestamp = timestamp;
    self.len = init_hands(&mut self.hands, timestamp);
  }

  #[inline]
  pub fn timestamp(&self) -> usize {
    self.timestamp
  }

  #[inline]
  pub fn reset(&mut self) {
    self.len = 0;
    self.timestamp = 0;
  }

  #[inline]
  pub fn len(&self) -> usize {
    self.len
  }

  #[inline]
  pub fn advance_until(&mut self, timestamp: usize) -> bool {
    if self.timestamp >= timestamp {
      return false;
    }

    self.timestamp += 1;
    for i in self.hands.iter_mut().take(self.len) {
      if *i < LAYER_PER_BUCKET_MASK {
        *i += 1;
        return true;
      }

      *i = 0;
    }

    self.hands[self.len] = 1;
    self.len += 1;
    true
  }

  #[inline]
  pub fn get(&self, index: usize) -> Option<usize> {
    if index >= self.len {
      return None;
    }

    Some(self.hands[index])
  }
}

impl Index<usize> for ClockHands {
  type Output = usize;

  #[inline]
  fn index(&self, index: usize) -> &Self::Output {
    &self.hands[index]
  }
}
