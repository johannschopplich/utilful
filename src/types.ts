export type AutocompletableString = string & {}

export type LooseAutocomplete<T extends string> = T | AutocompletableString

/** Also commonly referred to as `Prettify` */
export type UnifyIntersection<T> = {
  [K in keyof T]: T[K]
} & {}

declare const brand: unique symbol

export type BrandedType<T, B> = T & { [brand]: B }
