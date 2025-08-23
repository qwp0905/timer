import { TaskScheduler } from "../src/scheduler"

describe("TaskScheduler", () => {
  let scheduler: TaskScheduler

  beforeEach(() => {
    jest.useFakeTimers()
    scheduler = new TaskScheduler()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  it("should register task and execute it after the delay", () => {
    const callback = jest.fn()
    const delay = 1000
    const args = ["arg1", "arg2"]

    scheduler.setTimeout(callback, delay, ...args)
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

    const intervalTask = scheduler.setInterval(callback, interval, ...args)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(interval)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(...args)

    jest.advanceTimersByTime(interval)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(...args)

    scheduler.clearTimeout(intervalTask)
  })

  it("should cancel timeout task when unregistered", () => {
    const callback = jest.fn()
    const delay = 1000

    const task = scheduler.setTimeout(callback, delay)
    expect(callback).not.toHaveBeenCalled()

    scheduler.clearTimeout(task)

    jest.advanceTimersByTime(delay + 100)
    expect(callback).not.toHaveBeenCalled()
  })

  it("should cancel interval task when unregistered", () => {
    const callback = jest.fn()
    const interval = 1000

    const task = scheduler.setInterval(callback, interval)

    jest.advanceTimersByTime(interval)
    expect(callback).toHaveBeenCalledTimes(1)

    scheduler.clearInterval(task)

    jest.advanceTimersByTime(interval * 2)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should cancel interval task in interval callback", () => {
    let callback
    const interval = 1000
    let count = 0
    const maxCount = 3
    const task = scheduler.setInterval(
      (callback = jest.fn(() => {
        if (++count < maxCount) {
          return
        }
        scheduler.clearInterval(task)
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
    scheduler.setTimeout(callback)
    expect(callback).toHaveBeenCalledTimes(0)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)

    scheduler.setTimeout(callback, -1000)
    expect(callback).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it("should execute interval immediately when delay under 1", () => {
    const callback = jest.fn()
    let task = scheduler.setInterval(callback)
    expect(callback).toHaveBeenCalledTimes(0)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(2)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(3)

    task.close()

    task = scheduler.setInterval(callback, -1000)
    expect(callback).toHaveBeenCalledTimes(3)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(4)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(5)

    task.close()
  })

  it("should delay can be less then max delay", () => {
    const maxDelay = 0xffff_ffff
    const callback = jest.fn()
    const task = scheduler.setTimeout(callback, maxDelay + 1000)
    // expect(task.getExecutionTime()).toBe(maxDelay)
    expect(callback).not.toHaveBeenCalled()

    scheduler.clearTimeout(task)
  })
})
