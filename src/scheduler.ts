import { BucketLayer } from "./layers"
import { IntervalTask, ITask, TimeoutTask } from "./task"
import { convertToIndex } from "./utils"

interface ICallback<TArgs extends any[] = any[], TResult = any> {
  (...args: TArgs): TResult
}

export class TaskScheduler {
  private readonly layers: BucketLayer[] = []
  private readonly tasks = new Set<ITask>()
  private started = Date.now()
  private readonly getNow = () => Date.now() - this.started
  private currentTick: number = this.getNow()
  private refedCount = 0
  private lastId = 0

  private get count() {
    return this.tasks.size
  }

  private perEventLoop = () => {
    this.tick()
    if (this.count === 0) {
      return
    }
    this.recursiveInit()
  }
  private recursiveInit() {
    const immediate = setImmediate(this.perEventLoop)
    if (this.count === 0) {
      return
    }
    if (this.refedCount > 0) {
      return
    }

    immediate.unref()
  }

  private createTimeoutTask<T extends any[] = [], R = any>(
    callback: ICallback<T, R>,
    delay: number,
    args: T
  ): TimeoutTask<T, R> {
    return new TimeoutTask({
      id: this.lastId++,
      _onTimeout: callback,
      args,
      delay,
      beforeRef: this.beforeRef,
      beforeUnref: this.beforeUnref,
      register: this.registerTask,
      unregister: this.unregisterTask,
      getNow: this.getNow
    })
  }
  private createIntervalTask<T extends any[] = [], R = any>(
    callback: ICallback<T, R>,
    interval: number,
    args: T
  ): IntervalTask<T, R> {
    return new IntervalTask({
      id: this.lastId++,
      _onTimeout: callback,
      args,
      delay: interval,
      beforeRef: this.beforeRef,
      beforeUnref: this.beforeUnref,
      register: this.registerTask,
      unregister: this.unregisterTask,
      getNow: this.getNow
    })
  }

  private readonly beforeRef = (task: TimeoutTask) => {
    if (task.hasRef()) {
      return
    }
    this.refedCount += 1
  }
  private readonly beforeUnref = (task: TimeoutTask) => {
    if (!task.hasRef()) {
      return
    }
    this.refedCount -= 1
  }

  private readonly registerTask = (task: ITask) => {
    const index = task.getMaxLayer()
    while (this.layers.length <= index) {
      this.layers.push(new BucketLayer(this.layers.length))
    }
    this.layers[index].insert(task)
    if (!this.tasks.add(task)) {
      return
    }
    this.refedCount += task.refCount()
  }
  private readonly unregisterTask = (task: ITask) => {
    if (!this.tasks.delete(task)) {
      return
    }
    this.refedCount -= task.refCount()
  }

  private init() {
    if (this.count > 0) {
      return
    }
    this.started = Date.now()
    this.currentTick = this.getNow()
    this.recursiveInit()
  }

  setTimeout<T extends any[] = [], R = any>(
    callback: ICallback<T, R>,
    delay: number = 1,
    ...args: T
  ): TimeoutTask<T, R> {
    this.init()
    const task = this.createTimeoutTask(callback, delay, args)
    this.registerTask(task)
    return task
  }
  setInterval<T extends any[] = [], R = any>(
    callback: ICallback<T, R>,
    delay: number = 1,
    ...args: T
  ): IntervalTask<T, R> {
    this.init()
    const task = this.createIntervalTask(callback, delay, args)
    this.registerTask(task)
    return task
  }

  clearTimeout(task: TimeoutTask) {
    task.close()
  }
  clearInterval(task: IntervalTask) {
    task.close()
  }

  private tick() {
    const now = this.getNow()
    let dropdown = new Set<ITask>()
    while (now > this.currentTick) {
      const current = this.currentTick + 1
      const indexes = convertToIndex(current)

      layerLoop: for (let i = this.layers.length - 1; i >= 0; i -= 1) {
        const layer = this.layers[i]
        for (const task of dropdown) {
          layer.insert(task)
        }

        const index = indexes.at(i)!
        const tasks = layer.dropdown(index)
        if (!tasks) {
          dropdown.clear()
          continue layerLoop
        }

        dropdown = tasks
      }

      while (this.layers.at(-1)?.length === 0) {
        this.layers.pop()
      }

      this.currentTick = current

      for (const task of dropdown) {
        if (!this.tasks.has(task)) {
          continue
        }
        if (task.getExecutionTime() !== current) {
          continue
        }
        task.execute()
        this.unregisterTask(task)
        task.afterTaskRun()
      }
      dropdown.clear()
    }
  }
}
