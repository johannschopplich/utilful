// #region Interop

/**
 * Interop helper for default exports.
 *
 * @example
 * const mod = await interopDefault(import('./module.js'))
 */
export async function interopDefault<T>(m: T | Promise<T>): Promise<T extends { default: infer U } ? U : T> {
  const resolved = await m
  return (resolved as any).default || resolved
}

// #endregion
