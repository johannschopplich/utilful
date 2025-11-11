/**
 * Represents a row in a CSV file with column names of type T.
 */
export type CSVRow<T extends string = string> = Record<T, string>

/**
 * Converts an array of objects to a comma-separated values (CSV) string
 * that contains only the `columns` specified.
 *
 * @example
 * const data = [
 *   { name: 'John', age: '30', city: 'New York' },
 *   { name: 'Jane', age: '25', city: 'Boston' }
 * ]
 *
 * const csv = createCSV(data, ['name', 'age'])
 * // name,age
 * // John,30
 * // Jane,25
 */
export function createCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: readonly (keyof T)[],
  options: {
    /** @default ',' */
    delimiter?: string
    /** @default true */
    addHeader?: boolean
    /** @default false */
    quoteAll?: boolean
    /** @default '\n' */
    lineEnding?: string
  } = {},
): string {
  const {
    delimiter = ',',
    addHeader = true,
    quoteAll = false,
    lineEnding = '\n',
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
    rows.unshift(columns.map(formatCell).join(delimiter))
  }

  return rows.join(lineEnding)
}

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
    delimiter = ',',
    quoteAll = false,
  } = options

  if (value == null) {
    return ''
  }

  const coercedValue = String(value)
  const requiresQuoting = quoteAll
    || coercedValue.includes(delimiter)
    || coercedValue.includes('"')
    || coercedValue.includes('\n')
    || coercedValue.includes('\r')

  if (requiresQuoting) {
    // Escape quotes and wrap the value
    return `"${coercedValue.replaceAll('"', '""')}"`
  }

  return coercedValue
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

  // Parse the CSV content respecting quotes
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let currentRowNumber = 1 // Tracks the current row being parsed (1-indexed)

  const { delimiter = ',', trim = true, strict = true } = options

  if (delimiter.length !== 1) {
    throw new RangeError(`CSV delimiter must be a single character, got "${delimiter}"`)
  }

  const appendField = () => {
    currentRow.push(currentField)
    currentField = ''
  }

  const appendRow = () => {
    appendField()
    rows.push(currentRow)
    currentRow = []
  }

  // Process character by character to handle quotes properly
  for (let i = 0; i < csv.length; i++) {
    const character = csv[i]
    const nextCharacter = i + 1 < csv.length ? csv[i + 1] : ''

    // Handle quotes
    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        // Escaped quote inside quotes
        currentField += '"'
        i++ // Skip the next quote
      }
      else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    }
    // Handle field delimiter when not in quotes
    else if (character === delimiter && !inQuotes) {
      appendField()
    }
    // Handle row delimiter when not in quotes
    else if ((character === '\n' || (character === '\r' && nextCharacter === '\n')) && !inQuotes) {
      if (character === '\r')
        i++

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
  if (!headerRow)
    return []

  const headers = trim ? headerRow.map(h => h.trim()) : headerRow

  // Validate headers
  const headersWithEmptyNames = headers.filter(h => h.length === 0)
  if (headersWithEmptyNames.length > 0) {
    const positions = headers
      .map((h, i) => h.length === 0 ? i + 1 : -1)
      .filter(i => i > 0)
      .join(', ')
    throw new SyntaxError(`CSV header row contains empty column name(s) at position(s): ${positions}`)
  }

  const duplicateHeaderNames = headers.filter((h, i) => headers.indexOf(h) !== i)
  if (duplicateHeaderNames.length > 0) {
    throw new SyntaxError(`CSV header row contains duplicate column name(s): ${[...new Set(duplicateHeaderNames)].join(', ')}`)
  }

  const isFieldPopulated = trim
    ? (field: string) => field.trim().length > 0
    : (field: string) => field.length > 0

  return rows.slice(1)
    .filter(row => row.length > 1 || row.some(isFieldPopulated))
    .map((fieldValues, rowIndex) => {
      if (fieldValues.length > headers.length) {
        const fieldsExceedingHeaders = fieldValues.slice(headers.length)
        const containsNonEmptyOverflow = fieldsExceedingHeaders.some(isFieldPopulated)

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
          const value = trim ? untrimmedValue.trim() : untrimmedValue
          return [header, value]
        }),
      ) as CSVRow<Header>
    })
}
