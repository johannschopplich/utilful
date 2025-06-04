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

Run the following command to add `utilful` to your project.

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

Converts an array of objects to a comma-separated values (CSV) string that contains only the `columns` specified.

```ts
declare function createCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: (keyof T)[],
  options?: {
    /** @default ',' */
    delimiter?: string
    /** @default true */
    includeHeaders?: boolean
    /** @default false */
    quoteAll?: boolean
  }
): string
```

**Example:**

```ts
const data = [
  { name: 'John', age: '30', city: 'New York' },
  { name: 'Jane', age: '25', city: 'Boston' }
]

const csv = createCSV(data, ['name', 'age'])
// name,age
// John,30
// Jane,25
```

#### `parseCSV`

Parses a comma-separated values (CSV) string into an array of objects.

> [!NOTE]
> The first row of the CSV string is used as the header row.

```ts
type CSVRow<T extends string = string> = Record<T, string>

declare function parseCSV<Header extends string>(
  csv?: string | null | undefined,
  options?: {
  /** @default ',' */
    delimiter?: string
    /** @default true */
    trimValues?: boolean
  }
): CSVRow<Header>[]
```

**Example:**

```ts
const csv = `name,age
John,30
Jane,25`

const data = parseCSV<'name' | 'age'>(csv) // [{ name: 'John', age: '30' }, { name: 'Jane', age: '25' }]
```

### Defu

Recursively assign default properties. Simplified version based on [unjs/defu](https://github.com/unjs/defu).

#### `defu`

Recursively assigns missing properties from defaults to the source object. The source object takes precedence over defaults.

**Key Features:**

- **Null/undefined handling**: `null` and `undefined` values in source are replaced with defaults
- **Array concatenation**: Arrays are concatenated (source + defaults)
- **Deep merging**: Nested objects are recursively merged
- **Type safety**: Preserves TypeScript types
- **Prototype pollution protection**: Ignores `__proto__` and `constructor` keys

```ts
type PlainObject = Record<PropertyKey, any>

declare function defu<T extends PlainObject>(
  source: T,
  ...defaults: PlainObject[]
): T
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

**Null/undefined handling:**

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

Type-safe wrapper around `JSON.stringify`.

Falls back to the original value if the JSON serialization fails or the value is not a string.

```ts
declare function tryParseJSON<T = unknown>(value: unknown): T
```

#### `cloneJSON`

Clones the given JSON value.

> [!NOTE]
> The value must not contain circular references as JSON does not support them. It also must contain JSON serializable values.

```ts
declare function cloneJSON<T>(value: T): T
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

Useful for deferring initialization or expensive operations. Unlike a simple getter, there is no runtime overhead after the first invokation, since the getter itself is overwritten with the memoized value.

```ts
declare function memoize<T>(getter: () => T): { value: T }
```

**Example:**

```ts
const myValue = lazy(() => 'Hello, World!')
console.log(myValue.value) // Computes value, overwrites getter
console.log(myValue.value) // Returns cached value
console.log(myValue.value) // Returns cached value
```

#### `objectKeys`

Strictly typed `Object.keys`.

```ts
declare function objectKeys<T extends Record<any, any>>(obj: T): Array<`${keyof T & (string | number | boolean | null | undefined)}`>
```

#### `objectEntries`

Strictly typed `Object.entries`.

```ts
declare function objectEntries<T extends Record<any, any>>(obj: T): Array<[keyof T, T[keyof T]]>
```

#### `deepApply`

Deeply applies a callback to every key-value pair in the given object, as well as nested objects and arrays.

```ts
declare function deepApply<T extends Record<any, any>>(data: T, callback: (item: T, key: keyof T, value: T[keyof T]) => void): void
```

### Path

#### `withoutLeadingSlash`

Removes the leading slash from the given path if it has one.

```ts
declare function withoutLeadingSlash(path?: string): string
```

#### `withLeadingSlash`

Adds a leading slash to the given path if it does not already have one.

```ts
declare function withLeadingSlash(path?: string): string
```

#### `withoutTrailingSlash`

Removes the trailing slash from the given path if it has one.

```ts
declare function withoutTrailingSlash(path?: string): string
```

#### `withTrailingSlash`

Adds a trailing slash to the given path if it does not already have one.

```ts
declare function withTrailingSlash(path?: string): string
```

#### `joinURL`

Joins the given URL path segments, ensuring that there is only one slash between them.

```ts
declare function joinURL(...paths: (string | undefined)[]): string
```

#### `withBase`

Adds the base path to the input path, if it is not already present.

```ts
declare function withBase(input?: string, base?: string): string
```

#### `withoutBase`

Removes the base path from the input path, if it is present.

```ts
declare function withoutBase(input?: string, base?: string): string
```

#### `getPathname`

Returns the pathname of the given path, which is the path without the query string.

```ts
declare function getPathname(path?: string): string
```

#### `withQuery`

Returns the URL with the given query parameters. If a query parameter is undefined, it is omitted.

```ts
declare function withQuery(input: string, query?: QueryObject): string
```

**Example:**

```ts
import { withQuery } from 'utilful'

const url = withQuery('https://example.com', {
  foo: 'bar',
  // This key is omitted
  baz: undefined,
  // Object values are stringified
  baz: { qux: 'quux' }
})
```

### Result

The `Result` type that represents either success (`Ok`) or failure (`Err`). It helps to handle errors in a more explicit and type-safe way, without relying on exceptions.

A common use case for `Result` is error handling in functions that might fail. Here's an example of a function that divides two numbers and returns a `Result`:

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

#### `Result`

The `Result` type represents either success (`Ok`) or failure (`Err`).

**Type Definition:**

```ts
type Result<T, E> = Ok<T> | Err<E>
```

#### `Ok`

The `Ok` type wraps a successful value.

**Example:**

```ts
const result = new Ok(42)
```

#### `Err`

The `Err` type wraps an error value.

**Example:**

```ts
const result = new Err('Something went wrong')
```

#### `ok`

Shorthand function to create an `Ok` result. Use it to wrap a successful value.

**Type Definition:**

```ts
declare function ok<T>(value: T): Ok<T>
```

#### `err`

Shorthand function to create an `Err` result. Use it to wrap an error value.

**Type Definition:**

```ts
declare function err<E extends string = string>(err: E): Err<E>
declare function err<E = unknown>(err: E): Err<E>
```

#### `toResult`

Wraps a function that might throw an error and returns a `Result` with the result of the function.

**Type Definition:**

```ts
declare function toResult<T, E = unknown>(fn: () => T): Result<T, E>
declare function toResult<T, E = unknown>(promise: Promise<T>): Promise<Result<T, E>>
```

#### `unwrapResult`

Unwraps a `Result`, `Ok`, or `Err` value and returns the value or error in an object. If the result is an `Ok`, the object contains the value and an `undefined` error. If the result is an `Err`, the object contains an `undefined` value and the error.

**Example:**

```ts
const result = toResult(() => JSON.parse('{"foo":"bar"}'))
const { value, error } = unwrapResult(result)
```

**Type Definition:**

```ts
declare function unwrapResult<T>(result: Ok<T>): { value: T, error: undefined }
declare function unwrapResult<E>(result: Err<E>): { value: undefined, error: E }
declare function unwrapResult<T, E>(result: Result<T, E>): { value: T, error: undefined } | { value: undefined, error: E }
```

#### `tryCatch`

A simpler alternative to `toResult` + `unwrapResult`. It executes a function that might throw an error and directly returns the result in a `ResultData` format. Works with both synchronous functions and promises.

**Example:**

```ts
import { tryCatch } from 'utilful'

// Synchronous usage
const { value, error } = tryCatch(() => JSON.parse('{"foo":"bar"}'))

// Asynchronous usage
const { value, error } = await tryCatch(fetch('https://api.example.com/data').then(r => r.json()))
```

**Type Definition:**

```ts
declare function tryCatch<T, E = unknown>(fn: () => T): { value: T, error: undefined } | { value: undefined, error: E }
declare function tryCatch<T, E = unknown>(promise: Promise<T>): Promise<{ value: T, error: undefined } | { value: undefined, error: E }>
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
