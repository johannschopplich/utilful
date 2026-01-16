// #region Types

export type Result<T, E> = Ok<T, E> | Err<T, E>

export interface OkData<T> { value: T, error: undefined }
export interface ErrData<E> { value: undefined, error: E }
export type ResultData<T, E> = OkData<T> | ErrData<E>

// #endregion

// #region Classes

/**
 * Successful result variant.
 * @template T Success value type.
 * @template E Error type (phantom - for type unification).
 */
export class Ok<T, E = never> {
  readonly value: T
  readonly ok = true

  constructor(value: T) {
    this.value = value
  }

  /** Transforms the success value. */
  map<U>(fn: (value: T) => U): Ok<U, E> {
    return new Ok(fn(this.value))
  }

  /** No-op on Ok, returns self with new error type. */
  mapError<E2>(_fn: (error: E) => E2): Ok<T, E2> {
    return this as unknown as Ok<T, E2>
  }

  /** Chains a Result-returning function. */
  andThen<U, E2>(fn: (value: T) => Result<U, E2>): Result<U, E | E2> {
    return fn(this.value)
  }

  /** Extracts the value. */
  unwrap(_message?: string): T {
    return this.value
  }

  /** Returns the value, ignoring the fallback. */
  unwrapOr<U>(_fallback: U): T {
    return this.value
  }

  /** Pattern matches on the Result. */
  match<R>(handlers: { ok: (value: T) => R, err: (error: E) => R }): R {
    return handlers.ok(this.value)
  }
}

/**
 * Error result variant.
 * @template T Success type (phantom - for type unification).
 * @template E Error value type.
 */
export class Err<T, E> {
  readonly error: E
  readonly ok = false

  constructor(error: E) {
    this.error = error
  }

  /** No-op on Err, returns self with new value type. */
  map<U>(_fn: (value: T) => U): Err<U, E> {
    return this as unknown as Err<U, E>
  }

  /** Transforms the error value. */
  mapError<E2>(fn: (error: E) => E2): Err<T, E2> {
    return new Err(fn(this.error))
  }

  /** No-op on Err, returns self with widened error type. */
  andThen<U, E2>(_fn: (value: T) => Result<U, E2>): Err<U, E | E2> {
    return this as unknown as Err<U, E | E2>
  }

  /** Throws an error with the given message. */
  unwrap(message?: string): never {
    throw new Error(message ?? `Unwrap called on Err: ${String(this.error)}`)
  }

  /** Returns the fallback value. */
  unwrapOr<U>(fallback: U): T | U {
    return fallback
  }

  /** Pattern matches on the Result. */
  match<R>(handlers: { ok: (value: T) => R, err: (error: E) => R }): R {
    return handlers.err(this.error)
  }
}

// #endregion

// #region Factory functions

export function ok<T, E = never>(value: T): Ok<T, E> {
  return new Ok(value)
}

export function err<T = never, E extends string = string>(error: E): Err<T, E>
export function err<T = never, E = unknown>(error: E): Err<T, E>
export function err<T = never, E = unknown>(error: E): Err<T, E> {
  return new Err(error)
}

// #endregion

// #region Type guards

export function isOk<T, E>(result: Result<T, E>): result is Ok<T, E> {
  return result.ok === true
}

export function isErr<T, E>(result: Result<T, E>): result is Err<T, E> {
  return result.ok === false
}

// #endregion

// #region Result conversion

export function toResult<T, E = unknown>(fn: () => T): Result<T, E>
export function toResult<T, E = unknown>(promise: Promise<T>): Promise<Result<T, E>>
export function toResult<T, E = unknown>(fnOrPromise: (() => T) | Promise<T>): Result<T, E> | Promise<Result<T, E>> {
  if (fnOrPromise instanceof Promise) {
    return fnOrPromise.then(ok).catch(err as (error: unknown) => Err<T, E>)
  }

  try {
    return ok(fnOrPromise())
  }
  catch (error) {
    return err(error as E)
  }
}

export function unwrapResult<T, E>(result: Ok<T, E>): OkData<T>
export function unwrapResult<T, E>(result: Err<T, E>): ErrData<E>
export function unwrapResult<T, E>(result: Result<T, E>): ResultData<T, E>
export function unwrapResult<T, E>(result: Result<T, E>): ResultData<T, E> {
  return result.ok
    ? { value: result.value, error: undefined }
    : { value: undefined, error: result.error }
}

export function tryCatch<T, E = unknown>(fn: () => T): ResultData<T, E>
export function tryCatch<T, E = unknown>(
  promise: Promise<T>,
): Promise<ResultData<T, E>>
export function tryCatch<T, E = unknown>(
  fnOrPromise: (() => T) | Promise<T>,
): ResultData<T, E> | Promise<ResultData<T, E>> {
  if (fnOrPromise instanceof Promise) {
    return toResult<T, E>(fnOrPromise).then(result =>
      unwrapResult<T, E>(result),
    )
  }

  return unwrapResult(toResult<T, E>(fnOrPromise))
}

// #endregion
