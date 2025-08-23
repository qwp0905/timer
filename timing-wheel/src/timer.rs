use std::time::SystemTime;

fn now() -> u128 {
  SystemTime::now()
    .duration_since(SystemTime::UNIX_EPOCH)
    .unwrap()
    .as_millis()
}

pub trait Timer {
  fn reset(&mut self);
  fn now(&self) -> u32;
}

pub struct SystemTimer {
  started_at: u128,
}
impl SystemTimer {
  pub fn new() -> Self {
    Self { started_at: now() }
  }
}
impl Timer for SystemTimer {
  fn now(&self) -> u32 {
    (now() - self.started_at) as u32
  }

  fn reset(&mut self) {
    self.started_at = now();
  }
}
