// #region Memoize

/**
 * Wraps a getter so its value is computed on first access and cached from then on.
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
 * Wraps `Object.keys` with a stricter return type.
 */
export function objectKeys<T extends Record<any, any>>(obj: T): Array<`${Extract<keyof T, string | number>}`> {
  return Object.keys(obj) as Array<`${Extract<keyof T, string | number>}`>
}

/**
 * Wraps `Object.entries` with a stricter return type.
 */
export function objectEntries<T extends Record<any, any>>(obj: T): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>
}

// #endregion

// #region Deep apply

/**
 * Applies a callback to every key-value pair of the given object, and to every pair
 * inside nested objects and arrays (including arrays nested inside arrays).
 *
 * @remarks
 * The callback also fires for nested objects, so `item` is whichever object the pair
 * belongs to rather than the one that was passed in.
 */
export function deepApply<T extends Record<any, any>>(
  data: T,
  callback: (item: Record<string, any>, key: string, value: any) => void,
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
