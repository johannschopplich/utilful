import type { CSVRow } from './csv'
import { describe, expect, it } from 'vitest'
import { createCSV, createCSVAsync, createCSVStream, escapeCSVValue, parseCSV, parseCSVStream } from './csv'

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
      expect(escapeCSVValue(9007199254740993n)).toBe('9007199254740993')
      const date = new Date('2020-01-02T03:04:05.000Z')
      expect(escapeCSVValue(date)).toBe(date.toString())
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
    it('throws error for invalid delimiter (not single character)', () => {
      expect(() => createCSV(people, ['name', 'age'], { delimiter: '' }))
        .toThrow(RangeError)
      expect(() => createCSV(people, ['name', 'age'], { delimiter: '' }))
        .toThrow('CSV delimiter must be a single character, got ""')
      expect(() => createCSV(people, ['name', 'age'], { delimiter: ',,' }))
        .toThrow('CSV delimiter must be a single character, got ",,"')
    })

    it.each([
      ['double quote', '"'],
      ['newline', '\n'],
      ['carriage return', '\r'],
    ])('throws error for reserved delimiter: %s', (_label, delimiter) => {
      expect(() => createCSV(people, ['name', 'age'], { delimiter }))
        .toThrow(RangeError)
      expect(() => createCSV(people, ['name', 'age'], { delimiter }))
        .toThrow(/must not be a quote or line break/)
    })

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

    it('escapes values requiring quoting via escapeCSVValue', () => {
      const data = [
        { name: 'John, Jr.', note: 'He said "hi"' },
        { name: 'Multi\nline', note: 'CR\r\nLF' },
      ]
      const result = createCSV(data, ['name', 'note'])
      expect(result).toBe('name,note\n"John, Jr.","He said ""hi"""\n"Multi\nline","CR\r\nLF"')
    })

    it('quotes all values when specified', () => {
      const result = createCSV(people, ['name', 'age'], { quoteAll: true })
      expect(result).toBe('"name","age"\n"John","30"\n"Jane","25"\n"Bob","40"')
    })

    it('outputs header only for empty data array', () => {
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

    it('ignores extra properties not listed in columns', () => {
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

    describe('column inference (when columns not specified)', () => {
      it('infers union of keys in first-seen order', () => {
        const mixed = [
          { name: 'John', age: '30' }, // Introduces name, age
          { name: 'Jane', city: 'Boston' }, // Introduces city
          { name: 'Bob', age: '40', city: 'Chicago' },
        ]
        const result = createCSV(mixed)
        expect(result).toBe('name,age,city\nJohn,30,\nJane,,Boston\nBob,40,Chicago')
      })

      it('accepts options', () => {
        const result = createCSV(people, { addHeader: false })
        expect(result).toBe('John,30,New York\nJane,25,Boston\nBob,40,Chicago')
      })

      it('returns empty string for empty data', () => {
        expect(createCSV([], { addHeader: true })).toBe('')
        expect(createCSV([], { addHeader: false })).toBe('')
      })
    })
  })

  describe('parseCSV', () => {
    it('throws error for invalid delimiter (not single character)', () => {
      const csv = 'name,age\nJohn,30'
      expect(() => parseCSV(csv, { delimiter: '' }))
        .toThrow(RangeError)
      expect(() => parseCSV(csv, { delimiter: '' }))
        .toThrow('CSV delimiter must be a single character, got ""')
      expect(() => parseCSV(csv, { delimiter: ';;' }))
        .toThrow('CSV delimiter must be a single character, got ";;"')
    })

    it.each([
      ['double quote', '"'],
      ['newline', '\n'],
      ['carriage return', '\r'],
    ])('throws error for reserved delimiter: %s', (_label, delimiter) => {
      expect(() => parseCSV('name,age\nJohn,30', { delimiter }))
        .toThrow(RangeError)
      expect(() => parseCSV('name,age\nJohn,30', { delimiter }))
        .toThrow(/must not be a quote or line break/)
    })

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

    it('treats quotes inside unquoted fields as literal characters', () => {
      const csv = 'name,remark\nJohn,He said "hello"\nJane,B" level'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', remark: 'He said "hello"' },
        { name: 'Jane', remark: 'B" level' },
      ])
    })

    it('ignores whitespace between a closing quote and the following delimiter', () => {
      const csv = 'a,b,c\r\n1,"two" ,3\r\n4,"five"  ,6'
      expect(parseCSV(csv)).toEqual([
        { a: '1', b: 'two', c: '3' },
        { a: '4', b: 'five', c: '6' },
      ])
    })

    it('ignores whitespace between a closing quote and the following newline', () => {
      const csv = `
name,notes
a,"line1
"
b,"line2"
`.trim()
      expect(parseCSV(csv)).toEqual([
        { name: 'a', notes: 'line1\n' },
        { name: 'b', notes: 'line2' },
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

    it('handles values with newlines', () => {
      const csv = `
name,bio
"John Doe","Line 1
Line 2"
Jane,"Single line"
`
      expect(parseCSV(csv.trim())).toEqual([
        { name: 'John Doe', bio: 'Line 1\nLine 2' },
        { name: 'Jane', bio: 'Single line' },
      ])
    })

    it('handles CR and CRLF newlines inside quoted values', () => {
      const csv = 'name,bio\r\n"John","line1\rline2"\r\n"Jane","line1\r\nline2"'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', bio: 'line1\rline2' },
        { name: 'Jane', bio: 'line1\r\nline2' },
      ])
    })

    it('handles empty input and headers-only input', () => {
      expect(parseCSV()).toEqual([])
      expect(parseCSV('')).toEqual([])
      expect(parseCSV('name,age,city')).toEqual([])
    })

    it('handles headers-only input with a trailing newline', () => {
      expect(parseCSV('name,age,city\n')).toEqual([])
      expect(parseCSV('name,age,city\r\n')).toEqual([])
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

    it('handles CR-only line endings (\\r)', () => {
      const csv = 'name,age\rJohn,30\rJane,25'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])
    })

    it('skips empty rows by default', () => {
      const csv = 'name,age\nJohn,30\n\nJane,25\n\n'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])
    })

    it('preserves whitespace by default; trim option trims unquoted headers and values', () => {
      const csv = 'name,age\n John , 30 \n Jane, 25'
      expect(parseCSV(csv)).toEqual([
        { name: ' John ', age: ' 30 ' },
        { name: ' Jane', age: ' 25' },
      ])

      const csv2 = ' name , age \n John , 30 \n Jane, 25'
      expect(parseCSV(csv2, { trim: true })).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])
    })

    it('never trims quoted values, even with trim enabled', () => {
      const csv = 'name,note\n" John ","  keep  "'
      expect(parseCSV(csv, { trim: true })).toEqual([
        { name: ' John ', note: '  keep  ' },
      ])
    })

    it('throws error when row has more fields than headers (default strict)', () => {
      const csv = 'name,age\nJohn,30,Engineer'
      expect(() => parseCSV(csv)).toThrow(SyntaxError)
      expect(() => parseCSV(csv)).toThrow('CSV row 2 has 1 extra field(s): expected 2 column(s), found 3')
    })

    it('throws error when row has fewer fields than headers (default strict)', () => {
      const csv = 'name,age,city\nJohn,30\nJane,25,Boston'
      expect(() => parseCSV(csv)).toThrow(SyntaxError)
      expect(() => parseCSV(csv)).toThrow('CSV row 2 has 1 missing field(s): expected 3 column(s), found 2')
    })

    it('tolerates empty overflow fields in strict mode (trailing delimiter)', () => {
      expect(parseCSV('name,age\nJohn,30,')).toEqual([
        { name: 'John', age: '30' },
      ])
    })

    it('allows extra fields when strict is false by ignoring extras (even if non-empty)', () => {
      const csv = 'name,age\nJohn,30,Engineer\nJane,25,,extra'
      expect(parseCSV(csv, { strict: false })).toEqual([
        { name: 'John', age: '30' }, // 'Engineer' ignored
        { name: 'Jane', age: '25' }, // ',extra' ignored
      ])
    })

    it('fills missing trailing fields as empty strings when strict is false', () => {
      const csv = 'name,age,city\nJohn,30\nJane,25,Boston'
      expect(parseCSV(csv, { strict: false })).toEqual([
        { name: 'John', age: '30', city: '' },
        { name: 'Jane', age: '25', city: 'Boston' },
      ])
    })

    it.each([
      ['consecutive delimiters', 'name,age,,city\nJohn,30,,New York'],
      ['trailing delimiter', 'name,age,\nJohn,30,value'],
      ['BOM followed by empty header', '\uFEFF,age\nJohn,30'],
    ])('throws error for empty header: %s', (_label, csv) => {
      expect(() => parseCSV(csv)).toThrow(SyntaxError)
      expect(() => parseCSV(csv)).toThrow(/CSV header row contains empty column name/)
    })

    it('throws error for whitespace-only header when trim is enabled', () => {
      expect(() => parseCSV(' ,age\nJohn,30', { trim: true }))
        .toThrow(/CSV header row contains empty column name/)
    })

    it('treats whitespace-only header as a column name by default', () => {
      expect(parseCSV(' ,age\nJohn,30')).toEqual([
        { ' ': 'John', 'age': '30' },
      ])
    })

    it('strips UTF-8 BOM at the start of input', () => {
      const csv = '\uFEFFname,age\nJohn,30'
      expect(parseCSV(csv)).toEqual([
        { name: 'John', age: '30' },
      ])
    })

    it('throws error for duplicate headers', () => {
      expect(() => parseCSV('name,name\nJohn,Doe'))
        .toThrow(SyntaxError)
      expect(() => parseCSV('name,name\nJohn,Doe'))
        .toThrow('CSV header row contains duplicate column name(s): name')
      expect(() => parseCSV('name,age,name,age\nJohn,30,Doe,31'))
        .toThrow('CSV header row contains duplicate column name(s): name, age')
    })

    it('handles complex nested quotes and escaping', () => {
      const csv = `
name,description
"Product A","This product has ""special"" features and ""unique"" design"
"Product B","Another ""cool"" item with multiple ""quoted"" words"
"Product C",Normal description
`
      expect(parseCSV(csv.trim())).toEqual([
        { name: 'Product A', description: 'This product has "special" features and "unique" design' },
        { name: 'Product B', description: 'Another "cool" item with multiple "quoted" words' },
        { name: 'Product C', description: 'Normal description' },
      ])
    })

    it('preserves whitespace-only rows by default', () => {
      const csv = 'name\n   '
      expect(parseCSV(csv)).toEqual([{ name: '   ' }])
    })

    it('skips whitespace-only rows when trim is enabled', () => {
      const csv = 'name\n   '
      expect(parseCSV(csv, { trim: true })).toEqual([])
    })

    it('supports UTF-8 characters', () => {
      const csv = 'emoji,word\n😀,café'
      expect(parseCSV(csv)).toEqual([{ emoji: '😀', word: 'café' }])
    })

    it('throws error for unterminated quoted field', () => {
      const csv = 'name,age\n"John,30'
      expect(() => parseCSV(csv)).toThrow(SyntaxError)
      expect(() => parseCSV(csv)).toThrow('CSV contains unterminated quoted field at row 2')
    })

    it('throws error for mismatched quotes in field', () => {
      const csv = 'name,age\nJohn,"30'
      expect(() => parseCSV(csv)).toThrow(SyntaxError)
      expect(() => parseCSV(csv)).toThrow('CSV contains unterminated quoted field at row 2')

      const csv2 = 'name,age\n"John"",30'
      expect(() => parseCSV(csv2)).toThrow(SyntaxError)
      expect(() => parseCSV(csv2)).toThrow('CSV contains unterminated quoted field at row 2')
    })
  })

  // Cross-function guarantees
  describe('round-trip: createCSV → parseCSV', () => {
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

    it('round-trips when columns are inferred', () => {
      const csv = createCSV(people) // Infer: name,age,city
      const out = parseCSV(csv)
      expect(out).toEqual([
        { name: 'John', age: '30', city: 'New York' },
        { name: 'Jane', age: '25', city: 'Boston' },
        { name: 'Bob', age: '40', city: 'Chicago' },
      ])
    })

    it('round-trips fields containing commas, quotes, and newlines', () => {
      const data = [
        { name: 'John "Johnny" Doe', note: 'Line 1\nLine 2, with comma' },
        { name: 'Jane', note: 'He said "Hi"' },
      ]
      const csv = createCSV(data, ['name', 'note'])
      const out = parseCSV(csv)
      expect(out).toEqual(data)
    })

    it('round-trips values with leading and trailing whitespace', () => {
      const data = [{ value: '  padded  ' }]
      expect(parseCSV(createCSV(data, ['value']))).toEqual(data)
    })
  })

  describe('createCSVStream', () => {
    it('creates CSV matching synchronous createCSV for simple data', async () => {
      const csvSync = createCSV(people, ['name', 'age', 'city'])

      let csvStreamed = ''
      for await (const chunk of createCSVStream(people, ['name', 'age', 'city'])) {
        csvStreamed += chunk
      }

      // Streaming version has trailing newline, so add one to sync version
      expect(csvStreamed).toBe(`${csvSync}\n`)
    })

    it('handles async iterables', async () => {
      async function* generateData() {
        for (const person of people) {
          yield person
        }
      }

      let csvStreamed = ''
      for await (const chunk of createCSVStream(generateData(), ['name', 'age'])) {
        csvStreamed += chunk
      }

      expect(csvStreamed).toBe('name,age\nJohn,30\nJane,25\nBob,40\n')
    })

    it('supports custom delimiters and options', async () => {
      let csvStreamed = ''
      for await (const chunk of createCSVStream(people, ['name', 'age'], {
        delimiter: ';',
        quoteAll: true,
        addHeader: false,
      })) {
        csvStreamed += chunk
      }

      expect(csvStreamed).toBe('"John";"30"\n"Jane";"25"\n"Bob";"40"\n')
    })

    it('properly escapes values containing special characters', async () => {
      const data = [
        { name: 'John "Johnny" Doe', note: 'Line 1\nLine 2' },
        { name: 'Jane', note: 'Normal' },
      ]

      let csvStreamed = ''
      for await (const chunk of createCSVStream(data, ['name', 'note'])) {
        csvStreamed += chunk
      }

      const expected = `${createCSV(data, ['name', 'note'])}\n`
      expect(csvStreamed).toBe(expected)
    })
  })

  describe('createCSVAsync', () => {
    it('collects stream into single string', async () => {
      const csv = await createCSVAsync(people, ['name', 'age', 'city'])
      const expected = `${createCSV(people, ['name', 'age', 'city'])}\n`
      expect(csv).toBe(expected)
    })

    it('works with async iterables', async () => {
      async function* generateData() {
        yield { name: 'John', age: '30' }
        yield { name: 'Jane', age: '25' }
      }

      const csv = await createCSVAsync(generateData(), ['name', 'age'])
      expect(csv).toBe('name,age\nJohn,30\nJane,25\n')
    })
  })

  describe('parseCSVStream', () => {
    it('parses CSV matching synchronous parseCSV for single chunk', async () => {
      const csv = 'name,age\nJohn,30\nJane,25\nBob,40'
      const expected = parseCSV(csv)

      const out: typeof expected = []
      for await (const row of parseCSVStream<'name' | 'age'>([csv])) {
        out.push(row)
      }

      expect(out).toEqual(expected)
    })

    it('handles multi-chunk input with arbitrary boundaries', async () => {
      const csv = 'name,age\nJohn,30\nJane,25\nBob,40'
      const chunks = ['name,age\nJo', 'hn,30\nJane,25\nB', 'ob,40']

      const expected = parseCSV(csv)

      const out: typeof expected = []
      for await (const row of parseCSVStream<'name' | 'age'>(chunks)) {
        out.push(row)
      }

      expect(out).toEqual(expected)
    })

    it('handles chunk boundaries inside quoted fields', async () => {
      const csv = 'name,bio\n"John","Line 1\nLine 2"\n"Jane","Single line"'
      // Split in the middle of the quoted field with newline
      const chunks = ['name,bio\n"John","Line 1\nLi', 'ne 2"\n"Jane","Single line"']

      const expected = parseCSV(csv)

      const out: typeof expected = []
      for await (const row of parseCSVStream<'name' | 'bio'>(chunks)) {
        out.push(row)
      }

      expect(out).toEqual(expected)
    })

    it('handles chunk boundaries around CRLF pairs', async () => {
      const csv = 'name,age\r\nJohn,30\r\nJane,25'
      // Split between CR and LF
      const chunks = ['name,age\r', '\nJohn,30\r\nJane,25']

      const expected = parseCSV(csv)

      const out: typeof expected = []
      for await (const row of parseCSVStream<'name' | 'age'>(chunks)) {
        out.push(row)
      }

      expect(out).toEqual(expected)
    })

    it('handles chunk boundaries splitting an escaped quote pair', async () => {
      // Boundary between the two quotes of the escaped `""` pair
      const chunks = ['a\n"x"', '"y"']

      const out: CSVRow<'a'>[] = []
      for await (const row of parseCSVStream<'a'>(chunks)) {
        out.push(row)
      }

      expect(out).toEqual([{ a: 'x"y' }])
    })

    it('parses identically for every possible chunk split point', async () => {
      const csv = 'name,note\r\n"John ""JJ""","line1\nline2"\r\nJane, plain '
      const expected = parseCSV(csv)

      for (let splitIndex = 1; splitIndex < csv.length; splitIndex++) {
        const chunks = [csv.slice(0, splitIndex), csv.slice(splitIndex)]

        const out: typeof expected = []
        for await (const row of parseCSVStream(chunks)) {
          out.push(row)
        }

        expect(out).toEqual(expected)
      }
    })

    it('strips UTF-8 BOM at the start of the first chunk', async () => {
      const chunks = ['﻿name,age\nJo', 'hn,30']

      const out: CSVRow<'name' | 'age'>[] = []
      for await (const row of parseCSVStream<'name' | 'age'>(chunks)) {
        out.push(row)
      }

      expect(out).toEqual([{ name: 'John', age: '30' }])
    })

    it('reports correct row numbers for errors after chunk-split CRLF pairs', async () => {
      const chunks = ['a,b\r', '\n1,2\r', '\n3,4,5']

      const parseAll = async () => {
        const rows: CSVRow[] = []
        for await (const row of parseCSVStream(chunks)) {
          rows.push(row)
        }
        return rows
      }

      await expect(parseAll()).rejects.toThrow('CSV row 3 has 1 extra field(s)')
    })

    it('works with async iterables', async () => {
      async function* generateChunks() {
        yield 'name,age\n'
        yield 'John,30\n'
        yield 'Jane,25'
      }

      const out: { name: string, age: string }[] = []
      for await (const row of parseCSVStream<'name' | 'age'>(generateChunks())) {
        out.push(row)
      }

      expect(out).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])
    })

    it('supports custom delimiters and options', async () => {
      const csv = 'name;age\nJohn;30\nJane;25'
      const chunks = [csv]

      const out: { name: string, age: string }[] = []
      for await (const row of parseCSVStream<'name' | 'age'>(chunks, { delimiter: ';' })) {
        out.push(row)
      }

      expect(out).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ])
    })

    it('propagates errors from CSVParserCore', async () => {
      const csv = 'name,age\nJohn,30,extra'
      const chunks = [csv]

      const parseStream = async () => {
        const out: { name: string, age: string }[] = []
        for await (const row of parseCSVStream<'name' | 'age'>(chunks)) {
          out.push(row)
        }
        return out
      }

      await expect(parseStream()).rejects.toThrow(SyntaxError)
      await expect(parseStream()).rejects.toThrow('CSV row 2 has 1 extra field(s)')
    })
  })

  describe('round-trip: streaming encoder/parser', () => {
    it('createCSVStream → parseCSVStream round-trips correctly', async () => {
      const data = [
        { name: 'John', age: '30', city: 'New York' },
        { name: 'Jane', age: '25', city: 'Boston' },
        { name: 'Bob', age: '40', city: 'Chicago' },
      ]

      const chunks: string[] = []
      for await (const chunk of createCSVStream(data, ['name', 'age', 'city'])) {
        chunks.push(chunk)
      }

      const out: typeof data = []
      for await (const row of parseCSVStream<'name' | 'age' | 'city'>(chunks)) {
        out.push(row)
      }

      expect(out).toEqual(data)
    })

    it('round-trips with special characters and arbitrary chunk boundaries', async () => {
      const data = [
        { name: 'John "Johnny" Doe', note: 'Line 1\nLine 2, with comma' },
        { name: 'Jane', note: 'He said "Hi"' },
      ]

      // Collect from stream
      let csvFull = ''
      for await (const chunk of createCSVStream(data, ['name', 'note'])) {
        csvFull += chunk
      }

      // Split at arbitrary positions
      const chunks = [
        csvFull.slice(0, 15),
        csvFull.slice(15, 40),
        csvFull.slice(40),
      ]

      const out: typeof data = []
      for await (const row of parseCSVStream<'name' | 'note'>(chunks)) {
        out.push(row)
      }

      expect(out).toEqual(data)
    })
  })
})
