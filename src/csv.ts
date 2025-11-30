// #region Constants

export const COMMA = ','
export const DOUBLE_QUOTE = '"'
export const NEWLINE = '\n'
export const CARRIAGE_RETURN = '\r'
export const ESCAPED_QUOTE = '""'

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

  const formatCell = (value: unknown) =>
    escapeCSVValue(value, { delimiter, quoteAll })

  const rows = data.map(obj =>
    columns.map(key => formatCell(obj[key])).join(delimiter),
  )

  if (addHeader) {
    const header = columns.map(formatCell).join(delimiter)
    if (rows.length === 0) {
      return header
    }

    return header + lineEnding + rows.join(lineEnding)
  }

  return rows.join(lineEnding)
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
  const requiresQuoting = quoteAll
    || coercedValue.includes(delimiter)
    || coercedValue.includes(DOUBLE_QUOTE)
    || coercedValue.includes(NEWLINE)
    || coercedValue.includes(CARRIAGE_RETURN)

  if (requiresQuoting) {
    // Escape quotes and wrap the value
    return `${DOUBLE_QUOTE}${coercedValue.replaceAll(DOUBLE_QUOTE, ESCAPED_QUOTE)}${DOUBLE_QUOTE}`
  }

  return coercedValue
}

// #endregion

// #region Parse CSV

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

  // Parse the CSV content respecting quotes
  const rows: string[][] = []
  const rowQuotedFlags: boolean[][] = [] // Track which fields were quoted
  let currentRow: string[] = []
  let currentRowQuotedFlags: boolean[] = []
  let currentField = ''
  let inQuotes = false
  let isFieldQuoted = false // Tracks if the current field started with a quote
  let currentRowNumber = 1 // Tracks the current row being parsed (1-indexed)

  const { delimiter = COMMA, trim = true, strict = true } = options

  if (delimiter.length !== 1) {
    throw new RangeError(`CSV delimiter must be a single character, got "${delimiter}"`)
  }

  const appendField = () => {
    currentRow.push(currentField)
    currentRowQuotedFlags.push(isFieldQuoted)
    currentField = ''
    isFieldQuoted = false
  }

  const appendRow = () => {
    appendField()
    rows.push(currentRow)
    rowQuotedFlags.push(currentRowQuotedFlags)
    currentRow = []
    currentRowQuotedFlags = []
  }

  // Process character by character to handle quotes properly
  for (let i = 0; i < csv.length; i++) {
    const character = csv[i]
    const nextCharacter = i + 1 < csv.length ? csv[i + 1] : ''

    // Skip whitespace after closing quote until delimiter or newline (but not if it IS the delimiter)
    if (isFieldQuoted && !inQuotes && character !== delimiter && (character === ' ' || character === '\t')) {
      // Ignore trailing whitespace after closing quote
      continue
    }

    // Handle quotes
    if (character === DOUBLE_QUOTE) {
      // Quote at the start of a field opens quoted mode
      if (currentField.length === 0 && !inQuotes) {
        inQuotes = true
        isFieldQuoted = true
      }
      else if (inQuotes && nextCharacter === DOUBLE_QUOTE) {
        // Escaped quote inside quotes
        currentField += DOUBLE_QUOTE
        i++ // Skip the next quote
      }
      else if (inQuotes) {
        // Close quote mode
        inQuotes = false
      }
      else {
        // Quote in the middle of an unquoted field - treat as literal
        currentField += character
      }
    }
    // Handle field delimiter when not in quotes
    else if (character === delimiter && !inQuotes) {
      appendField()
    }
    // Handle row delimiter when not in quotes
    else if ((character === NEWLINE || character === CARRIAGE_RETURN) && !inQuotes) {
      // Skip CRLF pairs
      if (character === CARRIAGE_RETURN && nextCharacter === NEWLINE) {
        i++
      }

      appendRow()
      currentRowNumber++
    }
    else {
      currentField += character
    }
  }

  // Handle the last field and row if needed
  if (currentField || currentRow.length > 0) {
    appendRow()
  }

  // Check for unterminated quoted field
  if (inQuotes) {
    throw new SyntaxError(`CSV contains unterminated quoted field at row ${currentRowNumber}`)
  }

  // No data or only header row
  if (rows.length <= 1)
    return []

  const [headerRow] = rows
  const [headerRowQuotedFlags] = rowQuotedFlags
  if (!headerRow)
    return []

  const headers = trim
    ? headerRow.map((h, i) => {
      // Don't trim quoted headers
        return headerRowQuotedFlags && headerRowQuotedFlags[i] ? h : h.trim()
      })
    : headerRow

  // Validate headers
  const headersWithEmptyNames = headers.filter(h => h.length === 0)
  if (headersWithEmptyNames.length > 0) {
    const positions = headers
      .map((h, i) => h.length === 0 ? i + 1 : -1)
      .filter(i => i > 0)
      .join(', ')
    throw new SyntaxError(`CSV header row contains empty column name(s) at position(s): ${positions}`)
  }

  const headerSet = new Set<string>()
  const duplicateHeaderNames = new Set<string>()
  for (const header of headers) {
    if (headerSet.has(header))
      duplicateHeaderNames.add(header)
    else
      headerSet.add(header)
  }

  if (duplicateHeaderNames.size > 0) {
    throw new SyntaxError(`CSV header row contains duplicate column name(s): ${[...duplicateHeaderNames].join(', ')}`)
  }

  const isFieldPopulated = trim
    ? (field: string, wasQuoted: boolean) => wasQuoted ? field.length > 0 : field.trim().length > 0
    : (field: string) => field.length > 0

  const dataRows = rows.slice(1)
  const dataRowQuotedFlags = rowQuotedFlags.slice(1)

  return dataRows
    .map((row, idx) => ({ row, quotedFlags: dataRowQuotedFlags[idx] ?? [], rowIndex: idx }))
    .filter(({ row, quotedFlags }) =>
      row.length > 1 || row.some((field, fieldIdx) =>
        isFieldPopulated(field, quotedFlags[fieldIdx] ?? false),
      ),
    )
    .map(({ row: fieldValues, quotedFlags, rowIndex }) => {
      if (fieldValues.length > headers.length) {
        const fieldsExceedingHeaders = fieldValues.slice(headers.length)
        const excessQuotedFlags = quotedFlags.slice(headers.length)
        const containsNonEmptyOverflow = fieldsExceedingHeaders.some((field, idx) =>
          isFieldPopulated(field, excessQuotedFlags[idx] ?? false),
        )

        if (strict && containsNonEmptyOverflow) {
          const expectedCount = headers.length
          const actualCount = fieldValues.length
          const excessCount = actualCount - expectedCount
          throw new SyntaxError(
            `CSV row ${rowIndex + 2} has ${excessCount} extra field(s): expected ${expectedCount} column(s), found ${actualCount}`,
          )
        }
      }

      return Object.fromEntries(
        headers.map((header, columnIndex) => {
          const untrimmedValue = columnIndex < fieldValues.length ? fieldValues[columnIndex] ?? '' : ''
          const wasQuoted = quotedFlags[columnIndex] ?? false
          // Don't trim quoted fields
          const value = trim && !wasQuoted ? untrimmedValue.trim() : untrimmedValue
          return [header, value]
        }),
      ) as CSVRow<Header>
    })
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
