export interface CreateTaskOptions<T extends any[] = any[], R = any> {
  id: number
  _onTimeout: (...args: T) => R
  setRef: (id: number) => void
  clearRef: (id: number) => void
  unregister: (id: number) => void
  refresh: (id: number) => void
  hasRef: (id: number) => boolean
}

export class Task<T extends any[] = any[], R = any> implements NodeJS.Timeout {
  private readonly id: number
  readonly _onTimeout: (...args: T) => R
  private readonly setRef: (id: number) => void
  private readonly clearRef: (id: number) => void
  private readonly _hasRef: (id: number) => boolean
  private readonly unregister: (id: number) => void
  private readonly _refresh: (id: number) => void

  constructor({
    id,
    _onTimeout,
    setRef,
    clearRef,
    unregister,
    refresh,
    hasRef
  }: CreateTaskOptions<T, R>) {
    this.id = id
    this._onTimeout = _onTimeout
    this.setRef = setRef
    this.clearRef = clearRef
    this.unregister = unregister
    this._refresh = refresh
    this._hasRef = hasRef
  }
  close(): this {
    this.unregister(this.id)
    return this
  }
  hasRef(): boolean {
    return this._hasRef(this.id)
  }
  ref(): this {
    this.setRef(this.id)
    return this
  }
  unref(): this {
    this.clearRef(this.id)
    return this
  }
  refresh(): this {
    this._refresh(this.id)
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
}
