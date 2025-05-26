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
  columns: (keyof T)[],
  options: {
    /** @default ',' */
    delimiter?: string
    /** @default true */
    addHeader?: boolean
    /** @default false */
    quoteAll?: boolean
  } = {},
): string {
  const {
    delimiter = ',',
    addHeader = true,
    quoteAll = false,
  } = options

  const escapeAndQuote = (value: unknown) =>
    escapeCSVValue(value, { delimiter, quoteAll })

  const rows = data.map(obj =>
    columns.map(key => escapeAndQuote(obj[key])).join(delimiter),
  )

  if (addHeader) {
    rows.unshift(columns.map(escapeAndQuote).join(delimiter))
  }

  return rows.join('\n')
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

  const stringValue = String(value)
  const needsQuoting = quoteAll
    || stringValue.includes(delimiter)
    || stringValue.includes('"')
    || stringValue.includes('\n')
    || stringValue.includes('\r')

  if (needsQuoting) {
    // Escape quotes and wrap the value
    return `"${stringValue.replaceAll('"', '""')}"`
  }

  return stringValue
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
    /** @default true */
    trimValues?: boolean
  } = {},
): CSVRow<Header>[] {
  if (!csv?.trim())
    return []

  // Parse the CSV content respecting quotes
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  const { delimiter = ',', trimValues = true } = options

  // Process character by character to handle quotes properly
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    const nextChar = i + 1 < csv.length ? csv[i + 1] : ''

    // Handle quotes
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote inside quotes
        currentField += '"'
        i++ // Skip the next quote
      }
      else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    }
    // Handle field delimiter (comma) when not in quotes
    else if (char === delimiter && !inQuotes) {
      currentRow.push(trimValues ? currentField.trim() : currentField)
      currentField = ''
    }
    // Handle row delimiter (newline) when not in quotes
    else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      // Skip the next `\n` in `\r\n`
      if (char === '\r')
        i++

      currentRow.push(trimValues ? currentField.trim() : currentField)
      rows.push(currentRow)
      currentRow = []
      currentField = ''
    }
    else {
      currentField += char
    }
  }

  // Handle the last field and row if needed
  if (currentField || currentRow.length > 0) {
    currentRow.push(trimValues ? currentField.trim() : currentField)
    rows.push(currentRow)
  }

  // No data or only header row
  if (rows.length <= 1)
    return []

  const headers = rows[0]!

  return rows.slice(1)
    .filter(row => row.some(field => field.trim().length > 0)) // Skip empty rows
    .map((values) => {
      return Object.fromEntries(
        headers.map((header, index) => [header, index < values.length ? values[index] : '']),
      ) as CSVRow<Header>
    })
}
