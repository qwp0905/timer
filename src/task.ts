import { convertToIndex } from "./utils"

export interface CreateTaskOptions {
  _onTimeout: (...args: any[]) => any
  args: any[]
  delay: number
  scheduledAt: number
  beforeRef: (task: Task) => void
  beforeUnref: (task: Task) => void
  register: (task: Task) => void
  unregister: (task: Task) => void
}

export class Task implements NodeJS.Timeout {
  private indexes: number[]
  private closed = false
  private refed = true
  readonly _onTimeout: (...args: any[]) => any
  private readonly args: any[]
  private readonly delay: number
  private scheduledAt: number
  private readonly beforeRef: (task: Task) => void
  private readonly beforeUnref: (task: Task) => void
  private readonly register: (task: Task) => void
  private readonly unregister: (task: Task) => void
  constructor({
    _onTimeout,
    args,
    delay,
    scheduledAt,
    beforeRef,
    beforeUnref,
    register,
    unregister
  }: CreateTaskOptions) {
    this._onTimeout = _onTimeout
    this.args = args
    this.delay = delay
    this.scheduledAt = scheduledAt
    this.beforeRef = beforeRef
    this.beforeUnref = beforeUnref
    this.register = register
    this.unregister = unregister
    this.indexes = convertToIndex(this.getExecutionTime())
  }

  close(): this {
    if (this.closed) {
      return this
    }
    this.closed = true
    this.unregister(this)
    return this
  }

  hasRef(): boolean {
    return this.refed
  }

  ref(): this {
    this.beforeRef(this)
    this.refed = true
    return this
  }

  refresh(): this {
    this.unregister(this)
    this.scheduledAt = Date.now()
    this.indexes = convertToIndex(this.getExecutionTime())
    this.register(this)
    return this
  }

  unref(): this {
    this.beforeUnref(this)
    this.refed = false
    return this
  }

  [Symbol.toPrimitive](): number {
    throw new Error("Method not implemented.")
  }

  [Symbol.dispose](): void {
    throw new Error("Method not implemented.")
  }

  execute() {
    return this._onTimeout(...this.args)
  }

  getExecutionTime() {
    return this.scheduledAt + this.delay
  }

  getIndex(at: number) {
    return this.indexes.at(at)
  }

  getLayer() {
    return this.indexes.length - 1
  }

  getScheduledAt() {
    return this.scheduledAt
  }
}
