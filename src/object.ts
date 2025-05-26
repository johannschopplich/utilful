/**
 * A simple general purpose memoizer utility.
 * - Lazily computes a value when accessed
 * - Auto-caches the result by overwriting the getter
 *
 * @remarks
 * Useful for deferring initialization or expensive operations. Unlike a simple getter, there is no runtime overhead after the first invokation, since the getter itself is overwritten with the memoized value.
 *
 * @example
 * const myValue = lazy(() => 'Hello, World!')
 * console.log(myValue.value) // Computes value, overwrites getter
 * console.log(myValue.value) // Returns cached value
 * console.log(myValue.value) // Returns cached value
 */
export function memoize<T>(getter: () => T): { value: T } {
  return {
    get value() {
      const value = getter()
      Object.defineProperty(this, 'value', { value })
      return value
    },
  }
}

/**
 * Strictly typed `Object.keys`.
 */
export function objectKeys<T extends Record<any, any>>(obj: T): Array<`${keyof T & (string | number | boolean | null | undefined)}`> {
  return Object.keys(obj) as Array<`${keyof T & (string | number | boolean | null | undefined)}`>
}

/**
 * Strictly typed `Object.entries`.
 */
export function objectEntries<T extends Record<any, any>>(obj: T): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>
}

/**
 * Deeply applies a callback to every key-value pair in the given object, as well as nested objects and arrays.
 */
export function deepApply<T extends Record<any, any>>(
  data: T,
  callback: (item: T, key: keyof T, value: T[keyof T]) => void,
): void {
  for (const [key, value] of Object.entries(data)) {
    callback(data, key, value)

    if (Array.isArray(value)) {
      for (const element of value) {
        if (isObject(element)) {
          deepApply(element, callback)
        }
      }
    }
    else if (isObject(value)) {
      deepApply(value, callback)
    }
  }
}

function isObject(value: unknown): value is Record<any, any> {
  return Object.prototype.toString.call(value) === '[object Object]'
}
