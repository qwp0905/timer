use std::ptr::NonNull;

use crate::task::Task;

pub trait Pointer<T> {
  fn refs(&self) -> &T;
  fn muts(&mut self) -> &mut T;
  fn into_raw(self) -> T;
}
impl<T> Pointer<T> for NonNull<T> {
  #[inline]
  fn refs(&self) -> &T {
    unsafe { self.as_ref() }
  }

  #[inline]
  fn muts(&mut self) -> &mut T {
    unsafe { self.as_mut() }
  }

  #[inline]
  fn into_raw(self) -> T {
    *unsafe { Box::from_raw(self.as_ptr()) }
  }
}

pub trait IntoPointer<T> {
  fn create_ptr(self) -> NonNull<T>;
}
impl<T> IntoPointer<T> for T {
  #[inline]
  fn create_ptr(self) -> NonNull<T> {
    NonNull::from(Box::leak(Box::new(self)))
  }
}

pub type TaskRef = NonNull<Task>;
