import { TimingWheel } from "./timing-wheel"
import { promisify } from "util"

export let globalTimer: TimingWheel

export function setGlobalTimers() {
  globalTimer = new TimingWheel()

  const registerTimeout = globalTimer.registerTimeout.bind(globalTimer)
  const registerInterval = globalTimer.registerInterval.bind(globalTimer)
  const unregisterTimeout = globalTimer.unregisterTimeout.bind(globalTimer)
  Object.defineProperty(registerTimeout, promisify.custom, {
    get() {
      return (delay: number, ...args: any[]) => {
        return new Promise((resolve) => {
          globalTimer.registerTimeout(resolve, delay, ...args)
        })
      }
    }
  })

  global.setTimeout = registerTimeout as unknown as typeof global.setTimeout
  global.clearTimeout = unregisterTimeout as unknown as typeof global.clearTimeout
  global.setInterval = registerInterval as unknown as typeof global.setInterval
  global.clearInterval = globalTimer.unregisterTimeout.bind(
    globalTimer
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
