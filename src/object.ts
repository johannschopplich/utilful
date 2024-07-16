import { isObject } from './is'

/**
 * Strictly typed `Object.keys`.
 */
export function objectKeys<T extends Record<any, any>>(obj: T) {
  return Object.keys(obj) as Array<`${keyof T & (string | number | boolean | null | undefined)}`>
}

/**
 * Strictly typed `Object.entries`.
 */
export function objectEntries<T extends Record<any, any>>(obj: T) {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>
}

/**
 * Deeply applies a callback to every key-value pair in the given object, as well as nested objects and arrays.
 */
export function deepApply<T extends Record<any, any>>(
  data: T,
  callback: (item: T, key: keyof T, value: T[keyof T]) => void,
) {
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
