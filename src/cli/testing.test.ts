import * as path from 'node:path'
import process from 'node:process'
import { text } from 'node:stream/consumers'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineCommand } from './command'
import { createCliHarness, mockStdin, useTemporaryDirectories } from './testing'

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

describe('env', () => {
  const createDirectory = useTemporaryDirectories()
  const printEnv = defineCommand({
    run() {
      process.stdout.write(`${JSON.stringify({ added: process.env.UTILFUL_ADDED, removed: process.env.UTILFUL_REMOVED })}\n`)
    },
  })
  const { runCli } = createCliHarness(printEnv)

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['runCli', () => runCli([], { env: { UTILFUL_ADDED: 'yes', UTILFUL_REMOVED: undefined } })],
    ['runCliProcess', () => {
      const entry = path.join(createDirectory({ 'entry.mjs': 'console.log(JSON.stringify({ added: process.env.UTILFUL_ADDED, removed: process.env.UTILFUL_REMOVED }))' }), 'entry.mjs')
      return createCliHarness(printEnv, { entry }).runCliProcess([], { env: { UTILFUL_ADDED: 'yes', UTILFUL_REMOVED: undefined } })
    }],
  ])('sets and removes variables for %s', async (_, run) => {
    vi.stubEnv('UTILFUL_REMOVED', 'still here')

    const { stdout } = await run()

    expect(JSON.parse(stdout)).toEqual({ added: 'yes' })
  })

  it('leaves the environment as it was after runCli', async () => {
    vi.stubEnv('UTILFUL_REMOVED', 'still here')

    await runCli([], { env: { UTILFUL_ADDED: 'yes', UTILFUL_REMOVED: undefined } })

    expect(process.env.UTILFUL_ADDED).toBeUndefined()
    expect(process.env.UTILFUL_REMOVED).toBe('still here')
  })
})
