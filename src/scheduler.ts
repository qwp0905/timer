import { Task } from "./task"
import { TimingWheel } from "../timing-wheel"

interface ICallback<TArgs extends any[] = any[], TResult = any> {
  (...args: TArgs): TResult
}

export class TaskScheduler {
  private readonly wheel = new TimingWheel()

  private perEventLoop = () => {
    this.wheel.tick()
    if (this.wheel.isEmpty()) {
      return
    }
    this.scheduleTicker()
  }
  private scheduleTicker() {
    const immediate = setImmediate(this.perEventLoop)
    if (!this.wheel.isRefEmpty()) {
      return
    }

    immediate.unref()
  }

  private onRef = (id: number, hasRef: boolean) =>
    hasRef ? this.wheel.setRef(id) : this.wheel.clearRef(id)
  private unregister = (id: number) => this.wheel.unregister(id)
  private refresh = (id: number) => this.wheel.refresh(id)
  private hasRef = (id: number) => this.wheel.hasRef(id)

  setTimeout<T extends any[] = [], R = any>(
    callback: ICallback<T, R>,
    delay: number = 1,
    ...args: T
  ): Task<T, R> {
    const isEmpty = this.wheel.isEmpty()
    const task = new Task({
      id: this.wheel.register(delay, createCallback(callback, args), false),
      _onTimeout: callback,
      onRef: this.onRef,
      unregister: this.unregister,
      refresh: this.refresh,
      hasRef: this.hasRef
    })
    if (isEmpty) {
      this.scheduleTicker()
    }
    return task
  }
  setInterval<T extends any[] = [], R = any>(
    callback: ICallback<T, R>,
    delay: number = 1,
    ...args: T
  ): Task<T, R> {
    const isEmpty = this.wheel.isEmpty()
    const task = new Task({
      id: this.wheel.register(delay, createCallback(callback, args), true),
      _onTimeout: callback,
      onRef: this.onRef,
      unregister: this.unregister,
      refresh: this.refresh,
      hasRef: this.hasRef
    })
    if (isEmpty) {
      this.scheduleTicker()
    }
    return task
  }

  clearTimeout(task: number | string | Task<any, any>) {
    switch (typeof task) {
      case "number":
        return this.wheel.unregister(task)
      case "string":
        return this.wheel.unregister(Number(task))
      default:
        if (!(task instanceof Task)) {
          return
        }
        task.close()
    }
  }
  clearInterval(task: number | string | Task<any, any>) {
    switch (typeof task) {
      case "number":
        return this.wheel.unregister(task)
      case "string":
        return this.wheel.unregister(Number(task))
      default:
        if (!(task instanceof Task)) {
          return
        }
        task.close()
    }
  }
}

function createCallback(callback: (...args: any[]) => any, args: any[]) {
  return () => callback(...args)
}
