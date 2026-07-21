# utilful

A collection of TypeScript utilities that I use across my projects.

## Table of Contents

- [Installation](#installation)
- [API](#api)
  - [Array](#array)
  - [CSV](#csv)
  - [Defu](#defu)
  - [Emitter](#emitter)
  - [JSON](#json)
  - [Module](#module)
  - [Object](#object)
  - [Path](#path)
  - [Result](#result)
  - [String](#string)

## Installation

```bash
# npm
npm install -D utilful

# pnpm
pnpm add -D utilful

# yarn
yarn add -D utilful
```

## API

### Array

#### `toArray`

Converts `MaybeArray<T>` to `Array<T>`.

```ts
type MaybeArray<T> = T | T[]

declare function toArray<T>(array?: MaybeArray<T> | null | undefined): T[]
```

### CSV

#### `createCSV`

Converts an array of objects to a comma-separated values (CSV) string. You can either specify which columns to include explicitly, or let the function automatically infer all columns from your data.

```ts
// With explicit columns
declare function createCSV<T extends Record<string, unknown>>(
  data: readonly T[],
  columns: readonly (keyof T)[],
  options?: CSVCreateOptions
): string

// With automatic column inference
declare function createCSV<T extends Record<string, unknown>>(
  data: readonly T[],
  options?: CSVCreateOptions
): string
```

**Example with explicit columns:**

```ts
const data = [
  { name: 'John', age: '30', city: 'New York' },
  { name: 'Jane', age: '25', city: 'Boston' }
]

// Only include 'name' and 'age' columns
const csv = createCSV(data, ['name', 'age'])
// name,age
// John,30
// Jane,25
```

**Example with automatic column inference:**

When you omit the `columns` parameter, `createCSV` automatically collects all unique keys from your data in first-seen order. This is particularly useful when working with data that has varying structures:

```ts
const rows = [
  { name: 'John', age: '30' },
  { name: 'Jane', city: 'Boston' },
  { name: 'Bob', age: '40', city: 'Chicago' }
]

// All columns are automatically detected: name, age, city
const csv = createCSV(rows)
// name,age,city
// John,30,
// Jane,,Boston
// Bob,40,Chicago
```

#### `parseCSV`

Parses a comma-separated values (CSV) string into an array of objects.

> [!NOTE]
> The first row of the CSV string is used as the header row. A leading UTF-8 byte order mark is stripped.

```ts
type CSVRow<T extends string = string> = Record<T, string>

interface CSVParseOptions {
  /** @default ',' */
  delimiter?: string
  /**
   * Trim whitespace from unquoted headers and values.
   * @default false
   */
  trim?: boolean
  /**
   * Throw if a row's field count does not match the header row.
   * @default true
   */
  strict?: boolean
}

declare function parseCSV<Header extends string>(
  csv?: string | null | undefined,
  options?: CSVParseOptions
): CSVRow<Header>[]
```

The parser accepts a few lenient deviations from RFC 4180: LF, CR, and CRLF line endings are all recognized, whitespace between a closing quote and the next delimiter or line break is ignored, and quotes inside unquoted fields are kept as literal characters (a field only counts as quoted if it starts with a quote).

**Example:**

```ts
const csv = `
name,age
John,30
Jane,25
`.trim()

const data = parseCSV<'name' | 'age'>(csv) // [{ name: 'John', age: '30' }, { name: 'Jane', age: '25' }]
```

#### `createCSVStream`

Creates a CSV stream from an iterable or async iterable of objects. Yields complete lines (header and/or data rows) including line endings – useful for large datasets that should not be buffered in memory.

```ts
declare function createCSVStream<T extends Record<string, unknown>>(
  data: AsyncIterable<T> | Iterable<T>,
  columns: readonly (keyof T)[],
  options?: CSVCreateOptions
): AsyncIterable<string>
```

**Example:**

```ts
for await (const chunk of createCSVStream(rows, ['name', 'age'])) {
  process.stdout.write(chunk)
}
```

#### `createCSVAsync`

Convenience wrapper around `createCSVStream` that collects all chunks into a single string.

> [!NOTE]
> Unlike `createCSV`, the result has a trailing line ending.

```ts
declare function createCSVAsync<T extends Record<string, unknown>>(
  data: AsyncIterable<T> | Iterable<T>,
  columns: readonly (keyof T)[],
  options?: CSVCreateOptions
): Promise<string>
```

#### `parseCSVStream`

Parses CSV data from an iterable or async iterable of string chunks, yielding rows as soon as they are complete. Chunks do not need to align with row boundaries – quotes and newlines are handled correctly across chunk boundaries.

```ts
declare function parseCSVStream<Header extends string>(
  chunks: AsyncIterable<string> | Iterable<string>,
  options?: CSVParseOptions
): AsyncIterable<CSVRow<Header>>
```

**Example:**

```ts
const chunks = ['name,age\nJo', 'hn,30\nJane,25']

for await (const row of parseCSVStream<'name' | 'age'>(chunks)) {
  console.log(row) // { name: 'John', age: '30' }, then { name: 'Jane', age: '25' }
}
```

> [!TIP]
> `parseCSVStream` accepts any iterable of strings, including an array of lines.

#### `escapeCSVValue`

Escapes a single value for a CSV string. Returns an empty string for `null` and `undefined`. Values containing delimiters, quotes, or line breaks are quoted; embedded quotes are doubled.

```ts
declare function escapeCSVValue(
  value: unknown,
  options?: {
    /** @default ',' */
    delimiter?: string
    /** @default false */
    quoteAll?: boolean
  }
): string
```

**Example:**

```ts
escapeCSVValue('hello, world') // '"hello, world"'
escapeCSVValue('contains "quotes"') // '"contains ""quotes"""'
```

### Defu

Recursively assign default properties. Simplified version based on [unjs/defu](https://github.com/unjs/defu).

#### `defu`

Recursively assigns missing properties from defaults to the source object. The source object takes precedence over defaults.

The function replaces `null` and `undefined` values in the source with defaults, concatenates arrays (source + defaults), and recursively merges nested objects.

```ts
type PlainObject = Record<PropertyKey, any>

declare function defu<Source extends PlainObject, Defaults extends PlainObject[]>(
  source: Source,
  ...defaults: Defaults
): Defu<Source, Defaults>
```

The return type is a deep merge of the source over the defaults, so keys that only exist in the defaults are part of the result type:

```ts
const result = defu({ a: 1 }, { b: 2 })
result.b // number – no cast needed
```

**Example:**

```ts
import { defu } from 'utilful'

const result = defu(
  { a: 1, b: { x: 1 } },
  { a: 2, b: { y: 2 }, c: 3 }
)
// Result: { a: 1, b: { x: 1, y: 2 }, c: 3 }
```

**Array concatenation example:**

```ts
const result = defu(
  { items: ['a', 'b'] },
  { items: ['c', 'd'] }
)
// Result: { items: ['a', 'b', 'c', 'd'] }
```

**Handling null/undefined:**

```ts
const result = defu(
  { name: null, age: undefined },
  { name: 'John', age: 30, city: 'NYC' }
)
// Result: { name: 'John', age: 30, city: 'NYC' }
```

#### `createDefu`

Creates a custom defu function with a custom merger.

```ts
type DefuMerger<T extends PlainObject = PlainObject> = (
  target: T,
  key: PropertyKey,
  value: any,
  namespace: string,
) => boolean | void

declare function createDefu(merger?: DefuMerger): DefuFn
```

**Example:**

```ts
import { createDefu } from 'utilful'

// Custom merger that adds numbers instead of replacing them
const addNumbers = createDefu((obj, key, val) => {
  if (typeof val === 'number' && typeof obj[key] === 'number') {
    obj[key] += val
    return true // Indicates the merger handled this property
  }
})

const result = addNumbers({ cost: 15 }, { cost: 10 })
// Result: { cost: 25 }
```

### Emitter

Tiny functional event emitter / pubsub, based on [mitt](https://github.com/developit/mitt).

**Example:**

```ts
import { createEmitter } from 'utilful'

// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
  foo: { a: string }
}

const emitter = createEmitter<Events>()

// Listen to an event
emitter.on('foo', e => console.log('foo', e))

// Listen to all events
emitter.on('*', (type, e) => console.log(type, e))

// Fire an event
emitter.emit('foo', { a: 'b' })

// Clearing all events
emitter.events.clear()

// Working with handler references:
function onFoo() {}
emitter.on('foo', onFoo) // Listen
emitter.off('foo', onFoo) // Unlisten
```

### JSON

#### `tryParseJSON`

Type-safe wrapper around `JSON.parse`.

Falls back to the original value if parsing fails or the value is not a string.

```ts
declare function tryParseJSON<T = unknown>(value: unknown): T
```

### Module

#### `interopDefault`

Interop helper for default exports.

```ts
declare function interopDefault<T>(m: T | Promise<T>): Promise<T extends {
  default: infer U
} ? U : T>
```

**Example:**

```ts
import { interopDefault } from 'utilful'

async function loadModule() {
  const mod = await interopDefault(import('./module.js'))
}
```

### Object

#### `memoize`

A simple general purpose memoizer utility.

- Lazily computes a value when accessed
- Auto-caches the result by overwriting the getter

Useful for deferring initialization or expensive operations. Unlike a simple getter, there is no runtime overhead after the first invocation, since the getter itself is overwritten with the memoized value.

```ts
declare function memoize<T>(getter: () => T): { value: T }
```

**Example:**

```ts
const myValue = memoize(() => 'Hello, World!')
console.log(myValue.value) // Computes value, overwrites getter
console.log(myValue.value) // Returns cached value
console.log(myValue.value) // Returns cached value
```

#### `objectKeys`

Strictly typed `Object.keys`.

```ts
declare function objectKeys<T extends Record<any, any>>(obj: T): Array<`${Extract<keyof T, string | number>}`>
```

#### `objectEntries`

Strictly typed `Object.entries`.

```ts
declare function objectEntries<T extends Record<any, any>>(obj: T): Array<[keyof T, T[keyof T]]>
```

#### `deepApply`

Deeply applies a callback to every key-value pair in the given object, as well as nested objects and arrays (including arrays nested inside arrays).

```ts
declare function deepApply<T extends Record<any, any>>(data: T, callback: (item: T, key: keyof T, value: T[keyof T]) => void): void
```

#### `isObject`

Checks if a value is an object with the plain `[object Object]` tag. Returns `true` for object literals, class instances, and `null`-prototype objects.

```ts
declare function isObject(value: unknown): value is Record<any, any>
```

### Path

Utilities to build and normalize URL paths. All of them are also available from the `utilful/path` subpath export.

#### `withoutLeadingSlash` / `withLeadingSlash`

Removes or adds a leading slash.

```ts
declare function withoutLeadingSlash(path?: string): string
declare function withLeadingSlash(path?: string): string
```

#### `withoutTrailingSlash` / `withTrailingSlash`

Removes or adds a trailing slash, preserving query strings and hash fragments.

```ts
declare function withoutTrailingSlash(path?: string): string
declare function withTrailingSlash(path?: string): string
```

#### `joinURL`

Joins the given URL path segments, ensuring that there is only one slash between them.

```ts
declare function joinURL(...paths: (string | undefined)[]): string
```

**Example:**

```ts
joinURL('/api/', '/users', '42') // '/api/users/42'
```

#### `withBase` / `withoutBase`

Adds or removes a base path – each is a no-op if the base is already present (or absent).

```ts
declare function withBase(input?: string, base?: string): string
declare function withoutBase(input?: string, base?: string): string
```

**Example:**

```ts
withBase('/users', '/api') // '/api/users'
withoutBase('/api/users', '/api') // '/users'
```

#### `getPathname`

Returns the pathname of the given path – everything before the query string or hash. Absolute URLs (with a scheme, e.g. `https://example.com/foo`) return the URL's pathname; all other inputs are returned unchanged with the query string and hash removed.

```ts
declare function getPathname(path?: string): string
```

#### `withQuery`

Returns the URL with the given query parameters merged in. `undefined` values remove the parameter, array values append one entry per item, and object values are JSON-stringified.

```ts
type QueryValue = string | number | boolean | QueryValue[] | Record<string, any> | null | undefined
type QueryObject = Record<string, QueryValue | QueryValue[]>

declare function withQuery(input: string, query?: QueryObject): string
```

**Example:**

```ts
withQuery('/api/users', { page: 2, tags: ['a', 'b'] }) // '/api/users?page=2&tags=a&tags=b'
```

### Result

The `Result` type represents either success (`Ok`) or failure (`Err`). It provides a type-safe way to handle errors without relying on exceptions.

```ts
type Result<T, E> = Ok<T, E> | Err<T, E>
```

Both `Ok` and `Err` carry phantom types for proper type inference in unions.

**Basic example:**

```ts
import { err, ok } from 'utilful'

function divide(a: number, b: number) {
  if (b === 0) {
    return err('Division by zero')
  }
  return ok(a / b)
}

const result = divide(10, 2)
if (result.ok)
  console.log('Result:', result.value)
else
  console.error('Error:', result.error)
```

**Fluent chaining:**

```ts
import { toResult } from 'utilful'

const name = toResult(() => JSON.parse(jsonString))
  .map(data => data.user)
  .map(user => user.name)
  .unwrapOr('Anonymous')
```

#### `ok`

Creates a successful result.

```ts
declare function ok<T, E = never>(value: T): Ok<T, E>
```

#### `err`

Creates an error result.

```ts
declare function err<T = never, E extends string = string>(error: E): Err<T, E>
declare function err<T = never, E = unknown>(error: E): Err<T, E>
```

#### `isOk` / `isErr`

Type guards for narrowing `Result` types.

```ts
declare function isOk<T, E>(result: Result<T, E>): result is Ok<T, E>
declare function isErr<T, E>(result: Result<T, E>): result is Err<T, E>
```

**Example:**

```ts
const result = toResult(() => JSON.parse(str))
if (isOk(result)) {
  console.log(result.value) // TypeScript knows this is Ok
}
```

#### `Result.map`

Transforms the success value. No-op on `Err`.

```ts
ok(2).map(x => x * 3) // Ok(6)
err('fail').map(x => x * 3) // Err('fail')
```

#### `Result.mapError`

Transforms the error value. No-op on `Ok`.

```ts
err('fail').mapError(e => e.toUpperCase()) // Err('FAIL')
ok(42).mapError(e => e.toUpperCase()) // Ok(42)
```

#### `Result.andThen`

Chains a function that returns a `Result`. Useful for composing fallible operations.

```ts
ok(2).andThen(x => x > 0 ? ok(x) : err('negative')) // Ok(2)
err('fail').andThen(x => ok(x * 2)) // Err('fail') - short-circuits
```

#### `Result.unwrap`

Extracts the value or throws an error.

```ts
ok(42).unwrap() // 42
err('fail').unwrap() // throws Error
err('fail').unwrap('custom message') // throws Error('custom message')
```

#### `Result.unwrapOr`

Extracts the value or returns a fallback.

```ts
ok(42).unwrapOr(0) // 42
err('fail').unwrapOr(0) // 0
```

#### `Result.match`

Pattern matches on the result.

```ts
result.match({
  ok: value => `Success: ${value}`,
  err: error => `Error: ${error}`,
})
```

#### `toResult`

Wraps a function or promise that might throw and returns a `Result`.

```ts
declare function toResult<T, E = unknown>(fn: () => T): Result<T, E>
declare function toResult<T, E = unknown>(promise: Promise<T>): Promise<Result<T, E>>
```

> [!NOTE]
> The function overload must be synchronous. For asynchronous work, pass the promise itself – a function returning a promise throws a `TypeError`, since its rejection could not be captured as `Err`.

**Example:**

```ts
// Synchronous
const result = toResult(() => JSON.parse('{"foo":"bar"}'))

// Asynchronous
const result = await toResult(fetch('https://api.example.com'))
```

#### `unwrapResult`

Converts a `Result` to a plain object with `value` and `error` properties.

```ts
declare function unwrapResult<T, E>(result: Ok<T, E>): { value: T, error: undefined }
declare function unwrapResult<T, E>(result: Err<T, E>): { value: undefined, error: E }
declare function unwrapResult<T, E>(result: Result<T, E>): { value: T, error: undefined } | { value: undefined, error: E }
```

#### `tryCatch`

Combines `toResult` and `unwrapResult` into one step. Executes a function and returns `{ value, error }` directly.

```ts
declare function tryCatch<T, E = unknown>(fn: () => T): { value: T, error: undefined } | { value: undefined, error: E }
declare function tryCatch<T, E = unknown>(promise: Promise<T>): Promise<{ value: T, error: undefined } | { value: undefined, error: E }>
```

**Example:**

```ts
// Synchronous
const { value, error } = tryCatch(() => JSON.parse('{"foo":"bar"}'))

// Asynchronous
const { value, error } = await tryCatch(fetch('https://api.example.com').then(r => r.json()))
```

### String

#### `template`

Simple template engine to replace variables in a string.

```ts
declare function template(
  str: string,
  variables: Record<string | number, any>,
  fallback?: string | ((key: string) => string)
): string
```

**Example:**

```ts
import { template } from 'utilful'

const str = 'Hello, {name}!'
const variables = { name: 'world' }

console.log(template(str, variables)) // Hello, world!
```

#### `generateRandomId`

Generates a random string. The function is ported from [`nanoid`](https://github.com/ai/nanoid). You can specify the size of the string and the dictionary of characters to use.

```ts
declare function generateRandomId(size?: number, dict?: string): string
```

## License

[MIT](./LICENSE) License © 2024-PRESENT [Johann Schopplich](https://github.com/johannschopplich)
