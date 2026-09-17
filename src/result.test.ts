import type { Result, ResultData } from './result'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { Err, err, isErr, isOk, Ok, ok, toResult, tryCatch, unwrapResult } from './result'

describe('ok', () => {
  it('wraps the value in an Ok', () => {
    const result = ok(1)
    expect(result).toBeInstanceOf(Ok)
    expect(result.ok).toBe(true)
    expect(result.value).toBe(1)
    expectTypeOf(result).toEqualTypeOf<Ok<number, never>>()
  })

  it('wraps null and undefined as values', () => {
    expect(ok(null).value).toBe(null)
    expect(ok(undefined).value).toBe(undefined)
  })
})

describe('err', () => {
  it('wraps the error in an Err', () => {
    const error = new Error('test')
    const result = err(error)
    expect(result).toBeInstanceOf(Err)
    expect(result.ok).toBe(false)
    expect(result.error).toBe(error)
    expectTypeOf(result).toEqualTypeOf<Err<never, Error>>()
  })

  it('infers \'failed\' as a literal error type', () => {
    expectTypeOf(err('failed')).toEqualTypeOf<Err<never, 'failed'>>()
  })
})

describe('isOk', () => {
  it('returns true for an Ok', () => {
    expect(isOk(ok(1))).toBe(true)
  })

  it('returns false for an Err', () => {
    expect(isOk(err('fail'))).toBe(false)
  })

  it('narrows a Result to Ok', () => {
    const result = ok(1) as Result<number, string>
    if (isOk(result)) {
      expectTypeOf(result).toEqualTypeOf<Ok<number, string>>()
    }
  })
})

describe('isErr', () => {
  it('returns true for an Err', () => {
    expect(isErr(err('fail'))).toBe(true)
  })

  it('returns false for an Ok', () => {
    expect(isErr(ok(1))).toBe(false)
  })

  it('narrows a Result to Err', () => {
    const result = err('fail') as Result<number, string>
    if (isErr(result)) {
      expectTypeOf(result).toEqualTypeOf<Err<number, string>>()
    }
  })
})

describe('map', () => {
  it('maps an Ok value to the callback result', () => {
    const result = ok(2).map(x => String(x * 3))
    expect(result.value).toBe('6')
    expectTypeOf(result).toEqualTypeOf<Ok<string, never>>()
  })

  it('passes an Err through unchanged', () => {
    const result = err<number, string>('fail').map(x => x * 3)
    expect(result.error).toBe('fail')
    expectTypeOf(result).toEqualTypeOf<Err<number, string>>()
  })
})

describe('mapError', () => {
  it('maps an Err error to the callback result', () => {
    const result = err('fail').mapError(e => new Error(e.toUpperCase()))
    expect(result.error).toEqual(new Error('FAIL'))
    expectTypeOf(result).toEqualTypeOf<Err<never, Error>>()
  })

  it('passes an Ok through unchanged', () => {
    const result = ok(42).mapError((e: string) => e.toUpperCase())
    expect(result.value).toBe(42)
    expectTypeOf(result).toEqualTypeOf<Ok<number, string>>()
  })
})

describe('andThen', () => {
  it('returns the Ok from the callback', () => {
    const result = ok(2).andThen(x => ok(x * 3))
    assertOk(result)
    expect(result.value).toBe(6)
  })

  it('returns the Err from the callback', () => {
    const result = ok(2).andThen(x => err(`got ${x}`))
    assertErr(result)
    expect(result.error).toBe('got 2')
  })

  it('returns an Err without calling the callback', () => {
    let called = false
    const result = err<number, string>('fail').andThen((_x) => {
      called = true
      return ok(42)
    })
    expect(called).toBe(false)
    assertErr(result)
    expect(result.error).toBe('fail')
  })

  it('infers the error type from the callback', () => {
    const result = ok(1).andThen(x => x > 0 ? ok(x) : err('negative'))
    expectTypeOf(result).toEqualTypeOf<Result<number, 'negative'>>()
  })
})

describe('unwrap', () => {
  it('returns the value for an Ok', () => {
    expect(ok(42).unwrap()).toBe(42)
  })

  it('throws the given message for an Err', () => {
    expect(() => err('fail').unwrap('custom message')).toThrow('custom message')
  })

  it('throws a default message containing the error', () => {
    expect(() => err('my error').unwrap()).toThrow(/my error/)
  })
})

describe('unwrapErr', () => {
  it('returns the error for an Err', () => {
    expect(err('fail').unwrapErr()).toBe('fail')
  })

  it('throws the given message for an Ok', () => {
    expect(() => ok(42).unwrapErr('custom message')).toThrow('custom message')
  })

  it('throws a default message containing the value', () => {
    expect(() => ok('my value').unwrapErr()).toThrow(/my value/)
  })

  it('returns the error type E', () => {
    const error = err<number, SyntaxError>(new SyntaxError('bad')).unwrapErr()
    expectTypeOf(error).toEqualTypeOf<SyntaxError>()
  })
})

describe('unwrapOr', () => {
  it('returns the value for an Ok', () => {
    expect(ok(42).unwrapOr(0)).toBe(42)
  })

  it('returns the fallback for an Err', () => {
    expect(err('fail').unwrapOr(0)).toBe(0)
  })

  it('infers number | string with a string fallback', () => {
    const result = err('fail') as Result<number, string>
    const value = result.unwrapOr('default')
    expectTypeOf(value).toEqualTypeOf<number | string>()
    expect(value).toBe('default')
  })
})

describe('match', () => {
  it('returns the ok handler result for an Ok', () => {
    const result = ok(2).match({
      ok: x => `value: ${x}`,
      err: e => `error: ${e}`,
    })
    expect(result).toBe('value: 2')
  })

  it('returns the err handler result for an Err', () => {
    const result = err('oops').match({
      ok: x => `value: ${x}`,
      err: e => `error: ${e}`,
    })
    expect(result).toBe('error: oops')
  })
})

describe('toResult', () => {
  it('returns Ok for a synchronous function that returns', () => {
    const result = toResult(() => 1)
    assertOk(result)
    expect(result.value).toBe(1)
  })

  it('returns Err for a synchronous function that throws', () => {
    const error = new Error('test')
    const result = toResult<never, Error>(() => {
      throw error
    })
    assertErr(result)
    expect(result.error).toBe(error)
  })

  it('returns Ok for a resolved promise', async () => {
    const result = await toResult(Promise.resolve(1))
    assertOk(result)
    expect(result.value).toBe(1)
  })

  it('returns Err for a rejected promise', async () => {
    const error = new Error('test')
    const result = await toResult<never, Error>(Promise.reject(error))
    assertErr(result)
    expect(result.error).toBe(error)
  })

  it('throws a TypeError when the function returns a promise', () => {
    expect(() => toResult(() => Promise.resolve(1))).toThrow(TypeError)
    expect(() => toResult(() => Promise.resolve(1))).toThrow(/Pass the promise itself/)
  })
})

describe('chaining', () => {
  it('applies each map in a chain from toResult to an Ok value', () => {
    const doubledId = toResult(() => JSON.parse('{"id": 42}'))
      .map((data: { id: number }) => data.id)
      .map(id => id * 2)
      .unwrapOr(0)

    expect(doubledId).toBe(84)
  })

  it('skips each map in a chain from toResult on an Err', () => {
    const doubledId = toResult(() => JSON.parse('{invalid}'))
      .map((data: { id: number }) => data.id)
      .map(id => id * 2)
      .unwrapOr(0)

    expect(doubledId).toBe(0)
  })
})

describe('unwrapResult', () => {
  it('returns { value, error: undefined } for an Ok', () => {
    const unwrapped = unwrapResult(ok(1))
    expect(unwrapped).toEqual({ value: 1, error: undefined })
    expectTypeOf(unwrapped).toEqualTypeOf<{ value: number, error: undefined }>()
  })

  it('returns { value: undefined, error } for an Err', () => {
    const error = new Error('test')
    const unwrapped = unwrapResult(err(error))
    expect(unwrapped).toEqual({ value: undefined, error })
    expectTypeOf(unwrapped).toEqualTypeOf<{ value: undefined, error: Error }>()
  })
})

describe('tryCatch', () => {
  it('returns { value, error: undefined } for a function that returns', () => {
    const result = tryCatch(() => 1)
    expect(result).toEqual({ value: 1, error: undefined })
    expectTypeOf(result).toEqualTypeOf<ResultData<number, unknown>>()
  })

  it('returns { value: undefined, error } for a function that throws', () => {
    const error = new Error('test')
    const result = tryCatch<never, Error>(() => {
      throw error
    })
    expect(result).toEqual({ value: undefined, error })
  })

  it('returns { value, error: undefined } for a resolved promise', async () => {
    const result = await tryCatch(Promise.resolve(1))
    expect(result).toEqual({ value: 1, error: undefined })
  })

  it('returns { value: undefined, error } for a rejected promise', async () => {
    const error = new Error('test')
    const result = await tryCatch(Promise.reject(error))
    expect(result).toEqual({ value: undefined, error })
  })

  it('throws a TypeError when the function returns a promise', () => {
    expect(() => tryCatch(() => Promise.resolve(1))).toThrow(TypeError)
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
