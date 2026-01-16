import { describe, expect, it } from 'vitest'
import { getPathname, joinURL, withBase, withLeadingSlash, withoutBase, withoutLeadingSlash, withoutTrailingSlash, withQuery, withTrailingSlash } from './path'

describe('path', () => {
  describe('withoutLeadingSlash', () => {
    const tests: Record<string, string> = {
      '': '',
      '/': '',
      '/foo': 'foo',
      'foo': 'foo',
      '/foo/bar': 'foo/bar',
      '//foo': '/foo',
      '///foo': '//foo',
    }

    for (const input in tests) {
      it(input || '(empty)', () => {
        expect(withoutLeadingSlash(input)).toBe(tests[input])
      })
    }

    it('falsy value', () => {
      expect(withoutLeadingSlash()).toBe('')
    })
  })

  describe('withLeadingSlash', () => {
    const tests: Record<string, string> = {
      '': '/',
      '/': '/',
      'foo': '/foo',
      '/foo': '/foo',
      'foo/bar': '/foo/bar',
      '//foo': '//foo',
    }

    for (const input in tests) {
      it(input || '(empty)', () => {
        expect(withLeadingSlash(input)).toBe(tests[input])
      })
    }

    it('falsy value', () => {
      expect(withLeadingSlash()).toBe('/')
    })
  })

  describe('withBase', () => {
    const tests = [
      // Empty/root base
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
      // Partial match (should NOT match)
      { base: '/api', input: '/apiv2', out: '/api/apiv2' },
    ]

    for (const test of tests) {
      it(`${JSON.stringify(test.base)} + ${JSON.stringify(test.input)}`, () => {
        expect(withBase(test.input, test.base)).toBe(test.out)
      })
    }
  })

  describe('withoutBase', () => {
    const tests = [
      // Empty/root base
      { base: '', input: '/foo', out: '/foo' },
      { base: '/', input: '/', out: '/' },
      { base: '/', input: '/test/', out: '/test/' },
      { base: '/', input: '/?test', out: '/?test' },
      { base: '/', input: 'https://test.com', out: 'https://test.com' },
      // Base not present
      { base: '/foo', input: '/', out: '/' },
      { base: '/foo', input: '/bar', out: '/bar' },
      { base: '/foo/', input: '/', out: '/' },
      // Base present - strip it
      { base: '/base', input: '/base/', out: '/' },
      { base: '/base', input: '/base/a', out: '/a' },
      { base: '/base/', input: '/base', out: '/' },
      { base: '/base/', input: '/base/a', out: '/a' },
      { base: '/base/a/', input: '/base/a', out: '/' },
      // With query string
      { base: '/api', input: '/api?test', out: '/?test' },
      // Partial match (should NOT strip)
      { base: '/api', input: '/apiv2', out: '/apiv2' },
      // Full URLs passthrough
      { base: '/base/', input: 'https://test.com', out: 'https://test.com' },
    ]

    for (const test of tests) {
      it(`${JSON.stringify(test.input)}-${JSON.stringify(test.base)}`, () => {
        expect(withoutBase(test.input, test.base)).toBe(test.out)
      })
    }
  })

  describe('joinURL', () => {
    const tests = [
      // Empty/single segment
      { input: [], out: '' },
      { input: ['/'], out: '/' },
      { input: ['/a'], out: '/a' },
      // Falsy values
      { input: ['', 'a'], out: 'a' },
      { input: ['a', '', 'b'], out: 'a/b' },
      { input: ['a', undefined, 'b'], out: 'a/b' },
      { input: [undefined, './'], out: './' },
      // Basic joining
      { input: ['a', 'b'], out: 'a/b' },
      { input: ['a', 'b/', 'c'], out: 'a/b/c' },
      // Slash handling
      { input: ['/', '/b'], out: '/b' },
      { input: ['/', '/', '/'], out: '/' },
      { input: ['a', '/', 'b'], out: 'a/b' },
      { input: ['a', 'b/', '/c'], out: 'a/b/c' },
      { input: ['a//b', 'c'], out: 'a//b/c' },
      // Full URLs
      { input: ['https://example.com', 'foo'], out: 'https://example.com/foo' },
      { input: ['https://example.com/', '/foo'], out: 'https://example.com/foo' },
    ] as const

    for (const test of tests) {
      it(`joinURL(${test.input.map(i => JSON.stringify(i)).join(', ')}) === ${JSON.stringify(test.out)}`, () => {
        expect(joinURL(...(test.input))).toBe(test.out)
      })
    }
  })

  describe('withQuery', () => {
    const tests = [
      { input: '', query: {}, out: '' },
      { input: '/', query: {}, out: '/' },
      { input: '?test', query: {}, out: '?test' },
      { input: '/?test', query: {}, out: '/?test' },
      { input: '/?test', query: { foo: '0' }, out: '/?test=&foo=0' },
      { input: '/?test', query: { foo: 0 }, out: '/?test=&foo=0' },
      { input: '/?test', query: { foo: 1 }, out: '/?test=&foo=1' },
      { input: '/?test', query: { test: undefined }, out: '/' },
      { input: '/?foo=1', query: { foo: 2 }, out: '/?foo=2' },
      {
        input: '/?foo=1',
        query: { foo: true, bar: false },
        out: '/?foo=true&bar=false',
      },
      { input: '/?foo=1', query: { foo: undefined }, out: '/' },

      { input: '/?foo=1', query: { foo: null }, out: '/?foo=' },
      {
        input: '/',
        query: { email: 'some email.com' },
        out: '/?email=some+email.com',
      },
      {
        input: '/',
        query: { 'key with space': 'spaced value' },
        out: '/?key+with+space=spaced+value',
      },
      {
        input: '/',
        query: { str: '&', str2: '%26' },
        out: '/?str=%26&str2=%2526',
      },
      { input: '/?x=1,2,3', query: { y: '1,2,3' }, out: '/?x=1%2C2%2C3&y=1%2C2%2C3' },
      { input: 'http://a.com?v=1', query: { x: 2 }, out: 'http://a.com?v=1&x=2' },
      {
        input: '/',
        query: { json: '{"test":["content"]}' },
        out: '/?json=%7B%22test%22%3A%5B%22content%22%5D%7D',
      },
      { input: '/', query: { param: ['3', ''] }, out: '/?param=3&param=' },
      { input: '/', query: { param: ['', '3'] }, out: '/?param=&param=3' },
      {
        input: '/',
        query: { param: { a: { nested: { object: 123 } } } },
        out: '/?param=%7B%22a%22%3A%7B%22nested%22%3A%7B%22object%22%3A123%7D%7D%7D',
      },
      {
        input: '/',
        query: { param: { a: [{ obj: 1 }, { obj: 2 }] } },
        out: '/?param=%7B%22a%22%3A%5B%7B%22obj%22%3A1%7D%2C%7B%22obj%22%3A2%7D%5D%7D', // {"a":[{"obj":1},{"obj":2}]}
      },
      {
        input: '/',
        query: { param: { a: [{ obj: [1, 2, 3] }] } },
        out: '/?param=%7B%22a%22%3A%5B%7B%22obj%22%3A%5B1%2C2%2C3%5D%7D%5D%7D', // {"a":[{"obj":[1,2,3]}]}
      },
      {
        input: '/',
        query: { 'a': 'X', 'b[]': [], 'c': 'Y' },
        out: '/?a=X&c=Y',
      },
    ]

    for (const test of tests) {
      it(`${test.input.toString()} with ${JSON.stringify(test.query)}`, () => {
        expect(withQuery(test.input, test.query)).toBe(test.out)
      })
    }
  })

  describe('withTrailingSlash', () => {
    const tests: Record<string, string> = {
      '': '/',
      '/': '/',
      'bar': 'bar/',
      'bar#abc': 'bar/#abc',
      'bar/': 'bar/',
      'foo?123': 'foo/?123',
      'foo/?123': 'foo/?123',
      'foo/?123#abc': 'foo/?123#abc',
      'https://example.com': 'https://example.com/',
      'https://example.com/foo': 'https://example.com/foo/',
    }

    for (const input in tests) {
      it(input || '(empty)', () => {
        expect(withTrailingSlash(input)).toBe(tests[input])
      })
    }

    it('falsy value', () => {
      expect(withTrailingSlash()).toBe('/')
    })
  })

  describe('withoutTrailingSlash', () => {
    const tests: Record<string, string> = {
      '': '/',
      '/': '/',
      'bar': 'bar',
      'bar#abc': 'bar#abc',
      'bar/#abc': 'bar#abc',
      'foo?123': 'foo?123',
      'foo/?123': 'foo?123',
      'foo/?123#abc': 'foo?123#abc',
      'foo/?k=v': 'foo?k=v',
      'foo/?k=/': 'foo?k=/',
      'https://example.com/': 'https://example.com',
      'https://example.com/foo/': 'https://example.com/foo',
    }

    for (const input in tests) {
      it(input || '(empty)', () => {
        expect(withoutTrailingSlash(input)).toBe(tests[input])
      })
    }

    it('falsy value', () => {
      expect(withoutTrailingSlash()).toBe('/')
    })
  })

  describe('getPathname', () => {
    const tests: Record<string, string> = {
      // Simple paths
      '/': '/',
      '/foo': '/foo',
      '/foo/': '/foo/',
      '/#hash': '/',
      '/foo/#bar': '/foo/',
      // With query string
      '/foo?bar': '/foo',
      '/?query#hash': '/',
      // With hash
      '/foo#bar': '/foo',
      '/foo?bar#baz': '/foo',
      // Full URLs
      'https://example.com': '/',
      'https://example.com/': '/',
      'https://example.com/foo': '/foo',
      'https://example.com/foo?bar': '/foo',
      'https://example.com/foo#hash': '/foo',
    }

    for (const input in tests) {
      it(input, () => {
        expect(getPathname(input)).toBe(tests[input])
      })
    }

    it('falsy value', () => {
      expect(getPathname()).toBe('/')
    })
  })
})
