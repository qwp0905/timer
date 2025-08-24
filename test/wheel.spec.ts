import { TimingWheel, TestingTimer } from "../timing-wheel"

describe("TimingWheel", () => {
  let wheel: TimingWheel
  let timer: TestingTimer

  beforeEach(() => {
    timer = new TestingTimer()
    wheel = TimingWheel.withTesting(timer)
  })

  it("should register task and execute it after the delay", () => {
    const delay = 1000
    const callback = jest.fn()

    wheel.register(1, delay, () => callback(), false)
    expect(callback).not.toHaveBeenCalled()

    timer.advance(delay - 1)
    wheel.tick()
    expect(callback).not.toHaveBeenCalled()

    timer.advance(delay)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should register interval task and execute it repeatedly", () => {
    const callback = jest.fn()
    const interval = 1000
    const id = 1

    wheel.register(id, interval, callback, true)
    expect(callback).not.toHaveBeenCalled()

    timer.advance(interval - 1)
    wheel.tick()
    expect(callback).not.toHaveBeenCalled()
    timer.advance(1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(1)

    timer.advance(interval - 1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(1)
    timer.advance(1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(2)

    wheel.unregister(id)
  })

  it("should cancel timeout task when unregistered", () => {
    const delay = 1000
    const callback = jest.fn()
    const id = 1

    wheel.register(id, delay, callback, false)
    expect(callback).not.toHaveBeenCalled()

    wheel.unregister(id)

    timer.advance(delay + 100)
    wheel.tick()
    expect(callback).not.toHaveBeenCalled()
  })

  it("should cancel interval task when unregistered", () => {
    const callback = jest.fn()
    const interval = 1000
    const id = 1

    wheel.register(id, interval, callback, true)

    timer.advance(interval)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(1)

    wheel.unregister(id)

    timer.advance(interval * 2)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should cancel interval task in interval callback", () => {
    let callback
    const interval = 1000
    const id = 1
    let count = 0
    const maxCount = 3
    wheel.register(
      id,
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

    timer.advance(interval - 1)
    wheel.tick()
    expect(callback).not.toHaveBeenCalled()

    timer.advance(1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(1)

    timer.advance(interval - 1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(1)

    timer.advance(1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(2)

    timer.advance(interval - 1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(2)

    timer.advance(1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(3)

    timer.advance(interval - 1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(3)

    timer.advance(1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it("should execute timeout immediately when delay under 1", () => {
    const callback = jest.fn()
    const id = 1
    wheel.register(id, 0, callback, false)
    expect(callback).toHaveBeenCalledTimes(0)

    timer.advance(1)
    wheel.tick()
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
