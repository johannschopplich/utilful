import { describe, expect, expectTypeOf, it } from 'vitest'
import { createDefu, defu } from './defu'

// Part of tests brought from jonschlinkert/defaults-deep (MIT)
const nonObject = [null, undefined, [], false, true, 123]

describe('defu', () => {
  it('fills in only the keys the source lacks', () => {
    const result = defu({ a: 'c' }, { a: 'bbb', d: 'c' })
    expect(result).toEqual({ a: 'c', d: 'c' })
  })

  it('ignores null values on either side', () => {
    const result1 = defu({ a: null as null }, { a: 'c', d: 'c' })
    expect(result1).toEqual({ a: 'c', d: 'c' })

    const result2 = defu({ a: 'c' }, { a: null as null, d: 'c' })
    expect(result2).toEqual({ a: 'c', d: 'c' })
  })

  it('merges nested objects', () => {
    const result = defu({ a: { b: 'c' } }, { a: { d: 'e' } })
    expect(result).toEqual({
      a: { b: 'c', d: 'e' },
    })
  })

  it('concatenates arrays with the source values first', () => {
    const result = defu({ array: ['a', 'b'] }, { array: ['c', 'd'] })
    expect(result).toEqual({
      array: ['a', 'b', 'c', 'd'],
    })
  })

  it('concatenates arrays whose items differ in shape', () => {
    const item1 = { name: 'Name', age: 21 }
    const item2 = { name: 'Name', age: '42' }
    const result = defu({ items: [item1] }, { items: [item2] })
    expect(result).toEqual({ items: [item1, item2] })
  })

  it('keeps the source instance when both sides are class instances', () => {
    class Test {
      value: string
      constructor(value: string) {
        this.value = value
      }
    }
    const result = defu({ test: new Test('a') }, { test: new Test('b') })
    expect(result).toEqual({ test: new Test('a') })
  })

  it('keeps the source Date instead of merging it', () => {
    const date1 = new Date('2020-01-01')
    const date2 = new Date('2020-01-02')
    const result = defu({ date: date1 }, { date: date2 })
    expect(result).toEqual({ date: date1 })
  })

  it('keeps the source value when the two sides have unrelated types', () => {
    const fn = () => 42
    const re = /test/i

    const result = defu({ a: fn }, { a: re })
    expect(result).toEqual({ a: fn })
  })

  it('returns the defaults when the source is not an object', () => {
    for (const val of nonObject) {
      expect(defu(val as any, { d: true })).toEqual({ d: true })
    }
  })

  it('returns the source when the defaults are not an object', () => {
    for (const val of nonObject) {
      expect(defu({ d: true }, val as any)).toEqual({ d: true })
    }
  })

  it('lets earlier arguments win across multiple defaults', () => {
    const result = defu({ a: 1 }, { b: 2, a: 'x' }, { c: 3, a: 'x', b: 'x' })
    expect(result).toEqual({
      a: 1,
      b: 2,
      c: 3,
    })
  })

  it('ignores a constructor key instead of polluting the prototype', () => {
    const payload = JSON.parse(
      '{"constructor": {"prototype": {"isAdmin": true}}}',
    )
    defu({}, payload)
    defu(payload, {})
    defu(payload, payload)
    // @ts-expect-error: Property does not exist
    expect({}.isAdmin).toBe(undefined)
  })

  it('ignores a __proto__ key instead of polluting the prototype', () => {
    const payload = JSON.parse('{"__proto__": {"isAdmin": true}, "a": 1}')
    const result = defu(payload, {}) as Record<string, unknown>
    expect(Object.keys(result)).toEqual(['a'])
    // @ts-expect-error: Property does not exist
    expect({}.isAdmin).toBe(undefined)
  })

  it('exposes keys that exist only in the defaults', () => {
    const result = defu({ a: 1 }, { b: 2 })
    expect(result.b).toBe(2)
    expectTypeOf(result.a).toEqualTypeOf<number>()
    expectTypeOf(result.b).toEqualTypeOf<number>()

    const nested = defu({ a: { b: 'c' } }, { a: { d: 'e' } })
    expect(nested.a.d).toBe('e')
    expectTypeOf(nested.a.b).toEqualTypeOf<string>()
    expectTypeOf(nested.a.d).toEqualTypeOf<string>()
  })

  it('ignores non-object arguments', () => {
    expect(defu(null as any, { foo: 1 }, false as any, 123 as any, { bar: 2 })).toEqual({
      foo: 1,
      bar: 2,
    })
  })

  it('lets a custom merger replace the default merge', () => {
    const ext = createDefu((obj, key, val) => {
      if (typeof val === 'number') {
        (obj as any)[key] += val
        return true
      }
    })
    expect(ext({ cost: 15 }, { cost: 10 })).toEqual({ cost: 25 })
  })

  it('passes the dotted key path to a custom merger', () => {
    const ext = createDefu((obj, key, val, namespace) => {
      if (key === 'modules') {
        obj[key] = `${namespace}:${[...val, ...obj[key]].sort().join(',')}`
        return true
      }
    })

    const obj1 = { modules: ['A'], foo: { bar: { modules: ['X'] } } }
    const obj2 = { modules: ['B'], foo: { bar: { modules: ['Y'] } } }
    expect(ext(obj1, obj2)).toEqual({
      modules: ':A,B',
      foo: { bar: { modules: 'foo.bar:X,Y' } },
    })
  })
})
