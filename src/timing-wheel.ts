import { IntervalTask, TimeoutTask } from "./task"
import { convertToIndex } from "./utils"

export class TimingWheel {
  private readonly buckets: (Set<TimeoutTask> | null)[][] = []
  private currentTick: number = Date.now()
  private registeredCount = 0
  private refedCount = 0
  private lastId = 0

  private perEventLoop = () => {
    this.tick()
    if (this.registeredCount === 0) {
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
      scheduledAt: Date.now(),
      beforeRef: (task) => ref.deref()?.beforeRef(task),
      beforeUnref: (task) => ref.deref()?.beforeUnref(task),
      register: (task) => ref.deref()?.registerTask(task),
      unregister: (task) => ref.deref()?.unregisterTimeout(task)
    })
  }
  private createIntervalTask(callback: () => any, interval: number, args: any[]) {
    const ref = new WeakRef(this)
    return new IntervalTask({
      id: this.lastId++,
      _onTimeout: callback,
      args,
      delay: interval,
      scheduledAt: Date.now(),
      beforeRef: (task) => ref.deref()?.beforeRef(task),
      beforeUnref: (task) => ref.deref()?.beforeUnref(task),
      register: (task) => ref.deref()?.registerTask(task),
      unregister: (task) => ref.deref()?.unregisterTimeout(task)
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
    if (this.registeredCount++ === 0) {
      this.currentTick = task.getScheduledAt()
      this.recursiveInit()
    }
    this.refedCount += task.refCount()

    const layer = task.getLayer()
    const index = task.getIndex(-1)!
    while (this.buckets.length <= layer) {
      this.buckets.push([])
    }

    const tasks = (this.buckets[layer][index] ??= new Set())
    tasks.add(task)
  }

  registerTimeout(callback: (...args: any[]) => any, delay: number, ...args: any[]): TimeoutTask {
    const task = this.createTimeoutTask(callback, delay, args)
    this.registerTask(task)
    return task
  }
  registerInterval(callback: (...args: any[]) => any, delay: number, ...args: any[]): IntervalTask {
    const task = this.createIntervalTask(callback, delay, args)
    this.registerTask(task)
    return task
  }

  unregisterTimeout(task: TimeoutTask) {
    task.markAsClosed()
    for (let layer = 0; layer < this.buckets.length; layer += 1) {
      const index = task.getIndex(layer)!
      const tasks = this.buckets[layer][index]
      if (!tasks?.delete(task)) {
        continue
      }

      if (tasks.size === 0) {
        this.buckets[layer][index] = null
      }

      this.registeredCount -= 1
      this.refedCount -= task.refCount()
      return
    }
  }

  private tick() {
    const now = Date.now()
    let dropdown = new Set<TimeoutTask>()
    while (now > this.currentTick) {
      const current = this.currentTick + 1
      const indexes = convertToIndex(current)

      layerLoop: for (let layer = this.buckets.length - 1; layer >= 0; layer -= 1) {
        for (const task of dropdown) {
          const tasks = (this.buckets[layer][task.getIndex(layer)!] ??= new Set())
          tasks.add(task)
        }

        const index = indexes.at(layer)!
        if (!this.buckets[layer][index]?.size) {
          dropdown.clear()
          continue layerLoop
        }

        dropdown = this.buckets[layer][index]!
        this.buckets[layer][index] = null
      }

      this.currentTick = current

      for (const task of dropdown) {
        task.execute()
        this.registeredCount -= 1
        this.refedCount -= task.refCount()
        task.afterTaskRun()
      }
      dropdown.clear()
    }
  }
}
