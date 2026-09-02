import type { ArgsDef } from './args'
import type { CommandDef } from './command'
import type { Style } from './style'
import process from 'node:process'
import { stripVTControlCharacters } from 'node:util'
import { paint } from './style'

export interface RenderUsageOptions {
  parent?: CommandDef<any>
  /** Decides whether the text gets color. */
  stream?: NodeJS.WriteStream
}

export function renderUsage<T extends ArgsDef>(command: CommandDef<T>, { parent, stream = process.stdout }: RenderUsageOptions = {}): string {
  const color = (style: Style, text: string): string => paint(style, text, stream)
  const heading = (title: string): string => color(['bold', 'underline'], title)

  const meta = command.meta ?? {}
  const parentMeta = parent?.meta ?? {}
  const commandName = [parentMeta.name, meta.name].filter(name => name !== undefined).join(' ')
  const version = meta.version ?? parentMeta.version

  const positionalLines: string[][] = []
  const optionLines: string[][] = []
  const commandLines: string[][] = []
  const usageLine: string[] = []

  for (const [name, definition] of Object.entries(command.args ?? {})) {
    const isRequired = definition.type !== 'boolean' && definition.required === true
    // An absent boolean reads as `false` by contract, so that default says nothing.
    const hasDefault = definition.type !== 'positional' && definition.default !== undefined && definition.default !== false
    const hints = [
      definition.description,
      isRequired ? color('gray', '(Required)') : undefined,
      hasDefault ? color('gray', `(Default: ${definition.default})`) : undefined,
    ].filter(hint => hint !== undefined).join(' ')

    if (definition.type === 'positional') {
      const label = name.toUpperCase()
      positionalLines.push([color('cyan', label), hints])
      usageLine.push(isRequired ? `<${label}>` : `[${label}]`)
      continue
    }

    const spellings = [definition.alias === undefined ? undefined : `-${definition.alias}`, `--${name}`]
      .filter(spelling => spelling !== undefined)
      .join(', ')
    const value = definition.type === 'string' ? `<${definition.valueHint ?? name}>` : undefined
    optionLines.push([color('cyan', value === undefined ? spellings : `${spellings}=${value}`), hints])

    if (definition.type === 'boolean' && definition.default === true)
      optionLines.push([color('cyan', `--no-${name}`), ''])

    if (isRequired)
      usageLine.push(`--${name}=${value}`)
  }

  for (const [name, subCommand] of Object.entries(command.subCommands ?? {}))
    commandLines.push([color('cyan', name), subCommand.meta?.description ?? ''])

  const hasArguments = positionalLines.length > 0 || optionLines.length > 0

  // A tree that also runs on its own would read as taking a file *and* a
  // command, so the COMMANDS section alone lists them.
  if (commandLines.length > 0 && !hasArguments)
    usageLine.push(Object.keys(command.subCommands!).join('|'))

  const lines: string[] = [
    color('gray', `${meta.description ?? ''} (${commandName}${version === undefined ? '' : ` v${version}`})`),
    '',
    `${heading('USAGE')} ${color('cyan', [commandName, hasArguments ? '[OPTIONS]' : undefined, ...usageLine].filter(part => part !== undefined).join(' '))}`,
    '',
  ]

  for (const [title, rows] of [['ARGUMENTS', positionalLines], ['OPTIONS', optionLines], ['COMMANDS', commandLines]] as const) {
    if (rows.length > 0)
      lines.push(heading(title), '', formatColumns(rows), '')
  }

  if (commandLines.length > 0)
    lines.push(`Use ${color('cyan', `${commandName} <command> --help`)} for more information about a command.`)

  return lines.join('\n').trimEnd()
}

function formatColumns(rows: readonly (readonly string[])[]): string {
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map(row => visibleLength(row[column]!))))

  return rows
    .map(row => row.map((cell, column) => `  ${cell}${' '.repeat(widths[column]! - visibleLength(cell))}`).join('').trimEnd())
    .join('\n')
}

function visibleLength(text: string): number {
  return stripVTControlCharacters(text).length
}
