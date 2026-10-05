import process from 'node:process'
import { text } from 'node:stream/consumers'
import { beforeAll, describe, expect, it } from 'vitest'
import { mockStdin } from './testing'

const originalStdin = process.stdin

describe('mockStdin', () => {
  let failureOutsideTest: unknown

  beforeAll(() => {
    try {
      mockStdin('piped')
    }
    catch (error) {
      failureOutsideTest = error
    }
  })

  it('throws outside a test and leaves stdin as it was', () => {
    expect(failureOutsideTest).toBeInstanceOf(Error)
    expect(process.stdin).toBe(originalStdin)
  })

  it('pipes its input into stdin within a test', async () => {
    mockStdin('piped')

    expect(await text(process.stdin)).toBe('piped')
  })

  it('restores stdin after the test that mocked it finishes', () => {
    expect(process.stdin).toBe(originalStdin)
  })

  it('restores stdin early through the function it returns', () => {
    const restoreStdin = mockStdin('piped')
    restoreStdin()

    expect(process.stdin).toBe(originalStdin)
  })
})
