import { describe, expect, it } from 'vitest'
import { toReducedBlob } from './index'

describe('toReducedBlob', () => {
  it.each([
    [
      'an untyped blob without options',
      new Blob(['image']),
      {},
    ],
    [
      'a PNG with only quality',
      new Blob(['image'], { type: 'image/png' }),
      { quality: 0.5 },
    ],
  ])('returns %s unchanged', async (_, blob, options) => {
    expect(await toReducedBlob(blob, options)).toBe(blob)
  })
})
