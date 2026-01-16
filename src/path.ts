// #region Types

export type QueryValue = string | number | boolean | QueryValue[] | Record<string, any> | null | undefined
export type QueryObject = Record<string, QueryValue | QueryValue[]>

// #endregion

// #region Slash manipulation

/**
 * Removes the leading slash from the given path if it has one.
 */
export function withoutLeadingSlash(path?: string): string {
  if (!path)
    return ''

  return path[0] === '/' ? path.slice(1) : path
}

/**
 * Adds a leading slash to the given path if it does not already have one.
 */
export function withLeadingSlash(path?: string): string {
  if (!path || path === '/')
    return '/'

  return path[0] === '/' ? path : `/${path}`
}

/**
 * Removes the trailing slash from the given path if it has one,
 * preserving query strings and hash fragments.
 */
export function withoutTrailingSlash(path?: string): string {
  if (!path || path === '/')
    return '/'

  // Find where the pathname ends (before ? or #)
  let pathEnd = path.length
  const queryIndex = path.indexOf('?')
  const hashIndex = path.indexOf('#')

  if (queryIndex !== -1)
    pathEnd = queryIndex
  if (hashIndex !== -1 && hashIndex < pathEnd)
    pathEnd = hashIndex

  // Check if there's a trailing slash before query/hash
  if (pathEnd > 0 && path[pathEnd - 1] === '/') {
    // Special case: don't remove the root slash
    if (pathEnd === 1)
      return path
    return path.slice(0, pathEnd - 1) + path.slice(pathEnd)
  }

  return path
}

/**
 * Adds a trailing slash to the given path if it does not already have one,
 * preserving query strings and hash fragments.
 */
export function withTrailingSlash(path?: string): string {
  if (!path || path === '/')
    return '/'

  // Find where the pathname ends (before ? or #)
  let pathEnd = path.length
  const queryIndex = path.indexOf('?')
  const hashIndex = path.indexOf('#')

  if (queryIndex !== -1)
    pathEnd = queryIndex
  if (hashIndex !== -1 && hashIndex < pathEnd)
    pathEnd = hashIndex

  // Check if there's already a trailing slash before query/hash
  if (pathEnd > 0 && path[pathEnd - 1] === '/') {
    return path
  }

  return `${path.slice(0, pathEnd)}/${path.slice(pathEnd)}`
}

// #endregion

// #region Path joining

/**
 * Joins the given URL path segments, ensuring that there is only one slash between them.
 */
export function joinURL(...paths: (string | undefined)[]): string {
  let result = ''

  for (const path of paths) {
    if (!path)
      continue

    if (!result) {
      result = path
      continue
    }

    if (path === '/')
      continue

    const resultHasTrailing = result[result.length - 1] === '/'
    const pathHasLeading = path[0] === '/'

    if (resultHasTrailing && pathHasLeading) {
      result += path.slice(1)
    }
    else if (!resultHasTrailing && !pathHasLeading) {
      result += `/${path}`
    }
    else {
      result += path
    }
  }

  return result
}

// #endregion

// #region Base path manipulation

/**
 * Adds the base path to the input path, if it is not already present.
 */
export function withBase(input = '', base = ''): string {
  if (!base || base === '/')
    return input

  const _base = withoutTrailingSlash(base)

  // Check if input starts with base followed by / or end of string
  if (input.startsWith(_base) && (input.length === _base.length || input[_base.length] === '/' || input[_base.length] === '?'))
    return input

  return joinURL(_base, input)
}

/**
 * Removes the base path from the input path, if it is present.
 */
export function withoutBase(input = '', base = ''): string {
  if (!base || base === '/')
    return input

  const _base = withoutTrailingSlash(base)

  // Check if input starts with base followed by / or end of string
  if (!input.startsWith(_base) || (input.length !== _base.length && input[_base.length] !== '/' && input[_base.length] !== '?'))
    return input

  const trimmed = input.slice(_base.length)
  return trimmed[0] === '/' ? trimmed : `/${trimmed}`
}

// #endregion

// #region Query string manipulation

/**
 * Returns the pathname of the given path, which is the path without the query string or hash.
 */
export function getPathname(path = '/'): string {
  if (!path.startsWith('/')) {
    return new URL(path, 'http://localhost').pathname
  }

  let pathEnd = path.length
  const queryIndex = path.indexOf('?')
  const hashIndex = path.indexOf('#')

  if (queryIndex !== -1)
    pathEnd = queryIndex
  if (hashIndex !== -1 && hashIndex < pathEnd)
    pathEnd = hashIndex

  return path.slice(0, pathEnd) || '/'
}

/**
 * Returns the URL with the given query parameters. If a query parameter is undefined, it is omitted.
 */
export function withQuery(input: string, query?: QueryObject): string {
  if (!query || Object.keys(query).length === 0)
    return input

  const searchIndex = input.indexOf('?')
  const hasExistingParams = searchIndex !== -1

  // Extract base URL and initialize search params
  const base = hasExistingParams ? input.slice(0, searchIndex) : input
  const searchParams = new URLSearchParams(
    hasExistingParams ? input.slice(searchIndex + 1) : undefined,
  )

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      searchParams.delete(key)
      continue
    }

    if (Array.isArray(value)) {
      if (value.length === 0)
        continue

      for (const item of value) {
        if (item !== undefined) {
          searchParams.append(key, normalizeQueryValue(item))
        }
      }
    }
    else {
      searchParams.set(key, normalizeQueryValue(value))
    }
  }

  const queryString = searchParams.toString()
  return queryString ? `${base}?${queryString}` : base
}

function normalizeQueryValue(value: QueryValue): string {
  if (value === null)
    return ''

  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)

  if (typeof value === 'object')
    return JSON.stringify(value)

  return String(value)
}

// #endregion
