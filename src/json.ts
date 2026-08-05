// #region Parse JSON

/**
 * Wraps `JSON.parse` with a typed return value.
 *
 * @remarks
 * Falls back to the original value if parsing fails or the value is not a string.
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
