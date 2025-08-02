import { BUCKET_SIZE } from "./constants"

export function convertToIndex(timestamp: number) {
  return timestamp
    .toString(BUCKET_SIZE)
    .split("")
    .map((e) => parseInt(e, BUCKET_SIZE))
    .reverse()
}
