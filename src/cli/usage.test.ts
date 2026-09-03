import { describe, expect, it } from 'vitest'
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
  it('lists the commands of a tree', async () => {
    const { stdout } = await runCli(['--help'])

    expect(stdout.split('\n').slice(0, 2)).toEqual(['probe v1.2.3', 'A command tree'])
    expect(stdout).toContain('USAGE')
    expect(stdout).toContain('probe build')
    expect(stdout).toContain('Build the entry file')
    expect(stdout).toContain('probe <command> --help')
  })

  it('prefixes a sub-command with the name of its parent', async () => {
    const { stdout } = await runCli(['build', '--help'])

    expect(stdout).toContain('probe build [OPTIONS] <FILE> --token=<secret>')
    expect(stdout.split('\n')[0]).toBe('probe build v1.2.3')
  })

  it('renders every spelling and hint of an option', async () => {
    const { stdout } = await runCli(['build', '--help'])

    expect(stdout).toContain('-d, --out-dir=<out-dir>')
    expect(stdout).toContain('(Default: dist)')
    expect(stdout).toContain('--no-watch')
    expect(stdout).toContain('(Required)')
  })

  it('names the value of an option after its hint', async () => {
    const { stdout } = await runCli(['build', '--help'])

    expect(stdout).toContain('--token=<secret>')
    expect(stdout).not.toContain('<token>')
  })

  it('omits the default of a boolean that is off by default', async () => {
    const { stdout } = await runCli(['build', '--help'])

    expect(stdout).not.toContain('(Default: false)')
  })

  it('starts every description in the same column', async () => {
    const { stdout } = await runCli(['build', '--help'])
    const columns = ['Output directory', 'Rebuild on change', 'API token']
      .map(description => stdout.split('\n').find(line => line.includes(description))!.indexOf(description))

    expect(new Set(columns).size).toBe(1)
  })
})
