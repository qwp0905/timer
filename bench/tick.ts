import { TestingTimer, TimingWheel } from "../timing-wheel"

const trial = 10

const delay = 0x00ff_ffff
const count = 1_000_000
const callback = () => {}
const delays = Array.from({ length: count }, () => Math.random() * delay)

function runTrial() {
  const timer = new TestingTimer()
  const wheel = TimingWheel.withTesting(timer)
  for (let i = 0; i < count; i += 1) {
    wheel.register(delays[i], callback, false)
  }

  timer.advance(delay)
  const start = performance.now()
  wheel.tick()
  return performance.now() - start
}

function runBenchmark() {
  console.log("--------------------------------")
  console.log(`Running benchmark with ${count.toLocaleString()} timers, ${trial} trials`)
  console.log("--------------------------------")
  const results = []
  for (let i = 0; i < trial; i += 1) {
    const elapsed = runTrial()
    console.log(`trial ${i + 1}: ${elapsed.toLocaleString()} ms`)
    console.log(`  ${(delay / elapsed).toLocaleString()} ops/ms`)
    console.log("--------------------------------")
    results.push(elapsed)
  }

  const average = results.reduce((a, b) => a + b, 0) / trial
  console.log(`\nAverage for ${trial} trials:`)
  console.log("--------------------------------")
  console.log(`average: ${average.toLocaleString()} ms`)
  console.log(`  ${(delay / average).toLocaleString()} ops/ms`)
  console.log("--------------------------------")
}
runBenchmark()
