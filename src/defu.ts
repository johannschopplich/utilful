// Forked from unjs/defu (MIT)

// #region Types

type PlainObject = Record<PropertyKey, any>

export type DefuMerger<T extends PlainObject = PlainObject> = (
  target: T,
  key: PropertyKey,
  value: any,
  namespace: string,
) => boolean | void

/**
 * Deeply merged result type of a source object over a list of defaults.
 */
export type Defu<Source, Defaults extends any[]> = Defaults extends [infer First, ...infer Rest]
  ? Defu<MergedObject<Source, First>, Rest>
  : Source

type MergedObject<Source, Defaults> = Source extends PlainObject
  ? Defaults extends PlainObject
    ? {
        [Key in keyof Source | keyof Defaults]: MergedValue<
          Key extends keyof Source ? Source[Key] : undefined,
          Key extends keyof Defaults ? Defaults[Key] : undefined
        >
      }
    : Source
  : Source

type MergedValue<SourceValue, DefaultValue> = SourceValue extends null | undefined
  ? DefaultValue
  : SourceValue extends any[]
    ? DefaultValue extends any[]
      ? Array<SourceValue[number] | DefaultValue[number]>
      : SourceValue
    // Built-ins the runtime treats as opaque – `isPlainObject` rejects them,
    // so the source value wins as-is
    : SourceValue extends ((...args: any[]) => any) | Date | RegExp | Error | Promise<any> | Map<any, any> | Set<any>
      ? SourceValue
      : SourceValue extends PlainObject
        ? MergedObject<SourceValue, DefaultValue>
        : SourceValue

/**
 * Defu function type that accepts a source and multiple defaults
 */
export type DefuFn = <Source extends PlainObject, Defaults extends PlainObject[]>(
  source: Source,
  ...defaults: Defaults
) => Defu<Source, Defaults>

// #endregion

// #region Create defu

/**
 * Create a defu function with optional custom merger
 */
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
    // Skip prototype pollution
    if (key === '__proto__' || key === 'constructor') {
      continue
    }

    // Skip null/undefined values – let defaults take precedence
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
