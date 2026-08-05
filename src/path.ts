// #region Types

export type QueryValue = string | number | boolean | QueryValue[] | Record<string, any> | null | undefined
export type QueryObject = Record<string, QueryValue | QueryValue[]>

/** Query parameters as read back from a URL, where a repeated key holds all its values. */
export type ParsedQuery = Record<string, string | string[]>

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

  // Find where the pathname ends (before ? or #).
  let pathEnd = path.length
  const queryIndex = path.indexOf('?')
  const hashIndex = path.indexOf('#')

  if (queryIndex !== -1)
    pathEnd = queryIndex
  if (hashIndex !== -1 && hashIndex < pathEnd)
    pathEnd = hashIndex

  if (pathEnd > 0 && path[pathEnd - 1] === '/') {
    // Special case: don't remove the root slash.
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

  // Find where the pathname ends (before ? or #).
  let pathEnd = path.length
  const queryIndex = path.indexOf('?')
  const hashIndex = path.indexOf('#')

  if (queryIndex !== -1)
    pathEnd = queryIndex
  if (hashIndex !== -1 && hashIndex < pathEnd)
    pathEnd = hashIndex

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

    const resultHasTrailing = result.at(-1) === '/'
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

  // Check whether `input` starts with `base` followed by `/`, `?`, `#`, or the end of the string.
  if (input.startsWith(_base) && (input.length === _base.length || input[_base.length] === '/' || input[_base.length] === '?' || input[_base.length] === '#'))
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

  // Check whether `input` starts with `base` followed by `/`, `?`, `#`, or the end of the string.
  if (!input.startsWith(_base) || (input.length !== _base.length && input[_base.length] !== '/' && input[_base.length] !== '?' && input[_base.length] !== '#'))
    return input

  const trimmed = input.slice(_base.length)
  return trimmed[0] === '/' ? trimmed : `/${trimmed}`
}

// #endregion

// #region Query string manipulation

const URL_SCHEME_RE = /^[a-z][\w+.-]*:\/\//i

/**
 * Returns the pathname of the given path, which is the path without the query string or hash.
 *
 * @remarks
 * Absolute URLs (with a scheme, e.g. `https://example.com/foo`) return the segment
 * after the authority. The result is sliced out verbatim, never normalized, so
 * percent-encoding and `..` segments survive as written.
 */
export function getPathname(path = '/'): string {
  let pathStart = 0

  if (URL_SCHEME_RE.test(path)) {
    // The authority runs from `://` to the first `/`, `?` or `#`. Anything but a
    // slash means the URL carries no path at all.
    const authorityStart = path.indexOf('://') + 3
    let authorityEnd = path.length

    for (let i = authorityStart; i < path.length; i++) {
      const character = path[i]
      if (character === '/' || character === '?' || character === '#') {
        authorityEnd = i
        break
      }
    }

    if (path[authorityEnd] !== '/')
      return '/'

    pathStart = authorityEnd
  }

  let pathEnd = path.length
  const queryIndex = path.indexOf('?', pathStart)
  const hashIndex = path.indexOf('#', pathStart)

  if (queryIndex !== -1)
    pathEnd = queryIndex
  if (hashIndex !== -1 && hashIndex < pathEnd)
    pathEnd = hashIndex

  return path.slice(pathStart, pathEnd) || '/'
}

/**
 * Returns the URL with the given query parameters. If a query parameter is `undefined`, it is omitted.
 */
export function withQuery(input: string, query?: QueryObject): string {
  if (!query || Object.keys(query).length === 0)
    return input

  // Split off the fragment first, so it cannot be swallowed by the query string.
  const { beforeHash, hash } = splitFragment(input)

  const searchIndex = beforeHash.indexOf('?')
  const hasExistingParams = searchIndex !== -1

  const base = hasExistingParams ? beforeHash.slice(0, searchIndex) : beforeHash
  const searchParams = new URLSearchParams(
    hasExistingParams ? beforeHash.slice(searchIndex + 1) : undefined,
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
  return queryString ? `${base}?${queryString}${hash}` : base + hash
}

/**
 * Reads the query parameters of the given URL, ignoring the fragment.
 *
 * @remarks
 * A parameter that appears more than once becomes an array of its values,
 * in the order they appear. Values are percent-decoded.
 */
export function getQuery(input: string): ParsedQuery {
  const { beforeHash } = splitFragment(input)

  const searchIndex = beforeHash.indexOf('?')
  if (searchIndex === -1)
    return {}

  // A null prototype keeps `__proto__` a normal key and stops inherited members
  // such as `constructor` from passing as an already-seen value.
  const query: ParsedQuery = Object.create(null)

  for (const [key, value] of new URLSearchParams(beforeHash.slice(searchIndex + 1))) {
    const existingValue = query[key]

    if (existingValue === undefined)
      query[key] = value
    else if (Array.isArray(existingValue))
      existingValue.push(value)
    else
      query[key] = [existingValue, value]
  }

  // Spreading defines own properties instead of assigning them, so `__proto__`
  // survives the trip back to an ordinary object.
  return { ...query }
}

function splitFragment(input: string): { beforeHash: string, hash: string } {
  const hashIndex = input.indexOf('#')

  return hashIndex === -1
    ? { beforeHash: input, hash: '' }
    : { beforeHash: input.slice(0, hashIndex), hash: input.slice(hashIndex) }
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
