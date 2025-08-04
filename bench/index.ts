import { clearGlobalTimers, setGlobalTimers } from "../src"
import { promisify } from "util"

// 벤치마크 설정
const COUNT = 1_000_000 // 각 트라이얼 당 타이머 수
const TRIALS = 5 // 각 테스트 당 트라이얼 수

// 트라이얼 결과 인터페이스
interface TrialResult {
  setTimeoutTime: number // setTimeout 실행 시간(ms)
  setTimeoutOps: number // setTimeout ops/ms
  clearTimeoutTime: number // clearTimeout 실행 시간(ms)
  clearTimeoutOps: number // clearTimeout ops/ms
  memoryUsage: number // 메모리 사용량(MB)
}

// 테스트 결과 인터페이스
interface TestResults {
  name: string // 테스트 이름 (Native/TimingWheel)
  trials: TrialResult[] // 각 트라이얼 결과
  averageSetTimeoutTime: number
  averageSetTimeoutOps: number
  averageClearTimeoutTime: number
  averageClearTimeoutOps: number
  averageMemoryUsage: number
}

// 단일 트라이얼 실행
async function runTrial(): Promise<TrialResult> {
  const arr: any[] = []
  const startMem = process.memoryUsage().heapUsed

  // setTimeout 벤치마크
  const setTimeoutStart = performance.now()
  for (let i = 0; i < COUNT; i++) {
    const timeout = setTimeout(() => {}, Math.floor(1000 + Math.random() * 10000000))
    arr.push(timeout)
  }
  const setTimeoutEnd = performance.now()
  const setTimeoutTime = setTimeoutEnd - setTimeoutStart
  const setTimeoutOps = COUNT / setTimeoutTime

  // clearTimeout 벤치마크
  const clearTimeoutStart = performance.now()
  for (const timer of arr) {
    clearTimeout(timer)
  }
  const clearTimeoutEnd = performance.now()
  const clearTimeoutTime = clearTimeoutEnd - clearTimeoutStart
  const clearTimeoutOps = COUNT / clearTimeoutTime

  // 메모리 사용량 계산
  const memoryUsage = Math.round((process.memoryUsage().heapUsed - startMem) / 1024 ** 2)

  // 배열 비우기
  arr.length = 0

  return {
    setTimeoutTime,
    setTimeoutOps,
    clearTimeoutTime,
    clearTimeoutOps,
    memoryUsage
  }
}

// 각 타이머 구현에 대한 테스트 실행
async function runTest(useNative: boolean): Promise<TestResults> {
  const testName = useNative ? "Native Timers" : "Timing Wheel"
  console.log(`\n[${testName}]`)

  // 적절한 타이머 구현 설정
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

    // GC 호출 및 대기
    if (i < TRIALS - 1) {
      console.log("  Triggering GC and waiting...")
      gc?.()
      await promisify(setTimeout)(2000)
    }
  }

  // 평균 계산
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

// 결과 출력 함수
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

  // 개선율 계산
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

// 전체 벤치마크 실행
async function runBenchmark() {
  console.log(`Running benchmark with ${COUNT.toLocaleString()} timers, ${TRIALS} trials per test`)

  // TimingWheel 테스트
  const timingWheelResults = await runTest(false)

  // GC 실행 및 대기
  console.log("\n--------------------------------------------------------------------")
  console.log("Garbage collection triggered. Waiting for 10 seconds...")
  console.log("--------------------------------------------------------------------")
  gc?.()
  await promisify(setTimeout)(10000)

  // Native 타이머 테스트
  const nativeResults = await runTest(true)

  // 결과 출력
  printResults(timingWheelResults, nativeResults)

  // 네이티브 타이머로 복원
  clearGlobalTimers()
}

// 프로세스 종료 시그널 처리
process.on("SIGINT", () => {
  console.log("\nBenchmark interrupted. Cleaning up...")
  clearGlobalTimers()
  process.exit(0)
})

// 벤치마크 실행
runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err)
  clearGlobalTimers()
})
