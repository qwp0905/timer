#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

mod clock;
mod constant;
mod layer;
mod pointer;
mod pool;
mod task;
mod test;
mod timer;
mod wheel;

pub use task::{TaskId, VoidCallback};
pub use test::*;
pub use wheel::TimingWheel;
