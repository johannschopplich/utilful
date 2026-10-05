import { describe, expect, it } from 'vitest'
import { readStdin } from './stdin'
import { mockStdin } from './testing'

describe('readStdin', () => {
  it('reads everything piped in as UTF-8 text', async () => {
    mockStdin('héllo\nwörld\n')

    expect(await readStdin()).toBe('héllo\nwörld\n')
  })

  it('reads stdin that has already ended as empty', async () => {
    mockStdin('once')
    await readStdin()

    expect(await readStdin()).toBe('')
  })
})
