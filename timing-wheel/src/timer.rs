use std::time::Instant;

use napi::bindgen_prelude::Reference;

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

#[napi]
#[derive(Debug)]
pub struct TestingTimer {
  pub started_at: u32,
  pub tick: u32,
}
#[napi]
impl TestingTimer {
  #[napi(constructor)]
  pub fn new() -> Self {
    Self {
      started_at: 0,
      tick: 0,
    }
  }

  #[napi]
  pub fn advance(&mut self, tick: u32) {
    self.tick += tick;
  }
}
impl Timer for Reference<TestingTimer> {
  fn reset(&mut self) {
    self.started_at = 0;
    self.tick = 0;
  }

  fn now(&self) -> u32 {
    self.started_at + self.tick
  }
}
