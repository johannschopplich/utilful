import { getReducedSize } from './size'

// #region Types

export type ReducedBlobType = typeof REDUCED_BLOB_TYPES[number]

export interface ReducedBlobOptions {
  /**
   * Maximum width or height in pixels. Smaller images are never upscaled.
   */
  maxDimension?: number
  /**
   * MIME type of the output. Defaults to the source type if it is one of these, otherwise `image/jpeg`.
   */
  type?: ReducedBlobType
  /**
   * Encoder quality between 0 and 1, applied to JPEG and WebP.
   * @default 0.85
   */
  quality?: number
  /**
   * Whether to re-encode an image that already has the right size and type, which drops EXIF data such as the location.
   * @default false
   */
  stripMetadata?: boolean
}

// #endregion

// #region Constants

const REDUCED_BLOB_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const DEFAULT_QUALITY = 0.85

// #endregion

// #region Reduce Blob

/**
 * Downscales an image blob to fit the maximum dimension and re-encodes it, preserving the aspect ratio.
 *
 * @remarks
 * Returns the original blob if nothing needs to change. Browser-only.
 */
export async function toReducedBlob(blob: Blob, options: ReducedBlobOptions = {}): Promise<Blob> {
  const { maxDimension, type, quality = DEFAULT_QUALITY, stripMetadata = false } = options

  if (!maxDimension && !type && !stripMetadata)
    return blob

  if (!blob.type.startsWith('image/'))
    throw new TypeError(`Expected an image, but got: ${blob.type || 'unknown type'}`)

  const outputType = type ?? (isReducedBlobType(blob.type) ? blob.type : 'image/jpeg')
  const source = await createImageBitmap(blob)
  let resized: ImageBitmap | undefined

  try {
    const size = getReducedSize(source, maxDimension)
    const isResized = size.width !== source.width || size.height !== source.height

    if (!isResized && outputType === blob.type && !stripMetadata)
      return blob

    if (isResized) {
      resized = await createImageBitmap(source, {
        resizeWidth: size.width,
        resizeHeight: size.height,
        // Defaults to `low`, which skips mipmaps in Chrome
        resizeQuality: 'high',
      })
    }

    // Encoders ignore `quality` for PNG
    return await encodeBitmap(resized ?? source, outputType, quality)
  }
  finally {
    source.close()
    resized?.close()
  }
}

// #endregion

// #region Helper functions

function isReducedBlobType(type: string): type is ReducedBlobType {
  return (REDUCED_BLOB_TYPES as readonly string[]).includes(type)
}

async function encodeBitmap(bitmap: ImageBitmap, type: ReducedBlobType, quality: number): Promise<Blob> {
  let blob: Blob | null

  // Safari supports `OffscreenCanvas` from 16.4 onwards
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    drawBitmap(canvas.getContext('2d'), bitmap)
    blob = await canvas.convertToBlob({ type, quality })
  }
  else {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height

    try {
      drawBitmap(canvas.getContext('2d'), bitmap)
      // Resolves `null` if Safari refused the canvas for exceeding its area limit
      blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))
    }
    finally {
      // Releases the backing store right away, which older iOS versions count against a memory cap
      canvas.width = 0
      canvas.height = 0
    }
  }

  if (!blob)
    throw new Error('Failed to encode the image')

  // Browsers fall back to PNG for types they cannot encode
  if (blob.type !== type)
    throw new Error(`This browser cannot encode ${type}`)

  return blob
}

function drawBitmap(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null,
  bitmap: ImageBitmap,
): void {
  if (!context)
    throw new Error('Failed to get a 2D canvas context')

  context.drawImage(bitmap, 0, 0)
}

// #endregion
