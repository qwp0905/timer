export interface CreateTaskOptions<T extends any[] = any[], R = any> {
  id: number
  _onTimeout: (...args: T) => R
  args: T
  onRef: (id: number, hasRef: boolean) => void
  unregister: (task: Task<T, R>) => void
  refresh: (task: Task<T, R>) => void
  hasRef: (id: number) => boolean
}

export class Task<T extends any[] = any[], R = any> implements NodeJS.Timeout {
  private readonly id: number
  private readonly args: T
  readonly _onTimeout: (...args: T) => R
  private readonly onRef: (id: number, hasRef: boolean) => void
  private readonly _hasRef: (id: number) => boolean
  private readonly unregister: (task: Task<T, R>) => void
  private readonly _refresh: (task: Task<T, R>) => void

  constructor({
    id,
    _onTimeout,
    args,
    onRef,
    unregister,
    refresh,
    hasRef
  }: CreateTaskOptions<T, R>) {
    this.id = id
    this._onTimeout = _onTimeout
    this.args = args
    this.onRef = onRef
    this.unregister = unregister
    this._refresh = refresh
    this._hasRef = hasRef
  }

  close(): this {
    this.unregister(this)
    return this
  }
  hasRef(): boolean {
    return this._hasRef(this.id)
  }
  ref(): this {
    this.onRef(this.id, true)
    return this
  }

  unref(): this {
    this.onRef(this.id, false)
    return this
  }

  refresh(): this {
    this._refresh(this)
    return this
  }

  [Symbol.toPrimitive](): number {
    return this.id
  }
  [Symbol.dispose](): void {
    this.close()
  }

  getId() {
    return this.id
  }

  execution = () => this._onTimeout(...this.args)
}
