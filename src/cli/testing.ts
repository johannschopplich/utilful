import type { ArgsDef } from './args'
import type { CommandDef, RunMainOptions } from './command'
import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import process from 'node:process'
import { Readable } from 'node:stream'
import { afterEach, vi } from 'vitest'
import { runMain } from './command'

export interface FileMap {
  [relativePath: string]: string
}

export interface CliResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface RunOptions {
  cwd?: string
}

export interface CliHarnessOptions extends Omit<RunMainOptions, 'argv'> {
  /** Only `runCliProcess` needs it. */
  entry?: string
}

export interface CliHarness {
  runCli: (argv: readonly string[], options?: RunOptions) => Promise<CliResult>
  /** Runs the entry file as a child process, where the exit code is real and stdout can be cut short by exiting. */
  runCliProcess: (argv: readonly string[], options?: RunOptions) => Promise<CliResult>
}

class ProcessExitError extends Error {
  readonly exitCode: number

  constructor(exitCode: number) {
    super(`process.exit(${exitCode})`)
    this.exitCode = exitCode
  }
}

export function createCliHarness<T extends ArgsDef>(command: CommandDef<T>, { entry, ...runOptions }: CliHarnessOptions = {}): CliHarness {
  return {
    async runCli(argv, options = {}) {
      const stdout: string[] = []
      const stderr: string[] = []
      const previousExitCode = process.exitCode
      const previousCwd = process.cwd()
      process.exitCode = undefined

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        stdout.push(String(chunk))
        return true
      })
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        stderr.push(String(chunk))
        return true
      })
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
        stdout.push(`${parts.map(String).join(' ')}\n`)
      })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
        stderr.push(`${parts.map(String).join(' ')}\n`)
      })
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new ProcessExitError(typeof code === 'number' ? code : 0)
      })

      let exitCode: number

      try {
        if (options.cwd !== undefined)
          process.chdir(options.cwd)

        await runMain(command, { ...runOptions, argv })
        exitCode = process.exitCode ?? 0
      }
      catch (error) {
        if (!(error instanceof ProcessExitError))
          throw error

        exitCode = error.exitCode
      }
      finally {
        process.chdir(previousCwd)
        process.exitCode = previousExitCode
        exitSpy.mockRestore()
        consoleErrorSpy.mockRestore()
        consoleLogSpy.mockRestore()
        stderrSpy.mockRestore()
        stdoutSpy.mockRestore()
      }

      return { stdout: stdout.join(''), stderr: stderr.join(''), exitCode }
    },

    runCliProcess(argv, options = {}) {
      if (entry === undefined)
        return Promise.reject(new Error('runCliProcess needs the entry file of the CLI'))

      return new Promise((resolve, reject) => {
        execFile(
          process.execPath,
          [entry, ...argv],
          { cwd: options.cwd, maxBuffer: 64 * 1024 * 1024 },
          (spawnError, stdout, stderr) => {
            // A numeric `code` is the child's exit status; anything else failed to spawn.
            if (spawnError && typeof spawnError.code !== 'number')
              reject(spawnError)
            else
              resolve({ stdout, stderr, exitCode: spawnError ? spawnError.code as number : 0 })
          },
        )
      })
    },
  }
}

/** Registers an `afterEach` cleanup, so call it at the top level of a test file. */
export function useTemporaryDirectories(prefix = 'cli-test-'): (files?: FileMap) => string {
  const directories: string[] = []

  afterEach(() => {
    while (directories.length > 0)
      rmSync(directories.pop()!, { recursive: true, force: true })
  })

  return (files: FileMap = {}) => {
    const directory = mkdtempSync(path.join(os.tmpdir(), prefix))
    directories.push(directory)

    for (const [relativePath, contents] of Object.entries(files)) {
      const filePath = path.join(directory, relativePath)
      mkdirSync(path.dirname(filePath), { recursive: true })
      writeFileSync(filePath, contents, 'utf-8')
    }

    return directory
  }
}

export function mockStdin(input: string): () => void {
  // Real stdin hands over bytes, and a strict UTF-8 check depends on getting them.
  const stream = Readable.from([new TextEncoder().encode(input)])
  const originalStdin = process.stdin

  Object.defineProperty(process, 'stdin', { value: stream, writable: true })

  return () => {
    Object.defineProperty(process, 'stdin', { value: originalStdin, writable: true })
  }
}
