import { BUCKET_MASK, BUCKET_SIZE, BUCKET_SIZE_BIT } from "./constants"
const MAX = 0xffff_ffff
export function convertToIndex(timestamp: number) {
  const indexes: number[] = []

  while (timestamp > MAX) {
    indexes.push(timestamp % BUCKET_SIZE)
    timestamp = Math.floor(timestamp / BUCKET_SIZE)
  }

  while (timestamp > 0) {
    indexes.push(timestamp & BUCKET_MASK)
    timestamp >>>= BUCKET_SIZE_BIT
  }

  return indexes
}
