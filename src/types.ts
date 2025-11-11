// #region String types

export type AutocompletableString = string & {}

export type LooseAutocomplete<T extends string> = T | AutocompletableString

// #endregion

// #region Utility types

/** Also commonly referred to as `Prettify` */
export type UnifyIntersection<T> = {
  [K in keyof T]: T[K]
} & {}

// #endregion

// #region Branded types

declare const brand: unique symbol

export type BrandedType<T, B> = T & { [brand]: B }

// #endregion
