// #region Interop

/**
 * Unwraps a module's `default` export, or returns the module unchanged if it has none.
 *
 * @example
 * const mod = await interopDefault(import('./module.js'))
 */
export async function interopDefault<T>(m: T | Promise<T>): Promise<T extends { default: infer U } ? U : T> {
  const resolved = await m

  if (
    resolved != null
    && (typeof resolved === 'object' || typeof resolved === 'function')
    && 'default' in resolved
  ) {
    return (resolved as any).default
  }

  return resolved as any
}

// #endregion
