use std::ptr::NonNull;

pub trait UnsafePtr<T> {
  fn borrow(&self) -> &T;
  fn borrow_mut(&mut self) -> &mut T;
  fn drop(self);
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
  fn drop(self) {
    unsafe { self.drop_in_place() };
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
