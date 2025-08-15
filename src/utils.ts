import { BUCKET_MASK, BUCKET_SIZE_BIT } from "./constants"
export function convertToIndex(timestamp: number) {
  const indexes: number[] = []

  while (timestamp > 0) {
    indexes.push(timestamp & BUCKET_MASK)
    timestamp >>>= BUCKET_SIZE_BIT
  }

  return indexes
}
