import type { ArgsDef } from './args'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { parseArgs } from './args'
import { defineCommand } from './command'
import { ArgumentError } from './errors'

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
  })

  it('types every key of a plain ArgsDef as string | boolean | undefined', () => {
    expectTypeOf(parseArgs([], {} as ArgsDef).anything).toEqualTypeOf<string | boolean | undefined>()
  })

  it('reads an absent --watch as false', () => {
    expect(parseArgs(['src/index.js'], buildArgs).watch).toBe(false)
  })

  it('turns a boolean off with --no-watch', () => {
    const args = parseArgs(['src/index.js', '--no-watch'], { ...buildArgs, watch: { type: 'boolean', default: true } })

    expect(args.watch).toBe(false)
  })

  it('reads -d=out as --out-dir out', () => {
    expect(parseArgs(['src/index.js', '-d=out'], buildArgs)['out-dir']).toBe('out')
  })

  it('reads -3 and -1 as the values of --start and -e', () => {
    const args = parseArgs(['x', '--start', '-3', '-e', '-1'], { ...buildArgs, start: { type: 'string' }, end: { type: 'string', alias: 'e' } })

    expect(args).toMatchObject({ start: '-3', end: '-1' })
  })

  it('keeps -d=out past -- as an operand', () => {
    expect(parseArgs(['--', '-d=out'], buildArgs).file).toBe('-d=out')
  })

  it('rejects an undeclared --wtach', () => {
    expect(() => parseArgs(['src/index.js', '--wtach'], buildArgs)).toThrow('Unknown option \'--wtach\'')
  })

  it('rejects a missing required file by the name FILE', () => {
    expect(() => parseArgs([], buildArgs)).toThrow('Missing required positional argument: FILE')
  })

  it('rejects a missing required --token', () => {
    expect(() => parseArgs([], { token: { type: 'string', required: true } })).toThrow('Missing required argument: --token')
  })

  it('rejects b.js as an extra positional', () => {
    expect(() => parseArgs(['a.js', 'b.js'], buildArgs)).toThrow('Unexpected argument: "b.js"')
  })

  it('keeps every positional in _ with allowExtraPositionals', () => {
    const args = parseArgs(['a.js', 'b.js'], {}, { allowExtraPositionals: true })

    expect(args._).toEqual(['a.js', 'b.js'])
  })
})

describe('enum', () => {
  const engineArgs = {
    engine: { type: 'enum', options: ['2k', '2k3'], alias: 'e' },
    format: { type: 'enum', options: ['json', 'text'], default: 'text' },
  } as const

  it('binds -e 2k3 and defaults --format to text', () => {
    expect(parseArgs(['-e', '2k3'], engineArgs)).toMatchObject({ engine: '2k3', format: 'text' })
  })

  it('types each value as the union of its options', () => {
    const args = parseArgs([], engineArgs)

    expectTypeOf(args.engine).toEqualTypeOf<'2k' | '2k3' | undefined>()
    expectTypeOf(args.format).toEqualTypeOf<'json' | 'text'>()
  })

  it('types an enum declared inline as the union of its options', () => {
    expectTypeOf(parseArgs([], { format: { type: 'enum', options: ['json', 'text'], default: 'text' } }).format).toEqualTypeOf<'json' | 'text'>()

    defineCommand({
      args: { format: { type: 'enum', options: ['json', 'text'] } },
      run({ args }) {
        expectTypeOf(args.format).toEqualTypeOf<'json' | 'text' | undefined>()
      },
    })
  })

  it('rejects a misspelled key of an argument definition', () => {
    const typoArgs = { file: { type: 'positional', requird: true } } as const

    // @ts-expect-error `requird` is no key of an argument definition.
    defineCommand({ args: typoArgs })
    // @ts-expect-error `defualt` is no key of an argument definition.
    defineCommand({ args: { out: { type: 'string', defualt: 'dist' } } })
  })

  it('rejects 3k with the options it could have been', () => {
    const parse = (): unknown => parseArgs(['--engine', '3k'], engineArgs)

    expect(parse).toThrow(ArgumentError)
    expect(parse).toThrow('Invalid value for --engine: "3k". Expected one of: 2k, 2k3')
  })

  it('rejects a default outside the options as a defect, not an ArgumentError', () => {
    const parse = (): unknown => parseArgs([], { format: { type: 'enum', options: ['json'], default: 'yaml' } })

    expect(parse).toThrow('The default of --format, "yaml", is not one of: json')
    expect(parse).not.toThrow(ArgumentError)
  })

  it('reads -1 as the value of --level', () => {
    expect(parseArgs(['--level', '-1'], { level: { type: 'enum', options: ['-1', '0'] } }).level).toBe('-1')
  })
})
