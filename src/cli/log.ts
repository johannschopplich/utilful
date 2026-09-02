import process from 'node:process'
import { paint } from './style'

// Every level writes to stderr, so stdout carries results only.

export function error(message: string): void {
  console.error(`${paint('red', '✖', process.stderr)} ${message}`)
}

export function warn(message: string): void {
  console.error(`${paint('yellow', '⚠', process.stderr)} ${message}`)
}

export function info(message: string): void {
  console.error(`${paint('cyan', '●', process.stderr)} ${message}`)
}

export function success(message: string): void {
  console.error(`${paint('green', '✔', process.stderr)} ${message}`)
}

export function blankLine(): void {
  console.error('')
}
