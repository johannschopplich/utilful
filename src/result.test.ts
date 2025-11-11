import type { Result, ResultData } from './result'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { Err, err, Ok, ok, toResult, tryCatch, unwrapResult } from './result'

describe('result', () => {
  describe('ok', () => {
    it('creates an Ok result', () => {
      const result = ok(1)
      expect(result).toBeInstanceOf(Ok)
      expect(result.ok).toBe(true)
      expect(result.value).toBe(1)
      expectTypeOf(result).toEqualTypeOf<Ok<number>>()
    })
  })

  describe('err', () => {
    it('creates an Err result', () => {
      const error = new Error('test')
      const result = err(error)
      expect(result).toBeInstanceOf(Err)
      expect(result.ok).toBe(false)
      expect(result.error).toBe(error)
      expectTypeOf(result).toEqualTypeOf<Err<Error>>()
    })
  })

  describe('toResult', () => {
    it('handles successful synchronous operations', () => {
      const result = toResult(() => 1)
      expect(result).toBeInstanceOf(Ok)
      assertOk(result)
      expect(result.value).toBe(1)
      expectTypeOf(result).toEqualTypeOf<Ok<number>>()
    })

    it('handles failed synchronous operations', () => {
      const result = toResult<never, Error>(() => {
        throw new Error('test')
      })
      expect(result).toBeInstanceOf(Err)
      assertErr(result)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('test')
      expectTypeOf(result).toExtend<Err<unknown>>()
    })

    it('handles successful asynchronous operations', async () => {
      const result = await toResult(Promise.resolve(1))
      expect(result).toBeInstanceOf(Ok)
      assertOk(result)
      expect(result.value).toBe(1)
      expectTypeOf(result).toEqualTypeOf<Ok<number>>()
    })

    it('handles failed asynchronous operations', async () => {
      const result = await toResult<never, Error>(Promise.reject(new Error('test')))
      expect(result).toBeInstanceOf(Err)
      assertErr(result)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('test')
      expectTypeOf(result).toExtend<Err<unknown>>()
    })

    it('supports custom error types', () => {
      class CustomError extends Error {}
      const result = toResult<number, CustomError>(() => {
        throw new CustomError('test')
      })
      expect(result).toBeInstanceOf(Err)
      assertErr(result)
      expect(result.error).toBeInstanceOf(CustomError)
      expectTypeOf(result).toExtend<Result<number, CustomError>>()
    })

    it('allows JSON parsing with type inference', () => {
      const result = toResult<{ test: number }>(() => JSON.parse('{"test": 1}'))
      expect(result).toBeInstanceOf(Ok)
      assertOk(result)
      expect(result.value).toEqual({ test: 1 })
      expectTypeOf(result).toEqualTypeOf<Ok<{ test: number }>>()
    })

    it('handles JSON parsing errors', () => {
      const result = toResult(() => JSON.parse('{test: 1}'))
      expect(result).toBeInstanceOf(Err)
      assertErr(result)
      expect(result.error).toBeInstanceOf(SyntaxError)
      expectTypeOf(result).toEqualTypeOf<Err<unknown>>()
    })
  })

  describe('unwrapResult', () => {
    it('unwraps an Ok result', () => {
      const result = ok(1)
      const unwrapped = unwrapResult(result)
      expect(unwrapped).toEqual({ value: 1, error: undefined })
      expectTypeOf(unwrapped).toEqualTypeOf<{ value: number, error: undefined }>()
    })

    it('unwraps an Err result', () => {
      const error = new Error('test')
      const result = err(error)
      const unwrapped = unwrapResult(result)
      expect(unwrapped).toEqual({ value: undefined, error })
      expectTypeOf(unwrapped).toEqualTypeOf<{ value: undefined, error: Error }>()
    })

    it('unwraps a result with type inference', () => {
      const result = toResult(() => 1)
      const unwrapped = unwrapResult(result)
      expect(unwrapped).toEqual({ value: 1, error: undefined })
      expectTypeOf(unwrapped).toExtend<{ value: number | undefined, error: unknown }>()
    })
  })

  describe('tryCatch', () => {
    it('returns unwrapped value for successful operations', () => {
      const result = tryCatch(() => 1)
      expect(result).toEqual({ value: 1, error: undefined })
      expectTypeOf(result).toEqualTypeOf<ResultData<number, unknown>>()
    })

    it('returns unwrapped error for failed operations', () => {
      const error = new Error('test')
      const result = tryCatch<never, Error>(() => {
        throw error
      })
      expect(result).toEqual({ value: undefined, error })
      expectTypeOf(result).toEqualTypeOf<ResultData<never, Error>>()
    })

    it('handles async operations', async () => {
      const successResult = await tryCatch(Promise.resolve(1))
      expect(successResult).toEqual({ value: 1, error: undefined })

      const errorResult = await tryCatch(Promise.reject(new Error('test')))
      expect(errorResult.value).toBeUndefined()
      expect(errorResult.error).toBeInstanceOf(Error)
    })
  })
})

function assertOk<T, E>(result: Result<T, E>): asserts result is Ok<T> {
  if (!(result instanceof Ok)) {
    throw new TypeError('Expected Ok result')
  }
}

function assertErr<T, E>(result: Result<T, E>): asserts result is Err<E> {
  if (!(result instanceof Err)) {
    throw new TypeError('Expected Err result')
  }
}
