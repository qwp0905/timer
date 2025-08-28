import { TimingWheel, TestingTimer } from "../timing-wheel"

describe("TimingWheel", () => {
  let wheel: TimingWheel
  let timer: TestingTimer

  function advance(tick: number) {
    timer.advance(tick)
    wheel.tick()
  }

  beforeEach(() => {
    timer = new TestingTimer()
    wheel = TimingWheel.withTesting(timer)
  })

  it("should register task and execute it after the delay", () => {
    const delay = 1000
    const callback = jest.fn()

    wheel.register(delay, () => callback(), false)
    expect(callback).not.toHaveBeenCalled()

    advance(delay - 1)
    expect(callback).not.toHaveBeenCalled()

    advance(delay)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should register interval task and execute it repeatedly", () => {
    const callback = jest.fn()
    const interval = 1000
    const id = wheel.register(interval, callback, true)

    expect(callback).not.toHaveBeenCalled()

    advance(interval - 1)
    expect(callback).not.toHaveBeenCalled()
    advance(1)
    expect(callback).toHaveBeenCalledTimes(1)

    advance(interval - 1)
    expect(callback).toHaveBeenCalledTimes(1)
    advance(1)
    expect(callback).toHaveBeenCalledTimes(2)

    wheel.unregister(id)
  })

  it("should cancel timeout task when unregistered", () => {
    const delay = 1000
    const callback = jest.fn()
    const id = wheel.register(delay, callback, false)

    expect(callback).not.toHaveBeenCalled()

    wheel.unregister(id)

    advance(delay + 100)
    expect(callback).not.toHaveBeenCalled()
  })

  it("should cancel interval task when unregistered", () => {
    const callback = jest.fn()
    const interval = 1000
    const id = wheel.register(interval, callback, true)

    advance(interval)
    expect(callback).toHaveBeenCalledTimes(1)

    wheel.unregister(id)

    advance(interval * 2)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should cancel interval task in interval callback", () => {
    let callback
    const interval = 1000
    let count = 0
    const maxCount = 3
    const id = wheel.register(
      interval,
      (callback = jest.fn(() => {
        if (++count < maxCount) {
          return
        }
        wheel.unregister(id)
      })),
      true
    )

    expect(callback).not.toHaveBeenCalled()

    advance(interval - 1)
    expect(callback).not.toHaveBeenCalled()

    advance(1)
    expect(callback).toHaveBeenCalledTimes(1)

    advance(interval - 1)
    expect(callback).toHaveBeenCalledTimes(1)

    advance(1)
    expect(callback).toHaveBeenCalledTimes(2)

    advance(interval - 1)
    expect(callback).toHaveBeenCalledTimes(2)

    advance(1)
    expect(callback).toHaveBeenCalledTimes(3)

    advance(interval - 1)
    expect(callback).toHaveBeenCalledTimes(3)

    advance(1)
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it("should execute callback in 1ms with delay under 1", () => {
    const callback = jest.fn()
    wheel.register(0, callback, false)
    expect(callback).toHaveBeenCalledTimes(0)

    advance(1)
    expect(callback).toHaveBeenCalledTimes(1)

    wheel.register(-1000, callback, false)
    expect(callback).toHaveBeenCalledTimes(1)

    advance(1)
    expect(callback).toHaveBeenCalledTimes(2)
  })
})
