import type { ParsedQuery, QueryObject } from './path'
import { describe, expect, it } from 'vitest'
import { getPathname, getQuery, joinURL, withBase, withLeadingSlash, withoutBase, withoutLeadingSlash, withoutTrailingSlash, withQuery, withTrailingSlash } from './path'

describe('withoutLeadingSlash', () => {
  it.each([
    { input: undefined, out: '' },
    { input: '/', out: '' },
    { input: '/foo', out: 'foo' },
    { input: '/foo/bar', out: 'foo/bar' },
    // Only the first slash is removed.
    { input: '//foo', out: '/foo' },
    { input: '///foo', out: '//foo' },
  ])('converts $input to $out', ({ input, out }) => {
    expect(withoutLeadingSlash(input)).toBe(out)
  })

  it.each([
    { input: '' },
    { input: 'foo' },
  ])('leaves $input unchanged', ({ input }) => {
    expect(withoutLeadingSlash(input)).toBe(input)
  })
})

describe('withLeadingSlash', () => {
  it.each([
    { input: undefined, out: '/' },
    { input: '', out: '/' },
    { input: 'foo', out: '/foo' },
    // A slash later in the path is not a leading slash.
    { input: 'foo/bar', out: '/foo/bar' },
  ])('converts $input to $out', ({ input, out }) => {
    expect(withLeadingSlash(input)).toBe(out)
  })

  it.each([
    { input: '/' },
    { input: '/foo' },
    { input: '//foo' },
  ])('leaves $input unchanged', ({ input }) => {
    expect(withLeadingSlash(input)).toBe(input)
  })
})

describe('withoutTrailingSlash', () => {
  it.each([
    // Empty or missing input becomes the root.
    { input: undefined, out: '/' },
    { input: '', out: '/' },
    { input: 'bar/', out: 'bar' },
    // The query and fragment stay after the removed slash.
    { input: 'bar/#abc', out: 'bar#abc' },
    { input: 'foo/?123', out: 'foo?123' },
    { input: 'foo/?123#abc', out: 'foo?123#abc' },
    // A slash inside the query is not trailing.
    { input: 'foo/?k=/', out: 'foo?k=/' },
    // Absolute URLs
    { input: 'https://example.com/', out: 'https://example.com' },
    { input: 'https://example.com/foo/', out: 'https://example.com/foo' },
  ])('converts $input to $out', ({ input, out }) => {
    expect(withoutTrailingSlash(input)).toBe(out)
  })

  it.each([
    { input: '/' },
    { input: 'bar' },
    { input: 'bar#abc' },
    { input: 'foo?123' },
  ])('leaves $input unchanged', ({ input }) => {
    expect(withoutTrailingSlash(input)).toBe(input)
  })
})

describe('withTrailingSlash', () => {
  it.each([
    { input: undefined, out: '/' },
    { input: '', out: '/' },
    { input: 'bar', out: 'bar/' },
    // The slash goes before the query and fragment.
    { input: 'bar#abc', out: 'bar/#abc' },
    { input: 'foo?123', out: 'foo/?123' },
    { input: 'https://example.com', out: 'https://example.com/' },
    // A slash earlier in the path is not a trailing slash.
    { input: 'https://example.com/foo', out: 'https://example.com/foo/' },
  ])('converts $input to $out', ({ input, out }) => {
    expect(withTrailingSlash(input)).toBe(out)
  })

  it.each([
    { input: '/' },
    { input: 'bar/' },
    { input: 'foo/?123' },
    { input: 'foo/?123#abc' },
  ])('leaves $input unchanged', ({ input }) => {
    expect(withTrailingSlash(input)).toBe(input)
  })
})

describe('joinURL', () => {
  it.each<{ input: (string | undefined)[], out: string }>([
    // Empty or single segment
    { input: [], out: '' },
    { input: ['/'], out: '/' },
    // Falsy segments
    { input: ['', 'a'], out: 'a' },
    { input: ['a', undefined, 'b'], out: 'a/b' },
    { input: ['a', '', 'b'], out: 'a/b' },
    // The first segment keeps its trailing slash when nothing follows.
    { input: [undefined, './'], out: './' },
    // Basic joining
    { input: ['a', 'b'], out: 'a/b' },
    { input: ['a', 'b/', 'c'], out: 'a/b/c' },
    // Slashes between segments
    { input: ['/', '/b'], out: '/b' },
    { input: ['/', '/', '/'], out: '/' },
    { input: ['a', '/', 'b'], out: 'a/b' },
    { input: ['a', 'b/', '/c'], out: 'a/b/c' },
    { input: ['a//b', 'c'], out: 'a//b/c' },
    // Absolute URLs
    { input: ['https://example.com', 'foo'], out: 'https://example.com/foo' },
    { input: ['https://example.com/', '/foo'], out: 'https://example.com/foo' },
  ])('joins $input into $out', ({ input, out }) => {
    expect(joinURL(...input)).toBe(out)
  })
})

describe('withBase', () => {
  it.each([
    { base: '/foo', input: '', out: '/foo' },
    { base: '/foo', input: '/bar', out: '/foo/bar' },
    { base: '/foo/', input: '/', out: '/foo' },
    // Partial match, which is not a match
    { base: '/api', input: '/apiv2', out: '/api/apiv2' },
  ])('converts $input with base $base to $out', ({ base, input, out }) => {
    expect(withBase(input, base)).toBe(out)
  })

  it.each([
    // Empty or root base
    { base: '', input: '/foo' },
    { base: '/', input: '/' },
    // Base already present
    { base: '/base', input: '/base/' },
    { base: '/base', input: '/base/a' },
    { base: '/base/', input: '/base' },
    // Base followed by query or hash
    { base: '/base', input: '/base?q=1' },
    { base: '/base', input: '/base#hash' },
    // Absolute URLs, which no base can prefix
    { base: '/base', input: 'https://test.com/a' },
    { base: '/base', input: '//test.com/a' },
  ])('leaves $input unchanged with base $base', ({ base, input }) => {
    expect(withBase(input, base)).toBe(input)
  })
})

describe('withoutBase', () => {
  it.each([
    { base: '/base', input: '/base/', out: '/' },
    { base: '/base', input: '/base/a', out: '/a' },
    { base: '/base/', input: '/base', out: '/' },
    { base: '/base/a/', input: '/base/a', out: '/' },
    // Base followed by query or hash
    { base: '/api', input: '/api?test', out: '/?test' },
    { base: '/api', input: '/api#hash', out: '/#hash' },
  ])('converts $input with base $base to $out', ({ base, input, out }) => {
    expect(withoutBase(input, base)).toBe(out)
  })

  it.each([
    // Empty or root base
    { base: '', input: '/foo' },
    { base: '/', input: '/' },
    { base: '/', input: '/test/' },
    // Base not present
    { base: '/foo', input: '/' },
    { base: '/foo', input: '/bar' },
    // Partial match, which is not a match
    { base: '/api', input: '/apiv2' },
    // Absolute URLs, which carry no base to strip
    { base: '/base/', input: 'https://test.com' },
  ])('leaves $input unchanged with base $base', ({ base, input }) => {
    expect(withoutBase(input, base)).toBe(input)
  })
})

describe('getPathname', () => {
  it.each([
    // Simple paths
    { input: undefined, out: '/' },
    { input: '', out: '/' },
    { input: '/', out: '/' },
    { input: '/foo', out: '/foo' },
    { input: '/foo/', out: '/foo/' },
    // With a query string
    { input: '/foo?bar', out: '/foo' },
    { input: '/?query#hash', out: '/' },
    // With a hash
    { input: '/#hash', out: '/' },
    { input: '/foo#bar', out: '/foo' },
    { input: '/foo/#bar', out: '/foo/' },
    { input: '/foo?bar#baz', out: '/foo' },
    // Absolute URLs
    { input: 'https://example.com', out: '/' },
    { input: 'https://example.com/', out: '/' },
    { input: 'https://example.com/foo', out: '/foo' },
    { input: 'https://example.com/foo?bar#baz', out: '/foo' },
    { input: 'https://example.com?bar', out: '/' },
    { input: 'https://example.com#/not-a-path', out: '/' },
    { input: 'https://user:pass@example.com/foo', out: '/foo' },
    { input: 'https://[::1]:8080/foo', out: '/foo' },
    { input: 'HTTPS://EXAMPLE.COM/Foo', out: '/Foo' },
    // Protocol-relative URLs, whose authority follows the leading `//`
    { input: '//example.com', out: '/' },
    { input: '//example.com/foo', out: '/foo' },
    // Absolute URLs are sliced too, so their pathname is left unnormalized.
    { input: 'https://example.com/a b', out: '/a b' },
    { input: 'https://example.com/a/../b', out: '/a/../b' },
    { input: 'https://example.com/ünïcode', out: '/ünïcode' },
    // Relative paths and non-URL schemes are sliced, not URL-parsed.
    { input: 'foo', out: 'foo' },
    { input: 'foo?bar', out: 'foo' },
    { input: 'foo#bar', out: 'foo' },
    { input: 'mailto:someone@example.com', out: 'mailto:someone@example.com' },
  ])('extracts the pathname of $input as $out', ({ input, out }) => {
    expect(getPathname(input)).toBe(out)
  })
})

describe('withQuery', () => {
  it.each<{ input: string, query: QueryObject, out: string }>([
    // Merging into existing parameters
    { input: '/?test', query: { foo: 1 }, out: '/?test=&foo=1' },
    { input: '/?foo=1', query: { foo: 2 }, out: '/?foo=2' },
    { input: '/?foo=1', query: { foo: true, bar: false }, out: '/?foo=true&bar=false' },
    // `undefined` removes, `null` keeps an empty value
    { input: '/?foo=1', query: { foo: undefined }, out: '/' },
    { input: '/?foo=1', query: { foo: null }, out: '/?foo=' },
    // Percent-encoding
    { input: '/', query: { email: 'some email.com' }, out: '/?email=some+email.com' },
    { input: '/', query: { 'key with space': 'spaced value' }, out: '/?key+with+space=spaced+value' },
    { input: '/', query: { str: '&', str2: '%26' }, out: '/?str=%26&str2=%2526' },
    { input: '/?x=1,2,3', query: { y: '1,2,3' }, out: '/?x=1%2C2%2C3&y=1%2C2%2C3' },
    // Arrays append one entry per item, and an empty array is skipped
    { input: '/', query: { param: ['3', ''] }, out: '/?param=3&param=' },
    { input: '/', query: { 'a': 'X', 'b[]': [], 'c': 'Y' }, out: '/?a=X&c=Y' },
    // The fragment stays at the end and never becomes part of the query.
    { input: '/foo#bar', query: { page: 2 }, out: '/foo?page=2#bar' },
    { input: '/foo?a=1#bar', query: { page: 2 }, out: '/foo?a=1&page=2#bar' },
    { input: '/foo?a=1#bar', query: { a: undefined }, out: '/foo#bar' },
    { input: '/foo#a?b', query: { x: 1 }, out: '/foo?x=1#a?b' },
    { input: 'https://a.com/p?v=1#frag', query: { x: 2 }, out: 'https://a.com/p?v=1&x=2#frag' },
    { input: '/foo#', query: { x: 1 }, out: '/foo?x=1#' },
  ])('converts $input with $query to $out', ({ input, query, out }) => {
    expect(withQuery(input, query)).toBe(out)
  })

  it('leaves the input unchanged for an empty query', () => {
    expect(withQuery('/?test', {})).toBe('/?test')
  })

  it('percent-encodes a JSON string value', () => {
    expect(withQuery('/', { json: '{"test":["content"]}' })).toBe('/?json=%7B%22test%22%3A%5B%22content%22%5D%7D')
  })

  it('encodes an object value as JSON', () => {
    expect(withQuery('/', { param: { a: [{ obj: 1 }, { obj: 2 }] } }))
      .toBe('/?param=%7B%22a%22%3A%5B%7B%22obj%22%3A1%7D%2C%7B%22obj%22%3A2%7D%5D%7D')
  })
})

describe('getQuery', () => {
  it.each<{ input: string, out: ParsedQuery }>([
    { input: '/foo', out: {} },
    { input: '/foo?', out: {} },
    { input: '/foo?a=1', out: { a: '1' } },
    { input: '/foo?a=1&b=2', out: { a: '1', b: '2' } },
    { input: '/foo?a', out: { a: '' } },
    { input: '/foo?a=1&a=2', out: { a: ['1', '2'] } },
    { input: '/foo?a=1&a=2&a=3', out: { a: ['1', '2', '3'] } },
    { input: '/foo?a=1#bar', out: { a: '1' } },
    { input: '/foo#bar?a=1', out: {} },
    { input: '/foo?email=some+email.com', out: { email: 'some email.com' } },
    { input: '/foo?str=%26', out: { str: '&' } },
    { input: 'https://a.com/p?v=1#frag', out: { v: '1' } },
  ])('parses the query of $input as $out', ({ input, out }) => {
    expect(getQuery(input)).toEqual(out)
  })

  it('keeps __proto__ as an ordinary key', () => {
    const query = getQuery('/foo?__proto__=a')
    expect(Object.keys(query)).toEqual(['__proto__'])
    expect(Object.getPrototypeOf(query)).toBe(Object.prototype)
  })

  it('reads keys that collide with Object.prototype members', () => {
    expect(getQuery('/foo?constructor=x&toString=y')).toEqual({ constructor: 'x', toString: 'y' })
  })

  it('round-trips the parameters written by withQuery', () => {
    const url = withQuery('/foo#frag', { page: 2, tags: ['a', 'b'] })
    expect(getQuery(url)).toEqual({ page: '2', tags: ['a', 'b'] })
  })
})
