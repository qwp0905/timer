import { convertToIndex } from "./utils"

export interface CreateTaskOptions {
  id: number
  _onTimeout: (...args: any[]) => any
  args: any[]
  delay: number
  scheduledAt: number
  beforeRef: (task: TimeoutTask) => void
  beforeUnref: (task: TimeoutTask) => void
  register: (task: TimeoutTask) => void
  unregister: (task: TimeoutTask) => void
  getNow: () => number
}

export class TimeoutTask implements NodeJS.Timeout {
  protected readonly id: number
  protected indexes: number[]
  protected closed = false
  protected refed = true
  protected readonly args: any[]
  protected readonly delay: number
  protected scheduledAt: number

  readonly _onTimeout: (...args: any[]) => any

  protected readonly beforeRef: (task: TimeoutTask) => void
  protected readonly beforeUnref: (task: TimeoutTask) => void
  protected readonly register: (task: TimeoutTask) => void
  protected readonly unregister: (task: TimeoutTask) => void
  protected readonly getNow: () => number

  constructor({
    id,
    _onTimeout,
    args,
    delay,
    scheduledAt,
    beforeRef,
    beforeUnref,
    register,
    unregister,
    getNow
  }: CreateTaskOptions) {
    this.id = id
    this._onTimeout = _onTimeout
    this.args = args
    this.delay = Math.max(1, delay)
    this.scheduledAt = scheduledAt
    this.beforeRef = beforeRef
    this.beforeUnref = beforeUnref
    this.register = register
    this.unregister = unregister
    this.indexes = convertToIndex(this.getExecutionTime())
    this.getNow = getNow
  }

  refreshDate() {
    this.scheduledAt = this.getNow()
    this.indexes = convertToIndex(this.getExecutionTime())
  }

  close(): this {
    if (this.closed) {
      return this
    }
    this.unregister(this)
    return this
  }

  markAsClosed() {
    this.closed = true
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
    this.refreshDate()
    this.register(this)
    return this
  }

  unref(): this {
    this.beforeUnref(this)
    this.refed = false
    return this
  }

  [Symbol.toPrimitive](): number {
    return this.getId()
  }

  [Symbol.dispose](): void {
    this.close()
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

  afterTaskRun() {
    this.closed = true
  }

  getId() {
    return this.id
  }

  refCount() {
    return (this.refed && 1) || 0
  }

  setScheduledAt(timestamp: number) {
    this.scheduledAt = timestamp
    this.indexes = convertToIndex(this.getExecutionTime())
  }
}

export class IntervalTask extends TimeoutTask {
  afterTaskRun(): void {
    if (this.closed) {
      return
    }
    this.refreshDate()
    this.register(this)
  }
}
