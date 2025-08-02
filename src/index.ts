import { TimingWheel } from "./timing-wheel"
import { promisify } from "util"

const globalTimer = new TimingWheel()

const register = globalTimer.register.bind(globalTimer)
const unregister = globalTimer.unregister.bind(globalTimer)
Object.defineProperty(register, promisify.custom, {
  get() {
    return (delay: number, ...args: any[]) => {
      return new Promise((resolve) => {
        globalTimer.register(resolve, delay, ...args)
      })
    }
  }
})

global.setTimeout = register as typeof global.setTimeout
global.clearTimeout = unregister as typeof global.clearTimeout
