use std::time::{Duration, Instant};

pub trait Timer {
  fn reset(&mut self);
  fn now(&self) -> usize;
}

pub struct SystemTimer {
  started_at: Instant,
}
impl SystemTimer {
  pub fn new() -> Self {
    Self {
      started_at: Instant::now(),
    }
  }
}
impl Timer for SystemTimer {
  #[inline]
  fn now(&self) -> usize {
    self.started_at.elapsed().as_millis_usize()
  }

  #[inline]
  fn reset(&mut self) {
    self.started_at = Instant::now();
  }
}

pub trait AsMillisUsize {
  fn as_millis_usize(&self) -> usize;
}
impl AsMillisUsize for Duration {
  #[inline]
  fn as_millis_usize(&self) -> usize {
    self.as_secs() as usize * 1000 + self.subsec_millis() as usize
  }
}
