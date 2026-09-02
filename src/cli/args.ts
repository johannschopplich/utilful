import type { ParseArgsOptionDescriptor } from 'node:util'
import { parseArgs as parseNodeArgs } from 'node:util'
import { ArgumentError } from './errors'

export interface StringArgDef {
  type: 'string'
  /** One letter, as in `-d`. */
  alias?: string
  description?: string
  default?: string
  required?: boolean
  /** Placeholder in the help, as in `--out-dir=<path>`. */
  valueHint?: string
}

export interface BooleanArgDef {
  type: 'boolean'
  alias?: string
  description?: string
  default?: boolean
}

export interface PositionalArgDef {
  type: 'positional'
  description?: string
  required?: boolean
}

export type ArgDef = StringArgDef | BooleanArgDef | PositionalArgDef

export type ArgsDef = Record<string, ArgDef>

export type ParsedArgs<T extends ArgsDef = ArgsDef> = {
  /** Every positional, bound by a definition or not. */
  _: string[]
} & {
  // A definition typed as plain `ArgsDef` says nothing about any one key.
  [K in keyof T]: ArgDef extends T[K]
    ? string | boolean | undefined
    : T[K] extends { type: 'boolean' }
      ? boolean
      : T[K] extends { default: string } | { required: true }
        ? string
        : string | undefined
}

export interface CommonArgs extends ArgsDef {
  verbose: BooleanArgDef
}

export const commonArgs: CommonArgs = {
  verbose: {
    type: 'boolean',
    description: 'Print the cause chain and stack trace on failure',
  },
}

/** Parses `argv` against a definition. An absent boolean reads as `false`, and `--no-<name>` turns one off. */
export function parseArgs<T extends ArgsDef>(
  argv: readonly string[],
  argsDef: T,
  { allowExtraPositionals = false }: { allowExtraPositionals?: boolean } = {},
): ParsedArgs<T> {
  let parseResult: ReturnType<typeof parseNodeArgs>
  try {
    parseResult = parseNodeArgs({
      args: joinNegativeValues(splitShortOptionValues(argv), argsDef),
      options: toNodeOptions(argsDef),
      strict: true,
      allowPositionals: true,
      allowNegative: true,
    })
  }
  catch (error) {
    // Node appends a hint sentence about `--`, which the usage below the message covers.
    if (isNodeArgumentError(error))
      throw new ArgumentError(error.message.split('. ')[0]!)
    throw error
  }

  const args: Record<string, unknown> = { _: parseResult.positionals }
  const positionalNames: string[] = []

  for (const [name, definition] of Object.entries(argsDef)) {
    if (definition.type === 'positional') {
      positionalNames.push(name)
      continue
    }

    const value = parseResult.values[name]

    if (definition.type === 'boolean')
      args[name] = value ?? false
    else if (value === undefined && definition.required === true)
      throw new ArgumentError(`Missing required argument: --${name}`)
    else
      args[name] = value
  }

  positionalNames.forEach((name, index) => {
    const definition = argsDef[name] as PositionalArgDef
    const value = parseResult.positionals[index]

    if (value === undefined && definition.required === true)
      throw new ArgumentError(`Missing required positional argument: ${name.toUpperCase()}`)

    args[name] = value
  })

  if (!allowExtraPositionals && parseResult.positionals.length > positionalNames.length)
    throw new ArgumentError(`Unexpected argument: ${JSON.stringify(parseResult.positionals[positionalNames.length])}`)

  return args as ParsedArgs<T>
}

export function toNodeOptions(argsDef: ArgsDef): Record<string, ParseArgsOptionDescriptor> {
  const options: Record<string, ParseArgsOptionDescriptor> = {}

  for (const [name, definition] of Object.entries(argsDef)) {
    if (definition.type === 'positional')
      continue

    const option: ParseArgsOptionDescriptor = { type: definition.type }
    if (definition.alias !== undefined)
      option.short = definition.alias
    if (definition.default !== undefined)
      option.default = definition.default
    options[name] = option
  }

  return options
}

/**
 * Splits an inline value off a short option. Node's `parseArgs` splits
 * `--name=value` but leaves `-n=value` whole, so `-o=report.json` would write to
 * a file named `=report.json`. Past `--` every token is an operand and stays as
 * it was written.
 */
function splitShortOptionValues(argv: readonly string[]): string[] {
  const splitArguments: string[] = []
  let isTerminated = false

  for (const argument of argv) {
    const match = /^(-[^-])=(.*)$/.exec(argument)

    if (isTerminated || match === null) {
      splitArguments.push(argument)
      isTerminated ||= argument === '--'
      continue
    }

    splitArguments.push(match[1]!, match[2]!)
  }

  return splitArguments
}

/**
 * Joins a negative number onto the value-taking option before it, as
 * `--start=-3`. Node refuses `--start -3` as ambiguous, but a token that starts
 * with a digit after its dash is a number wherever a value is due.
 */
function joinNegativeValues(argv: readonly string[], argsDef: ArgsDef): string[] {
  const optionNamesBySpelling = new Map<string, string>()

  for (const [name, definition] of Object.entries(argsDef)) {
    if (definition.type !== 'string')
      continue
    optionNamesBySpelling.set(`--${name}`, name)
    if (definition.alias !== undefined)
      optionNamesBySpelling.set(`-${definition.alias}`, name)
  }

  const joinedArguments: string[] = []

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!
    const next = argv[index + 1]
    const name = optionNamesBySpelling.get(argument)

    if (argument === '--') {
      joinedArguments.push(...argv.slice(index))
      break
    }

    if (name !== undefined && next !== undefined && /^-\d/.test(next)) {
      joinedArguments.push(`--${name}=${next}`)
      index++
      continue
    }

    joinedArguments.push(argument)
  }

  return joinedArguments
}

function isNodeArgumentError(error: unknown): error is Error {
  return error instanceof Error && String((error as { code?: unknown }).code).startsWith('ERR_PARSE_ARGS')
}
