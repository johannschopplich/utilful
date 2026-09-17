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
  let events: EventHandlerMap<Events>, inst: Emitter<Events>

  beforeEach(() => {
    events = new Map()
    inst = createEmitter(events)
  })

  it('invokes handlers from a passed-in map', () => {
    const first = vi.fn()
    const second = vi.fn()
    events.set('foo', [first, second])

    inst.emit('foo')

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it('exposes the passed-in map as events', () => {
    expect(inst.events).toBe(events)
  })

  describe('on', () => {
    it('registers a handler under a symbol type', () => {
      const event = { a: 'b' }
      const handler = vi.fn()

      inst.on(eventType, handler)
      inst.emit(eventType, event)

      expect(handler).toHaveBeenCalledExactlyOnceWith(event)
    })

    it('appends a handler after the existing handlers of the type', () => {
      const first = vi.fn()
      const second = vi.fn()

      inst.on('foo', first)
      inst.on('foo', second)
      inst.emit('foo', undefined)

      expect(first).toHaveBeenCalledBefore(second)
    })
  })

  describe('off', () => {
    it('removes the handler from the type', () => {
      const handler = vi.fn()

      inst.on('foo', handler)
      inst.off('foo', handler)
      inst.emit('foo', undefined)

      expect(handler).not.toHaveBeenCalled()
    })

    it('removes only the first occurrence of a handler registered twice', () => {
      const handler = vi.fn()

      inst.on('foo', handler)
      inst.on('foo', handler)
      inst.off('foo', handler)
      inst.emit('foo', undefined)

      expect(handler).toHaveBeenCalledOnce()
    })

    it('removes all handlers of the type without a handler argument', () => {
      const onFoo1 = vi.fn()
      const onFoo2 = vi.fn()
      const onBar = vi.fn()

      inst.on('foo', onFoo1)
      inst.on('foo', onFoo2)
      inst.on('bar', onBar)
      inst.off('foo')
      inst.emit('foo', undefined)
      inst.emit('bar', undefined)

      expect(onFoo1).not.toHaveBeenCalled()
      expect(onFoo2).not.toHaveBeenCalled()
      expect(onBar).toHaveBeenCalledOnce()
    })
  })

  describe('emit', () => {
    it('invokes the handler of the type with the event', () => {
      const event = { a: 'b' }
      const handler = vi.fn()

      inst.on('foo', handler)
      inst.emit('foo', event)

      expect(handler).toHaveBeenCalledExactlyOnceWith(event)
    })

    it('invokes only the handler whose type matches case', () => {
      const onFoo = vi.fn()
      const onFOO = vi.fn()

      inst.on('Foo', onFoo)
      inst.on('FOO', onFOO)
      inst.emit('Foo', 'Foo arg')

      expect(onFoo).toHaveBeenCalledExactlyOnceWith('Foo arg')
      expect(onFOO).not.toHaveBeenCalled()
    })

    it('invokes * handlers with the type and event', () => {
      const event = { a: 'b' }
      const star = vi.fn()

      inst.on('*', star)
      inst.emit('foo', event)

      expect(star).toHaveBeenCalledExactlyOnceWith('foo', event)
    })
  })
})
