use crossbeam::{
  channel::{Receiver, Sender},
  select,
};

use crate::{
  channel::MustSend,
  constant::MAX_BUCKET_INDEX,
  index::{BucketIndexes, get_bucket_indexes},
  layer::BucketLayer,
  task::{Task, TaskId},
  timer::Timer,
};

pub enum Message {
  New(TaskId, usize),
  Idle,
}

pub struct TimingWheel {
  layers: Vec<BucketLayer>,
  timer: Box<dyn Timer>,
  executor: Sender<Task>,
  input_recv: Receiver<Message>,
  current_tick: usize,
  count: usize,
}
impl TimingWheel {
  pub fn new(timer: Box<dyn Timer>, executor: Sender<Task>, input_recv: Receiver<Message>) -> Self {
    Self {
      layers: Vec::with_capacity(MAX_BUCKET_INDEX),
      timer,
      executor,
      input_recv,
      current_tick: 0,
      count: 0,
    }
  }

  #[inline]
  fn idle(&mut self) {
    self.timer.idle();
    self.layers.clear();
  }

  #[inline]
  fn tick(&mut self, now: usize) {
    let mut dropdown: Option<Vec<Task>> = None;

    for current in (self.current_tick + 1)..=now {
      let mut indexes: Option<BucketIndexes> = None;

      for (i, layer) in self.layers.iter_mut().enumerate().rev() {
        match dropdown.take() {
          Some(tasks) => tasks.into_iter().for_each(|task| layer.insert(task)),
          None if layer.is_empty() => continue,
          None => {}
        }

        let index = match indexes
          .get_or_insert_with(|| get_bucket_indexes(current))
          .get(i)
        {
          None => continue,
          Some(index) => *index,
        };

        dropdown = layer.dropdown(index);
      }

      self.reduce_layers();

      if let Some(tasks) = dropdown.take() {
        self.execute_tasks(tasks);
      }
    }

    self.current_tick = now;
  }

  pub fn start_loop(&mut self) {
    self.current_tick = 0;
    self.timer.reset();
    loop {
      select! {
        recv(self.input_recv) -> msg => {
          match msg {
            Ok(Message::New(id, delay)) => self.register_new(id, delay),
            Ok(Message::Idle) => return self.idle(),
            Err(_) => return self.timer.close(),
          };
        }
        recv(self.timer.recv()) -> now => self.tick(now.unwrap()),
      };
    }
  }

  #[inline]
  fn register_new(&mut self, id: TaskId, delay: usize) {
    let task = Task::new(id, self.current_tick + delay);
    self.register_task(task);
  }

  #[inline]
  fn register_task(&mut self, mut task: Task) {
    let layer_size = task.layer_size();
    while self.layers.len() < layer_size {
      self.layers.push(BucketLayer::new(self.layers.len()));
    }

    self.layers[layer_size - 1].insert(task);
    self.count += 1;
  }

  #[inline]
  fn reduce_layers(&mut self) {
    while let Some(true) = self.layers.last().map(|l| l.is_empty()) {
      self.layers.pop();
    }
  }

  #[inline]
  fn execute_tasks(&mut self, tasks: Vec<Task>) {
    self.count -= tasks.len();
    for task in tasks {
      self.executor.must_send(task);
    }
  }
}
