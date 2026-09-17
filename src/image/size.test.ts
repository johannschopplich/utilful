import { describe, expect, it } from 'vitest'
import { getReducedSize } from './size'

describe('getReducedSize', () => {
  it('scales the longer side of a landscape size down to maxDimension', () => {
    expect(getReducedSize({ width: 4000, height: 3000 }, 2048)).toEqual({ width: 2048, height: 1536 })
  })

  it.each([
    { width: 1000, height: 800 },
    { width: 2048, height: 1024 },
  ])('keeps $width×$height within maxDimension 2048', (size) => {
    expect(getReducedSize(size, 2048)).toEqual(size)
  })

  it('keeps the size without maxDimension', () => {
    expect(getReducedSize({ width: 8000, height: 6000 })).toEqual({ width: 8000, height: 6000 })
  })

  it('keeps at least one pixel on the shorter side', () => {
    expect(getReducedSize({ width: 1, height: 10000 }, 100)).toEqual({ width: 1, height: 100 })
  })
})
