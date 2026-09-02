import type { ArgsDef, ParsedArgs } from './args'
import type { ReportOptions } from './errors'
import process from 'node:process'
import { parseArgs as parseNodeArgs } from 'node:util'
import { parseArgs, toNodeOptions } from './args'
import { ArgumentError, reportFailure } from './errors'
import { renderUsage } from './usage'

export interface CommandMeta {
  name?: string
  version?: string
  description?: string
}

export interface CommandContext<T extends ArgsDef = ArgsDef> {
  args: ParsedArgs<T>
}

export interface CommandDef<T extends ArgsDef = ArgsDef> {
  meta?: CommandMeta
  args?: T
  subCommands?: Record<string, CommandDef<any>>
  allowExtraPositionals?: boolean
  run?: (context: CommandContext<T>) => unknown
}

export interface RunMainOptions extends Omit<ReportOptions, 'verbose'> {
  /** @default process.argv.slice(2) */
  argv?: readonly string[]
}

// Both short forms belong to the runner, so no option may take `h` or `v` as its alias.
const HELP_FLAGS: ReadonlySet<string> = new Set(['--help', '-h'])
const VERSION_FLAGS: ReadonlySet<string> = new Set(['--version', '-v'])

export function defineCommand<T extends ArgsDef>(command: CommandDef<T>): CommandDef<T> {
  return command
}

/**
 * Runs the command tree and reports whatever it throws. Help someone asked for
 * is the result of the run and goes to stdout; usage that follows a wrong
 * argument is diagnostics and joins its message on stderr.
 */
export async function runMain<T extends ArgsDef>(command: CommandDef<T>, options: RunMainOptions = {}): Promise<void> {
  const argv = options.argv ?? process.argv.slice(2)
  const beforeTerminator = argv.slice(0, argv.includes('--') ? argv.indexOf('--') : undefined)
  const hasFlag = (flags: ReadonlySet<string>): boolean => beforeTerminator.some(argument => flags.has(argument))

  try {
    if (hasFlag(HELP_FLAGS))
      process.stdout.write(`${usageFor(command, argv, process.stdout)}\n`)
    else if (hasFlag(VERSION_FLAGS))
      process.stdout.write(`${command.meta?.version ?? ''}\n`)
    else
      await runCommand(command, argv)
  }
  catch (error) {
    if (error instanceof ArgumentError)
      process.stderr.write(`${usageFor(command, argv, process.stderr)}\n\n`)

    // A wrong argument is the user's to fix, so its stack would only bury the usage above it.
    const verbose = !(error instanceof ArgumentError) && beforeTerminator.includes('--verbose')
    reportFailure(error, { ...options, verbose })
  }
}

/** Runs like `runMain`, but without the error boundary. */
export async function runCommand<T extends ArgsDef>(command: CommandDef<T>, argv: readonly string[]): Promise<void> {
  const { name, firstOperand, rest } = findSubCommand(command, argv)

  if (name !== undefined)
    return runCommand(command.subCommands![name]!, rest)

  if (command.subCommands !== undefined && command.run === undefined)
    throw new ArgumentError(firstOperand === undefined ? 'Missing command' : `Unknown command: ${firstOperand}`)

  const args = parseArgs(rest, (command.args ?? {}) as T, { allowExtraPositionals: command.allowExtraPositionals })
  await command.run?.({ args })
}

function usageFor(command: CommandDef<any>, argv: readonly string[], stream: NodeJS.WriteStream): string {
  const { name } = findSubCommand(command, argv)

  return name === undefined
    ? renderUsage(command, { stream })
    : renderUsage(command.subCommands![name]!, { parent: command, stream })
}

/**
 * Finds the sub-command the first operand names, wherever it stands among the
 * options. Telling an operand from the value of an option needs every
 * value-taking option of every sub-command, since the command is still unknown.
 */
function findSubCommand(command: CommandDef<any>, argv: readonly string[]): { name?: string, firstOperand?: string, rest: string[] } {
  if (command.subCommands === undefined)
    return { rest: [...argv] }

  const options = Object.assign(
    toNodeOptions(command.args ?? {}),
    ...Object.values(command.subCommands).map(subCommand => toNodeOptions(subCommand.args ?? {})),
  )
  const { tokens } = parseNodeArgs({ args: [...argv], options, strict: false, allowPositionals: true, tokens: true })
  const firstOperand = tokens.find(token => token.kind === 'positional' || token.kind === 'option-terminator')

  if (firstOperand?.kind !== 'positional')
    return { rest: [...argv] }

  if (Object.hasOwn(command.subCommands, firstOperand.value))
    return { name: firstOperand.value, rest: argv.toSpliced(firstOperand.index, 1) }

  return { firstOperand: firstOperand.value, rest: [...argv] }
}
