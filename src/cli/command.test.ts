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

describe('error boundary', () => {
  it('prints a recognized error as a message alone', async () => {
    const { stderr, exitCode } = await reportFor(new CliError('Not a directory: /tmp/missing'))

    expect(stderr).toContain('Not a directory: /tmp/missing')
    expect(stderr).not.toMatch(STACK_FRAME)
    expect(exitCode).toBe(1)
  })

  it('adds the stack to a recognized error with --verbose', async () => {
    const { stderr } = await reportFor(new CliError('Not a directory: /tmp/missing'), ['--verbose'])

    expect(stderr).toMatch(STACK_FRAME)
  })

  it('keeps the stack off a wrong argument even with --verbose', async () => {
    const { stderr } = await runCli(['build', '--verbose'])

    expect(stderr).toContain('Missing required positional argument: FILE')
    expect(stderr).not.toMatch(STACK_FRAME)
  })

  it('prints the stack of an unexpected error without being asked', async () => {
    const { stderr } = await reportFor(new TypeError('entries.map is not a function'))

    expect(stderr).toContain('entries.map is not a function')
    expect(stderr).toMatch(STACK_FRAME)
  })

  it('treats a class named in expectedErrors as recognized', async () => {
    const { stderr } = await reportFor(new ProbeError('probe failed'))

    expect(stderr).not.toMatch(STACK_FRAME)
  })

  it('renders an error through describe', async () => {
    const { stderr } = await reportFor(new ProbeError('probe failed'))

    expect(stderr).toContain('Probe: probe failed')
  })

  it('treats an error with a system error code as recognized', async () => {
    const { stderr } = await reportFor(Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' }))

    expect(stderr).toContain('ENOENT')
    expect(stderr).not.toMatch(STACK_FRAME)
  })

  it('prints the stack of an error with an ERR_ code', async () => {
    const { stderr } = await reportFor(Object.assign(new TypeError('The "path" argument must be of type string'), { code: 'ERR_INVALID_ARG_TYPE' }))

    expect(stderr).toMatch(STACK_FRAME)
  })

  it('names each cause with --verbose', async () => {
    const { stderr } = await reportFor(new CliError('Cannot read the input', { cause: new Error('permission denied') }), ['--verbose'])

    expect(stderr).toContain('Caused by: Error: permission denied')
  })

  it('reports a thrown non-error by its string form', async () => {
    const { stderr, exitCode } = await reportFor('plain string failure')

    expect(stderr).toContain('plain string failure')
    expect(exitCode).toBe(1)
  })
})

describe('help', () => {
  it('writes requested help to stdout', async () => {
    const { stdout, stderr, exitCode } = await runCli(['--help'])

    expect(stdout).toContain('USAGE')
    expect(stdout).toContain('build')
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
  })

  it('writes the help of the named command', async () => {
    const { stdout } = await runCli(['build', '--help'])

    expect(stdout).toContain('probe build')
    expect(stdout).toContain('<FILE>')
  })

  it('writes the version to stdout from behind a command name', async () => {
    const { stdout } = await runCli(['build', '--version'])

    expect(stdout).toBe('1.2.3\n')
  })

  it('keeps usage off stdout when an argument was wrong', async () => {
    const { stdout, stderr, exitCode } = await runCli(['build'])

    expect(stdout).toBe('')
    expect(stderr).toContain('USAGE')
    expect(stderr).toContain('Missing required positional argument: FILE')
    expect(exitCode).toBe(1)
  })
})

describe('dispatch', () => {
  it('hands options before the command name to the command', async () => {
    const { stdout } = await runCli(['--out-dir', 'out', 'build', 'x.js'])

    expect(JSON.parse(stdout)).toMatchObject({ 'out-dir': 'out', 'file': 'x.js' })
  })

  it('does not mistake an option value for a command name', async () => {
    const { stdout } = await runCli(['build', '--out-dir', 'fail', 'x.js'])

    expect(JSON.parse(stdout)).toMatchObject({ 'out-dir': 'fail', 'file': 'x.js' })
  })

  it('never reads an operand past -- as a command name', async () => {
    const { stderr } = await runCli(['--', 'build'])

    expect(stderr).toContain('Missing command')
  })

  it('asks for a command when none was named', async () => {
    const { stderr, exitCode } = await runCli([])

    expect(stderr).toContain('Missing command')
    expect(exitCode).toBe(1)
  })

  it('names an operand that is no command', async () => {
    const { stderr, exitCode } = await runCli(['biuld', 'x.js'])

    expect(stderr).toContain('Unknown command: biuld')
    expect(exitCode).toBe(1)
  })

  it('runs the tree itself when no operand names a command', async () => {
    const { stdout } = await runCountCli(['a.txt', 'b.txt'])

    expect(stdout).toBe('count a.txt b.txt\n')
  })

  it('reads only the first operand as a command name', async () => {
    const { stdout } = await runCountCli(['a.txt', 'build'])

    expect(stdout).toBe('count a.txt build\n')
  })
})
