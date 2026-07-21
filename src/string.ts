// #region Constants

const URL_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

// #endregion

// #region Template

const TEMPLATE_PLACEHOLDER_RE = /\{(\w+)\}/g

/**
 * Simple template engine to replace variables in a string.
 *
 * @remarks
 * Only own properties of `variables` are substituted, so placeholders like
 * `{constructor}` cannot leak prototype members.
 *
 * @example
 * const str = 'Hello, {name}!'
 * const variables = { name: 'world' }
 *
 * console.log(template(str, variables)) // Hello, world!
 */
export function template(
  str: string,
  variables: Record<string | number, any>,
  fallback?: string | ((key: string) => string),
): string {
  return str.replace(TEMPLATE_PLACEHOLDER_RE, (_, key: string) => {
    const value = Object.hasOwn(variables, key) ? variables[key] : undefined
    return value != null ? String(value) : ((typeof fallback === 'function' ? fallback(key) : fallback) ?? key)
  })
}

// #endregion

// #region Random ID generation

/**
 * Generates a random string.
 *
 * @remarks Ported from `nanoid`.
 * @see https://github.com/ai/nanoid
 */
export function generateRandomId(size: number = 16, dict: string = URL_ALPHABET): string {
  let id = ''
  // A compact alternative for `for (var i = 0; i < step; i++)`.
  let i = size
  const len = dict.length
  while (i--)
    // `| 0` is more compact and faster than `Math.floor()`.
    id += dict[(Math.random() * len) | 0]
  return id
}

// #endregion
