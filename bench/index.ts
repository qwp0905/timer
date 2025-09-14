import { clearGlobalTimers, setGlobalTimers } from "../src"
import { promisify } from "util"

// Benchmark configuration
const COUNT = 1_000_000 // Number of timers per trial
const TRIALS = 5 // Number of trials per test
const GC_DELAY_PER_TRIAL = 3000

const testSets = Array.from({ length: COUNT }, (_, i) => (COUNT - i) * 100)

// Trial result interface
interface TrialResult {
  setTimeoutTime: number // setTimeout execution time (ms)
  setTimeoutOps: number // setTimeout operations per ms
  clearTimeoutTime: number // clearTimeout execution time (ms)
  clearTimeoutOps: number // clearTimeout operations per ms
  memoryUsage: number // Memory usage (MB)
}

// Test results interface
interface TestResults {
  name: string // Test name (Native/TimingWheel)
  trials: TrialResult[] // Individual trial results
  averageSetTimeoutTime: number
  averageSetTimeoutOps: number
  averageClearTimeoutTime: number
  averageClearTimeoutOps: number
  averageMemoryUsage: number
}

// Run a single trial
async function runTrial(): Promise<TrialResult> {
  const arr: any[] = []
  const startMem = process.memoryUsage().heapUsed

  // setTimeout benchmark
  const setTimeoutStart = performance.now()
  for (const delay of testSets) {
    const timeout = setTimeout(() => {}, delay)
    arr.push(timeout)
  }

  // Calculate memory usage
  const memoryUsage = Math.round((process.memoryUsage().heapUsed - startMem) / 1024 ** 2)

  const setTimeoutEnd = performance.now()
  const setTimeoutTime = setTimeoutEnd - setTimeoutStart
  const setTimeoutOps = COUNT / setTimeoutTime

  // clearTimeout benchmark
  const clearTimeoutStart = performance.now()
  for (const timer of arr) {
    clearTimeout(timer)
  }
  const clearTimeoutEnd = performance.now()
  const clearTimeoutTime = clearTimeoutEnd - clearTimeoutStart
  const clearTimeoutOps = COUNT / clearTimeoutTime

  // Clear the array
  arr.length = 0

  return {
    setTimeoutTime,
    setTimeoutOps,
    clearTimeoutTime,
    clearTimeoutOps,
    memoryUsage
  }
}

// Run tests for each timer implementation
async function runTest(useNative: boolean): Promise<TestResults> {
  const testName = useNative ? "Native Timers" : "Timing Wheel"
  console.log(`\n[${testName}]`)

  // Set the appropriate timer implementation
  if (useNative) {
    clearGlobalTimers()
  } else {
    setGlobalTimers()
  }

  const trials: TrialResult[] = []

  for (let i = 0; i < TRIALS; i++) {
    console.log(`Trial ${i + 1}/${TRIALS}...`)
    const result = await runTrial()
    trials.push(result)

    console.log(
      `  setTimeout: ${result.setTimeoutTime.toFixed(2)}ms (${result.setTimeoutOps.toFixed(2)} ops/ms)`
    )
    console.log(
      `  clearTimeout: ${result.clearTimeoutTime.toFixed(2)}ms (${result.clearTimeoutOps.toFixed(2)} ops/ms)`
    )
    console.log(`  Memory usage: ${result.memoryUsage} MB`)

    // Call GC and wait
    if (i < TRIALS - 1) {
      console.log("  Triggering GC and waiting...")
      gc?.()
      await promisify(setTimeout)(GC_DELAY_PER_TRIAL)
    }
  }

  // Calculate averages
  const averageSetTimeoutTime =
    trials.reduce((sum, trial) => sum + trial.setTimeoutTime, 0) / TRIALS
  const averageSetTimeoutOps = trials.reduce((sum, trial) => sum + trial.setTimeoutOps, 0) / TRIALS
  const averageClearTimeoutTime =
    trials.reduce((sum, trial) => sum + trial.clearTimeoutTime, 0) / TRIALS
  const averageClearTimeoutOps =
    trials.reduce((sum, trial) => sum + trial.clearTimeoutOps, 0) / TRIALS
  const averageMemoryUsage = trials.reduce((sum, trial) => sum + trial.memoryUsage, 0) / TRIALS

  return {
    name: testName,
    trials,
    averageSetTimeoutTime,
    averageSetTimeoutOps,
    averageClearTimeoutTime,
    averageClearTimeoutOps,
    averageMemoryUsage
  }
}

// Print results function
function printResults(timingWheelResults: TestResults, nativeResults: TestResults) {
  console.log("\n====================================================================")
  console.log("BENCHMARK RESULTS")
  console.log("====================================================================\n")

  function printTestResults(results: TestResults) {
    console.log(`[${results.name}]`)
    console.log(
      `  setTimeout:    ${results.averageSetTimeoutTime.toFixed(2)}ms (${results.averageSetTimeoutOps.toFixed(2)} ops/ms)`
    )
    console.log(
      `  clearTimeout:  ${results.averageClearTimeoutTime.toFixed(2)}ms (${results.averageClearTimeoutOps.toFixed(2)} ops/ms)`
    )
    console.log(`  Memory usage:  ${results.averageMemoryUsage.toFixed(2)} MB\n`)
  }

  printTestResults(timingWheelResults)
  printTestResults(nativeResults)

  // Calculate improvement rates
  const setTimeoutImprovement =
    ((nativeResults.averageSetTimeoutTime - timingWheelResults.averageSetTimeoutTime) /
      nativeResults.averageSetTimeoutTime) *
    100
  const clearTimeoutImprovement =
    ((nativeResults.averageClearTimeoutTime - timingWheelResults.averageClearTimeoutTime) /
      nativeResults.averageClearTimeoutTime) *
    100
  const memoryImprovement =
    ((nativeResults.averageMemoryUsage - timingWheelResults.averageMemoryUsage) /
      nativeResults.averageMemoryUsage) *
    100

  console.log("Performance Improvement:")
  console.log(`  setTimeout:    ${setTimeoutImprovement.toFixed(0)}% faster`)
  console.log(`  clearTimeout:  ${clearTimeoutImprovement.toFixed(0)}% faster`)
  console.log(
    `  Memory usage:  ${memoryImprovement > 0 ? memoryImprovement.toFixed(0) + "% less" : Math.abs(memoryImprovement).toFixed(0) + "% more"}`
  )
}

// Run the complete benchmark
async function runBenchmark() {
  console.log(`Running benchmark with ${COUNT.toLocaleString()} timers, ${TRIALS} trials per test`)

  // TimingWheel test
  const timingWheelResults = await runTest(false)

  // Run GC and wait
  console.log("\n--------------------------------------------------------------------")
  console.log("Garbage collection triggered. Waiting for 10 seconds...")
  console.log("--------------------------------------------------------------------")
  gc?.()
  await promisify(setTimeout)(10000)

  // Native timer test
  const nativeResults = await runTest(true)

  // Print results
  printResults(timingWheelResults, nativeResults)

  // Restore native timers
  clearGlobalTimers()
}

// Handle process termination signals
process.on("SIGINT", () => {
  console.log("\nBenchmark interrupted. Cleaning up...")
  clearGlobalTimers()
  process.exit(0)
})

// Run the benchmark
runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err)
  clearGlobalTimers()
})
