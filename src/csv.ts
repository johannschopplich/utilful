// #region Constants

const COMMA = ','
const DOUBLE_QUOTE = '"'
const NEWLINE = '\n'
const CARRIAGE_RETURN = '\r'
const ESCAPED_QUOTE = '""'
const SPACE = ' '
const TAB = '\t'

// #endregion

// #region Types

/**
 * Represents a row in a CSV file with column names of type T.
 */
export type CSVRow<T extends string = string> = Record<T, string>

/**
 * Options for the `createCSV` function.
 */
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
  // Discriminate arguments
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

  // Handle empty data with no inferred columns
  if (columns.length === 0 && data.length === 0) {
    return ''
  }

  const {
    delimiter = COMMA,
    addHeader = true,
    quoteAll = false,
    lineEnding = NEWLINE,
  } = options

  if (delimiter.length !== 1) {
    throw new RangeError(`CSV delimiter must be a single character, got "${delimiter}"`)
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

  if (delimiter.length !== 1) {
    throw new RangeError(`CSV delimiter must be a single character, got "${delimiter}"`)
  }

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
 * escapeCSVValue('hello, world') // "hello, world"
 * escapeCSVValue('contains "quotes"') // "contains ""quotes"""
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
  private currentRowQuotedFlags: boolean[] = []
  private currentField = ''
  private inQuotes = false
  private isFieldQuoted = false
  private currentRowNumber = 1

  private headerRaw?: string[]
  private headerQuotedFlags?: boolean[]
  private headers?: Header[]

  constructor(
    options: { delimiter?: string, trim?: boolean, strict?: boolean },
    onRow: (row: CSVRow<Header>) => void,
  ) {
    const { delimiter = COMMA, trim = true, strict = true } = options

    if (delimiter.length !== 1) {
      throw new RangeError(`CSV delimiter must be a single character, got "${delimiter}"`)
    }

    this.delimiter = delimiter
    this.trim = trim
    this.strict = strict
    this.onRow = onRow
  }

  push(chunk: string): void {
    for (let i = 0; i < chunk.length; i++) {
      const character = chunk[i]
      const nextCharacter = i + 1 < chunk.length ? chunk[i + 1] : ''

      // Skip whitespace after closing quote until delimiter or newline (but not if it IS the delimiter)
      if (this.isFieldQuoted && !this.inQuotes && character !== this.delimiter && (character === SPACE || character === TAB)) {
        // Ignore trailing whitespace after closing quote
        continue
      }

      // Handle quotes
      if (character === DOUBLE_QUOTE) {
        // Quote at the start of a field opens quoted mode
        if (this.currentField.length === 0 && !this.inQuotes) {
          this.inQuotes = true
          this.isFieldQuoted = true
        }
        else if (this.inQuotes && nextCharacter === DOUBLE_QUOTE) {
          // Escaped quote inside quotes
          this.currentField += DOUBLE_QUOTE
          i++ // Skip the next quote
        }
        else if (this.inQuotes) {
          // Close quote mode
          this.inQuotes = false
        }
        else {
          // Quote in the middle of an unquoted field - treat as literal
          this.currentField += character
        }
      }
      // Handle field delimiter when not in quotes
      else if (character === this.delimiter && !this.inQuotes) {
        this.appendField()
      }
      // Handle row delimiter when not in quotes
      else if ((character === NEWLINE || character === CARRIAGE_RETURN) && !this.inQuotes) {
        // Skip CRLF pairs
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

  finish(): void {
    // Unterminated quoted field check (before processing remaining data)
    if (this.inQuotes) {
      throw new SyntaxError(
        `CSV contains unterminated quoted field at row ${this.currentRowNumber}`,
      )
    }

    // If there is leftover field/row, append it
    if (this.currentField !== '' || this.currentRow.length > 0) {
      this.appendRow()
    }
  }

  private appendField(): void {
    this.currentRow.push(this.currentField)
    this.currentRowQuotedFlags.push(this.isFieldQuoted)
    this.currentField = ''
    this.isFieldQuoted = false
  }

  private appendRow(): void {
    this.appendField()

    if (!this.headerRaw) {
      this.headerRaw = this.currentRow
      this.headerQuotedFlags = this.currentRowQuotedFlags
      this.processHeaderRow()
    }
    else {
      this.processDataRow(this.currentRow, this.currentRowQuotedFlags)
    }

    this.currentRow = []
    this.currentRowQuotedFlags = []
    this.currentRowNumber++
  }

  private processHeaderRow(): void {
    const headerRow = this.headerRaw!
    const headerQuotedFlags = this.headerQuotedFlags ?? []

    const headers = this.trim
      ? headerRow.map((h, i) =>
          headerQuotedFlags[i] ? h : h.trim(),
        )
      : headerRow

    // Empty header validation
    const headersWithEmptyNames = headers.filter(h => h.length === 0)
    if (headersWithEmptyNames.length > 0) {
      const positions = headers
        .map((h, i) => (h.length === 0 ? i + 1 : -1))
        .filter(i => i > 0)
        .join(', ')
      throw new SyntaxError(
        `CSV header row contains empty column name(s) at position(s): ${positions}`,
      )
    }

    // Duplicate header validation
    const headerSet = new Set<string>()
    const duplicateHeaderNames = new Set<string>()
    for (const header of headers) {
      if (headerSet.has(header))
        duplicateHeaderNames.add(header)
      else headerSet.add(header)
    }

    if (duplicateHeaderNames.size > 0) {
      throw new SyntaxError(
        `CSV header row contains duplicate column name(s): ${[...duplicateHeaderNames].join(', ')}`,
      )
    }

    this.headers = headers as Header[]
  }

  private processDataRow(
    fieldValues: string[],
    quotedFlags: boolean[],
  ): void {
    if (!this.headers) {
      throw new Error('CSVParserCore: headers not initialized')
    }

    const headers = this.headers

    const isFieldPopulated = this.trim
      ? (field: string, wasQuoted: boolean) =>
          wasQuoted ? field.length > 0 : field.trim().length > 0
      : (field: string) => field.length > 0

    // Skip empty rows
    const hasMultipleFields = fieldValues.length > 1
    const hasAnyPopulatedField = fieldValues.some((field, idx) =>
      isFieldPopulated(field, quotedFlags[idx] ?? false),
    )
    if (!hasMultipleFields && !hasAnyPopulatedField) {
      return
    }

    // Strict extra-field check
    if (fieldValues.length > headers.length) {
      const fieldsExceedingHeaders = fieldValues.slice(headers.length)
      const excessQuotedFlags = quotedFlags.slice(headers.length)
      const containsNonEmptyOverflow = fieldsExceedingHeaders.some((field, idx) =>
        isFieldPopulated(field, excessQuotedFlags[idx] ?? false),
      )

      if (this.strict && containsNonEmptyOverflow) {
        const expectedCount = headers.length
        const actualCount = fieldValues.length
        const excessCount = actualCount - expectedCount
        throw new SyntaxError(
          `CSV row ${this.currentRowNumber} has ${excessCount} extra field(s): expected ${expectedCount} column(s), found ${actualCount}`,
        )
      }
    }

    // Build row object
    const rowEntries: [Header, string][] = headers.map((header, columnIndex) => {
      const untrimmedValue
        = columnIndex < fieldValues.length ? fieldValues[columnIndex] ?? '' : ''
      const wasQuoted = quotedFlags[columnIndex] ?? false
      const value
        = this.trim && !wasQuoted ? untrimmedValue.trim() : untrimmedValue
      return [header, value]
    })

    const rowObject = Object.fromEntries(rowEntries) as CSVRow<Header>
    this.onRow(rowObject)
  }
}

/**
 * Parses a comma-separated values (CSV) string into an array of objects.
 *
 * @remarks
 * The first row of the CSV string is used as the header row.
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
  options: {
    /** @default ',' */
    delimiter?: string
    /**
     * Trim whitespace from headers and values.
     * @default true
     */
    trim?: boolean
    /**
     * Throw error if row has more fields than headers.
     * @default true
     */
    strict?: boolean
  } = {},
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
  options: {
    delimiter?: string
    trim?: boolean
    strict?: boolean
  } = {},
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

/**
 * Parses CSV data from an async iterable or iterable of lines.
 *
 * @remarks
 * This is a convenience wrapper around `parseCSVStream` that treats each line
 * as a chunk. Note that lines do not necessarily correspond to CSV rows due to
 * quoted fields containing newlines. The parser handles this correctly.
 *
 * @example
 * const lines = ['name,age', 'John,30', 'Jane,25']
 *
 * for await (const row of parseCSVFromLines<'name' | 'age'>(lines)) {
 *   console.log(row)
 * }
 */
export async function* parseCSVFromLines<Header extends string>(
  lines: AsyncIterable<string> | Iterable<string>,
  options?: {
    delimiter?: string
    trim?: boolean
    strict?: boolean
  },
): AsyncIterable<CSVRow<Header>> {
  yield* parseCSVStream(lines, options)
}

// #endregion

// #region Helper functions

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
