import { TaskScheduler } from "./scheduler"
import { promisify } from "util"

export let globalScheduler: TaskScheduler

export function setGlobalTimers() {
  globalScheduler = new TaskScheduler()

  const registerTimeout = globalScheduler.setTimeout.bind(globalScheduler)
  const registerInterval = globalScheduler.setInterval.bind(globalScheduler)
  const unregisterTimeout = globalScheduler.clearTimeout.bind(globalScheduler)
  Object.defineProperty(registerTimeout, promisify.custom, {
    get() {
      return (delay: number, ...args: any[]) => {
        return new Promise((resolve) => {
          globalScheduler.setTimeout(resolve, delay, ...args)
        })
      }
    }
  })

  global.setTimeout = registerTimeout as unknown as typeof global.setTimeout
  global.clearTimeout = unregisterTimeout as unknown as typeof global.clearTimeout
  global.setInterval = registerInterval as unknown as typeof global.setInterval
  global.clearInterval = globalScheduler.clearTimeout.bind(
    globalScheduler
  ) as unknown as typeof global.clearInterval
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
