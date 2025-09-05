use std::{cell::RefCell, rc::Rc};

use napi::{JsNumber, bindgen_prelude::*};

use crate::{TaskId, TestingTimer, TimingWheel, VoidCallback};

#[napi]
pub struct Timeout {
  id: TaskId,
  on_timeout: FunctionRef<Unknown<'static>, Unknown<'static>>,
  wheel_ref: Rc<RefCell<TimingWheel>>,
}
#[napi]
impl Timeout {
  pub fn new(
    id: TaskId,
    on_timeout: FunctionRef<Unknown<'static>, Unknown<'static>>,
    wheel_ref: Rc<RefCell<TimingWheel>>,
  ) -> Self {
    Self {
      id,
      on_timeout,
      wheel_ref,
    }
  }

  #[napi]
  pub fn close(&self) {
    self.wheel_ref.borrow_mut().unregister(self.id)
  }

  #[napi]
  pub fn has_ref(&self) -> bool {
    self.wheel_ref.borrow().has_ref(self.id)
  }

  #[napi(js_name = "ref")]
  pub fn ref_(&self) {
    self.wheel_ref.borrow_mut().set_ref(self.id)
  }

  #[napi]
  pub fn unref(&self) {
    self.wheel_ref.borrow_mut().clear_ref(self.id)
  }

  #[napi]
  pub fn refresh(&self) {
    self.wheel_ref.borrow_mut().refresh(self.id)
  }

  #[napi(js_name = "[Symbol.toPrimitive]")]
  pub fn to_primitive(&self) -> TaskId {
    self.id
  }

  #[napi(js_name = "[Symbol.dispose]")]
  pub fn dispose(&self) {
    self.close()
  }

  #[napi(getter, js_name = "_onTimeout", ts_type = "(...args: any[]): any")]
  pub fn on_timeout<'env>(
    &self,
    env: &'env Env,
  ) -> Result<Function<'env, Unknown<'static>, Unknown<'static>>> {
    self.on_timeout.borrow_back(env)
  }

  #[napi]
  pub fn get_id(&self) -> TaskId {
    self.id
  }
}

#[napi]
pub struct Scheduler {
  wheel: Rc<RefCell<TimingWheel>>,
}
#[napi]
impl Scheduler {
  #[napi(constructor)]
  pub fn new() -> Self {
    Self {
      wheel: Rc::new(RefCell::new(TimingWheel::new())),
    }
  }

  #[napi(factory)]
  pub fn with_testing(test: Reference<TestingTimer>) -> Self {
    Self {
      wheel: Rc::new(RefCell::new(TimingWheel::with_testing(test))),
    }
  }

  #[napi(
    ts_args_type = "delay: number, on_timeout: (...args: any[]) => any, callback: VoidCallback"
  )]
  pub fn set_timeout(
    &self,
    delay: JsNumber,
    on_timeout: FunctionRef<Unknown<'static>, Unknown<'static>>,
    callback: VoidCallback,
  ) -> Result<Timeout> {
    let id = self.wheel.borrow_mut().register(delay, callback, false)?;
    Ok(Timeout::new(id, on_timeout, self.wheel.clone()))
  }

  #[napi(
    ts_args_type = "delay: number, on_timeout: (...args: any[]) => any, callback: VoidCallback"
  )]
  pub fn set_interval(
    &self,
    delay: JsNumber,
    on_timeout: FunctionRef<Unknown<'static>, Unknown<'static>>,
    callback: VoidCallback,
  ) -> Result<Timeout> {
    let id = self.wheel.borrow_mut().register(delay, callback, true)?;
    Ok(Timeout::new(id, on_timeout, self.wheel.clone()))
  }

  #[napi]
  pub fn clear_timeout(&self, id: TaskId) {
    self.wheel.borrow_mut().unregister_task(id);
  }

  #[napi]
  pub fn clear_interval(&self, id: TaskId) {
    self.wheel.borrow_mut().unregister_task(id);
  }

  #[napi]
  pub fn tick(&self, env: Env) -> Result<()> {
    self.wheel.borrow_mut().tick(env)
  }

  #[napi]
  pub fn is_ref_empty(&self) -> bool {
    self.wheel.borrow().is_ref_empty()
  }

  #[napi]
  pub fn is_empty(&self) -> bool {
    self.wheel.borrow().is_empty()
  }
}
