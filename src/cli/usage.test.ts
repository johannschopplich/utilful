import { beforeAll, describe, expect, it } from 'vitest'
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
  },
})

const mainCommand = defineCommand({
  meta: { name: 'probe', version: '1.2.3', description: 'A command tree' },
  subCommands: { build: buildCommand },
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
    expect(treeUsage).toContain('USAGE  probe build\n')
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

  it('omits (Default: false) from --json', () => {
    expect(buildUsage).toMatch(/^ +--json +Print JSON$/m)
  })

  it('starts every description in the same column', () => {
    const columns = ['Output directory', 'Rebuild on change', 'API token']
      .map(description => buildUsage.split('\n').find(line => line.includes(description))!.indexOf(description))

    expect(new Set(columns).size).toBe(1)
  })
})
