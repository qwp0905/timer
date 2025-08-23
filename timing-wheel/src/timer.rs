use std::time::Instant;

pub trait Timer {
  fn reset(&mut self);
  fn now(&self) -> u32;
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
  fn now(&self) -> u32 {
    self.started_at.elapsed().as_millis() as u32
  }

  fn reset(&mut self) {
    self.started_at = Instant::now();
  }
}
