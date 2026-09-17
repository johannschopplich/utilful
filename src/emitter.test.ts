import type { Emitter, EventHandlerMap } from './emitter'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmitter } from './emitter'

const eventType = Symbol('eventType')
// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
  foo: unknown
  bar: unknown
  Foo: unknown
  FOO: unknown
  [eventType]: unknown
}

describe('createEmitter', () => {
  let events: EventHandlerMap<Events>, emitter: Emitter<Events>

  beforeEach(() => {
    events = new Map()
    emitter = createEmitter(events)
  })

  it('invokes handlers from a passed-in map', () => {
    const first = vi.fn()
    const second = vi.fn()
    events.set('foo', [first, second])

    emitter.emit('foo')

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it('exposes the passed-in map as events', () => {
    expect(emitter.events).toBe(events)
  })

  describe('on', () => {
    it('registers a handler under a symbol type', () => {
      const event = { a: 'b' }
      const handler = vi.fn()

      emitter.on(eventType, handler)
      emitter.emit(eventType, event)

      expect(handler).toHaveBeenCalledExactlyOnceWith(event)
    })

    it('appends a handler after the existing handlers of the type', () => {
      const first = vi.fn()
      const second = vi.fn()

      emitter.on('foo', first)
      emitter.on('foo', second)
      emitter.emit('foo', undefined)

      expect(first).toHaveBeenCalledBefore(second)
    })
  })

  describe('off', () => {
    it('removes the handler from the type', () => {
      const handler = vi.fn()

      emitter.on('foo', handler)
      emitter.off('foo', handler)
      emitter.emit('foo', undefined)

      expect(handler).not.toHaveBeenCalled()
    })

    it('removes only the first occurrence of a handler registered twice', () => {
      const handler = vi.fn()

      emitter.on('foo', handler)
      emitter.on('foo', handler)
      emitter.off('foo', handler)
      emitter.emit('foo', undefined)

      expect(handler).toHaveBeenCalledOnce()
    })

    it('removes all handlers of the type without a handler argument', () => {
      const onFoo1 = vi.fn()
      const onFoo2 = vi.fn()
      const onBar = vi.fn()

      emitter.on('foo', onFoo1)
      emitter.on('foo', onFoo2)
      emitter.on('bar', onBar)
      emitter.off('foo')
      emitter.emit('foo', undefined)
      emitter.emit('bar', undefined)

      expect(onFoo1).not.toHaveBeenCalled()
      expect(onFoo2).not.toHaveBeenCalled()
      expect(onBar).toHaveBeenCalledOnce()
    })

    it('keeps a handler registered under a type that differs in case', () => {
      const handler = vi.fn()

      emitter.on('foo', handler)
      emitter.off('FOO', handler)
      emitter.emit('foo', undefined)

      expect(handler).toHaveBeenCalledOnce()
    })
  })

  describe('emit', () => {
    it('invokes the handler of the type with the event', () => {
      const event = { a: 'b' }
      const handler = vi.fn()

      emitter.on('foo', handler)
      emitter.emit('foo', event)

      expect(handler).toHaveBeenCalledExactlyOnceWith(event)
    })

    it('invokes only the handler whose type matches case', () => {
      const onFoo = vi.fn()
      const onFOO = vi.fn()

      emitter.on('Foo', onFoo)
      emitter.on('FOO', onFOO)
      emitter.emit('Foo', 'Foo arg')

      expect(onFoo).toHaveBeenCalledExactlyOnceWith('Foo arg')
      expect(onFOO).not.toHaveBeenCalled()
    })

    it('invokes * handlers with the type and event', () => {
      const event = { a: 'b' }
      const star = vi.fn()

      emitter.on('*', star)
      emitter.emit('foo', event)

      expect(star).toHaveBeenCalledExactlyOnceWith('foo', event)
    })
  })
})
