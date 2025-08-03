import { BucketLayer } from "./layers"
import { IntervalTask, TimeoutTask } from "./task"
import { convertToIndex } from "./utils"

export class TimingWheel {
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
    if (this.refedCount > 0) {
      return
    }

    immediate.unref()
  }

  private createTimeoutTask(callback: () => any, delay: number, args: any[]): TimeoutTask {
    const ref = new WeakRef(this)
    return new TimeoutTask({
      id: this.lastId++,
      _onTimeout: callback,
      args,
      delay,
      scheduledAt: this.getNow(),
      beforeRef: (task) => ref.deref()?.beforeRef(task),
      beforeUnref: (task) => ref.deref()?.beforeUnref(task),
      register: (task) => ref.deref()?.registerTask(task),
      unregister: (task) => ref.deref()?.unregisterTimeout(task),
      getNow: () => ref.deref()!.getNow()
    })
  }
  private createIntervalTask(callback: () => any, interval: number, args: any[]) {
    const ref = new WeakRef(this)
    return new IntervalTask({
      id: this.lastId++,
      _onTimeout: callback,
      args,
      delay: interval,
      scheduledAt: this.getNow(),
      beforeRef: (task) => ref.deref()?.beforeRef(task),
      beforeUnref: (task) => ref.deref()?.beforeUnref(task),
      register: (task) => ref.deref()?.registerTask(task),
      unregister: (task) => ref.deref()?.unregisterTimeout(task),
      getNow: () => ref.deref()!.getNow()
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

    const layer = task.getLayer()
    while (this.layers.length <= layer) {
      this.layers.push(new BucketLayer(this.layers.length))
    }
    this.layers[layer].insert(task)
  }

  private init() {
    if (this.count > 0) {
      return
    }
    this.started = Date.now()
    this.currentTick = this.getNow()
    this.recursiveInit()
  }

  registerTimeout(
    callback: (...args: any[]) => any,
    delay: number = 1,
    ...args: any[]
  ): TimeoutTask {
    this.init()
    const task = this.createTimeoutTask(callback, delay, args)
    this.registerTask(task)
    return task
  }
  registerInterval(
    callback: (...args: any[]) => any,
    delay: number = 1,
    ...args: any[]
  ): IntervalTask {
    this.init()
    const task = this.createIntervalTask(callback, delay, args)
    this.registerTask(task)
    return task
  }

  unregisterTimeout(task: TimeoutTask) {
    task.markAsClosed()
    for (let layer = 0; layer < this.layers.length; layer += 1) {
      const buckets = this.layers[layer]
      if (!buckets.remove(task)) {
        continue
      }

      this.refedCount -= task.refCount()
      return
    }
  }

  private tick() {
    const now = this.getNow()
    let dropdown = new Set<TimeoutTask>()
    while (now > this.currentTick) {
      const current = this.currentTick + 1
      const indexes = convertToIndex(current)

      layerLoop: for (let layer = this.layers.length - 1; layer >= 0; layer -= 1) {
        const buckets = this.layers[layer]
        for (const task of dropdown) {
          buckets.insert(task)
        }

        const index = indexes.at(layer)!
        const tasks = buckets.dropdown(index)
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
