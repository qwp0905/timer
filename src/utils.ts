import { BUCKET_MASK, BUCKET_SIZE } from "./constants"

export function convertToIndex(timestamp: number) {
  const indexes: number[] = []

  while (timestamp > 0) {
    indexes.push(timestamp & BUCKET_MASK)
    timestamp = Math.floor(timestamp / BUCKET_SIZE)
  }

  return indexes
}
