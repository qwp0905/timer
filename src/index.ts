import { TaskScheduler } from "./scheduler"

export const globalScheduler = new TaskScheduler()

export function setGlobalTimers() {
  const registerTimeout = globalScheduler.setTimeout.bind(
    globalScheduler
  ) as unknown as typeof global.setTimeout
  const registerInterval = globalScheduler.setInterval.bind(
    globalScheduler
  ) as unknown as typeof global.setInterval
  const unregisterTimeout = globalScheduler.clearTimeout.bind(
    globalScheduler
  ) as unknown as typeof global.clearTimeout
  const unregisterInterval = globalScheduler.clearInterval.bind(
    globalScheduler
  ) as unknown as typeof global.clearInterval
  if (typeof process !== undefined) {
    const { promisify } = require("util")
    Object.defineProperty(registerTimeout, promisify.custom, {
      get() {
        return (delay: number, ...args: any[]) => {
          return new Promise((resolve) => {
            registerTimeout(resolve, delay, ...args)
          })
        }
      }
    })
  }

  global.setTimeout = registerTimeout
  global.clearTimeout = unregisterTimeout
  global.setInterval = registerInterval
  global.clearInterval = unregisterInterval
}

const globalSetTimeout = global.setTimeout
const globalClearTimeout = global.clearTimeout
const globalSetInterval = global.setInterval
const globalClearInterval = global.clearInterval

export function clearGlobalTimers() {
  global.setTimeout = globalSetTimeout
  global.clearTimeout = globalClearTimeout
  global.setInterval = globalSetInterval
  global.clearInterval = globalClearInterval
}

export { TaskScheduler }
