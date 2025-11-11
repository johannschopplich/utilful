// #region Parse JSON

/**
 * Type-safe wrapper around `JSON.stringify`.
 *
 * @remarks
 * Falls back to the original value if the JSON serialization fails or the value is not a string.
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

// #endregion

// #region Clone JSON

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
    return value.map(element => (typeof element !== 'object' || element === null ? element : cloneJSON(element))) as T
  }

  const result: Record<string, unknown> = {}

  for (const key in value) {
    const propertyValue = value[key]
    result[key] = typeof propertyValue !== 'object' || propertyValue === null ? propertyValue : cloneJSON(propertyValue)
  }

  return result as T
}

// #endregion
