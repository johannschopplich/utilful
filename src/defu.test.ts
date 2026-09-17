import { describe, expect, expectTypeOf, it } from 'vitest'
import { createDefu, defu } from './defu'

class Wrapper {
  value: string
  constructor(value: string) {
    this.value = value
  }
}

const nonObjectValues = [
  { value: null },
  { value: undefined },
  { value: [] },
  { value: false },
  { value: true },
  { value: 123 },
]

// Part of tests brought from jonschlinkert/defaults-deep (MIT)
describe('defu', () => {
  it('fills in only the keys the source lacks', () => {
    const result = defu({ a: 'c' }, { a: 'bbb', d: 'c' })
    expect(result).toEqual({ a: 'c', d: 'c' })
  })

  it('falls back to the default for a null source value', () => {
    const result = defu({ a: null as null }, { a: 'c', d: 'c' })
    expect(result).toEqual({ a: 'c', d: 'c' })
  })

  it('keeps the source value over a null default', () => {
    const result = defu({ a: 'c' }, { a: null as null, d: 'c' })
    expect(result).toEqual({ a: 'c', d: 'c' })
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

  it('concatenates object items without merging them', () => {
    const sourceItem = { name: 'Name', age: 21 }
    const defaultItem = { name: 'Name', age: '42' }
    const result = defu({ items: [sourceItem] }, { items: [defaultItem] })
    expect(result).toEqual({ items: [sourceItem, defaultItem] })
  })

  it.each([
    ['class instance', new Wrapper('a'), new Wrapper('b')],
    ['Date', new Date('2020-01-01'), new Date('2020-01-02')],
  ])('keeps a source %s instead of merging it', (_, source, defaults) => {
    const result = defu({ value: source }, { value: defaults })
    expect(result.value).toBe(source)
  })

  it('keeps a source function over a RegExp default', () => {
    const source = () => 42
    const result = defu({ value: source }, { value: /test/i })
    expect(result.value).toBe(source)
  })

  it.each(nonObjectValues)('returns the defaults for source $value', ({ value }) => {
    expect(defu(value as any, { d: true })).toEqual({ d: true })
  })

  it.each(nonObjectValues)('returns the source for defaults $value', ({ value }) => {
    expect(defu({ d: true }, value as any)).toEqual({ d: true })
  })

  it('skips non-object defaults between object defaults', () => {
    expect(defu({}, { foo: 1 }, false as any, 123 as any, { bar: 2 })).toEqual({ foo: 1, bar: 2 })
  })

  it('leaves the defaults unmodified', () => {
    const defaults = { a: 'default', nested: { b: 'default' }, list: ['default'] }
    defu({ a: 'source', nested: { b: 'source', c: 'source' }, list: ['source'] }, defaults)
    expect(defaults).toEqual({ a: 'default', nested: { b: 'default' }, list: ['default'] })
  })

  it('lets earlier arguments win across multiple defaults', () => {
    const result = defu({ a: 1 }, { b: 2, a: 'x' }, { c: 3, a: 'x', b: 'x' })
    expect(result).toEqual({
      a: 1,
      b: 2,
      c: 3,
    })
  })

  it.each([
    { key: 'constructor', json: '{"constructor": {"prototype": {"isAdmin": true}}, "a": 1}' },
    { key: '__proto__', json: '{"__proto__": {"isAdmin": true}, "a": 1}' },
  ])('drops a $key key from the source without touching the prototype', ({ json }) => {
    const result = defu(JSON.parse(json), {})
    expect(Object.keys(result)).toEqual(['a'])
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect('isAdmin' in result).toBe(false)
  })

  it('types default-only keys on the result', () => {
    const result = defu({ a: 1 }, { b: 2 })
    expectTypeOf(result.a).toEqualTypeOf<number>()
    expectTypeOf(result.b).toEqualTypeOf<number>()
  })

  it('types default-only keys on a nested result', () => {
    const result = defu({ a: { b: 'c' } }, { a: { d: 'e' } })
    expectTypeOf(result.a.b).toEqualTypeOf<string>()
    expectTypeOf(result.a.d).toEqualTypeOf<string>()
  })

  it('keeps class instances nominal', () => {
    class Branded {
      private brand!: 'branded'
      value = 1
    }

    const result = defu({ instance: new Branded() }, { instance: new Branded() })
    expectTypeOf(result.instance).toEqualTypeOf<Branded>()
  })

  it('keeps the Date, RegExp, Set and Map types', () => {
    const result = defu(
      { when: new Date(), pattern: /a/, ids: new Set<string>(), lookup: new Map<string, number>() },
      { when: new Date(), pattern: /b/, ids: new Set<string>(), lookup: new Map<string, number>() },
    )

    expectTypeOf(result.when).toEqualTypeOf<Date>()
    expectTypeOf(result.pattern).toEqualTypeOf<RegExp>()
    expectTypeOf(result.ids).toEqualTypeOf<Set<string>>()
    expectTypeOf(result.lookup).toEqualTypeOf<Map<string, number>>()
  })

  it('keeps optional properties optional', () => {
    interface Options {
      required: string
      optional?: number
    }

    // `true` only while `Key` carries the `?` modifier.
    type IsOptional<T, Key extends keyof T> = object extends Pick<T, Key> ? true : false

    const source: Options = { required: 'a' }
    const result = defu(source, { extra: true })

    expect(result.required).toBe('a')
    expectTypeOf<IsOptional<typeof result, 'optional'>>().toEqualTypeOf<true>()
    expectTypeOf<IsOptional<typeof result, 'required'>>().toEqualTypeOf<false>()
  })

  it('stays assignable to the option type of its inputs', () => {
    // Mirrors third-party option bags that nest a config class, such as
    // `OpenAPITSOptions.redocly` from `openapi-typescript`.
    class Registry {
      private cache = new Map<string, string>()
      lookup(key: string): string | undefined {
        return this.cache.get(key)
      }
    }

    interface ServiceOptions {
      retries?: number
      registry?: Registry
      nested?: { depth?: number }
    }

    const overrides: ServiceOptions = { retries: 3 }
    const defaults: ServiceOptions = { retries: 1, nested: { depth: 2 } }

    expectTypeOf(defu(overrides, defaults)).toExtend<ServiceOptions>()
  })
})

describe('createDefu', () => {
  it('skips the default merge when merger returns true', () => {
    const defuWithSum = createDefu((target, key, value) => {
      if (typeof value === 'number') {
        (target as any)[key] += value
        return true
      }
    })
    expect(defuWithSum({ cost: 15 }, { cost: 10 })).toEqual({ cost: 25 })
  })

  it('passes the dotted namespace to merger', () => {
    const defuWithNamespace = createDefu((target, key, value, namespace) => {
      if (key === 'modules') {
        target[key] = `${namespace}:${[...value, ...target[key]].sort().join(',')}`
        return true
      }
    })

    const source = { modules: ['A'], foo: { bar: { modules: ['X'] } } }
    const defaults = { modules: ['B'], foo: { bar: { modules: ['Y'] } } }
    expect(defuWithNamespace(source, defaults)).toEqual({
      modules: ':A,B',
      foo: { bar: { modules: 'foo.bar:X,Y' } },
    })
  })
})
