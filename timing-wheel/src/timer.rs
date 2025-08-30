use std::{
  thread::{JoinHandle, spawn},
  time::{Duration, Instant},
};

use crossbeam::{
  channel::{Receiver, Sender, bounded, tick, unbounded},
  select,
};

use crate::channel::MustSend;

pub trait Timer {
  fn reset(&mut self);
  fn recv(&mut self) -> &Receiver<usize>;
  fn close(&mut self);
  fn idle(&mut self);
}

pub struct SystemTimer(Option<(JoinHandle<()>, Sender<()>, Receiver<usize>, Sender<()>)>);
impl SystemTimer {
  pub fn new() -> Self {
    Self(None)
  }

  fn bootstrap() -> (JoinHandle<()>, Sender<()>, Receiver<usize>, Sender<()>) {
    let (input, input_recv) = unbounded();
    let (output_tx, output) = unbounded();
    let (idle, idle_recv) = bounded(1);
    let thread = spawn(move || {
      let tick = tick(Duration::from_millis(1));
      while let Ok(_) = input_recv.recv() {
        let started_at = Instant::now();
        loop {
          select! {
            recv(tick) -> t => output_tx.must_send((t.unwrap() - started_at).as_millis() as usize),
            recv(idle_recv) -> _ => break,
          }
        }
      }
    });
    (thread, input, output, idle)
  }
}

impl Timer for SystemTimer {
  fn reset(&mut self) {
    self.0.get_or_insert_with(Self::bootstrap).1.must_send(());
  }

  fn recv(&mut self) -> &Receiver<usize> {
    &self.0.get_or_insert_with(Self::bootstrap).2
  }

  fn close(&mut self) {
    if let Some((thread, input, output, idle)) = self.0.take() {
      drop(input);
      drop(output);
      drop(idle);
      let _ = thread.join();
    }
  }

  fn idle(&mut self) {
    self.0.get_or_insert_with(Self::bootstrap).3.must_send(());
  }
}

// #[napi]
// pub struct TestingTimer {
//   tick: u32,
// }
// #[napi]
// impl TestingTimer {
//   #[napi(constructor)]
//   pub fn new() -> Self {
//     Self { tick: 0 }
//   }

//   #[napi]
//   pub fn advance(&mut self, tick: u32) {
//     self.tick += tick;
//   }
// }
// impl Timer for TestingTimer {
//   fn now(&self) -> usize {
//     self.tick as usize
//   }
//   fn reset(&mut self) {
//     self.tick = 0
//   }
// }
