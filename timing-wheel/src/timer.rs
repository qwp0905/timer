use std::time::Instant;

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
    self.started_at.elapsed().as_millis() as usize
  }

  #[inline]
  fn reset(&mut self) {
    self.started_at = Instant::now();
  }
}
