use std::{
  ops::{Index, IndexMut},
  ptr::NonNull,
  slice::IterMut,
};

use crate::{
  constant::MAX_LAYER_PER_BUCKET,
  pointer::{IntoUnsafePtr, UnsafePtr},
};

pub struct Buffer {
  data: [usize; MAX_LAYER_PER_BUCKET],
  store: NonNull<BufferStore>,
}
impl Buffer {
  #[inline]
  fn with(store: NonNull<BufferStore>, data: [usize; MAX_LAYER_PER_BUCKET]) -> Self {
    Self { data, store }
  }

  #[inline]
  fn new(store: NonNull<BufferStore>) -> Self {
    Self::with(store, [0; MAX_LAYER_PER_BUCKET])
  }

  #[inline]
  pub fn iter_mut(&mut self) -> IterMut<usize> {
    self.data.iter_mut()
  }
}
impl Drop for Buffer {
  #[inline]
  fn drop(&mut self) {
    let buf = self.store.borrow_mut();
    if buf.is_full() {
      return;
    }
    buf.data.push(self.data);
  }
}
impl Index<usize> for Buffer {
  type Output = usize;

  #[inline]
  fn index(&self, index: usize) -> &Self::Output {
    &self.data[index]
  }
}
impl IndexMut<usize> for Buffer {
  #[inline]
  fn index_mut(&mut self, index: usize) -> &mut Self::Output {
    &mut self.data[index]
  }
}

pub struct BufferPool {
  buffers: NonNull<BufferStore>,
}
impl BufferPool {
  #[inline]
  pub fn new(cap: usize) -> Self {
    Self {
      buffers: BufferStore::new(cap).create_ptr(),
    }
  }

  #[inline]
  pub fn acquire(&mut self) -> Buffer {
    match self.buffers.borrow_mut().data.pop() {
      Some(data) => Buffer::with(self.buffers, data),
      None => Buffer::new(self.buffers),
    }
  }
}
impl Drop for BufferPool {
  #[inline]
  fn drop(&mut self) {
    let _ = self.buffers.deref();
  }
}

struct BufferStore {
  data: Vec<[usize; MAX_LAYER_PER_BUCKET]>,
  cap: usize,
}
impl BufferStore {
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
