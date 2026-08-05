import type { ParsedQuery, QueryObject } from './path'
import { describe, expect, it } from 'vitest'
import { getPathname, getQuery, joinURL, withBase, withLeadingSlash, withoutBase, withoutLeadingSlash, withoutTrailingSlash, withQuery, withTrailingSlash } from './path'

describe('path', () => {
  describe('withoutLeadingSlash', () => {
    it.each([
      { input: '', out: '' },
      { input: '/', out: '' },
      { input: 'foo', out: 'foo' },
      { input: '/foo', out: 'foo' },
      { input: '/foo/bar', out: 'foo/bar' },
      { input: '//foo', out: '/foo' },
      { input: '///foo', out: '//foo' },
    ])('returns $input without a leading slash', ({ input, out }) => {
      expect(withoutLeadingSlash(input)).toBe(out)
    })

    it('returns an empty string for a missing input', () => {
      expect(withoutLeadingSlash()).toBe('')
    })
  })

  describe('withLeadingSlash', () => {
    it.each([
      { input: '', out: '/' },
      { input: '/', out: '/' },
      { input: 'foo', out: '/foo' },
      { input: '/foo', out: '/foo' },
      { input: 'foo/bar', out: '/foo/bar' },
      { input: '//foo', out: '//foo' },
    ])('returns $input with a leading slash', ({ input, out }) => {
      expect(withLeadingSlash(input)).toBe(out)
    })

    it('returns / for a missing input', () => {
      expect(withLeadingSlash()).toBe('/')
    })
  })

  describe('withoutTrailingSlash', () => {
    it.each([
      { input: '', out: '/' },
      { input: '/', out: '/' },
      { input: 'bar', out: 'bar' },
      { input: 'bar#abc', out: 'bar#abc' },
      { input: 'bar/#abc', out: 'bar#abc' },
      { input: 'foo?123', out: 'foo?123' },
      { input: 'foo/?123', out: 'foo?123' },
      { input: 'foo/?123#abc', out: 'foo?123#abc' },
      { input: 'foo/?k=v', out: 'foo?k=v' },
      { input: 'foo/?k=/', out: 'foo?k=/' },
      { input: 'https://example.com/', out: 'https://example.com' },
      { input: 'https://example.com/foo/', out: 'https://example.com/foo' },
    ])('returns $input without a trailing slash', ({ input, out }) => {
      expect(withoutTrailingSlash(input)).toBe(out)
    })

    it('returns / for a missing input', () => {
      expect(withoutTrailingSlash()).toBe('/')
    })
  })

  describe('withTrailingSlash', () => {
    it.each([
      { input: '', out: '/' },
      { input: '/', out: '/' },
      { input: 'bar', out: 'bar/' },
      { input: 'bar#abc', out: 'bar/#abc' },
      { input: 'bar/', out: 'bar/' },
      { input: 'foo?123', out: 'foo/?123' },
      { input: 'foo/?123', out: 'foo/?123' },
      { input: 'foo/?123#abc', out: 'foo/?123#abc' },
      { input: 'https://example.com', out: 'https://example.com/' },
      { input: 'https://example.com/foo', out: 'https://example.com/foo/' },
    ])('returns $input with a trailing slash', ({ input, out }) => {
      expect(withTrailingSlash(input)).toBe(out)
    })

    it('returns / for a missing input', () => {
      expect(withTrailingSlash()).toBe('/')
    })
  })

  describe('joinURL', () => {
    it.each<{ input: (string | undefined)[], out: string }>([
      // Empty or single segment
      { input: [], out: '' },
      { input: ['/'], out: '/' },
      { input: ['/a'], out: '/a' },
      // Falsy segments
      { input: ['', 'a'], out: 'a' },
      { input: ['a', '', 'b'], out: 'a/b' },
      { input: ['a', undefined, 'b'], out: 'a/b' },
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
      // Empty or root base
      { base: '', input: '/foo', out: '/foo' },
      { base: '/', input: '/', out: '/' },
      { base: '/', input: 'https://test.com', out: 'https://test.com' },
      // Simple base paths
      { base: '/foo', input: '', out: '/foo' },
      { base: '/foo', input: '/bar', out: '/foo/bar' },
      { base: '/foo/', input: '/', out: '/foo' },
      // Base already present
      { base: '/base', input: '/base/', out: '/base/' },
      { base: '/base', input: '/base/a', out: '/base/a' },
      { base: '/base/', input: '/base', out: '/base' },
      { base: '/base/', input: '/base/a', out: '/base/a' },
      // Base followed by query or hash
      { base: '/base', input: '/base?q=1', out: '/base?q=1' },
      { base: '/base', input: '/base#hash', out: '/base#hash' },
      // Partial match, which is not a match
      { base: '/api', input: '/apiv2', out: '/api/apiv2' },
    ])('returns $input with base $base', ({ base, input, out }) => {
      expect(withBase(input, base)).toBe(out)
    })
  })

  describe('withoutBase', () => {
    it.each([
      // Empty or root base
      { base: '', input: '/foo', out: '/foo' },
      { base: '/', input: '/', out: '/' },
      { base: '/', input: '/test/', out: '/test/' },
      { base: '/', input: '/?test', out: '/?test' },
      { base: '/', input: 'https://test.com', out: 'https://test.com' },
      // Base not present
      { base: '/foo', input: '/', out: '/' },
      { base: '/foo', input: '/bar', out: '/bar' },
      { base: '/foo/', input: '/', out: '/' },
      // Base present
      { base: '/base', input: '/base/', out: '/' },
      { base: '/base', input: '/base/a', out: '/a' },
      { base: '/base/', input: '/base', out: '/' },
      { base: '/base/', input: '/base/a', out: '/a' },
      { base: '/base/a/', input: '/base/a', out: '/' },
      // Base followed by query or hash
      { base: '/api', input: '/api?test', out: '/?test' },
      { base: '/api', input: '/api#hash', out: '/#hash' },
      // Partial match, which is not a match
      { base: '/api', input: '/apiv2', out: '/apiv2' },
      // Absolute URLs, which carry no base to strip
      { base: '/base/', input: 'https://test.com', out: 'https://test.com' },
    ])('returns $input without base $base', ({ base, input, out }) => {
      expect(withoutBase(input, base)).toBe(out)
    })
  })

  describe('getPathname', () => {
    it.each([
      // Simple paths
      { input: '', out: '/' },
      { input: '/', out: '/' },
      { input: '/foo', out: '/foo' },
      { input: '/foo/', out: '/foo/' },
      { input: '/#hash', out: '/' },
      { input: '/foo/#bar', out: '/foo/' },
      // With a query string
      { input: '/foo?bar', out: '/foo' },
      { input: '/?query#hash', out: '/' },
      // With a hash
      { input: '/foo#bar', out: '/foo' },
      { input: '/foo?bar#baz', out: '/foo' },
      // Absolute URLs
      { input: 'https://example.com', out: '/' },
      { input: 'https://example.com/', out: '/' },
      { input: 'https://example.com/foo', out: '/foo' },
      { input: 'https://example.com/foo?bar', out: '/foo' },
      { input: 'https://example.com/foo#hash', out: '/foo' },
      { input: 'https://example.com/foo?bar#baz', out: '/foo' },
      { input: 'https://example.com?bar', out: '/' },
      { input: 'https://example.com#/not-a-path', out: '/' },
      { input: 'https://user:pass@example.com/foo', out: '/foo' },
      { input: 'https://example.com:8080/foo', out: '/foo' },
      { input: 'https://[::1]:8080/foo', out: '/foo' },
      { input: 'HTTPS://EXAMPLE.COM/Foo', out: '/Foo' },
      // Absolute URLs are sliced too, so their pathname is left unnormalized.
      { input: 'https://example.com/a b', out: '/a b' },
      { input: 'https://example.com/a/../b', out: '/a/../b' },
      { input: 'https://example.com/ünïcode', out: '/ünïcode' },
      // Relative paths and non-URL schemes are sliced, not URL-parsed.
      { input: 'foo', out: 'foo' },
      { input: 'foo?bar', out: 'foo' },
      { input: 'foo#hash', out: 'foo' },
      { input: '../foo', out: '../foo' },
      { input: 'mailto:someone@example.com', out: 'mailto:someone@example.com' },
    ])('extracts the pathname of $input', ({ input, out }) => {
      expect(getPathname(input)).toBe(out)
    })

    it('returns / for a missing input', () => {
      expect(getPathname()).toBe('/')
    })
  })

  describe('withQuery', () => {
    it.each<{ input: string, query: QueryObject, out: string }>([
      // Nothing to merge
      { input: '', query: {}, out: '' },
      { input: '/', query: {}, out: '/' },
      { input: '?test', query: {}, out: '?test' },
      { input: '/?test', query: {}, out: '/?test' },
      // Merging into existing parameters
      { input: '/?test', query: { foo: '0' }, out: '/?test=&foo=0' },
      { input: '/?test', query: { foo: 0 }, out: '/?test=&foo=0' },
      { input: '/?foo=1', query: { foo: 2 }, out: '/?foo=2' },
      { input: '/?foo=1', query: { foo: true, bar: false }, out: '/?foo=true&bar=false' },
      { input: 'http://a.com?v=1', query: { x: 2 }, out: 'http://a.com?v=1&x=2' },
      // `undefined` removes, `null` keeps an empty value
      { input: '/?test', query: { test: undefined }, out: '/' },
      { input: '/?foo=1', query: { foo: undefined }, out: '/' },
      { input: '/?foo=1', query: { foo: null }, out: '/?foo=' },
      // Percent-encoding
      { input: '/', query: { email: 'some email.com' }, out: '/?email=some+email.com' },
      { input: '/', query: { 'key with space': 'spaced value' }, out: '/?key+with+space=spaced+value' },
      { input: '/', query: { str: '&', str2: '%26' }, out: '/?str=%26&str2=%2526' },
      { input: '/?x=1,2,3', query: { y: '1,2,3' }, out: '/?x=1%2C2%2C3&y=1%2C2%2C3' },
      { input: '/', query: { json: '{"test":["content"]}' }, out: '/?json=%7B%22test%22%3A%5B%22content%22%5D%7D' },
      // Arrays append one entry per item, and an empty array is skipped
      { input: '/', query: { param: ['3', ''] }, out: '/?param=3&param=' },
      { input: '/', query: { 'a': 'X', 'b[]': [], 'c': 'Y' }, out: '/?a=X&c=Y' },
      // Objects are JSON-encoded
      { input: '/', query: { param: { a: [{ obj: 1 }, { obj: 2 }] } }, out: '/?param=%7B%22a%22%3A%5B%7B%22obj%22%3A1%7D%2C%7B%22obj%22%3A2%7D%5D%7D' },
      // The fragment stays at the end and never becomes part of the query.
      { input: '/foo#bar', query: { page: 2 }, out: '/foo?page=2#bar' },
      { input: '/foo?a=1#bar', query: { page: 2 }, out: '/foo?a=1&page=2#bar' },
      { input: '/foo#bar', query: { a: undefined }, out: '/foo#bar' },
      { input: '/foo?a=1#bar', query: { a: undefined }, out: '/foo#bar' },
      { input: '/foo#a?b', query: { x: 1 }, out: '/foo?x=1#a?b' },
      { input: 'https://a.com/p?v=1#frag', query: { x: 2 }, out: 'https://a.com/p?v=1&x=2#frag' },
      { input: '/foo#', query: { x: 1 }, out: '/foo?x=1#' },
    ])('returns $input with query $query', ({ input, query, out }) => {
      expect(withQuery(input, query)).toBe(out)
    })
  })

  describe('getQuery', () => {
    it.each<{ input: string, out: ParsedQuery }>([
      { input: '', out: {} },
      { input: '/foo', out: {} },
      { input: '/foo?', out: {} },
      { input: '/foo?a=1', out: { a: '1' } },
      { input: '/foo?a=1&b=2', out: { a: '1', b: '2' } },
      { input: '/foo?a', out: { a: '' } },
      { input: '/foo?a=', out: { a: '' } },
      { input: '/foo?a=1&a=2', out: { a: ['1', '2'] } },
      { input: '/foo?a=1&a=2&a=3', out: { a: ['1', '2', '3'] } },
      { input: '/foo?a=1#bar', out: { a: '1' } },
      { input: '/foo#bar?a=1', out: {} },
      { input: '/foo?email=some+email.com', out: { email: 'some email.com' } },
      { input: '/foo?str=%26', out: { str: '&' } },
      { input: 'https://a.com/p?v=1#frag', out: { v: '1' } },
    ])('parses the query of $input', ({ input, out }) => {
      expect(getQuery(input)).toEqual(out)
    })

    it('keeps __proto__ as an ordinary key', () => {
      const query = getQuery('/foo?__proto__=a')
      expect(Object.keys(query)).toEqual(['__proto__'])
      expect(Object.getPrototypeOf(query)).toBe(Object.prototype)
    })

    it('reads keys that collide with Object.prototype members', () => {
      expect(getQuery('/foo?constructor=x')).toEqual({ constructor: 'x' })
      expect(getQuery('/foo?toString=x&valueOf=y')).toEqual({ toString: 'x', valueOf: 'y' })
    })

    it('round-trips the parameters written by withQuery', () => {
      const url = withQuery('/foo#frag', { page: 2, tags: ['a', 'b'] })
      expect(getQuery(url)).toEqual({ page: '2', tags: ['a', 'b'] })
    })
  })
})
