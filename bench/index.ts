import { clearGlobalTimers, setGlobalTimers } from "../src"
import { promisify } from "util"

const count = 1_000_000

const arr: any[] = []

async function run() {
  console.log("[Timing Wheel]")
  setGlobalTimers()
  let startMem = process.memoryUsage().heapUsed
  let start = performance.now()
  for (let i = 0; i < count; i += 1) {
    const ii = setTimeout(() => {}, Math.floor(1000 + Math.random() * 10000000))
    arr.push(ii)
  }
  let end = performance.now()
  console.log(`setTimeout: ${end - start}ms / ${count / (end - start)} ops/ms`)

  start = performance.now()
  for (const i of arr) {
    clearTimeout(i)
  }
  end = performance.now()
  console.log(`clearTimeout: ${end - start}ms / ${count / (end - start)} ops/ms`)
  console.log(
    `Memory usage: ${Math.round((process.memoryUsage().heapUsed - startMem) / 1024 ** 2)} MB`
  )
  arr.length = 0
  gc?.()

  console.log("--------------------------------------------------------------------")
  console.log("Garbage collection triggered. Waiting for 10 seconds...")
  console.log("--------------------------------------------------------------------")

  await promisify(setTimeout)(10000)

  clearGlobalTimers()
  console.log("[Native Timers]")
  startMem = process.memoryUsage().heapUsed
  start = performance.now()

  for (let i = 0; i < count; i += 1) {
    const ii = setTimeout(() => {}, Math.floor(1000 + Math.random() * 10000000))
    arr.push(ii)
  }
  end = performance.now()
  console.log(`setTimeout: ${end - start}ms / ${count / (end - start)} ops/ms`)

  start = performance.now()
  for (const i of arr) {
    clearTimeout(i)
  }
  end = performance.now()
  console.log(`clearTimeout: ${end - start}ms / ${count / (end - start)} ops/ms`)
  console.log(
    `Memory usage: ${Math.round((process.memoryUsage().heapUsed - startMem) / 1024 ** 2)} MB`
  )
}
run()
