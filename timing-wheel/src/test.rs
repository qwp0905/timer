use napi::bindgen_prelude::Reference;

use crate::timer::Timer;

#[napi]
#[derive(Debug)]
pub struct TestingTimer {
  started_at: u32,
  tick: u32,
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

  fn now(&self) -> usize {
    (self.started_at + self.tick) as usize
  }
}
