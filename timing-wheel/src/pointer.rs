use std::ptr::NonNull;

use crate::task::Task;

pub trait Pointer<T> {
  fn from_box(v: T) -> Self;
  fn refs(&self) -> &T;
  fn muts(&mut self) -> &mut T;
  fn into_raw(self) -> T;
}
impl<T> Pointer<T> for NonNull<T> {
  fn from_box(v: T) -> Self {
    NonNull::from(Box::leak(Box::new(v)))
  }

  fn refs(&self) -> &T {
    unsafe { self.as_ref() }
  }

  fn muts(&mut self) -> &mut T {
    unsafe { self.as_mut() }
  }

  fn into_raw(self) -> T {
    *unsafe { Box::from_raw(self.as_ptr()) }
  }
}

pub type TaskRef = NonNull<Task>;
