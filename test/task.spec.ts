import { TimingWheel } from "../src/timing-wheel"

if (!Symbol.dispose) {
  Object.defineProperty(Symbol, "dispose", {
    get() {
      return Symbol.for("nodejs.dispose")
    }
  })
}

describe("Task", () => {
  let timingWheel: TimingWheel

  beforeEach(() => {
    jest.useFakeTimers()
    timingWheel = new TimingWheel()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  it("should not execute timeout task if closed before execution", () => {
    const callback = jest.fn()
    const delay = 1000

    const task = timingWheel.registerTimeout(callback, delay)
    expect(callback).not.toHaveBeenCalled()
    jest.advanceTimersByTime(delay - 1)
    expect(callback).not.toHaveBeenCalled()

    task.close()

    jest.advanceTimersByTime(delay)
    expect(callback).not.toHaveBeenCalled()
  })

  it('should refresh timeout task when "refresh" is called', () => {
    const callback = jest.fn()
    const delay = 1000

    const task = timingWheel.registerTimeout(callback, delay)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(delay - 1)
    expect(callback).not.toHaveBeenCalled()

    task.refresh()

    jest.advanceTimersByTime(1)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(delay - 1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should stop interval task if close called", () => {
    const callback = jest.fn()
    const interval = 1000

    const task = timingWheel.registerInterval(callback, interval)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(interval - 1)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(interval - 1)
    expect(callback).toHaveBeenCalledTimes(1)

    task.close()

    jest.advanceTimersByTime(interval)
    expect(callback).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(interval)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should refresh interval task when "refresh" is called', () => {
    const callback = jest.fn()
    const interval = 1000

    const task = timingWheel.registerInterval(callback, interval)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(interval - 1)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)

    task.refresh()

    jest.advanceTimersByTime(interval - 1)
    expect(callback).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(2)

    task.close()
  })

  it("should close task when disposed", () => {
    const callback = jest.fn()
    const delay = 1000

    {
      using timer = timingWheel.registerTimeout(callback, delay)
      expect(callback).not.toHaveBeenCalled()
      jest.advanceTimersByTime(delay - 1)
      expect(timer).not.toBeNull()
    }

    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(delay)
    expect(callback).not.toHaveBeenCalled()
  })
})
