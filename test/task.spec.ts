if (!Symbol.dispose) {
  Object.defineProperty(Symbol, "dispose", {
    get() {
      return Symbol.for("nodejs.dispose")
    }
  })
}

import { spawn } from "child_process"
import { TaskScheduler } from "../src/scheduler"
import { resolve } from "path"
import { Task } from "../src/task"
import { TestingTimer, TimingWheel } from "../timing-wheel"

const schedulerPath = resolve(__dirname, "../src/scheduler")

describe("Task", () => {
  let timer: TestingTimer
  let wheel: TimingWheel
  let scheduler: TaskScheduler

  function advance(tick: number) {
    timer.advance(tick)
    return new Promise(setImmediate)
  }

  beforeEach(() => {
    timer = new TestingTimer()
    wheel = TimingWheel.withTesting(timer)
    scheduler = new TaskScheduler()
    Object.assign(scheduler, { wheel })
  })

  it("should not execute timeout task if closed before execution", async () => {
    const callback = jest.fn()
    const delay = 1000

    const task = scheduler.setTimeout(callback, delay)
    expect(callback).not.toHaveBeenCalled()
    await advance(delay - 1)
    expect(callback).not.toHaveBeenCalled()

    task.close()

    await advance(delay)
    expect(callback).not.toHaveBeenCalled()
  })

  it('should refresh timeout task when "refresh" is called', async () => {
    const callback = jest.fn()
    const delay = 1000

    const task = scheduler.setTimeout(callback, delay)
    expect(callback).not.toHaveBeenCalled()

    await advance(delay - 1)
    expect(callback).not.toHaveBeenCalled()

    task.refresh()

    await advance(1)
    expect(callback).not.toHaveBeenCalled()

    await advance(delay - 1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should stop interval task if close called", async () => {
    const callback = jest.fn()
    const interval = 1000

    const task = scheduler.setInterval(callback, interval)
    expect(callback).not.toHaveBeenCalled()

    await advance(interval - 1)
    expect(callback).not.toHaveBeenCalled()

    await advance(1)
    expect(callback).toHaveBeenCalledTimes(1)

    await advance(interval - 1)
    expect(callback).toHaveBeenCalledTimes(1)

    task.close()

    await advance(interval)
    expect(callback).toHaveBeenCalledTimes(1)

    await advance(interval)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should refresh interval task when "refresh" is called', async () => {
    const callback = jest.fn()
    const interval = 1000

    const task = scheduler.setInterval(callback, interval)
    expect(callback).not.toHaveBeenCalled()

    await advance(interval - 1)
    expect(callback).not.toHaveBeenCalled()

    await advance(1)
    expect(callback).toHaveBeenCalledTimes(1)

    task.refresh()

    await advance(interval - 1)
    expect(callback).toHaveBeenCalledTimes(1)

    await advance(1)
    expect(callback).toHaveBeenCalledTimes(2)

    task.close()
  })

  it("should close task when disposed", async () => {
    const callback = jest.fn()
    const delay = 1000

    {
      using timer = scheduler.setTimeout(callback, delay)
      expect(callback).not.toHaveBeenCalled()
      await advance(delay - 1)
      expect(timer).not.toBeNull()
    }

    expect(callback).not.toHaveBeenCalled()

    await advance(delay)
    expect(callback).not.toHaveBeenCalled()
  })

  it("should ignore in eventloop when task is unrefed", async () => {
    const result = ""

    const schedulerName = "scheduler"

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
import {${TaskScheduler.name}} from "${schedulerPath}"
const ${schedulerName} = new ${TaskScheduler.name}()
${schedulerName}.${TaskScheduler.prototype.setTimeout.name}(() => {
  console.log("123123123123")
}, 1000).${Task.prototype.unref.name}()
`)
      prc.stdin.end()
    })

    await expect(p).resolves.toBe(result)
  })

  it("should remain on eventloop when task is refed", async () => {
    const result = "result"

    const schedulerName = "scheduler"

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
import {${TaskScheduler.name}} from "${schedulerPath}"
const ${schedulerName} = new ${TaskScheduler.name}()
${schedulerName}.${TaskScheduler.prototype.setTimeout.name}(() => {
  console.log("${result}")
}, 1000)
`)
      prc.stdin.end()
    })

    await expect(p).resolves.toBe(result)
  })

  it("should be true by default", () => {
    const task = scheduler.setTimeout(() => {}, 1000)
    expect(task.hasRef()).toBe(true)
    task.close()
  })

  it("should be false when unrefed", () => {
    const task = scheduler.setTimeout(() => {}, 1000)
    task.unref()
    expect(task.hasRef()).toBe(false)
    task.close()
  })

  it("should be true when refed", () => {
    const task = scheduler.setTimeout(() => {}, 1000)
    task.unref()
    task.ref()
    expect(task.hasRef()).toBe(true)
    task.close()
  })

  it("should not effect when multiple ref/unref called", () => {
    const task = scheduler.setInterval(() => {}, 1000)
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
    const task = scheduler.setTimeout(() => {}, 1000)
    expect(task.getId()).not.toBeNaN()
    task.close()
  })

  it("should convert to number", () => {
    const task = scheduler.setTimeout(() => {}, 1000)
    expect(+task).not.toBeNaN()
    task.close()
  })
})
