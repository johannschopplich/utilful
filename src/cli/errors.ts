import process from 'node:process'
import * as log from './log'

export type ErrorClass = abstract new (...args: never[]) => Error

export interface ReportOptions {
  verbose?: boolean
  /** Treated like `CliError`: message only, no stack. */
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
  const sections = [error instanceof Error ? describe?.(error) ?? error.message : String(error)]

  if (verbose || !isExpected(error, expectedErrors)) {
    const causeChain = formatCauseChain(error)
    if (causeChain)
      sections.push(causeChain)
    if (error instanceof Error && error.stack)
      sections.push(error.stack)
  }

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

function formatCauseChain(error: unknown): string {
  const causeLines: string[] = []
  let current: unknown = error instanceof Error ? error.cause : undefined

  while (current instanceof Error) {
    causeLines.push(`Caused by: ${current.name || 'Error'}: ${current.message}`)
    current = current.cause
  }

  return causeLines.join('\n')
}
