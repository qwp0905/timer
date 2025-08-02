import { IntervalTask, Task } from "./task"
import { convertToIndex } from "./utils"

export class TimingWheel {
  private readonly buckets: (Set<Task> | null)[][] = []
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

  private createTimeoutTask(callback: () => any, delay: number, args: any[]): Task {
    const ref = new WeakRef(this)
    return new Task({
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

  private beforeRef(task: Task) {
    if (task.hasRef()) {
      return
    }
    this.refedCount += 1
  }
  private beforeUnref(task: Task) {
    if (!task.hasRef()) {
      return
    }
    this.refedCount -= 1
  }

  private registerTask(task: Task) {
    if (this.registeredCount++ === 0) {
      this.currentTick = task.getScheduledAt()
      this.recursiveInit()
    }
    this.refedCount += task.hasRef() ? 1 : 0

    const layer = task.getLayer()
    const index = task.getIndex(-1)!
    while (this.buckets.length <= layer) {
      this.buckets.push([])
    }

    this.buckets[layer][index] ??= new Set()
    this.buckets[layer][index].add(task)
  }

  registerTimeout(callback: (...args: any[]) => any, delay: number, ...args: any[]): Task {
    const task = this.createTimeoutTask(callback, delay, args)
    this.registerTask(task)
    return task
  }
  registerInterval(
    callback: (...args: any[]) => any,
    interval: number,
    ...args: any[]
  ): IntervalTask {
    const task = this.createIntervalTask(callback, interval, args)
    this.registerTask(task)
    return task
  }

  unregisterTimeout(task: Task) {
    task.markAsClosed()
    for (let layer = 0; layer < this.buckets.length; layer += 1) {
      const index = task.getIndex(layer)!
      const tasks = this.buckets[layer][index]
      if (!tasks?.delete(task)) {
        continue
      }

      this.registeredCount -= 1
      this.refedCount -= task.hasRef() ? 1 : 0
      return
    }
  }

  private tick() {
    if (Date.now() <= this.currentTick) {
      return
    }

    const current = this.currentTick + 1
    let dropdown: Set<Task> = new Set()
    const indexes = convertToIndex(current)
    for (let layer = this.buckets.length - 1; layer >= 0; layer -= 1) {
      for (const task of dropdown) {
        const index = task.getIndex(layer)!
        this.buckets[layer][index] ??= new Set()
        this.buckets[layer][index]!.add(task)
      }

      const index = indexes.at(layer)!
      if (!this.buckets[layer][index]?.size) {
        dropdown.clear()
        continue
      }

      dropdown = this.buckets[layer][index]!
      this.buckets[layer][index] = null
    }

    this.currentTick = current
    for (const task of dropdown) {
      task.execute()
      this.registeredCount -= 1
      this.refedCount -= task.hasRef() ? 1 : 0
      task.afterTaskRun()
    }

    this.tick()
  }
}
