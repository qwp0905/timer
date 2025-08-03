import { TimingWheel } from "../src/timing-wheel"

describe("TimingWheel", () => {
  let timingWheel: TimingWheel

  beforeEach(() => {
    jest.useFakeTimers()
    timingWheel = new TimingWheel()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  it("should register task and execute it after the delay", () => {
    const callback = jest.fn()
    const delay = 1000
    const args = ["arg1", "arg2"]

    timingWheel.registerTimeout(callback, delay, ...args)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(delay - 1)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(...args)
  })

  it("should register interval task and execute it repeatedly", () => {
    const callback = jest.fn()
    const interval = 1000
    const args = ["arg1", "arg2"]

    const intervalTask = timingWheel.registerInterval(callback, interval, ...args)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(interval)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(...args)

    jest.advanceTimersByTime(interval)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(...args)

    timingWheel.unregisterTimeout(intervalTask)
  })

  it("should cancel timeout task when unregistered", () => {
    const callback = jest.fn()
    const delay = 1000

    const task = timingWheel.registerTimeout(callback, delay)
    expect(callback).not.toHaveBeenCalled()

    // 타이머 취소
    timingWheel.unregisterTimeout(task)

    // 시간이 지나도 실행되지 않음
    jest.advanceTimersByTime(delay + 100)
    expect(callback).not.toHaveBeenCalled()
  })

  it("should cancel interval task when unregistered", () => {
    const callback = jest.fn()
    const interval = 1000

    const task = timingWheel.registerInterval(callback, interval)

    jest.advanceTimersByTime(interval)
    expect(callback).toHaveBeenCalledTimes(1)

    timingWheel.unregisterTimeout(task)

    jest.advanceTimersByTime(interval * 2)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should cancel interval task in interval callback", () => {
    let callback
    const interval = 1000
    let count = 0
    const maxCount = 3
    const task = timingWheel.registerInterval(
      (callback = jest.fn(() => {
        if (++count < maxCount) {
          return
        }
        timingWheel.unregisterTimeout(task)
      })),
      interval
    )
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(interval - 1)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(interval - 1)
    expect(callback).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(2)

    jest.advanceTimersByTime(interval - 1)
    expect(callback).toHaveBeenCalledTimes(2)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(3)

    jest.advanceTimersByTime(interval - 1)
    expect(callback).toHaveBeenCalledTimes(3)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it("should execute timeout immediately when delay under 1", () => {
    const callback = jest.fn()
    timingWheel.registerTimeout(callback)
    expect(callback).toHaveBeenCalledTimes(0)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)

    timingWheel.registerTimeout(callback, -1000)
    expect(callback).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it("should execute interval immediately when delay under 1", () => {
    const callback = jest.fn()
    let task = timingWheel.registerInterval(callback)
    expect(callback).toHaveBeenCalledTimes(0)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(2)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(3)

    task.close()

    task = timingWheel.registerInterval(callback, -1000)
    expect(callback).toHaveBeenCalledTimes(3)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(4)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(5)

    task.close()
  })
})
