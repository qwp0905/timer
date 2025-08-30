use crossbeam::channel::Sender;

pub trait MustSend<T> {
  fn must_send(&self, msg: T);
}
impl<T> MustSend<T> for Sender<T> {
  fn must_send(&self, msg: T) {
    self.send(msg).unwrap();
  }
}
