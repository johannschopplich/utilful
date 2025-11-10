import { describe, expect, it } from 'vitest'
import { createCSV, escapeCSVValue, parseCSV } from './csv'

describe('csv', () => {
  describe('createCSV', () => {
    const testData = [
      { name: 'John', age: '30', city: 'New York' },
      { name: 'Jane', age: '25', city: 'Boston' },
      { name: 'Bob', age: '40', city: 'Chicago' },
    ]

    it('creates a CSV string with headers by default', () => {
      const result = createCSV(testData, ['name', 'age'])
      expect(result).toBe('name,age\nJohn,30\nJane,25\nBob,40')
    })

    it('creates a CSV string without headers when specified', () => {
      const result = createCSV(testData, ['name', 'age'], { addHeader: false })
      expect(result).toBe('John,30\nJane,25\nBob,40')
    })

    it('handles custom delimiters', () => {
      const result = createCSV(testData, ['name', 'age'], { delimiter: ';' })
      expect(result).toBe('name;age\nJohn;30\nJane;25\nBob;40')
    })

    it('properly escapes values containing delimiters', () => {
      const dataWithCommas = [
        { name: 'John, Jr.', age: '30' },
        { name: 'Jane', age: '25' },
      ]
      const result = createCSV(dataWithCommas, ['name', 'age'])
      expect(result).toBe('name,age\n"John, Jr.",30\nJane,25')
    })

    it('properly escapes values containing quotes', () => {
      const dataWithQuotes = [
        { name: 'John "Johnny" Doe', age: '30' },
        { name: 'Jane', age: '25' },
      ]
      const result = createCSV(dataWithQuotes, ['name', 'age'])
      expect(result).toBe('name,age\n"John ""Johnny"" Doe",30\nJane,25')
    })

    it('quotes all values when specified', () => {
      const result = createCSV(testData, ['name', 'age'], { quoteAll: true })
      expect(result).toBe('"name","age"\n"John","30"\n"Jane","25"\n"Bob","40"')
    })

    it('handles empty data array', () => {
      const result = createCSV([], ['name', 'age'])
      expect(result).toBe('name,age')
    })

    it('handles undefined, null, and empty values', () => {
      const dataWithEmpty = [
        { name: 'John', age: undefined },
        { name: null, age: '25' },
        { name: '', age: '40' },
      ]
      const result = createCSV(dataWithEmpty, ['name', 'age'])
      expect(result).toBe('name,age\nJohn,\n,25\n,40')
    })

    it('handles newlines in values', () => {
      const dataWithNewlines = [
        { name: 'John\nDoe', age: '30' },
        { name: 'Jane', age: '25\n26' },
      ]
      const result = createCSV(dataWithNewlines, ['name', 'age'])
      expect(result).toBe('name,age\n"John\nDoe",30\nJane,"25\n26"')
    })
  })

  describe('escapeCSVValue', () => {
    it('returns string values as is when no escaping needed', () => {
      expect(escapeCSVValue('simple')).toBe('simple')
      expect(escapeCSVValue(42)).toBe('42')
      expect(escapeCSVValue(true)).toBe('true')
    })

    it('returns empty string for null or undefined', () => {
      expect(escapeCSVValue(null)).toBe('')
      expect(escapeCSVValue(undefined)).toBe('')
    })

    it('escapes values containing delimiters', () => {
      expect(escapeCSVValue('hello, world')).toBe('"hello, world"')
      expect(escapeCSVValue('hello; world', { delimiter: ';' })).toBe('"hello; world"')
    })

    it('escapes values containing quotes', () => {
      expect(escapeCSVValue('contains "quotes"')).toBe('"contains ""quotes"""')
      expect(escapeCSVValue('multiple "quotes" here "too"')).toBe('"multiple ""quotes"" here ""too"""')
    })

    it('escapes values containing newlines', () => {
      expect(escapeCSVValue('contains\nnewline')).toBe('"contains\nnewline"')
      expect(escapeCSVValue('contains\r\nnewline')).toBe('"contains\r\nnewline"')
    })

    it('quotes all values when quoteAll is true', () => {
      expect(escapeCSVValue('simple', { quoteAll: true })).toBe('"simple"')
      expect(escapeCSVValue(42, { quoteAll: true })).toBe('"42"')
    })
  })

  describe('parseCSV', () => {
    it('parses a simple CSV string into an array of objects', () => {
      const csv = 'name,age\nJohn,30\nJane,25\nBob,40'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
        { name: 'Bob', age: '40' },
      ])
    })

    it('handles custom delimiters', () => {
      const csv = 'name;age\nJohn;30\nJane;25\nBob;40'
      const result = parseCSV(csv, { delimiter: ';' })

      expect(result).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
        { name: 'Bob', age: '40' },
      ])
    })

    it('handles quoted values containing delimiters', () => {
      const csv = 'name,city\n"Doe, John",New York\nJane,"Boston, MA"'
      expect(parseCSV(csv)).toEqual([
        { name: 'Doe, John', city: 'New York' },
        { name: 'Jane', city: 'Boston, MA' },
      ])
    })

    it('handles quoted values containing escaped quotes', () => {
      const csv = 'name,quote\n"John ""Johnny"" Doe","He said ""Hello"""'
      expect(parseCSV(csv)).toEqual([
        { name: 'John "Johnny" Doe', quote: 'He said "Hello"' },
      ])
    })

    it('handles empty fields', () => {
      const csv = 'name,age,city\nJohn,30,\n,25,Boston\nBob,,'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30', city: '' },
        { name: '', age: '25', city: 'Boston' },
        { name: 'Bob', age: '', city: '' },
      ])
    })

    it('handles values with newlines', () => {
      const csv = `name,bio
"John Doe","Line 1
Line 2"
Jane,"Single line"`

      expect(parseCSV(csv)).toEqual([
        { name: 'John Doe', bio: 'Line 1\nLine 2' },
        { name: 'Jane', bio: 'Single line' },
      ])
    })

    it('handles empty input', () => {
      expect(parseCSV()).toEqual([])
      expect(parseCSV('')).toEqual([])
    })

    it('handles input with only headers', () => {
      expect(parseCSV('name,age,city')).toEqual([])
    })

    it('handles Windows line endings (CRLF)', () => {
      const csv = 'name,age\r\nJohn,30\r\nJane,25'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])
    })

    it('skips empty rows', () => {
      const csv = 'name,age\nJohn,30\n\nJane,25\n\n'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])
    })

    it('not trims values when trimValues is false', () => {
      const csv = 'name,age\n John , 30 \n Jane, 25'
      const result = parseCSV(csv, { trimValues: false })

      expect(result).toEqual([
        { name: ' John ', age: ' 30 ' },
        { name: ' Jane', age: ' 25' },
      ])
    })

    it('trims values by default', () => {
      const csv = 'name,age\n John , 30 \n Jane, 25'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])
    })

    it('preserves header whitespace when trimming values', () => {
      const csv = ' name , age \n John , 30 '
      expect(parseCSV<' name ' | ' age '>(csv)).toEqual([
        { ' name ': 'John', ' age ': '30' },
      ])
    })

    it('handles complex nested quotes and escaping', () => {
      const csv = `name,description
"Product A","This product has ""special"" features and ""unique"" design"
"Product B","Another ""cool"" item with multiple ""quoted"" words"
"Product C",Normal description`

      expect(parseCSV(csv)).toEqual([
        { name: 'Product A', description: 'This product has "special" features and "unique" design' },
        { name: 'Product B', description: 'Another "cool" item with multiple "quoted" words' },
        { name: 'Product C', description: 'Normal description' },
      ])
    })

    it('preserves whitespace-only rows when trimValues is false', () => {
      const csv = 'name\n   '
      expect(parseCSV(csv, { trimValues: false })).toEqual([
        { name: '   ' },
      ])
    })

    it('handles multiple consecutive delimiters as empty fields', () => {
      const csv = 'name,age,,city\nJohn,30,,New York\nJane,,,Boston\nBob,40,,'

      expect(parseCSV(csv)).toEqual([
        { 'name': 'John', 'age': '30', '': '', 'city': 'New York' },
        { 'name': 'Jane', 'age': '', '': '', 'city': 'Boston' },
        { 'name': 'Bob', 'age': '40', '': '', 'city': '' },
      ])
    })

    it('throws when row has more fields than headers', () => {
      const csv = 'name,age\nJohn,30,Engineer'
      expect(() => parseCSV(csv)).toThrowError('Row 2 has more fields (3) than headers (2).')
    })

    it('handles mixed line endings correctly', () => {
      const csv = 'name,age\nJohn,30\r\nJane,25\nBob,40'

      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
        { name: 'Bob', age: '40' },
      ])
    })

    it('handles complex multiline fields with mixed content', () => {
      const csv = `id,note
1,"This is a note
with multiple lines
and ""quotes"" inside"
2,"Single line note"`

      expect(parseCSV(csv)).toEqual([
        { id: '1', note: 'This is a note\nwith multiple lines\nand "quotes" inside' },
        { id: '2', note: 'Single line note' },
      ])
    })

    it('handles multiline quoted fields at the end of the file without a trailing newline', () => {
      const csv = `name,description
"Product A","Single line"
"Product B","This has
multiple lines"`

      expect(parseCSV(csv)).toEqual([
        { name: 'Product A', description: 'Single line' },
        { name: 'Product B', description: 'This has\nmultiple lines' },
      ])
    })

    it('handles mismatched quoted fields gracefully', () => {
      // Missing closing quote - the parser should treat the rest of the input as part of the field
      const csv = `name,description
"Product A,"Description A"
Product B,Description B`

      expect(parseCSV(csv)).toEqual([
        { name: 'Product A,Description A\nProduct B,Description B', description: '' },
      ])
    })

    it('preserves empty lines within quoted fields', () => {
      const csv = `id,content
1,"Line 1

Line 3"
2,"No empty lines"`

      expect(parseCSV(csv)).toEqual([
        { id: '1', content: 'Line 1\n\nLine 3' },
        { id: '2', content: 'No empty lines' },
      ])
    })

    it('handles real-world CSV example with various complexities', () => {
      const csv = `"Name","Email","Notes","Join Date"
"John Smith","john@example.com","Customer since 2020
Has premium subscription
""VIP"" status","2020-01-15"
"Jane Doe","jane@example.com","Regular customer","2019-11-30"
"Bob Johnson","bob@example.com","New customer
Referred by Jane","2023-05-22"`

      expect(parseCSV(csv)).toEqual([
        {
          'Name': 'John Smith',
          'Email': 'john@example.com',
          'Notes': 'Customer since 2020\nHas premium subscription\n"VIP" status',
          'Join Date': '2020-01-15',
        },
        {
          'Name': 'Jane Doe',
          'Email': 'jane@example.com',
          'Notes': 'Regular customer',
          'Join Date': '2019-11-30',
        },
        {
          'Name': 'Bob Johnson',
          'Email': 'bob@example.com',
          'Notes': 'New customer\nReferred by Jane',
          'Join Date': '2023-05-22',
        },
      ])
    })
  })
})
