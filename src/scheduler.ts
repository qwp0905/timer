import { BucketLayer } from "./layers"
import { IntervalTask, TimeoutTask } from "./task"
import { convertToIndex } from "./utils"

export class TaskScheduler {
  private readonly layers: BucketLayer[] = []
  private started = Date.now()
  private currentTick: number = this.getNow()
  private refedCount = 0
  private lastId = 0

  private get count() {
    if (this.layers.length === 0) {
      return 0
    }
    return this.layers.reduce((acc, layer) => acc + layer.length, 0)
  }

  private getNow() {
    return Date.now() - this.started
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
    if (this.layers.length === 0) {
      return
    }
    if (this.refedCount > 0) {
      return
    }

    immediate.unref()
  }

  private createTimeoutTask(callback: () => any, delay: number, args: any[]): TimeoutTask {
    // const ref = new WeakRef(this)
    return new TimeoutTask({
      id: this.lastId++,
      _onTimeout: callback,
      args,
      delay,
      scheduledAt: this.getNow(),
      beforeRef: (task) => this.beforeRef(task),
      beforeUnref: (task) => this.beforeUnref(task),
      register: (task) => this.registerTask(task),
      unregister: (task) => this.unregisterTask(task),
      getNow: () => this.getNow()
    })
  }
  private createIntervalTask(callback: () => any, interval: number, args: any[]) {
    // const ref = new WeakRef(this)
    return new IntervalTask({
      id: this.lastId++,
      _onTimeout: callback,
      args,
      delay: interval,
      scheduledAt: this.getNow(),
      beforeRef: (task) => this.beforeRef(task),
      beforeUnref: (task) => this.beforeUnref(task),
      register: (task) => this.registerTask(task),
      unregister: (task) => this.unregisterTask(task),
      getNow: () => this.getNow()
    })
  }

  private beforeRef(task: TimeoutTask) {
    if (task.hasRef()) {
      return
    }
    this.refedCount += 1
  }
  private beforeUnref(task: TimeoutTask) {
    if (!task.hasRef()) {
      return
    }
    this.refedCount -= 1
  }

  private registerTask(task: TimeoutTask) {
    this.refedCount += task.refCount()

    const index = task.getMaxLayer()
    while (this.layers.length <= index) {
      this.layers.push(new BucketLayer(this.layers.length))
    }
    this.layers[index].insert(task)
  }
  private unregisterTask(task: TimeoutTask) {
    for (let i = 0; i < this.layers.length; i += 1) {
      const layer = this.layers[i]
      if (!layer.remove(task)) {
        continue
      }
      this.refedCount -= task.refCount()
      return
    }
  }

  private init() {
    if (this.count > 0) {
      return
    }
    this.started = Date.now()
    this.currentTick = this.getNow()
    this.recursiveInit()
  }

  setTimeout(callback: (...args: any[]) => any, delay: number = 1, ...args: any[]): TimeoutTask {
    this.init()
    const task = this.createTimeoutTask(callback, delay, args)
    this.registerTask(task)
    return task
  }
  setInterval(callback: (...args: any[]) => any, delay: number = 1, ...args: any[]): IntervalTask {
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
    let dropdown = new Set<TimeoutTask>()
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
        task.execute()
        this.refedCount -= task.refCount()
        task.afterTaskRun()
      }
      dropdown.clear()
    }
  }
}
