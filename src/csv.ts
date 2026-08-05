// #region Constants

const COMMA = ','
const DOUBLE_QUOTE = '"'
const NEWLINE = '\n'
const CARRIAGE_RETURN = '\r'
const ESCAPED_QUOTE = '""'
const SPACE = ' '
const TAB = '\t'
const BYTE_ORDER_MARK = '\uFEFF'

// #endregion

// #region Types

export type CSVRow<T extends string = string> = Record<T, string>

export interface CSVCreateOptions {
  /** @default ',' */
  delimiter?: string
  /** @default true */
  addHeader?: boolean
  /** @default false */
  quoteAll?: boolean
  /** @default '\n' */
  lineEnding?: string
}

export interface CSVParseOptions {
  /** @default ',' */
  delimiter?: string
  /**
   * Whether to trim whitespace from unquoted headers and values.
   * @default false
   */
  trim?: boolean
  /**
   * Whether to throw if a row's field count does not match the header row.
   * @default true
   */
  strict?: boolean
}

// #endregion

// #region Create CSV

/**
 * Converts an array of objects to a comma-separated values (CSV) string.
 *
 * @remarks
 * When `columns` is omitted, the function automatically infers columns by collecting
 * the union of all keys across all objects in first-seen order. This means if different
 * objects have different keys, all keys will be included in the CSV. Objects missing
 * certain keys will have empty values for those columns.
 *
 * When `columns` is provided explicitly, only those columns are included in the output,
 * allowing you to control column order and filter out unwanted properties.
 *
 * @example
 * // With explicit columns
 * const data = [
 *   { name: 'John', age: '30', city: 'New York' },
 *   { name: 'Jane', age: '25', city: 'Boston' }
 * ]
 *
 * const csv = createCSV(data, ['name', 'age'])
 * // name,age
 * // John,30
 * // Jane,25
 *
 * @example
 * // With inferred columns (union of all keys in first-seen order)
 * const rows = [
 *   { name: 'John', age: '30' },
 *   { name: 'Jane', city: 'Boston' },
 * ]
 *
 * const csv = createCSV(rows)
 * // name,age,city
 * // John,30,
 * // Jane,,Boston
 */
export function createCSV<T extends Record<string, unknown>>(
  data: readonly T[],
  columns: readonly (keyof T)[],
  options?: CSVCreateOptions,
): string
export function createCSV<T extends Record<string, unknown>>(
  data: readonly T[],
  options?: CSVCreateOptions,
): string
export function createCSV<T extends Record<string, unknown>>(
  data: readonly T[],
  columnsOrOptions?: readonly (keyof T)[] | CSVCreateOptions,
  maybeOptions: CSVCreateOptions = {},
): string {
  let columns: readonly (keyof T)[]
  let options: CSVCreateOptions

  if (Array.isArray(columnsOrOptions)) {
    columns = columnsOrOptions
    options = maybeOptions
  }
  else {
    columns = inferColumns(data)
    options = (columnsOrOptions ?? {}) as CSVCreateOptions
  }

  const {
    delimiter = COMMA,
    addHeader = true,
    quoteAll = false,
    lineEnding = NEWLINE,
  } = options

  assertValidCSVDelimiter(delimiter)

  // Without columns there is nothing to write, not even a row separator.
  if (columns.length === 0) {
    return ''
  }

  if (addHeader) {
    const header = encodeCSVHeader(columns.map(String), delimiter, quoteAll)

    if (data.length === 0) {
      return header
    }

    const bodyLines = data.map(row => encodeCSVRow(row, columns, delimiter, quoteAll))
    return header + lineEnding + bodyLines.join(lineEnding)
  }

  const bodyLines = data.map(row => encodeCSVRow(row, columns, delimiter, quoteAll))
  return bodyLines.join(lineEnding)
}

// #endregion

// #region Stream CSV

/**
 * Creates a CSV stream from an iterable or async iterable of objects.
 *
 * @remarks
 * This function yields CSV content as strings, including line endings.
 * Each yielded chunk contains complete lines (header and/or data rows).
 *
 * @example
 * const data = [
 *   { name: 'John', age: '30' },
 *   { name: 'Jane', age: '25' }
 * ]
 *
 * for await (const chunk of createCSVStream(data, ['name', 'age'])) {
 *   console.log(chunk)
 * }
 */
export async function* createCSVStream<T extends Record<string, unknown>>(
  data: AsyncIterable<T> | Iterable<T>,
  columns: readonly (keyof T)[],
  options: CSVCreateOptions = {},
): AsyncIterable<string> {
  const {
    delimiter = COMMA,
    addHeader = true,
    quoteAll = false,
    lineEnding = NEWLINE,
  } = options

  assertValidCSVDelimiter(delimiter)

  if (addHeader) {
    const header = encodeCSVHeader(columns.map(String), delimiter, quoteAll)
    yield header + lineEnding
  }

  for await (const row of data) {
    const line = encodeCSVRow(row, columns, delimiter, quoteAll)
    yield line + lineEnding
  }
}

/**
 * Creates a CSV string from an async iterable or iterable of objects.
 *
 * @remarks
 * This is a convenience wrapper around `createCSVStream` that collects
 * all chunks into a single string. Note that the result will have a
 * trailing line ending, unlike the synchronous `createCSV`.
 *
 * @example
 * const data = [
 *   { name: 'John', age: '30' },
 *   { name: 'Jane', age: '25' }
 * ]
 *
 * const csv = await createCSVAsync(data, ['name', 'age'])
 */
export async function createCSVAsync<T extends Record<string, unknown>>(
  data: AsyncIterable<T> | Iterable<T>,
  columns: readonly (keyof T)[],
  options: CSVCreateOptions = {},
): Promise<string> {
  const chunks: string[] = []

  for await (const chunk of createCSVStream(data, columns, options))
    chunks.push(chunk)

  return chunks.join('')
}

// #endregion

// #region Helper functions

function assertValidCSVDelimiter(delimiter: string): void {
  if (delimiter.length !== 1) {
    throw new RangeError(`CSV delimiter must be a single character, got "${delimiter}"`)
  }

  if (delimiter === DOUBLE_QUOTE || delimiter === NEWLINE || delimiter === CARRIAGE_RETURN) {
    throw new RangeError(`CSV delimiter must not be a quote or line break character, got ${JSON.stringify(delimiter)}`)
  }
}

function encodeCSVHeader(
  columns: readonly string[],
  delimiter: string,
  quoteAll: boolean,
): string {
  return columns
    .map(col => escapeCSVValue(col, { delimiter, quoteAll }))
    .join(delimiter)
}

function encodeCSVRow<T extends Record<string, unknown>>(
  row: T,
  columns: readonly (keyof T)[],
  delimiter: string,
  quoteAll: boolean,
): string {
  return columns
    .map(key => escapeCSVValue(row[key], { delimiter, quoteAll }))
    .join(delimiter)
}

// #endregion

// #region Escape CSV value

/**
 * Escapes a value for a CSV string.
 *
 * @remarks
 * Returns an empty string if the value is `null` or `undefined`.
 * Values containing delimiters, quotes, or line breaks are quoted.
 * Within quoted values, double quotes are escaped by doubling them.
 *
 * @example
 * escapeCSVValue('hello, world') // '"hello, world"'
 * escapeCSVValue('contains "quotes"') // '"contains ""quotes"""'
 */
export function escapeCSVValue(
  value: unknown,
  options: {
    /** @default ',' */
    delimiter?: string
    /** @default false */
    quoteAll?: boolean
  } = {},
): string {
  const {
    delimiter = COMMA,
    quoteAll = false,
  } = options

  if (value == null) {
    return ''
  }

  const coercedValue = String(value)
  const hasQuote = coercedValue.includes(DOUBLE_QUOTE)
  const requiresQuoting = quoteAll
    || coercedValue.includes(delimiter)
    || hasQuote
    || coercedValue.includes(NEWLINE)
    || coercedValue.includes(CARRIAGE_RETURN)

  if (requiresQuoting) {
    const escaped = hasQuote
      ? coercedValue.replaceAll(DOUBLE_QUOTE, ESCAPED_QUOTE)
      : coercedValue
    return `${DOUBLE_QUOTE}${escaped}${DOUBLE_QUOTE}`
  }

  return coercedValue
}

// #endregion

// #region Parse CSV

class CSVParserCore<Header extends string> {
  private readonly delimiter: string
  private readonly trim: boolean
  private readonly strict: boolean
  private readonly onRow: (row: CSVRow<Header>) => void

  private currentRow: string[] = []
  private currentField = ''
  private inQuotes = false
  private isFieldQuoted = false
  private currentRowNumber = 1
  private headers?: Header[]

  private isAtInputStart = true
  private pendingChunkTail = ''

  constructor(
    options: CSVParseOptions,
    onRow: (row: CSVRow<Header>) => void,
  ) {
    const { delimiter = COMMA, trim = false, strict = true } = options

    assertValidCSVDelimiter(delimiter)

    this.delimiter = delimiter
    this.trim = trim
    this.strict = strict
    this.onRow = onRow
  }

  push(chunk: string): void {
    let pendingText = this.pendingChunkTail + chunk
    this.pendingChunkTail = ''

    if (this.isAtInputStart && pendingText.length > 0) {
      if (pendingText[0] === BYTE_ORDER_MARK) {
        pendingText = pendingText.slice(1)
      }
      this.isAtInputStart = false
    }

    let holdbackIndex = pendingText.length
    while (holdbackIndex > 0 && pendingText[holdbackIndex - 1] === DOUBLE_QUOTE)
      holdbackIndex--
    if (holdbackIndex === pendingText.length && holdbackIndex > 0 && pendingText[holdbackIndex - 1] === CARRIAGE_RETURN)
      holdbackIndex--

    this.pendingChunkTail = pendingText.slice(holdbackIndex)
    this.consume(pendingText.slice(0, holdbackIndex))
  }

  finish(): void {
    if (this.pendingChunkTail.length > 0) {
      const chunkTail = this.pendingChunkTail
      this.pendingChunkTail = ''
      this.consume(chunkTail)
    }

    // Check for an unterminated quoted field before flushing the leftover row.
    if (this.inQuotes) {
      throw new SyntaxError(
        `CSV contains unterminated quoted field at row ${this.currentRowNumber}`,
      )
    }

    if (this.currentField !== '' || this.currentRow.length > 0) {
      this.appendRow()
    }
  }

  private consume(text: string): void {
    for (let i = 0; i < text.length; i++) {
      const character = text[i]
      const nextCharacter = i + 1 < text.length ? text[i + 1] : ''

      // Skip whitespace after a closing quote until the delimiter or newline, unless the whitespace character is itself the delimiter.
      if (this.isFieldQuoted && !this.inQuotes && character !== this.delimiter && (character === SPACE || character === TAB)) {
        continue
      }

      if (character === DOUBLE_QUOTE) {
        // A quote at the start of a field opens quoted mode.
        if (this.currentField.length === 0 && !this.inQuotes) {
          this.inQuotes = true
          this.isFieldQuoted = true
        }
        else if (this.inQuotes && nextCharacter === DOUBLE_QUOTE) {
          // An escaped quote inside a quoted field.
          this.currentField += DOUBLE_QUOTE
          i++ // Skip the next quote.
        }
        else if (this.inQuotes) {
          this.inQuotes = false
        }
        else {
          // A quote in the middle of an unquoted field is kept as a literal character.
          this.currentField += character
        }
      }
      else if (character === this.delimiter && !this.inQuotes) {
        this.appendField()
      }
      else if ((character === NEWLINE || character === CARRIAGE_RETURN) && !this.inQuotes) {
        // Skip CRLF pairs.
        if (character === CARRIAGE_RETURN && nextCharacter === NEWLINE) {
          i++
        }

        this.appendRow()
      }
      else {
        this.currentField += character
      }
    }
  }

  private appendField(): void {
    const fieldValue = this.trim && !this.isFieldQuoted
      ? this.currentField.trim()
      : this.currentField
    this.currentRow.push(fieldValue)
    this.currentField = ''
    this.isFieldQuoted = false
  }

  private appendRow(): void {
    this.appendField()

    if (this.headers) {
      this.processDataRow(this.currentRow, this.headers)
    }
    else {
      this.processHeaderRow(this.currentRow)
    }

    this.currentRow = []
    this.currentRowNumber++
  }

  private processHeaderRow(headers: string[]): void {
    const emptyHeaderPositions = headers
      .map((header, index) => (header.length === 0 ? index + 1 : -1))
      .filter(position => position > 0)

    if (emptyHeaderPositions.length > 0) {
      throw new SyntaxError(
        `CSV header row contains empty column name(s) at position(s): ${emptyHeaderPositions.join(', ')}`,
      )
    }

    const seenHeaderNames = new Set<string>()
    const duplicateHeaderNames = new Set<string>()
    for (const header of headers) {
      if (seenHeaderNames.has(header))
        duplicateHeaderNames.add(header)
      else seenHeaderNames.add(header)
    }

    if (duplicateHeaderNames.size > 0) {
      throw new SyntaxError(
        `CSV header row contains duplicate column name(s): ${[...duplicateHeaderNames].join(', ')}`,
      )
    }

    this.headers = headers as Header[]
  }

  private processDataRow(fieldValues: string[], headers: Header[]): void {
    // Skip blank rows.
    if (fieldValues.length === 1 && fieldValues[0]!.length === 0) {
      return
    }

    if (this.strict) {
      if (fieldValues.length > headers.length) {
        // Tolerate empty overflow fields, e.g. from a trailing delimiter.
        const overflowFieldValues = fieldValues.slice(headers.length)
        if (overflowFieldValues.some(fieldValue => fieldValue.length > 0)) {
          throw new SyntaxError(
            `CSV row ${this.currentRowNumber} has ${fieldValues.length - headers.length} extra field(s): expected ${headers.length} column(s), found ${fieldValues.length}`,
          )
        }
      }
      else if (fieldValues.length < headers.length) {
        throw new SyntaxError(
          `CSV row ${this.currentRowNumber} has ${headers.length - fieldValues.length} missing field(s): expected ${headers.length} column(s), found ${fieldValues.length}`,
        )
      }
    }

    const rowEntries = headers.map((header, columnIndex) =>
      [header, fieldValues[columnIndex] ?? ''] as [Header, string],
    )
    this.onRow(Object.fromEntries(rowEntries) as CSVRow<Header>)
  }
}

/**
 * Parses a comma-separated values (CSV) string into an array of objects.
 *
 * @remarks
 * The first row of the CSV string is used as the header row. A leading
 * UTF-8 byte order mark is stripped.
 *
 * Parsing tolerances (lenient deviations from RFC 4180):
 * - LF, CR, and CRLF line endings are all accepted.
 * - Whitespace between a closing quote and the next delimiter or line break is ignored.
 * - A field is only treated as quoted if it starts with a quote; quotes inside
 *   unquoted fields are kept as literal characters.
 *
 * @example
 * const csv = `name,age
 * John,30
 * Jane,25`
 *
 * const data = parseCSV<'name' | 'age'>(csv)
 * // [{ name: 'John', age: '30' }, { name: 'Jane', age: '25' }]
 */
export function parseCSV<Header extends string>(
  csv?: string | null | undefined,
  options: CSVParseOptions = {},
): CSVRow<Header>[] {
  if (!csv?.trim())
    return []

  const rows: CSVRow<Header>[] = []
  const parser = new CSVParserCore<Header>(options, (row) => {
    rows.push(row)
  })

  parser.push(csv)
  parser.finish()

  return rows
}

/**
 * Parses CSV data from an async iterable or iterable of string chunks.
 *
 * @remarks
 * This function yields CSV rows as they are parsed. Chunks do not need to
 * align with row boundaries; the parser handles quotes and newlines correctly
 * across chunk boundaries.
 *
 * @example
 * const chunks = ['name,age\nJo', 'hn,30\nJane,25']
 *
 * for await (const row of parseCSVStream<'name' | 'age'>(chunks)) {
 *   console.log(row)
 * }
 */
export async function* parseCSVStream<Header extends string>(
  chunks: AsyncIterable<string> | Iterable<string>,
  options: CSVParseOptions = {},
): AsyncIterable<CSVRow<Header>> {
  const queue: CSVRow<Header>[] = []

  const parser = new CSVParserCore<Header>(options, (row) => {
    queue.push(row)
  })

  for await (const chunk of chunks) {
    parser.push(chunk)
    while (queue.length > 0) {
      yield queue.shift()!
    }
  }

  parser.finish()
  while (queue.length > 0) {
    yield queue.shift()!
  }
}

// #endregion

// #region Column inference

/**
 * Infers column names from data by collecting the union of keys
 * across all rows in first-seen order.
 */
function inferColumns<T extends Record<string, unknown>>(rows: readonly T[]): (keyof T)[] {
  const seenColumns = new Set<string>()
  const columns: string[] = []

  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const columnName of Object.keys(row)) {
        if (seenColumns.has(columnName))
          continue

        seenColumns.add(columnName)
        columns.push(columnName)
      }
    }
  }

  return columns as (keyof T)[]
}

// #endregion
