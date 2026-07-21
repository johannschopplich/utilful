// #region Memoize

/**
 * A simple general purpose memoizer utility.
 * - Lazily computes a value when accessed
 * - Auto-caches the result by overwriting the getter
 *
 * @remarks
 * Useful for deferring initialization or expensive operations. Unlike a simple getter, there is no runtime overhead after the first invocation, since the getter itself is overwritten with the memoized value.
 *
 * @example
 * const myValue = memoize(() => 'Hello, World!')
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

// #endregion

// #region Object utilities

/**
 * Strictly typed `Object.keys`.
 */
export function objectKeys<T extends Record<any, any>>(obj: T): Array<`${Extract<keyof T, string | number>}`> {
  return Object.keys(obj) as Array<`${Extract<keyof T, string | number>}`>
}

/**
 * Strictly typed `Object.entries`.
 */
export function objectEntries<T extends Record<any, any>>(obj: T): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>
}

// #endregion

// #region Deep apply

/**
 * Deeply applies a callback to every key-value pair in the given object, as well as nested objects and arrays (including arrays nested inside arrays).
 */
export function deepApply<T extends Record<any, any>>(
  data: T,
  callback: (item: T, key: keyof T, value: T[keyof T]) => void,
): void {
  for (const [key, value] of Object.entries(data)) {
    callback(data, key, value)
    applyToNestedValue(value, callback)
  }
}

function applyToNestedValue(
  value: unknown,
  callback: (item: any, key: any, value: any) => void,
): void {
  if (Array.isArray(value)) {
    for (const element of value) {
      applyToNestedValue(element, callback)
    }
  }
  else if (isObject(value)) {
    deepApply(value, callback)
  }
}

/**
 * Checks if a value is an object with the plain `[object Object]` tag.
 *
 * @remarks
 * Returns `true` for object literals, class instances, and `null`-prototype
 * objects – unlike stricter plain-object checks that reject class instances.
 */
export function isObject(value: unknown): value is Record<any, any> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

// #endregion
