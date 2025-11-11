// #region Types

/**
 * Represents a value that can be either a single value or an array of values.
 */
export type MaybeArray<T> = T | T[]

// #endregion

// #region Functions

/**
 * Converts `MaybeArray<T>` to `Array<T>`.
 */
export function toArray<T>(array?: MaybeArray<T> | null | undefined): T[] {
  array ??= []
  return Array.isArray(array) ? array : [array]
}

// #endregion
