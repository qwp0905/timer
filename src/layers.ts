import { TimeoutTask } from "./task"

export class BucketLayer {
  private readonly buckets: (Set<TimeoutTask> | null)[] = []
  private size = 0

  constructor(private readonly layerNumber: number) {}

  get length() {
    return this.size
  }

  dropdown(index: number) {
    const tasks = this.buckets[index]
    this.buckets[index] = null
    this.size -= tasks?.size ?? 0
    return tasks
  }

  insert(task: TimeoutTask) {
    const tasks = (this.buckets[task.getIndex(this.layerNumber)!] ??= new Set())
    if (!tasks.add(task)) {
      return
    }
    this.size += 1
  }

  remove(task: TimeoutTask) {
    const index = task.getIndex(this.layerNumber)!
    const tasks = this.buckets[index]
    if (!tasks?.delete(task)) {
      return false
    }

    if (tasks.size === 0) {
      this.buckets[index] = null
    }

    this.size -= 1
    return true
  }
}
