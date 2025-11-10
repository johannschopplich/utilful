/* eslint-disable ts/method-signature-style */
export type EventType = string | symbol

// An event handler can take an optional event argument
// and should not return a value
export type Handler<T = unknown> = (event: T) => void
export type WildcardHandler<T = Record<string, unknown>> = (
  type: keyof T,
  event: T[keyof T],
) => void

export type EventHandlerList<T = unknown> = Handler<T>[]
export type WildCardEventHandlerList<T = Record<string, unknown>> = WildcardHandler<T>[]

// A map of event types and their corresponding event handlers.
export type EventHandlerMap<Events extends Record<EventType, unknown>> = Map<
  keyof Events | '*',
  EventHandlerList<Events[keyof Events]> | WildCardEventHandlerList<Events>
>

export interface Emitter<Events extends Record<EventType, unknown>> {
  events: EventHandlerMap<Events>

  on<Key extends keyof Events>(type: Key, handler: Handler<Events[Key]>): void
  on(type: '*', handler: WildcardHandler<Events>): void

  off<Key extends keyof Events>(type: Key, handler?: Handler<Events[Key]>): void
  off(type: '*', handler: WildcardHandler<Events>): void

  emit<Key extends keyof Events>(type: Key, event: Events[Key]): void
  emit<Key extends keyof Events>(type: undefined extends Events[Key] ? Key : never): void
}

/**
 * Simple functional event emitter / pubsub.
 *
 * @remarks Ported from `mitt`.
 * @see https://github.com/developit/mitt
 */
export function createEmitter<Events extends Record<EventType, unknown>>(
  events?: EventHandlerMap<Events>,
): Emitter<Events> {
  type GenericEventHandler = Handler<Events[keyof Events]> | WildcardHandler<Events>

  events ||= new Map()

  return {
    /**
     * A Map of event names to registered handler functions.
     */
    events,

    /**
     * Register an event handler for the given type.
     *
     * @memberOf createEmitter
     */
    on<Key extends keyof Events>(
      /** Type of event to listen for, or `'*'` for all events */
      type: Key,
      /** Function to call in response to given event */
      handler: GenericEventHandler,
    ): void {
      const handlers: GenericEventHandler[] | undefined = events.get(type)

      if (handlers) {
        handlers.push(handler)
      }
      else {
        events.set(type, [handler] as EventHandlerList<Events[keyof Events]>)
      }
    },

    /**
     * Remove an event handler for the given type.
     *
     * @remarks
     * If `handler` is omitted, all handlers of the given type are removed.
     *
     * @memberOf createEmitter
     */
    off<Key extends keyof Events>(
      /** Type of event to unregister `handler` from (`'*'` to remove a wildcard handler) */
      type: Key,
      /** Handler function to remove */
      handler?: GenericEventHandler,
    ): void {
      const handlers: GenericEventHandler[] | undefined = events.get(type)

      if (handlers) {
        if (handler) {
          handlers.splice(handlers.indexOf(handler) >>> 0, 1)
        }
        else {
          events.set(type, [])
        }
      }
    },

    /**
     * Invoke all handlers for the given type.
     *
     * @remarks
     * If present, `'*'` handlers are invoked after type-matched handlers.
     * Manually firing '*' handlers is not supported.
     *
     * @memberOf createEmitter
     */
    emit<Key extends keyof Events>(
      /** The event type to invoke */
      type: Key,
      /** Any value (object is recommended and powerful), passed to each handler */
      evt?: Events[Key],
    ): void {
      let handlers = events.get(type)
      if (handlers) {
        for (const handler of [...(handlers as EventHandlerList<Events[keyof Events]>)])
          handler(evt!)
      }

      handlers = events.get('*')
      if (handlers) {
        for (const handler of [...(handlers as WildCardEventHandlerList<Events>)])
          handler(type, evt!)
      }
    },
  }
}
