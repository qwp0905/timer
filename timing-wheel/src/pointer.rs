use std::ptr::NonNull;

pub trait UnsafePtr<T> {
  fn borrow(&self) -> &T;
  fn borrow_mut(&mut self) -> &mut T;
  fn deref(self) -> T;
}
impl<T> UnsafePtr<T> for NonNull<T> {
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

pub trait IntoUnsafePtr<T> {
  fn create_ptr(self) -> NonNull<T>;
}
impl<T> IntoUnsafePtr<T> for T {
  #[inline]
  fn create_ptr(self) -> NonNull<T> {
    NonNull::from(Box::leak(Box::new(self)))
  }
}
