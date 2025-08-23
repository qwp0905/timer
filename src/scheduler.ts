// import { BucketLayer } from "./layers"
// import { IntervalTask, ITask, Task, TimeoutTask } from "./task"
// import { convertToIndex } from "./utils"
import { Task } from "./task"
import { TimingWheel } from "../timing-wheel"

interface ICallback<TArgs extends any[] = any[], TResult = any> {
  (...args: TArgs): TResult
}

export class TaskScheduler {
  private readonly wheel = new TimingWheel()
  // private readonly layers: BucketLayer[] = []
  // private readonly tasks = new Set<ITask>()
  // private started = Date.now()
  // private readonly getNow = () => Date.now() - this.started
  // private currentTick: number = this.getNow()
  // private refedCount = 0
  private lastId = 0

  private perEventLoop = () => {
    this.wheel.tick()
    if (this.wheel.isEmpty()) {
      return
    }
    this.scheduleTicker()
  }
  private scheduleTicker() {
    const immediate = setImmediate(this.perEventLoop)
    if (this.wheel.isEmpty()) {
      return
    }
    if (!this.wheel.isRefEmpty()) {
      return
    }

    immediate.unref()
  }

  private init() {
    if (!this.wheel.isEmpty()) {
      return
    }
    // this.started = Date.now()
    // this.currentTick = this.getNow()
    this.scheduleTicker()
  }

  // private createTimeoutTask<T extends any[] = [], R = any>(
  //   callback: ICallback<T, R>,
  //   delay: number,
  //   args: T
  // ): TimeoutTask<T, R> {
  // return new TimeoutTask({
  //   id: this.lastId++,
  //   _onTimeout: callback,
  //   args,
  //   delay,
  //   beforeRef: this.beforeRef,
  //   beforeUnref: this.beforeUnref,
  //   register: this.registerTask,
  //   unregister: this.unregisterTask,
  //   getNow: this.getNow
  // })
  // }
  // private createIntervalTask<T extends any[] = [], R = any>(
  //   callback: ICallback<T, R>,
  //   interval: number,
  //   args: T
  // ): IntervalTask<T, R> {
  // return new IntervalTask({
  //   id: this.lastId++,
  //   _onTimeout: callback,
  //   args,
  //   delay: interval,
  //   beforeRef: this.beforeRef,
  //   beforeUnref: this.beforeUnref,
  //   register: this.registerTask,
  //   unregister: this.unregisterTask,
  //   getNow: this.getNow
  // })
  // }

  // private readonly beforeRef = (task: TimeoutTask) => {
  //   if (task.hasRef()) {
  //     return
  //   }
  //   this.refedCount += 1
  // }
  // private readonly beforeUnref = (task: TimeoutTask) => {
  //   if (!task.hasRef()) {
  //     return
  //   }
  //   this.refedCount -= 1
  // }

  // private readonly registerTask = (task: ITask) => {
  //   const index = task.getMaxLayer()
  //   while (this.layers.length <= index) {
  //     this.layers.push(new BucketLayer(this.layers.length))
  //   }
  //   this.layers[index].insert(task)
  //   if (!this.tasks.add(task)) {
  //     return
  //   }
  //   this.refedCount += task.refCount()
  // }
  // private readonly unregisterTask = (task: ITask) => {
  //   if (!this.tasks.delete(task)) {
  //     return
  //   }
  //   this.refedCount -= task.refCount()
  // }

  private onRef = (id: number, hasRef: boolean) =>
    hasRef ? this.wheel.setRef(id) : this.wheel.clearRef(id)
  private unregister = (task: Task<any, any>) => this.wheel.unregister(task.getId())
  private refresh = (task: Task<any, any>) => this.wheel.refresh(task.getId())
  private hasRef = (id: number) => this.wheel.hasRef(id)

  setTimeout<T extends any[] = [], R = any>(
    callback: ICallback<T, R>,
    delay: number = 1,
    ...args: T
  ): Task<T, R> {
    this.init()
    const task = new Task({
      id: this.lastId++,
      _onTimeout: callback,
      args,
      onRef: this.onRef,
      unregister: this.unregister,
      refresh: this.refresh,
      hasRef: this.hasRef
    })
    this.wheel.register(task.getId(), delay, task.execution, false)
    return task
    // this.init()
    // const task = this.createTimeoutTask(callback, delay, args)
    // this.registerTask(task)
    // return task
  }
  setInterval<T extends any[] = [], R = any>(
    callback: ICallback<T, R>,
    delay: number = 1,
    ...args: T
  ): Task<T, R> {
    this.init()
    const task = new Task({
      id: this.lastId++,
      _onTimeout: callback,
      args,
      onRef: this.onRef,
      unregister: this.unregister,
      refresh: this.refresh,
      hasRef: this.hasRef
    })
    this.wheel.register(task.getId(), delay, task.execution, true)
    return task
  }

  clearTimeout(task: Task<any, any>) {
    task.close()
  }
  clearInterval(task: Task<any, any>) {
    task.close()
  }

  // private tick() {
  //   const now = this.getNow()
  //   let dropdown: ITask[] = []

  //   for (let current = this.currentTick + 1; current <= now; current += 1) {
  //     let indexes: number[] | null

  //     layerLoop: for (let i = this.layers.length - 1; i >= 0; i -= 1) {
  //       const layer = this.layers[i]
  //       if (layer.length === 0 && dropdown.length === 0) {
  //         continue layerLoop
  //       }
  //       while (dropdown.length > 0) {
  //         layer.insert(dropdown.pop()!)
  //       }

  //       const index = (indexes ??= convertToIndex(current)).at(i)!
  //       const tasks = layer.dropdown(index)
  //       if (!tasks) {
  //         continue layerLoop
  //       }

  //       dropdown = tasks
  //     }

  //     while (this.layers.at(-1)?.length === 0) {
  //       this.layers.pop()
  //     }

  //     while (dropdown.length > 0) {
  //       const task = dropdown.pop()!
  //       if (task.getExecutionTime() !== current) {
  //         continue
  //       }
  //       if (!this.tasks.delete(task)) {
  //         continue
  //       }

  //       task.execute()
  //       this.refedCount -= task.refCount()
  //       task.afterTaskRun()
  //     }
  //   }

  //   this.currentTick = now
  // }
}
