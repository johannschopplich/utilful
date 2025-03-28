export type Result<T, E> = Ok<T> | Err<E>

export interface OkData<T> { value: T, error: undefined }
export interface ErrData<E> { value: undefined, error: E }
export type ResultData<T, E> = OkData<T> | ErrData<E>

export class Ok<T> {
  readonly value: T
  readonly ok = true
  constructor(value: T) {
    this.value = value
  }
}

export class Err<E> {
  readonly error: E
  readonly ok = false
  constructor(error: E) {
    this.error = error
  }
}

export function ok<T>(value: T): Ok<T> {
  return new Ok(value)
}

export function err<E extends string = string>(error: E): Err<E>
export function err<E = unknown>(error: E): Err<E>
export function err<E = unknown>(error: E): Err<E> {
  return new Err(error)
}

export function toResult<T, E = unknown>(fn: () => T): Result<T, E>
export function toResult<T, E = unknown>(promise: Promise<T>): Promise<Result<T, E>>
export function toResult<T, E = unknown>(fnOrPromise: (() => T) | Promise<T>): Result<T, E> | Promise<Result<T, E>> {
  if (fnOrPromise instanceof Promise) {
    return fnOrPromise.then(ok).catch(err as (error: unknown) => Err<E>)
  }

  try {
    return ok(fnOrPromise())
  }
  catch (error) {
    return err(error as E)
  }
}

export function unwrapResult<T>(result: Ok<T>): OkData<T>
export function unwrapResult<E>(result: Err<E>): ErrData<E>
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
