import type { ArgsDef } from './args'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { parseArgs } from './args'

const buildArgs = {
  'file': { type: 'positional', required: true },
  'out-dir': { type: 'string', alias: 'd' },
  'watch': { type: 'boolean', alias: 'w' },
  'name': { type: 'string', default: 'plugin' },
} as const

describe('parseArgs', () => {
  it('binds positionals and options by name', () => {
    expect(parseArgs(['src/index.js', '-d', 'out', '--watch'], buildArgs)).toEqual({
      '_': ['src/index.js'],
      'file': 'src/index.js',
      'out-dir': 'out',
      'watch': true,
      'name': 'plugin',
    })
  })

  it('types each value by its definition', () => {
    const args = parseArgs(['src/index.js'], buildArgs)

    expectTypeOf(args._).toEqualTypeOf<string[]>()
    expectTypeOf(args.file).toEqualTypeOf<string>()
    expectTypeOf(args.name).toEqualTypeOf<string>()
    expectTypeOf(args['out-dir']).toEqualTypeOf<string | undefined>()
    expectTypeOf(args.watch).toEqualTypeOf<boolean>()
    expectTypeOf(parseArgs([], {} as ArgsDef).anything).toEqualTypeOf<string | boolean | undefined>()
  })

  it('reads an absent boolean as false', () => {
    expect(parseArgs(['src/index.js'], buildArgs).watch).toBe(false)
  })

  it('turns a boolean off with --no-watch', () => {
    const args = parseArgs(['src/index.js', '--no-watch'], { ...buildArgs, watch: { type: 'boolean', default: true } })

    expect(args.watch).toBe(false)
  })

  it('reads -d=out as a directory named out', () => {
    expect(parseArgs(['src/index.js', '-d=out'], buildArgs)['out-dir']).toBe('out')
  })

  it('reads a negative number as the value of the option before it', () => {
    const args = parseArgs(['x', '--start', '-3', '-e', '-1'], { ...buildArgs, start: { type: 'string' }, end: { type: 'string', alias: 'e' } })

    expect(args).toMatchObject({ start: '-3', end: '-1' })
  })

  it('keeps an operand that starts with a dash past --', () => {
    expect(parseArgs(['--', '-d=out'], buildArgs).file).toBe('-d=out')
  })

  it('rejects an option no definition declares', () => {
    expect(() => parseArgs(['src/index.js', '--wtach'], buildArgs)).toThrow('Unknown option \'--wtach\'')
  })

  it('rejects a missing required positional by its name', () => {
    expect(() => parseArgs([], buildArgs)).toThrow('Missing required positional argument: FILE')
  })

  it('rejects a missing required option', () => {
    expect(() => parseArgs([], { token: { type: 'string', required: true } })).toThrow('Missing required argument: --token')
  })

  it('rejects a positional no definition binds', () => {
    expect(() => parseArgs(['a.js', 'b.js'], buildArgs)).toThrow('Unexpected argument: "b.js"')
  })

  it('keeps every positional in _ with allowExtraPositionals', () => {
    const args = parseArgs(['a.js', 'b.js'], {}, { allowExtraPositionals: true })

    expect(args._).toEqual(['a.js', 'b.js'])
  })
})
