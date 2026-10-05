import { beforeAll, describe, expect, it } from 'vitest'
import { commonArgs } from './args'
import { defineCommand } from './command'
import { createCliHarness } from './testing'

const buildCommand = defineCommand({
  meta: { name: 'build', description: 'Build the entry file' },
  args: {
    'file': { type: 'positional', description: 'The entry file', required: true },
    'out-dir': { type: 'string', alias: 'd', description: 'Output directory', default: 'dist' },
    'watch': { type: 'boolean', description: 'Rebuild on change', default: true },
    'json': { type: 'boolean', description: 'Print JSON', default: false },
    'token': { type: 'string', description: 'API token', required: true, valueHint: 'secret' },
    'format': { type: 'enum', options: ['esm', 'iife'], description: 'Bundle format' },
    'target': { type: 'enum', options: ['node', 'browser'], description: 'Runtime', valueHint: 'platform' },
  },
})

const checkCommand = defineCommand({
  meta: { name: 'inspect', version: '2.0.0', description: 'Check a half of the catalog' },
  subCommands: {
    covers: defineCommand({
      meta: { description: 'Check the covers' },
      args: { sample: { type: 'string', description: 'Pairs to judge' } },
    }),
  },
})

const mainCommand = defineCommand({
  meta: { name: 'probe', version: '1.2.3', description: 'A command tree' },
  subCommands: {
    build: buildCommand,
    catalog: defineCommand({
      meta: { description: 'Work on the catalog' },
      subCommands: { check: checkCommand },
    }),
  },
})

const { runCli } = createCliHarness(mainCommand)

describe('usage', () => {
  let treeUsage: string
  let buildUsage: string

  beforeAll(async () => {
    treeUsage = (await runCli(['--help'])).stdout
    buildUsage = (await runCli(['build', '--help'])).stdout
  })

  it('opens with the name and version, then the description', () => {
    expect(treeUsage.split('\n').slice(0, 2)).toEqual(['probe v1.2.3', 'A command tree'])
  })

  it('lists subCommands on the USAGE line', () => {
    expect(treeUsage).toContain('USAGE  probe build|catalog\n')
  })

  it('lists subCommands with their descriptions', () => {
    expect(treeUsage).toMatch(/^ +build +Build the entry file$/m)
  })

  it('points to probe <command> --help at the end', () => {
    expect(treeUsage.trimEnd().split('\n').at(-1)).toContain('probe <command> --help')
  })

  it('prefixes a subCommands entry with the name of its parent', () => {
    expect(buildUsage).toMatch(/^USAGE {2}probe build /m)
  })

  it('lists [OPTIONS], <FILE> and a required --token=<secret> on the USAGE line', () => {
    expect(buildUsage).toMatch(/^USAGE {2}probe build \[OPTIONS\] <FILE> --token=<secret>$/m)
  })

  it('inherits the version of the parent', () => {
    expect(buildUsage.split('\n')[0]).toBe('probe build v1.2.3')
  })

  it('lists -d beside --out-dir', () => {
    expect(buildUsage).toMatch(/^ +-d, --out-dir=<out-dir> +Output directory/m)
  })

  it('shows (Default: dist) for --out-dir', () => {
    expect(buildUsage).toMatch(/^ +-d, --out-dir=<out-dir> +Output directory \(Default: dist\)$/m)
  })

  it('lists --no-watch for a boolean that defaults to true', () => {
    expect(buildUsage).toMatch(/^ +--watch +Rebuild on change \(Default: true\)\n +--no-watch$/m)
  })

  it('marks --token as (Required)', () => {
    expect(buildUsage).toMatch(/^ +--token=<secret> +API token \(Required\)$/m)
  })

  it('names the value of --token after its valueHint', () => {
    expect(buildUsage).toMatch(/^ +--token=<secret> +API token/m)
    expect(buildUsage).not.toContain('<token>')
  })

  it('names the options of --format as its value', () => {
    expect(buildUsage).toMatch(/^ +--format=<esm\|iife> +Bundle format$/m)
  })

  it('names the value of --target after its valueHint, not its options', () => {
    expect(buildUsage).toMatch(/^ +--target=<platform> +Runtime$/m)
  })

  it('omits (Default: false) from --json', () => {
    expect(buildUsage).toMatch(/^ +--json +Print JSON$/m)
  })

  it('lists --verbose last for a command that runs', () => {
    expect(buildUsage.trimEnd().split('\n').at(-1)).toMatch(/^ +--verbose +Print the stack trace on failure$/)
  })

  it('lists --verbose once for a command that spreads commonArgs', async () => {
    const { runCli: runSpreadCli } = createCliHarness(defineCommand({ meta: { name: 'spread' }, args: commonArgs, run() {} }))
    const { stdout } = await runSpreadCli(['--help'])

    expect(stdout.match(/--verbose/g)).toHaveLength(1)
  })

  it('lists the --verbose a command declares in place of verboseArg', async () => {
    const { runCli: runOwnCli } = createCliHarness(defineCommand({ args: { verbose: { type: 'boolean', description: 'Log every step' } }, run() {} }))
    const { stdout } = await runOwnCli(['--help'])

    expect(stdout).toMatch(/^ +--verbose +Log every step$/m)
    expect(stdout.match(/--verbose/g)).toHaveLength(1)
  })

  it('lists no options for a tree that does not run on its own', () => {
    expect(treeUsage).not.toContain('OPTIONS')
  })

  it('starts every description in the same column', () => {
    const columns = ['Output directory', 'Rebuild on change', 'API token']
      .map(description => buildUsage.split('\n').find(line => line.includes(description))!.indexOf(description))

    expect(new Set(columns).size).toBe(1)
  })
})

describe('usage of a nested command', () => {
  it.each([
    [['catalog', '--help'], 'probe catalog check'],
    [['catalog', 'check', '--help'], 'probe catalog check covers'],
    [['catalog', 'check', 'covers', '--help'], 'probe catalog check covers \\[OPTIONS\\]'],
  ])('names every command walked for %j', async (argv, usageLine) => {
    const { stdout } = await runCli(argv)

    expect(stdout).toMatch(new RegExp(`^USAGE {2}${usageLine}$`, 'm'))
  })

  it('prints the options of catalog check covers', async () => {
    const { stdout } = await runCli(['catalog', 'check', 'covers', '--help'])

    expect(stdout).toMatch(/^ +--sample=<sample> +Pairs to judge$/m)
  })

  it('opens with the path of keys, not with the meta.name inspect', async () => {
    const { stdout } = await runCli(['catalog', 'check', '--help'])

    expect(stdout.split('\n')[0]).toBe('probe catalog check v2.0.0')
  })

  it('takes the version of the nearest command that declares one', async () => {
    const { stdout } = await runCli(['catalog', 'check', 'covers', '--help'])

    expect(stdout.split('\n')[0]).toBe('probe catalog check covers v2.0.0')
  })

  it('opens with the version of the root for a command without its own', async () => {
    const { stdout } = await runCli(['catalog', '--help'])

    expect(stdout.split('\n')[0]).toBe('probe catalog v1.2.3')
  })

  it('prints the usage of catalog check covers after an unknown option', async () => {
    const { stderr } = await runCli(['catalog', 'check', 'covers', '--bogus'])

    expect(stderr).toContain('Unknown option \'--bogus\'')
    expect(stderr).toMatch(/^USAGE {2}probe catalog check covers \[OPTIONS\]$/m)
  })

  it('prints the usage of the command that is missing its sub-command', async () => {
    const { stderr } = await runCli(['catalog', 'check'])

    expect(stderr).toContain('Missing command')
    expect(stderr).toMatch(/^USAGE {2}probe catalog check covers$/m)
  })
})
