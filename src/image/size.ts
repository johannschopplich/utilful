export interface ImageSize {
  width: number
  height: number
}

export function getReducedSize(size: ImageSize, maxDimension?: number): ImageSize {
  if (!maxDimension || Math.max(size.width, size.height) <= maxDimension)
    return size

  const ratio = maxDimension / Math.max(size.width, size.height)

  return {
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(size.height * ratio)),
  }
}
