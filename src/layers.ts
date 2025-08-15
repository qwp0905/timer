import { ITask } from "./task"

export class BucketLayer {
  private readonly buckets: (Set<ITask> | null)[] = []
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

  insert(task: ITask) {
    const tasks = (this.buckets[task.getIndex(this.layerNumber)!] ??= new Set())
    if (!tasks.add(task)) {
      return
    }
    this.size += 1
  }
}
