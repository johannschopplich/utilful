import process from 'node:process'
import * as log from './log'

export type ErrorClass = abstract new (...args: never[]) => Error

export interface ReportOptions {
  verbose?: boolean
  /** Treated like `CliError`: no stack unless `verbose`. */
  expectedErrors?: readonly ErrorClass[]
  /** Renders an error where its message alone will not do; `undefined` falls back to the message. */
  describe?: (error: Error) => string | undefined
}

/**
 * A condition the CLI recognized and phrased for a human. Anything else
 * reaching the boundary is a defect in the tool and prints its stack unasked.
 */
export class CliError extends Error {}

/** Gets usage printed alongside its message. */
export class ArgumentError extends CliError {}

/** Reports a failure the way the boundary does, for one that outlives `run`, such as a watch rebuild. */
export function reportFailure(error: unknown, { verbose = false, expectedErrors = [], describe }: ReportOptions = {}): void {
  const message = error instanceof Error ? describe?.(error) ?? error.message : String(error)
  const sections = [message]

  // A cause often says why an expected failure happened, as `fetch failed` under a cache error.
  const causeChain = formatCauseChain(error, message)
  if (causeChain)
    sections.push(causeChain)

  if ((verbose || !isExpected(error, expectedErrors)) && error instanceof Error && error.stack)
    sections.push(error.stack)

  log.error(sections.join('\n\n'))
  // `process.exit` would discard whatever stdout has still buffered, truncating
  // a piped result partway through.
  process.exitCode = 1
}

/**
 * Reports whether the CLI raised this error deliberately rather than tripping
 * over it. A system error such as `ENOENT` reaches the boundary as the honest
 * answer to what the user asked for, so it reads as deliberate too, while an
 * `ERR_*` error from a Node API is a wrong call and stays a defect.
 */
function isExpected(error: unknown, expectedErrors: readonly ErrorClass[]): boolean {
  if (error instanceof CliError)
    return true

  if (expectedErrors.some(expectedError => error instanceof expectedError))
    return true

  return error instanceof Error && /^E[A-Z0-9]+$/.test(String((error as { code?: unknown }).code))
}

function formatCauseChain(error: unknown, message: string): string {
  const causeLines: string[] = []
  const seen = new Set<unknown>([error])
  let printedText = message
  let current: unknown = error instanceof Error ? error.cause : undefined

  while (current instanceof Error && !seen.has(current)) {
    seen.add(current)
    const name = current.name || 'Error'
    if (!current.message) {
      causeLines.push(`Caused by: ${name}`)
    }
    // A wrapper that copies or quotes the message of its cause would otherwise print it twice.
    else if (!printedText.includes(current.message)) {
      causeLines.push(`Caused by: ${name}: ${current.message}`)
      printedText += `\n${current.message}`
    }
    current = current.cause
  }

  return causeLines.join('\n')
}
