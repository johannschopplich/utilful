/**
 * Type-safe wrapper around `JSON.stringify` falling back to the original value
 * if it is not a string or an error is thrown.
 */
export function tryParseJSON<T = unknown>(value: unknown): T {
  if (typeof value !== 'string') {
    return value as T
  }

  try {
    return JSON.parse(value)
  }
  catch {
    return value as T
  }
}

/**
 * Clones the given JSON value.
 *
 * @remarks
 * The value must not contain circular references as JSON does not support them. It also must contain JSON serializable values.
 */
export function cloneJSON<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(e => (typeof e !== 'object' || e === null ? e : cloneJSON(e))) as T
  }

  const result: Record<string, unknown> = {}

  for (const k in value) {
    const v = value[k]
    result[k] = typeof v !== 'object' || v === null ? v : cloneJSON(v)
  }

  return result as T
}
