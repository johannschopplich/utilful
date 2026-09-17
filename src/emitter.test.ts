import type { Emitter, EventHandlerMap } from './emitter'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmitter } from './emitter'

const eventType = Symbol('eventType')
const otherEventType = Symbol('eventType')
// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
  foo: unknown
  bar: unknown
  Foo: unknown
  FOO: unknown
  [eventType]: unknown
  [otherEventType]: unknown
}

describe('createEmitter', () => {
  let events: EventHandlerMap<Events>, emitter: Emitter<Events>

  beforeEach(() => {
    events = new Map()
    emitter = createEmitter(events)
  })

  it('invokes handlers already in the events argument', () => {
    const first = vi.fn()
    const second = vi.fn()
    events.set('foo', [first, second])

    emitter.emit('foo')

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it('exposes the events argument as events', () => {
    expect(emitter.events).toBe(events)
  })

  it('creates its own events map without an argument', () => {
    const ownEmitter = createEmitter<Events>()
    const handler = vi.fn()

    ownEmitter.on('foo', handler)
    ownEmitter.emit('foo', 'event')

    expect(ownEmitter.events).toBeInstanceOf(Map)
    expect(handler).toHaveBeenCalledExactlyOnceWith('event')
  })

  describe('on', () => {
    it('keeps the handlers of two symbols with the same description apart', () => {
      const event = { a: 'b' }
      const handler = vi.fn()
      const otherHandler = vi.fn()

      emitter.on(eventType, handler)
      emitter.on(otherEventType, otherHandler)
      emitter.emit(eventType, event)

      expect(handler).toHaveBeenCalledExactlyOnceWith(event)
      expect(otherHandler).not.toHaveBeenCalled()
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
      const firstFooHandler = vi.fn()
      const secondFooHandler = vi.fn()
      const barHandler = vi.fn()

      emitter.on('foo', firstFooHandler)
      emitter.on('foo', secondFooHandler)
      emitter.on('bar', barHandler)
      emitter.off('foo')
      emitter.emit('foo', undefined)
      emitter.emit('bar', undefined)

      expect(firstFooHandler).not.toHaveBeenCalled()
      expect(secondFooHandler).not.toHaveBeenCalled()
      expect(barHandler).toHaveBeenCalledOnce()
    })

    it('keeps the other handlers when removing a handler that was never registered', () => {
      const handler = vi.fn()

      emitter.on('foo', handler)
      emitter.off('foo', vi.fn())
      emitter.emit('foo', undefined)

      expect(handler).toHaveBeenCalledOnce()
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
      const titleCaseHandler = vi.fn()
      const upperCaseHandler = vi.fn()

      emitter.on('Foo', titleCaseHandler)
      emitter.on('FOO', upperCaseHandler)
      emitter.emit('Foo', 'Foo arg')

      expect(titleCaseHandler).toHaveBeenCalledExactlyOnceWith('Foo arg')
      expect(upperCaseHandler).not.toHaveBeenCalled()
    })

    it('still invokes the next handler when a handler calls off for itself', () => {
      const selfRemovingHandler = vi.fn(() => emitter.off('foo', selfRemovingHandler))
      const nextHandler = vi.fn()

      emitter.on('foo', selfRemovingHandler)
      emitter.on('foo', nextHandler)
      emitter.emit('foo', undefined)

      expect(nextHandler).toHaveBeenCalledOnce()
    })

    it('invokes * handlers after the handlers of the type', () => {
      const typeHandler = vi.fn()
      const wildcardHandler = vi.fn()

      emitter.on('*', wildcardHandler)
      emitter.on('foo', typeHandler)
      emitter.emit('foo', undefined)

      expect(typeHandler).toHaveBeenCalledBefore(wildcardHandler)
    })

    it('invokes * handlers with the type and event of each emit', () => {
      const fooEvent = { a: 'b' }
      const barEvent = { c: 'd' }
      const wildcardHandler = vi.fn()

      emitter.on('*', wildcardHandler)
      emitter.emit('foo', fooEvent)
      emitter.emit('bar', barEvent)

      expect(wildcardHandler).toHaveBeenNthCalledWith(1, 'foo', fooEvent)
      expect(wildcardHandler).toHaveBeenNthCalledWith(2, 'bar', barEvent)
    })
  })
})
