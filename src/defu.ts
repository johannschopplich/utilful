// Forked from unjs/defu (MIT)

// #region Types

type PlainObject = Record<PropertyKey, any>

export type DefuMerger<T extends PlainObject = PlainObject> = (
  target: T,
  key: PropertyKey,
  value: any,
  namespace: string,
) => boolean | void

type Nullish = null | undefined | void

/**
 * Values that `isPlainObject` rejects at runtime, so the merged type keeps them
 * intact rather than recursing into them. `PlainObject` cannot draw this line
 * itself: its `any` value type makes every object type satisfy it, classes and
 * built-ins included.
 */
type NonPlainObject
  = | ((...args: any[]) => any)
    | { [Symbol.iterator]: any }
    | Date
    | RegExp
    | Promise<any>
    | Error
    | WeakMap<object, any>
    | WeakSet<object>

/**
 * Deeply merged result type of a source object over a list of defaults.
 */
export type Defu<Source, Defaults extends any[]> = Defaults extends [infer First, ...infer Rest]
  ? Defu<MergedObject<Source, First>, Rest>
  : Source

/**
 * Source merged over one defaults object, rebuilding only the shared keys.
 * Everything else passes through `Omit`, which is what keeps optionality,
 * `readonly` and the nominal identity of classes intact.
 */
type MergedObject<Source, Defaults> = Source extends PlainObject
  ? Defaults extends PlainObject
    ? Source extends Defaults
      ? Source
      : Omit<Source, keyof Source & keyof Defaults>
        & Omit<Defaults, keyof Source & keyof Defaults>
        & { -readonly [Key in keyof Source & keyof Defaults]: MergedValue<Source[Key], Defaults[Key]> }
    : Source
  : Source

type MergedValue<SourceValue, DefaultValue> = SourceValue extends Nullish
  ? DefaultValue
  : DefaultValue extends Nullish
    ? SourceValue
    : SourceValue extends readonly any[]
      ? DefaultValue extends readonly any[]
        ? Array<SourceValue[number] | DefaultValue[number]>
        : SourceValue
      : SourceValue extends NonPlainObject
        ? SourceValue
        : DefaultValue extends NonPlainObject
          ? SourceValue
          : MergedObject<SourceValue, DefaultValue>

export type DefuFn = <Source extends PlainObject, Defaults extends PlainObject[]>(
  source: Source,
  ...defaults: Defaults
) => Defu<Source, Defaults>

// #endregion

// #region Create defu

export function createDefu(
  merger?: DefuMerger,
): DefuFn {
  return ((source: PlainObject, ...defaults: PlainObject[]) => {
    return defaults.reduce(
      (mergedResult, currentDefaults) => _defu(mergedResult, currentDefaults ?? {}, '', merger),
      source ?? {},
    )
  }) as DefuFn
}

export const defu: DefuFn = createDefu()

// #endregion

// #region Internal helpers

function _defu<T extends PlainObject>(
  source: T,
  defaults: PlainObject,
  namespace = '',
  merger?: DefuMerger,
): T {
  if (!isPlainObject(defaults)) {
    return source
  }

  const result = { ...defaults }

  for (const [key, value] of Object.entries(source)) {
    // Skip keys that would write through to the prototype.
    if (key === '__proto__' || key === 'constructor') {
      continue
    }

    // Let the defaults take precedence over a null or undefined source value.
    if (value == null) {
      continue
    }

    if (merger?.(result, key, value, namespace)) {
      continue
    }

    const currentNamespace = namespace ? `${namespace}.${key}` : key

    if (Array.isArray(value) && Array.isArray(result[key])) {
      result[key] = [...value, ...result[key]]
    }
    else if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = _defu(value, result[key], currentNamespace, merger)
    }
    else {
      result[key] = value
    }
  }

  return result as T
}

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)

  if (
    prototype !== null
    && prototype !== Object.prototype
    && Object.getPrototypeOf(prototype) !== null
  ) {
    return false
  }

  if (Symbol.iterator in value) {
    return false
  }

  return true
}

// #endregion
