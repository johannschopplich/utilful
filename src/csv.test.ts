import { describe, expect, it } from 'vitest'
import { createCSV, escapeCSVValue, parseCSV } from './csv'

describe('csv', () => {
  // Common fixtures
  const people = [
    { name: 'John', age: '30', city: 'New York' },
    { name: 'Jane', age: '25', city: 'Boston' },
    { name: 'Bob', age: '40', city: 'Chicago' },
  ]

  describe('escapeCSVValue', () => {
    it('coerces primitives to strings (no escaping needed)', () => {
      expect(escapeCSVValue('simple')).toBe('simple')
      expect(escapeCSVValue(42)).toBe('42')
      expect(escapeCSVValue(true)).toBe('true')
      // also check BigInt and Date stringification
      expect(escapeCSVValue(9007199254740993n)).toBe('9007199254740993')
      const d = new Date('2020-01-02T03:04:05.000Z')
      expect(escapeCSVValue(d)).toBe(d.toString())
    })

    it('returns empty string for null or undefined', () => {
      expect(escapeCSVValue(null)).toBe('')
      expect(escapeCSVValue(undefined)).toBe('')
    })

    it.each([
      ['comma delimiter', { delimiter: ',' }, 'hello, world', '"hello, world"'],
      ['custom semicolon delimiter', { delimiter: ';' }, 'hello; world', '"hello; world"'],
      ['tab delimiter', { delimiter: '\t' }, 'hello\tworld', '"hello\tworld"'],
      ['double quotes', {}, 'contains "quotes"', '"contains ""quotes"""'],
      ['multiple quotes', {}, 'multiple "quotes" here "too"', '"multiple ""quotes"" here ""too"""'],
      ['LF newline', {}, 'contains\nnewline', '"contains\nnewline"'],
      ['CRLF newline', {}, 'contains\r\nnewline', '"contains\r\nnewline"'],
      ['combined: delimiter + quotes + newline', {}, 'x,"y",z\nmore', '"x,""y"",z\nmore"'],
    ])('escapes %s', (_label, options, input, expected) => {
      expect(escapeCSVValue(input, options)).toBe(expected)
    })

    it('quotes all values when quoteAll is true', () => {
      expect(escapeCSVValue('simple', { quoteAll: true })).toBe('"simple"')
      expect(escapeCSVValue(42, { quoteAll: true })).toBe('"42"')
    })
  })

  describe('createCSV', () => {
    it('creates a CSV string with headers by default', () => {
      const result = createCSV(people, ['name', 'age'])
      expect(result).toBe('name,age\nJohn,30\nJane,25\nBob,40')
    })

    it('creates a CSV string without headers when specified', () => {
      const result = createCSV(people, ['name', 'age'], { addHeader: false })
      expect(result).toBe('John,30\nJane,25\nBob,40')
    })

    it.each([
      ['comma', ',', 'name,age\nJohn,30\nJane,25\nBob,40'],
      ['semicolon', ';', 'name;age\nJohn;30\nJane;25\nBob;40'],
      ['tab', '\t', 'name\tage\nJohn\t30\nJane\t25\nBob\t40'],
    ])('handles custom delimiters: %s', (_label, delimiter, expected) => {
      const result = createCSV(people, ['name', 'age'], { delimiter })
      expect(result).toBe(expected)
    })

    it('properly escapes values containing delimiters', () => {
      const data = [
        { name: 'John, Jr.', age: '30' },
        { name: 'Jane', age: '25' },
      ]
      const result = createCSV(data, ['name', 'age'])
      expect(result).toBe('name,age\n"John, Jr.",30\nJane,25')
    })

    it('properly escapes values containing quotes', () => {
      const data = [
        { name: 'John "Johnny" Doe', age: '30' },
        { name: 'Jane', age: '25' },
      ]
      const result = createCSV(data, ['name', 'age'])
      expect(result).toBe('name,age\n"John ""Johnny"" Doe",30\nJane,25')
    })

    it('properly escapes values containing newlines', () => {
      const data = [
        { name: 'John\nDoe', age: '30' },
        { name: 'Jane', age: '25\n26' },
      ]
      const result = createCSV(data, ['name', 'age'])
      expect(result).toBe('name,age\n"John\nDoe",30\nJane,"25\n26"')
    })

    it('quotes all values when specified (including headers)', () => {
      const result = createCSV(people, ['name', 'age'], { quoteAll: true })
      expect(result).toBe('"name","age"\n"John","30"\n"Jane","25"\n"Bob","40"')
    })

    it('handles empty data array (still outputs header when addHeader is true)', () => {
      const result = createCSV([], ['name', 'age'])
      expect(result).toBe('name,age')
    })

    it('handles undefined, null, empty, and missing keys as empty fields', () => {
      const data = [
        { name: 'John', age: undefined },
        { name: null, age: '25' },
        { name: '', age: '40' },
        { name: 'Jane' }, // missing age
      ]
      const result = createCSV(data, ['name', 'age'])
      expect(result).toBe('name,age\nJohn,\n,25\n,40\nJane,')
    })

    it('ignores extra properties not listed in fields', () => {
      const data = [
        { name: 'John', age: '30', city: 'NYC', extra: 'ignore-me' },
      ]
      const result = createCSV(data, ['name', 'age'])
      expect(result).toBe('name,age\nJohn,30')
    })

    it('escapes headers that require it (quotes/delimiters in header names)', () => {
      const data = [{ 'na,me': 'John', 'a"ge': '30' }]
      const result = createCSV(data, ['na,me', 'a"ge'])
      expect(result).toBe('"na,me","a""ge"\nJohn,30')
    })

    it('supports CRLF line endings when specified', () => {
      const result = createCSV(people, ['name', 'age'], { lineEnding: '\r\n' })
      expect(result).toBe('name,age\r\nJohn,30\r\nJane,25\r\nBob,40')
    })

    it('coerces non-string values: number, boolean, bigint, date', () => {
      const d = new Date('2020-01-02T03:04:05.000Z')
      const data = [{ a: 1, b: false, c: 9007199254740993n, d }]
      const result = createCSV(data, ['a', 'b', 'c', 'd'])
      expect(result).toBe(`a,b,c,d\n1,false,9007199254740993,${d.toString()}`)
    })

    // Future-facing behavior (decide spec and implement):
    it.todo('throws on empty fields array (ambiguous CSV with no columns)')
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

    it.each([
      ['semicolon', ';', 'name;age\nJohn;30\nJane;25\nBob;40'],
      ['tab', '\t', 'name\tage\nJohn\t30\nJane\t25\nBob\t40'],
    ])('handles custom delimiters: %s', (_label, delimiter, csv) => {
      expect(parseCSV(csv, { delimiter })).toEqual([
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

    it('parses empty fields and zero-length quoted fields', () => {
      const csv = 'name,age,nick\nJohn,30,\n,25,""\n"","",'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30', nick: '' },
        { name: '', age: '25', nick: '' },
        { name: '', age: '', nick: '' },
      ])
    })

    it('handles values with newlines (quoted)', () => {
      const csv = `
name,bio
"John Doe","Line 1
Line 2"
Jane,"Single line"
`.trim()
      expect(parseCSV(csv)).toEqual([
        { name: 'John Doe', bio: 'Line 1\nLine 2' },
        { name: 'Jane', bio: 'Single line' },
      ])
    })

    it('handles empty input and headers-only input', () => {
      expect(parseCSV()).toEqual([])
      expect(parseCSV('')).toEqual([])
      expect(parseCSV('name,age,city')).toEqual([])
    })

    it('handles Windows line endings (CRLF) and mixed endings', () => {
      const crlf = 'name,age\r\nJohn,30\r\nJane,25'
      expect(parseCSV(crlf)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])

      const mixed = 'name,age\nJohn,30\r\nJane,25\nBob,40'
      expect(parseCSV(mixed)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
        { name: 'Bob', age: '40' },
      ])
    })

    it('skips empty rows by default', () => {
      const csv = 'name,age\nJohn,30\n\nJane,25\n\n'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])
    })

    it('trims headers and values by default; can be disabled', () => {
      const csv = ' name , age \n John , 30 \n Jane, 25'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])

      const csv2 = 'name,age\n John , 30 \n Jane, 25'
      expect(parseCSV(csv2, { trim: false })).toEqual([
        { name: ' John ', age: ' 30 ' },
        { name: ' Jane', age: ' 25' },
      ])
    })

    it('errors when row has more fields than headers (default strict)', () => {
      const csv = 'name,age\nJohn,30,Engineer'
      expect(() => parseCSV(csv)).toThrow(SyntaxError)
      expect(() => parseCSV(csv)).toThrowError('CSV row 2 has 1 extra field(s): expected 2 column(s), found 3')
    })

    it('allows extra fields when strict is false by ignoring extras (even if non-empty)', () => {
      const csv = 'name,age\nJohn,30,Engineer\nJane,25,,extra'
      expect(parseCSV(csv, { strict: false })).toEqual([
        { name: 'John', age: '30' }, // 'Engineer' ignored
        { name: 'Jane', age: '25' }, // ',extra' ignored
      ])
    })

    it.each([
      ['consecutive delimiters', 'name,age,,city\nJohn,30,,New York'],
      ['trailing delimiter', 'name,age,\nJohn,30,value'],
      ['whitespace-only header', ' ,age\nJohn,30'],
      ['BOM at start (treated as empty header if not stripped)', '\uFEFF,age\nJohn,30'],
    ])('throws error for empty header: %s', (_label, csv) => {
      expect(() => parseCSV(csv)).toThrow(SyntaxError)
      expect(() => parseCSV(csv)).toThrowError(/CSV header row contains empty column name/)
    })

    it('throws error for duplicate headers', () => {
      expect(() => parseCSV('name,name\nJohn,Doe'))
        .toThrow(SyntaxError)
      expect(() => parseCSV('name,name\nJohn,Doe'))
        .toThrowError('CSV header row contains duplicate column name(s): name')
      expect(() => parseCSV('name,age,name,age\nJohn,30,Doe,31'))
        .toThrowError('CSV header row contains duplicate column name(s): name, age')
    })

    it('handles complex nested quotes and escaping', () => {
      const csv = `
name,description
"Product A","This product has ""special"" features and ""unique"" design"
"Product B","Another ""cool"" item with multiple ""quoted"" words"
"Product C",Normal description
`.trim()
      expect(parseCSV(csv)).toEqual([
        { name: 'Product A', description: 'This product has "special" features and "unique" design' },
        { name: 'Product B', description: 'Another "cool" item with multiple "quoted" words' },
        { name: 'Product C', description: 'Normal description' },
      ])
    })

    it('preserves whitespace-only rows when trim is false', () => {
      const csv = 'name\n   '
      expect(parseCSV(csv, { trim: false })).toEqual([{ name: '   ' }])
    })

    it('supports UTF-8 characters', () => {
      const csv = 'emoji,word\n😀,café'
      expect(parseCSV(csv)).toEqual([{ emoji: '😀', word: 'café' }])
    })

    // Prefer failing malformed CSV by default; consider an option for relaxed parsing.
    it.todo('throws on mismatched/unterminated quoted fields in strict mode')
    it.todo('with relaxedQuotes: true, tolerates mismatched quotes by consuming until EOF')
  })

  // Cross-function guarantees
  describe('round-trip: createCSV -> parseCSV', () => {
    it('round-trips basic data with default options', () => {
      const fields = ['name', 'age', 'city'] as const
      const csv = createCSV(people, fields)
      const out = parseCSV(csv)
      expect(out).toEqual([
        { name: 'John', age: '30', city: 'New York' },
        { name: 'Jane', age: '25', city: 'Boston' },
        { name: 'Bob', age: '40', city: 'Chicago' },
      ])
    })

    it('round-trips with custom delimiter, quoteAll, CRLF line endings', () => {
      const fields = ['name', 'age', 'city'] as const
      const csv = createCSV(people, fields, { delimiter: '\t', quoteAll: true, lineEnding: '\r\n' })
      const out = parseCSV(csv, { delimiter: '\t' })
      expect(out).toEqual([
        { name: 'John', age: '30', city: 'New York' },
        { name: 'Jane', age: '25', city: 'Boston' },
        { name: 'Bob', age: '40', city: 'Chicago' },
      ])
    })
  })
})
