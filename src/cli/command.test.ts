import type { CliResult } from './testing'
import { describe, expect, it } from 'vitest'
import { commonArgs } from './args'
import { defineCommand } from './command'
import { CliError } from './errors'
import { createCliHarness } from './testing'

const STACK_FRAME = /^\s+at \S+/m

class ProbeError extends Error {}

const buildCommand = defineCommand({
  meta: { name: 'build', description: 'Build the entry file' },
  args: {
    ...commonArgs,
    'file': { type: 'positional', description: 'The entry file', required: true },
    'out-dir': { type: 'string', alias: 'd', description: 'Output directory' },
    'watch': { type: 'boolean', description: 'Rebuild on change', default: true },
  },
  run({ args }) {
    process.stdout.write(`${JSON.stringify(args)}\n`)
  },
})

let failure: unknown

const failCommand = defineCommand({
  meta: { name: 'fail', description: 'Throw whatever the test asked for' },
  args: commonArgs,
  run() {
    throw failure
  },
})

const mainCommand = defineCommand({
  meta: { name: 'probe', version: '1.2.3', description: 'A command tree to drive the runner with' },
  subCommands: { build: buildCommand, fail: failCommand },
})

const countCommand = defineCommand({
  meta: { name: 'count' },
  args: { file: { type: 'positional', required: true } },
  allowExtraPositionals: true,
  subCommands: { build: buildCommand },
  run({ args }) {
    process.stdout.write(`count ${args._.join(' ')}\n`)
  },
})

const { runCli } = createCliHarness(mainCommand, {
  expectedErrors: [ProbeError],
  describe: error => error instanceof ProbeError ? `Probe: ${error.message}` : undefined,
})

const { runCli: runCountCli } = createCliHarness(countCommand)

async function reportFor(error: unknown, argv: string[] = []): Promise<CliResult> {
  failure = error
  return runCli(['fail', ...argv])
}

describe('error reporting', () => {
  it('prints a CliError as its message alone', async () => {
    const { stderr } = await reportFor(new CliError('Not a directory: /tmp/missing'))

    expect(stderr).toContain('Not a directory: /tmp/missing')
    expect(stderr).not.toMatch(STACK_FRAME)
  })

  it('exits with code 1 after a CliError', async () => {
    const { exitCode } = await reportFor(new CliError('Not a directory: /tmp/missing'))

    expect(exitCode).toBe(1)
  })

  it('adds the stack to a CliError with --verbose', async () => {
    const { stderr } = await reportFor(new CliError('Not a directory: /tmp/missing'), ['--verbose'])

    expect(stderr).toMatch(STACK_FRAME)
  })

  it('omits the stack of an ArgumentError even with --verbose', async () => {
    const { stderr } = await runCli(['build', '--verbose'])

    expect(stderr).toContain('Missing required positional argument: FILE')
    expect(stderr).not.toMatch(STACK_FRAME)
  })

  it('exits with code 1 after an ArgumentError', async () => {
    const { exitCode } = await runCli(['build'])

    expect(exitCode).toBe(1)
  })

  it('prints the stack of a TypeError without --verbose', async () => {
    const { stderr } = await reportFor(new TypeError('entries.map is not a function'))

    expect(stderr).toContain('entries.map is not a function')
    expect(stderr).toMatch(STACK_FRAME)
  })

  it('omits the stack of an error class in expectedErrors', async () => {
    const { stderr } = await reportFor(new ProbeError('probe failed'))

    expect(stderr).not.toMatch(STACK_FRAME)
  })

  it('prints the text `describe` returns for an error', async () => {
    const { stderr } = await reportFor(new ProbeError('probe failed'))

    expect(stderr).toContain('Probe: probe failed')
  })

  it('omits the stack of an error with code ENOENT', async () => {
    const { stderr } = await reportFor(Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' }))

    expect(stderr).toContain('ENOENT')
    expect(stderr).not.toMatch(STACK_FRAME)
  })

  it('prints the stack of an error with code ERR_INVALID_ARG_TYPE', async () => {
    const { stderr } = await reportFor(Object.assign(new TypeError('The "path" argument must be of type string'), { code: 'ERR_INVALID_ARG_TYPE' }))

    expect(stderr).toMatch(STACK_FRAME)
  })

  it('names each cause with --verbose', async () => {
    const cause = new Error('permission denied', { cause: new RangeError('mode out of range') })
    const { stderr } = await reportFor(new CliError('Cannot read the input', { cause }), ['--verbose'])

    expect(stderr).toContain('Caused by: Error: permission denied\nCaused by: RangeError: mode out of range')
  })

  it('prints a thrown string as it is', async () => {
    const { stderr } = await reportFor('plain string failure')

    expect(stderr).toContain('plain string failure')
  })

  it('exits with code 1 after a thrown string', async () => {
    const { exitCode } = await reportFor('plain string failure')

    expect(exitCode).toBe(1)
  })
})

describe('help', () => {
  it('writes usage to stdout with --help', async () => {
    const { stdout, stderr, exitCode } = await runCli(['--help'])

    expect(stdout).toContain('USAGE')
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
  })

  it('writes usage to stderr after a missing <FILE>', async () => {
    const { stdout, stderr } = await runCli(['build'])

    expect(stdout).toBe('')
    expect(stderr).toContain('USAGE')
  })
})

describe('version', () => {
  it('writes the version with build --version', async () => {
    const { stdout } = await runCli(['build', '--version'])

    expect(stdout).toBe('1.2.3\n')
  })
})

describe('dispatch', () => {
  it('passes an --out-dir given before build on to build', async () => {
    const { stdout } = await runCli(['--out-dir', 'out', 'build', 'x.js'])

    expect(JSON.parse(stdout)).toMatchObject({ 'out-dir': 'out', 'file': 'x.js' })
  })

  it('reads fail after --out-dir as its value, not a command', async () => {
    const { stdout } = await runCli(['build', '--out-dir', 'fail', 'x.js'])

    expect(JSON.parse(stdout)).toMatchObject({ 'out-dir': 'fail', 'file': 'x.js' })
  })

  it('never reads build past -- as a command name', async () => {
    const { stderr } = await runCli(['--', 'build'])

    expect(stderr).toContain('Missing command')
  })

  it('rejects an empty argv with Missing command', async () => {
    const { stderr } = await runCli([])

    expect(stderr).toContain('Missing command')
  })

  it('rejects biuld as an unknown command', async () => {
    const { stderr } = await runCli(['biuld', 'x.js'])

    expect(stderr).toContain('Unknown command: biuld')
  })

  it('exits with code 1 after an unknown command', async () => {
    const { exitCode } = await runCli(['biuld', 'x.js'])

    expect(exitCode).toBe(1)
  })

  it('reads build after a.txt as an operand, not a command', async () => {
    const { stdout } = await runCountCli(['a.txt', 'build'])

    expect(stdout).toBe('count a.txt build\n')
  })
})
