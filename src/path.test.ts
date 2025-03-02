import { describe, expect, it } from 'vitest'
import { joinURL, withBase, withoutBase, withoutTrailingSlash, withQuery, withTrailingSlash } from './path'

describe('path', () => {
  describe('withBase', () => {
    const tests = [
      { base: '/', input: '/', out: '/' },
      { base: '/foo', input: '', out: '/foo' },
      { base: '/foo/', input: '/', out: '/foo' },
      { base: '/foo', input: '/bar', out: '/foo/bar' },
      { base: '/base/', input: '/base', out: '/base' },
      { base: '/base', input: '/base/', out: '/base/' },
      { base: '/base', input: '/base/a', out: '/base/a' },
      { base: '/base/', input: '/base/a', out: '/base/a' },
      { base: '/', input: 'https://test.com', out: 'https://test.com' },
    ]

    for (const test of tests) {
      it(`${JSON.stringify(test.base)} + ${JSON.stringify(test.input)}`, () => {
        expect(withBase(test.input, test.base)).toBe(test.out)
      })
    }
  })

  describe('withoutBase', () => {
    const tests = [
      { base: '/', input: '/', out: '/' },
      { base: '/foo', input: '/', out: '/' },
      { base: '/foo/', input: '/', out: '/' },
      { base: '/foo', input: '/bar', out: '/bar' },
      { base: '/base/', input: '/base', out: '/' },
      { base: '/base', input: '/base/', out: '/' },
      { base: '/base', input: '/base/a', out: '/a' },
      { base: '/base/', input: '/base/a', out: '/a' },
      { base: '/base/a/', input: '/base/a', out: '/' },
      { base: '/', input: '/test/', out: '/test/' },
      { base: '/', input: '/?test', out: '/?test' },
      { base: '/api', input: '/api?test', out: '/?test' },
      { base: '/base/', input: 'https://test.com', out: 'https://test.com' },
      { base: '/', input: 'https://test.com', out: 'https://test.com' },
    ]

    for (const test of tests) {
      it(`${JSON.stringify(test.input)}-${JSON.stringify(test.base)}`, () => {
        expect(withoutBase(test.input, test.base)).toBe(test.out)
      })
    }
  })

  describe('joinURL', () => {
    const tests = [
      { input: [], out: '' },
      { input: ['/'], out: '/' },
      { input: [undefined, './'], out: './' },
      { input: ['/a'], out: '/a' },
      { input: ['a', 'b'], out: 'a/b' },
      { input: ['/', '/b'], out: '/b' },
      { input: ['a', 'b/', 'c'], out: 'a/b/c' },
      { input: ['a', 'b/', '/c'], out: 'a/b/c' },
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
      'bar': 'bar/',
      'bar#abc': 'bar#abc/',
      'bar/': 'bar/',
      'foo?123': 'foo?123/',
      'foo/?123': 'foo/?123/',
      'foo/?123#abc': 'foo/?123#abc/',
    }

    for (const input in tests) {
      it(input, () => {
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
      'bar/#abc': 'bar/#abc',
      'foo?123': 'foo?123',
      'foo/?123': 'foo/?123',
      'foo/?123#abc': 'foo/?123#abc',
      'foo/?k=v': 'foo/?k=v',
      'foo/?k=/': 'foo/?k=',
    }

    for (const input in tests) {
      it(input, () => {
        expect(withoutTrailingSlash(input)).toBe(tests[input])
      })
    }

    it('falsy value', () => {
      expect(withoutTrailingSlash()).toBe('/')
    })
  })
})
