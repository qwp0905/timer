if (!Symbol.dispose) {
  Object.defineProperty(Symbol, "dispose", {
    get() {
      return Symbol.for("nodejs.dispose")
    }
  })
}

import { spawn } from "child_process"
import { TimingWheel } from "../src/timing-wheel"

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

  it("should ignore in eventloop when task is unrefed", async () => {
    jest.useRealTimers()
    const result = ""

    const p = new Promise((resolve, reject) => {
      const prc = spawn("yarn", ["ts-node"])
      let buffered = ""
      let errors = ""
      prc.stdout.on("data", (data) => {
        buffered += data.toString()
      })
      prc.stderr.on("data", (data) => {
        errors += data.toString()
      })
      prc.on("close", () => {
        if (errors) {
          reject(new Error(errors.trim()))
        } else {
          resolve(buffered.trim())
        }
      })
      prc.on("error", (err) => reject(err))
      prc.stdin.write(`
import {TimingWheel} from "${__dirname}/../src/timing-wheel"
const timingWheel = new TimingWheel()
timingWheel.registerTimeout(() => {
  console.log("123123123123")
}, 1000).unref()
`)
      prc.stdin.end()
    })

    await expect(p).resolves.toBe(result)
  })

  it("should remain on eventloop when task is refed", async () => {
    jest.useRealTimers()
    const result = "result"

    const p = new Promise((resolve, reject) => {
      const prc = spawn("yarn", ["ts-node"])
      let buffered = ""
      let errors = ""
      prc.stdout.on("data", (data) => {
        buffered += data.toString()
      })
      prc.stderr.on("data", (data) => {
        errors += data.toString()
      })

      prc.on("close", () => {
        if (errors) {
          reject(new Error(errors.trim()))
        } else {
          resolve(buffered.trim())
        }
      })
      prc.on("error", (err) => reject(err))

      prc.stdin.write(`
import {TimingWheel} from "${__dirname}/../src/timing-wheel"
const timingWheel = new TimingWheel()
timingWheel.registerTimeout(() => {
  console.log("${result}")
}, 1000)
`)
      prc.stdin.end()
    })

    await expect(p).resolves.toBe(result)
  })

  it("should be true by default", () => {
    const task = timingWheel.registerTimeout(() => {}, 1000)
    expect(task.hasRef()).toBe(true)
    task.close()
  })

  it("should be false when unrefed", () => {
    const task = timingWheel.registerTimeout(() => {}, 1000)
    task.unref()
    expect(task.hasRef()).toBe(false)
    task.close()
  })

  it("should be true when refed", () => {
    const task = timingWheel.registerTimeout(() => {}, 1000)
    task.unref()
    task.ref()
    expect(task.hasRef()).toBe(true)
    task.close()
  })

  it("should not effect when multiple ref/unref called", () => {
    const task = timingWheel.registerInterval(() => {}, 1000)
    task.unref()
    expect(task.hasRef()).toBe(false)
    task.unref()
    expect(task.hasRef()).toBe(false)
    task.unref()
    expect(task.hasRef()).toBe(false)

    task.ref()
    expect(task.hasRef()).toBe(true)
    task.ref()
    expect(task.hasRef()).toBe(true)
    task.ref()
    expect(task.hasRef()).toBe(true)

    task.close()
  })

  it("should return id typeof number", () => {
    const task = timingWheel.registerTimeout(() => {}, 1000)
    expect(task.getId()).not.toBeNaN()
    task.close()
  })

  it("should convert to number", () => {
    const task = timingWheel.registerTimeout(() => {}, 1000)
    expect(+task).not.toBeNaN()
    task.close()
  })
})
