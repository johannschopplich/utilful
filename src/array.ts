// #region Types

export type MaybeArray<T> = T | T[]

// #endregion

// #region Functions

export function toArray<T>(array?: MaybeArray<T> | null | undefined): T[] {
  array ??= []
  return Array.isArray(array) ? array : [array]
}

// #endregion
