use std::ptr::NonNull;

use crate::task::Task;

pub trait Pointer<T> {
  fn borrow(&self) -> &T;
  fn borrow_mut(&mut self) -> &mut T;
  fn deref(self) -> T;
}
impl<T> Pointer<T> for NonNull<T> {
  #[inline]
  fn borrow(&self) -> &T {
    unsafe { self.as_ref() }
  }

  #[inline]
  fn borrow_mut(&mut self) -> &mut T {
    unsafe { self.as_mut() }
  }

  #[inline]
  fn deref(self) -> T {
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
