import { TaskScheduler } from "../src/scheduler"
import { TestingTimer, TimingWheel } from "../timing-wheel"

describe("TaskScheduler", () => {
  let timer: TestingTimer
  let wheel: TimingWheel
  let scheduler: TaskScheduler

  function advance(tick: number) {
    timer.advance(tick)
    return new Promise(setImmediate) // to execute tick
  }

  beforeEach(() => {
    timer = new TestingTimer()
    wheel = TimingWheel.withTesting(timer)
    scheduler = new TaskScheduler()
    Object.assign(scheduler, { wheel })
  })

  it("should execute timeout immediately when delay under 1", async () => {
    const callback = jest.fn()
    scheduler.setTimeout(callback)
    expect(callback).toHaveBeenCalledTimes(0)

    await advance(1)
    expect(callback).toHaveBeenCalledTimes(1)

    scheduler.setTimeout(callback, -100)
    expect(callback).toHaveBeenCalledTimes(1)

    await advance(1)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it("should execute interval immediately when delay under 1", async () => {
    const callback = jest.fn()
    let task = scheduler.setInterval(callback)
    expect(callback).toHaveBeenCalledTimes(0)

    await advance(1)
    expect(callback).toHaveBeenCalledTimes(1)

    await advance(1)
    expect(callback).toHaveBeenCalledTimes(2)

    await advance(1)
    expect(callback).toHaveBeenCalledTimes(3)

    task.close()

    task = scheduler.setInterval(callback, -1000)
    expect(callback).toHaveBeenCalledTimes(3)

    await advance(1)
    expect(callback).toHaveBeenCalledTimes(4)

    await advance(1)
    expect(callback).toHaveBeenCalledTimes(5)

    task.close()
  })

  it("should clear timeout by id", async () => {
    const callback = jest.fn()
    const delay = 1000
    const task = scheduler.setTimeout(callback, delay)
    expect(callback).not.toHaveBeenCalled()

    scheduler.clearTimeout(task.getId())

    await advance(delay + 100)
    expect(callback).not.toHaveBeenCalled()
  })

  it("should clear timeout by id string", async () => {
    const callback = jest.fn()
    const delay = 1000
    const task = scheduler.setTimeout(callback, delay)
    expect(callback).not.toHaveBeenCalled()

    scheduler.clearTimeout(task.getId().toString())

    await advance(delay + 100)
    expect(callback).not.toHaveBeenCalled()
  })

  it("should clear interval by id", async () => {
    const callback = jest.fn()
    const interval = 1000
    const task = scheduler.setInterval(callback, interval)
    expect(callback).not.toHaveBeenCalled()

    scheduler.clearInterval(task.getId())

    await advance(interval + 100)
    expect(callback).not.toHaveBeenCalled()
  })

  it("should clear interval by id string", async () => {
    const callback = jest.fn()
    const interval = 1000
    const task = scheduler.setInterval(callback, interval)
    expect(callback).not.toHaveBeenCalled()

    scheduler.clearInterval(task.getId().toString())

    await advance(interval + 100)
    expect(callback).not.toHaveBeenCalled()
  })

  it("should run multiple tasks in the same tick", async () => {
    const callback1 = jest.fn()
    const callback2 = jest.fn()
    const delay = 1000

    scheduler.setTimeout(callback1, delay)
    scheduler.setTimeout(callback2, delay)
    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).not.toHaveBeenCalled()

    await advance(delay - 1)
    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).not.toHaveBeenCalled()

    await advance(1)
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
  })

  it("should not throw error when task is not typeof Task", async () => {
    expect(Promise.resolve().then(() => scheduler.clearTimeout(null!))).resolves.not.toThrow()
    expect(Promise.resolve().then(() => scheduler.clearInterval(undefined!))).resolves.not.toThrow()
    expect(Promise.resolve().then(() => scheduler.clearTimeout({} as any))).resolves.not.toThrow()
  })
})
