import { ITask } from "./task"

export class BucketLayer {
  private readonly buckets: (ITask[] | null)[] = []
  private size = 0

  constructor(private readonly layerNumber: number) {}

  get length() {
    return this.size
  }

  dropdown(index: number) {
    const tasks = this.buckets[index]
    this.buckets[index] = null
    this.size -= tasks?.length ?? 0
    return tasks
  }

  insert(task: ITask) {
    const index = task.getIndex(this.layerNumber)!
    const tasks = this.buckets[index]
    if (!tasks) {
      this.buckets[index] = [task]
    } else {
      tasks.push(task)
    }
    this.size += 1
  }
}
