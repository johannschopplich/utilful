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
    // Handle field delimiter when not in quotes
    else if (char === delimiter && !inQuotes) {
      appendField()
    }
    // Handle row delimiter when not in quotes
    else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r')
        i++

      appendRow()
    }
    else {
      currentField += char
    }
  }

  // Handle the last field and row if needed
  if (currentField || currentRow.length > 0) {
    appendRow()
  }

  // No data or only header row
  if (rows.length <= 1)
    return []

  const headers = rows[0]!

  const isNonEmptyField = trimValues
    ? (field: string) => field.trim().length > 0
    : (field: string) => field.length > 0

  return rows.slice(1)
    .filter(row => row.some(isNonEmptyField))
    .map((values, rowIndex) => {
      if (values.length > headers.length) {
        const extraValues = values.slice(headers.length)
        const hasMeaningfulExtra = extraValues.some(isNonEmptyField)

        if (hasMeaningfulExtra) {
          throw new Error(`Row ${rowIndex + 2} has more fields (${values.length}) than headers (${headers.length}).`)
        }
      }

      return Object.fromEntries(
        headers.map((header, index) => {
          const rawValue = index < values.length ? values[index] ?? '' : ''
          const normalizedValue = trimValues ? rawValue.trim() : rawValue
          return [header, normalizedValue]
        }),
      ) as CSVRow<Header>
    })
}
