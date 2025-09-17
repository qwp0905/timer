use std::{
  mem::ManuallyDrop,
  ops::{Index, IndexMut},
  ptr::NonNull,
  slice::IterMut,
};

use crate::{
  constant::MAX_LAYER_PER_BUCKET,
  pointer::{IntoUnsafePtr, UnsafePtr},
};

type VectorData = [usize; MAX_LAYER_PER_BUCKET];

pub struct ClockVector {
  data: ManuallyDrop<VectorData>,
  store: NonNull<VectorStore>,
}
impl ClockVector {
  #[inline]
  fn with(store: NonNull<VectorStore>, data: VectorData) -> Self {
    Self {
      data: ManuallyDrop::new(data),
      store,
    }
  }

  #[inline]
  fn new(store: NonNull<VectorStore>) -> Self {
    Self::with(store, [0; MAX_LAYER_PER_BUCKET])
  }

  #[inline]
  pub fn iter_mut(&mut self) -> IterMut<usize> {
    self.data.iter_mut()
  }
}
impl Drop for ClockVector {
  #[inline]
  fn drop(&mut self) {
    let buf = self.store.borrow_mut();
    unsafe {
      if buf.is_full() {
        ManuallyDrop::drop(&mut self.data);
        return;
      }
      buf.data.push(ManuallyDrop::take(&mut self.data));
    }
  }
}
impl Index<usize> for ClockVector {
  type Output = usize;

  #[inline]
  fn index(&self, index: usize) -> &Self::Output {
    &self.data[index]
  }
}
impl IndexMut<usize> for ClockVector {
  #[inline]
  fn index_mut(&mut self, index: usize) -> &mut Self::Output {
    &mut self.data[index]
  }
}

pub struct VectorPool {
  buffers: NonNull<VectorStore>,
}
impl VectorPool {
  #[inline]
  pub fn new(cap: usize) -> Self {
    Self {
      buffers: VectorStore::new(cap).create_ptr(),
    }
  }

  #[inline]
  pub fn acquire(&mut self) -> ClockVector {
    match self.buffers.borrow_mut().data.pop() {
      Some(data) => ClockVector::with(self.buffers, data),
      None => ClockVector::new(self.buffers),
    }
  }
}
impl Drop for VectorPool {
  #[inline]
  fn drop(&mut self) {
    let _ = self.buffers.deref();
  }
}

struct VectorStore {
  data: Vec<VectorData>,
  cap: usize,
}
impl VectorStore {
  fn new(cap: usize) -> Self {
    Self {
      data: Vec::with_capacity(cap),
      cap,
    }
  }

  fn is_full(&self) -> bool {
    self.data.len() >= self.cap
  }
}
