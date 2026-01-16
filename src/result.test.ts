import type { Result, ResultData } from './result'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { Err, err, isErr, isOk, Ok, ok, toResult, tryCatch, unwrapResult } from './result'

describe('result', () => {
  describe('ok', () => {
    it('creates an Ok result', () => {
      const result = ok(1)
      expect(result).toBeInstanceOf(Ok)
      expect(result.ok).toBe(true)
      expect(result.value).toBe(1)
      expectTypeOf(result).toEqualTypeOf<Ok<number, never>>()
    })

    it('handles null and undefined', () => {
      expect(ok(null).value).toBe(null)
      expect(ok(undefined).value).toBe(undefined)
    })
  })

  describe('err', () => {
    it('creates an Err result', () => {
      const error = new Error('test')
      const result = err(error)
      expect(result).toBeInstanceOf(Err)
      expect(result.ok).toBe(false)
      expect(result.error).toBe(error)
      expectTypeOf(result).toEqualTypeOf<Err<never, Error>>()
    })

    it('accepts string errors', () => {
      const result = err('failed')
      expect(result.error).toBe('failed')
      expectTypeOf(result).toEqualTypeOf<Err<never, 'failed'>>()
    })
  })

  describe('isOk', () => {
    it('returns true for Ok', () => {
      const result: Result<number, string> = ok(1)
      expect(isOk(result)).toBe(true)
      if (isOk(result)) {
        expectTypeOf(result).toEqualTypeOf<Ok<number, string>>()
      }
    })

    it('returns false for Err', () => {
      expect(isOk(err('fail'))).toBe(false)
    })
  })

  describe('isErr', () => {
    it('returns true for Err', () => {
      const result: Result<number, string> = err('fail')
      expect(isErr(result)).toBe(true)
      if (isErr(result)) {
        expectTypeOf(result).toEqualTypeOf<Err<number, string>>()
      }
    })

    it('returns false for Ok', () => {
      expect(isErr(ok(1))).toBe(false)
    })
  })

  describe('map', () => {
    it('transforms Ok value', () => {
      const result = ok(2).map(x => x * 3)
      expect(result.value).toBe(6)
      expectTypeOf(result).toEqualTypeOf<Ok<number, never>>()
    })

    it('passes through Err unchanged', () => {
      const result = err<number, string>('fail').map(x => x * 3)
      expect(result.error).toBe('fail')
      expectTypeOf(result).toEqualTypeOf<Err<number, string>>()
    })

    it('allows type transformation', () => {
      const result = ok(42).map(x => String(x))
      expect(result.value).toBe('42')
      expectTypeOf(result).toEqualTypeOf<Ok<string, never>>()
    })
  })

  describe('mapError', () => {
    it('transforms Err value', () => {
      const result = err('fail').mapError(e => e.toUpperCase())
      expect(result.error).toBe('FAIL')
      expectTypeOf(result).toEqualTypeOf<Err<never, string>>()
    })

    it('passes through Ok unchanged', () => {
      const result = ok(42).mapError((e: string) => e.toUpperCase())
      expect(result.value).toBe(42)
      expectTypeOf(result).toEqualTypeOf<Ok<number, string>>()
    })

    it('allows error type transformation', () => {
      const result = err('fail').mapError(e => new Error(e))
      expect(result.error).toBeInstanceOf(Error)
      expectTypeOf(result).toEqualTypeOf<Err<never, Error>>()
    })
  })

  describe('andThen', () => {
    it('chains Ok to Ok', () => {
      const result = ok(2).andThen(x => ok(x * 3))
      assertOk(result)
      expect(result.value).toBe(6)
    })

    it('chains Ok to Err', () => {
      const result = ok(2).andThen(x => err(`got ${x}`))
      assertErr(result)
      expect(result.error).toBe('got 2')
    })

    it('short-circuits on Err', () => {
      let called = false
      const result = err<number, string>('fail').andThen((_x) => {
        called = true
        return ok(42)
      })
      expect(called).toBe(false)
      assertErr(result)
      expect(result.error).toBe('fail')
    })

    it('preserves error type through chain', () => {
      const result: Result<number, string> = ok(1)
        .andThen(x => x > 0 ? ok(x) : err('negative'))
      expectTypeOf(result).toEqualTypeOf<Result<number, string>>()
    })
  })

  describe('unwrap', () => {
    it('returns value for Ok', () => {
      expect(ok(42).unwrap()).toBe(42)
    })

    it('throws for Err', () => {
      expect(() => err('fail').unwrap()).toThrow()
    })

    it('throws with custom message', () => {
      expect(() => err('fail').unwrap('custom message')).toThrow('custom message')
    })

    it('includes error in default message', () => {
      expect(() => err('my error').unwrap()).toThrow(/my error/)
    })
  })

  describe('unwrapOr', () => {
    it('returns value for Ok', () => {
      expect(ok(42).unwrapOr(0)).toBe(42)
    })

    it('returns fallback for Err', () => {
      expect(err('fail').unwrapOr(0)).toBe(0)
    })

    it('infers union type from Result', () => {
      const result: Result<number, string> = err('fail')
      const value = result.unwrapOr('default')
      expectTypeOf(value).toEqualTypeOf<number | string>()
      expect(value).toBe('default')
    })
  })

  describe('match', () => {
    it('calls ok handler for Ok', () => {
      const result = ok(2).match({
        ok: x => `value: ${x}`,
        err: e => `error: ${e}`,
      })
      expect(result).toBe('value: 2')
    })

    it('calls err handler for Err', () => {
      const result = err('oops').match({
        ok: x => `value: ${x}`,
        err: e => `error: ${e}`,
      })
      expect(result).toBe('error: oops')
    })

    it('allows different return types', () => {
      const okResult = ok(42).match({
        ok: x => x * 2,
        err: () => 0,
      })
      expect(okResult).toBe(84)

      const errResult = err('fail').match({
        ok: () => 0,
        err: e => e.length,
      })
      expect(errResult).toBe(4)
    })
  })

  describe('toResult', () => {
    it('handles successful synchronous operations', () => {
      const result = toResult(() => 1)
      expect(result).toBeInstanceOf(Ok)
      assertOk(result)
      expect(result.value).toBe(1)
    })

    it('handles failed synchronous operations', () => {
      const result = toResult<never, Error>(() => {
        throw new Error('test')
      })
      expect(result).toBeInstanceOf(Err)
      assertErr(result)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('test')
    })

    it('handles successful asynchronous operations', async () => {
      const result = await toResult(Promise.resolve(1))
      expect(result).toBeInstanceOf(Ok)
      assertOk(result)
      expect(result.value).toBe(1)
    })

    it('handles failed asynchronous operations', async () => {
      const result = await toResult<never, Error>(Promise.reject(new Error('test')))
      expect(result).toBeInstanceOf(Err)
      assertErr(result)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('test')
    })

    it('allows JSON parsing with type inference', () => {
      const result = toResult<{ test: number }>(() => JSON.parse('{"test": 1}'))
      assertOk(result)
      expect(result.value).toEqual({ test: 1 })
    })

    it('handles JSON parsing errors', () => {
      const result = toResult(() => JSON.parse('{invalid}'))
      assertErr(result)
      expect(result.error).toBeInstanceOf(SyntaxError)
    })
  })

  describe('unwrapResult', () => {
    it('unwraps an Ok result', () => {
      const unwrapped = unwrapResult(ok(1))
      expect(unwrapped).toEqual({ value: 1, error: undefined })
      expectTypeOf(unwrapped).toEqualTypeOf<{ value: number, error: undefined }>()
    })

    it('unwraps an Err result', () => {
      const error = new Error('test')
      const unwrapped = unwrapResult(err(error))
      expect(unwrapped).toEqual({ value: undefined, error })
      expectTypeOf(unwrapped).toEqualTypeOf<{ value: undefined, error: Error }>()
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
    })

    it('handles async operations', async () => {
      const successResult = await tryCatch(Promise.resolve(1))
      expect(successResult).toEqual({ value: 1, error: undefined })

      const errorResult = await tryCatch(Promise.reject(new Error('test')))
      expect(errorResult.value).toBeUndefined()
      expect(errorResult.error).toBeInstanceOf(Error)
    })
  })

  describe('chaining', () => {
    it('supports fluent method chaining', () => {
      const result = toResult(() => JSON.parse('{"id": 42}'))
        .map((data: { id: number }) => data.id)
        .map(id => id * 2)
        .unwrapOr(0)

      expect(result).toBe(84)
    })

    it('short-circuits chain on error', () => {
      const result = toResult(() => JSON.parse('{invalid}'))
        .map((data: { id: number }) => data.id)
        .map(id => id * 2)
        .unwrapOr(0)

      expect(result).toBe(0)
    })

    it('chains andThen for fallible operations', () => {
      const parseId = (s: string): Result<number, string> => {
        const n = Number.parseInt(s, 10)
        return Number.isNaN(n) ? err('not a number') : ok(n)
      }

      const result = ok('42')
        .andThen(parseId)
        .map(n => n * 2)

      assertOk(result)
      expect(result.value).toBe(84)
    })
  })
})

function assertOk<T, E>(result: Result<T, E>): asserts result is Ok<T, E> {
  if (!isOk(result)) {
    throw new TypeError('Expected Ok result')
  }
}

function assertErr<T, E>(result: Result<T, E>): asserts result is Err<T, E> {
  if (!isErr(result)) {
    throw new TypeError('Expected Err result')
  }
}
