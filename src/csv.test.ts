import { describe, expect, it } from 'vitest'
import { createCSV, createCSVAsync, createCSVStream, escapeCSVValue, parseCSV, parseCSVStream } from './csv'

const people = [
  { name: 'John', age: '30', city: 'New York' },
  { name: 'Jane', age: '25', city: 'Boston' },
  { name: 'Bob', age: '40', city: 'Chicago' },
]

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterable)
    items.push(item)
  return items
}

describe('escapeCSVValue', () => {
  it('returns a plain string unchanged', () => {
    expect(escapeCSVValue('simple')).toBe('simple')
  })

  it.each([
    ['a number', 42, '42'],
    ['a boolean', true, 'true'],
    ['a bigint', 9007199254740993n, '9007199254740993'],
    // An invalid `Date` is the one date whose string form is the same in every time zone.
    ['an invalid Date', new Date(Number.NaN), 'Invalid Date'],
  ])('coerces %s to a string without quoting', (_label, value, expected) => {
    expect(escapeCSVValue(value)).toBe(expected)
  })

  it('returns an empty string for null and undefined', () => {
    expect(escapeCSVValue(null)).toBe('')
    expect(escapeCSVValue(undefined)).toBe('')
  })

  it.each([
    ['a comma delimiter', { delimiter: ',' }, 'hello, world', '"hello, world"'],
    ['a semicolon delimiter', { delimiter: ';' }, 'hello; world', '"hello; world"'],
    ['quotes', {}, 'multiple "quotes" here "too"', '"multiple ""quotes"" here ""too"""'],
    ['an LF line break', {}, 'contains\nnewline', '"contains\nnewline"'],
    ['a CR line break', {}, 'contains\rnewline', '"contains\rnewline"'],
    ['a delimiter, quotes, and a line break', {}, 'x,"y",z\nmore', '"x,""y"",z\nmore"'],
  ])('quotes a value containing %s', (_label, options, input, expected) => {
    expect(escapeCSVValue(input, options)).toBe(expected)
  })

  it('quotes every value with quoteAll', () => {
    expect(escapeCSVValue('simple', { quoteAll: true })).toBe('"simple"')
    expect(escapeCSVValue(42, { quoteAll: true })).toBe('"42"')
  })
})

describe('createCSV', () => {
  it('throws RangeError for an empty or multi-character delimiter', () => {
    expect(() => createCSV(people, ['name', 'age'], { delimiter: '' }))
      .toThrow(RangeError)
    expect(() => createCSV(people, ['name', 'age'], { delimiter: '' }))
      .toThrow('CSV delimiter must be a single character, got ""')
    expect(() => createCSV(people, ['name', 'age'], { delimiter: ',,' }))
      .toThrow('CSV delimiter must be a single character, got ",,"')
  })

  it.each(['"', '\n', '\r'])('throws RangeError for delimiter %j', (delimiter) => {
    expect(() => createCSV(people, ['name', 'age'], { delimiter }))
      .toThrow(RangeError)
    expect(() => createCSV(people, ['name', 'age'], { delimiter }))
      .toThrow(/must not be a quote or line break/)
  })

  it('throws RangeError for an empty delimiter without columns', () => {
    expect(() => createCSV([{ a: 1 }], [], { delimiter: '' })).toThrow(RangeError)
  })

  it('writes a header row by default', () => {
    const result = createCSV(people, ['name', 'age'])
    expect(result).toBe('name,age\nJohn,30\nJane,25\nBob,40')
  })

  it('omits the header row with addHeader: false', () => {
    const result = createCSV(people, ['name', 'age'], { addHeader: false })
    expect(result).toBe('John,30\nJane,25\nBob,40')
  })

  it('joins fields with delimiter \';\'', () => {
    const result = createCSV(people, ['name', 'age'], { delimiter: ';' })
    expect(result).toBe('name;age\nJohn;30\nJane;25\nBob;40')
  })

  it('quotes values containing a delimiter, quote, or line break', () => {
    const data = [
      { name: 'John, Jr.', note: 'He said "hi"' },
      { name: 'Multi\nline', note: 'CR\r\nLF' },
    ]
    const result = createCSV(data, ['name', 'note'])
    expect(result).toBe('name,note\n"John, Jr.","He said ""hi"""\n"Multi\nline","CR\r\nLF"')
  })

  it('quotes headers and values with quoteAll', () => {
    const result = createCSV(people, ['name', 'age'], { quoteAll: true })
    expect(result).toBe('"name","age"\n"John","30"\n"Jane","25"\n"Bob","40"')
  })

  it('writes only the header row for empty data', () => {
    const result = createCSV([], ['name', 'age'])
    expect(result).toBe('name,age')
  })

  it('returns an empty string for an empty column list', () => {
    expect(createCSV([{ a: 1 }], [])).toBe('')
  })

  it('writes undefined, null, empty, and missing values as empty fields', () => {
    const data = [
      { name: 'John', age: undefined },
      { name: null, age: '25' },
      { name: '', age: '40' },
      { name: 'Jane' }, // Missing `age`.
    ]
    const result = createCSV(data, ['name', 'age'])
    expect(result).toBe('name,age\nJohn,\n,25\n,40\nJane,')
  })

  it('omits properties not listed in columns', () => {
    const data = [
      { name: 'John', age: '30', city: 'NYC', extra: 'ignore-me' },
    ]
    const result = createCSV(data, ['name', 'age'])
    expect(result).toBe('name,age\nJohn,30')
  })

  it('quotes column names containing a delimiter or quote', () => {
    const data = [{ 'na,me': 'John', 'a"ge': '30' }]
    const result = createCSV(data, ['na,me', 'a"ge'])
    expect(result).toBe('"na,me","a""ge"\nJohn,30')
  })

  it('separates rows with lineEnding \'\\r\\n\'', () => {
    const result = createCSV(people, ['name', 'age'], { lineEnding: '\r\n' })
    expect(result).toBe('name,age\r\nJohn,30\r\nJane,25\r\nBob,40')
  })

  describe('column inference', () => {
    it('infers the union of keys in first-seen order', () => {
      const mixed = [
        { name: 'John', age: '30' },
        { name: 'Jane', city: 'Boston' },
        { name: 'Bob', age: '40', city: 'Chicago' },
      ]
      const result = createCSV(mixed)
      expect(result).toBe('name,age,city\nJohn,30,\nJane,,Boston\nBob,40,Chicago')
    })

    it('omits the header row with addHeader: false', () => {
      const result = createCSV(people, { addHeader: false })
      expect(result).toBe('John,30,New York\nJane,25,Boston\nBob,40,Chicago')
    })

    it('returns an empty string for empty data', () => {
      expect(createCSV([], { addHeader: true })).toBe('')
      expect(createCSV([], { addHeader: false })).toBe('')
    })

    it('returns an empty string for rows without keys', () => {
      expect(createCSV([{}])).toBe('')
    })
  })
})

describe('parseCSV', () => {
  it('throws RangeError for an empty or multi-character delimiter', () => {
    const csv = 'name,age\nJohn,30'
    expect(() => parseCSV(csv, { delimiter: '' }))
      .toThrow(RangeError)
    expect(() => parseCSV(csv, { delimiter: '' }))
      .toThrow('CSV delimiter must be a single character, got ""')
    expect(() => parseCSV(csv, { delimiter: ';;' }))
      .toThrow('CSV delimiter must be a single character, got ";;"')
  })

  it.each(['"', '\n', '\r'])('throws RangeError for delimiter %j', (delimiter) => {
    expect(() => parseCSV('name,age\nJohn,30', { delimiter }))
      .toThrow(RangeError)
    expect(() => parseCSV('name,age\nJohn,30', { delimiter }))
      .toThrow(/must not be a quote or line break/)
  })

  it('parses rows into objects keyed by the header row', () => {
    const csv = 'name,age\nJohn,30\nJane,25\nBob,40'
    expect(parseCSV(csv)).toEqual([
      { name: 'John', age: '30' },
      { name: 'Jane', age: '25' },
      { name: 'Bob', age: '40' },
    ])
  })

  it.each([
    [';', 'name;age\nJohn;30\nJane;25\nBob;40'],
    ['\t', 'name\tage\nJohn\t30\nJane\t25\nBob\t40'],
  ])('splits fields on delimiter %j', (delimiter, csv) => {
    expect(parseCSV(csv, { delimiter })).toEqual([
      { name: 'John', age: '30' },
      { name: 'Jane', age: '25' },
      { name: 'Bob', age: '40' },
    ])
  })

  it('keeps non-ASCII characters in unquoted values', () => {
    expect(parseCSV('emoji,word\n😀,café')).toEqual([{ emoji: '😀', word: 'café' }])
  })

  it('parses a quoted value containing a delimiter', () => {
    const csv = 'name,city\n"Doe, John",New York\nJane,"Boston, MA"'
    expect(parseCSV(csv)).toEqual([
      { name: 'Doe, John', city: 'New York' },
      { name: 'Jane', city: 'Boston, MA' },
    ])
  })

  it('parses a quoted value containing an escaped quote', () => {
    const csv = 'name,quote\n"John ""Johnny"" Doe","He said ""Hello"""'
    expect(parseCSV(csv)).toEqual([
      { name: 'John "Johnny" Doe', quote: 'He said "Hello"' },
    ])
  })

  it('keeps quotes inside unquoted fields as literal characters', () => {
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

  it('ignores whitespace between a closing quote and the following line break', () => {
    const csv = 'name,note\na,"one" \nb,"two"\t\t\nc,"three"'
    expect(parseCSV(csv)).toEqual([
      { name: 'a', note: 'one' },
      { name: 'b', note: 'two' },
      { name: 'c', note: 'three' },
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

  it.each(['\n', '\r', '\r\n'])('keeps line break %j inside a quoted value', (lineBreak) => {
    const csv = `name,bio\n"John","line1${lineBreak}line2"\nJane,"Single line"`
    expect(parseCSV(csv)).toEqual([
      { name: 'John', bio: `line1${lineBreak}line2` },
      { name: 'Jane', bio: 'Single line' },
    ])
  })

  it.each([
    ['no input', undefined],
    ['an empty string', ''],
    ['a header row alone', 'name,age,city'],
    ['a header row with a trailing LF', 'name,age,city\n'],
    ['a header row with a trailing CRLF', 'name,age,city\r\n'],
  ])('returns an empty array for %s', (_label, csv) => {
    expect(parseCSV(csv)).toEqual([])
  })

  it.each([
    ['CRLF', 'name,age\r\nJohn,30\r\nJane,25'],
    ['CR', 'name,age\rJohn,30\rJane,25'],
    ['mixed LF and CRLF', 'name,age\nJohn,30\r\nJane,25'],
  ])('splits rows on %s line endings', (_label, csv) => {
    expect(parseCSV(csv)).toEqual([
      { name: 'John', age: '30' },
      { name: 'Jane', age: '25' },
    ])
  })

  it('reports row 3 for an extra field after CRLF line endings', () => {
    expect(() => parseCSV('a,b\r\n1,2\r\n3,4,5')).toThrow('CSV row 3 has 1 extra field(s)')
  })

  it('skips empty rows', () => {
    const csv = 'name,age\nJohn,30\n\nJane,25\n\n'
    expect(parseCSV(csv)).toEqual([
      { name: 'John', age: '30' },
      { name: 'Jane', age: '25' },
    ])
  })

  it('preserves whitespace around unquoted values by default', () => {
    const csv = 'name,age\n John , 30 \n Jane, 25'
    expect(parseCSV(csv)).toEqual([
      { name: ' John ', age: ' 30 ' },
      { name: ' Jane', age: ' 25' },
    ])
  })

  it('trims unquoted headers and values with trim', () => {
    const csv = ' name , age \n John , 30 \n Jane, 25'
    expect(parseCSV(csv, { trim: true })).toEqual([
      { name: 'John', age: '30' },
      { name: 'Jane', age: '25' },
    ])
  })

  it('never trims quoted values with trim', () => {
    const csv = 'name,note\n" John ","  keep  "'
    expect(parseCSV(csv, { trim: true })).toEqual([
      { name: ' John ', note: '  keep  ' },
    ])
  })

  it('throws SyntaxError for a row with extra fields', () => {
    const csv = 'name,age\nJohn,30,Engineer'
    expect(() => parseCSV(csv)).toThrow(SyntaxError)
    expect(() => parseCSV(csv)).toThrow('CSV row 2 has 1 extra field(s): expected 2 column(s), found 3')
  })

  it('throws SyntaxError for a row with missing fields', () => {
    const csv = 'name,age,city\nJohn,30\nJane,25,Boston'
    expect(() => parseCSV(csv)).toThrow(SyntaxError)
    expect(() => parseCSV(csv)).toThrow('CSV row 2 has 1 missing field(s): expected 3 column(s), found 2')
  })

  it('ignores a trailing delimiter in a data row', () => {
    expect(parseCSV('name,age\nJohn,30,')).toEqual([
      { name: 'John', age: '30' },
    ])
  })

  it('drops extra fields under strict: false', () => {
    const csv = 'name,age\nJohn,30,Engineer\nJane,25,,extra'
    expect(parseCSV(csv, { strict: false })).toEqual([
      { name: 'John', age: '30' },
      { name: 'Jane', age: '25' },
    ])
  })

  it('fills missing fields with empty strings under strict: false', () => {
    const csv = 'name,age,city\nJohn,30\nJane,25,Boston'
    expect(parseCSV(csv, { strict: false })).toEqual([
      { name: 'John', age: '30', city: '' },
      { name: 'Jane', age: '25', city: 'Boston' },
    ])
  })

  it.each([
    ['consecutive delimiters', 'name,age,,city\nJohn,30,,New York'],
    ['a trailing delimiter', 'name,age,\nJohn,30,value'],
    ['a delimiter after a byte order mark', '\uFEFF,age\nJohn,30'],
  ])('throws SyntaxError for an empty column name from %s', (_label, csv) => {
    expect(() => parseCSV(csv)).toThrow(SyntaxError)
    expect(() => parseCSV(csv)).toThrow(/CSV header row contains empty column name/)
  })

  it('throws SyntaxError for a whitespace-only column name with trim', () => {
    expect(() => parseCSV(' ,age\nJohn,30', { trim: true }))
      .toThrow(SyntaxError)
    expect(() => parseCSV(' ,age\nJohn,30', { trim: true }))
      .toThrow(/CSV header row contains empty column name/)
  })

  it('keeps a whitespace-only column name by default', () => {
    expect(parseCSV(' ,age\nJohn,30')).toEqual([
      { ' ': 'John', 'age': '30' },
    ])
  })

  it('strips a leading byte order mark', () => {
    const csv = '\uFEFFname,age\nJohn,30'
    expect(parseCSV(csv)).toEqual([
      { name: 'John', age: '30' },
    ])
  })

  it('throws SyntaxError for duplicate column names', () => {
    expect(() => parseCSV('name,name\nJohn,Doe'))
      .toThrow(SyntaxError)
    expect(() => parseCSV('name,name\nJohn,Doe'))
      .toThrow('CSV header row contains duplicate column name(s): name')
    expect(() => parseCSV('name,age,name,age\nJohn,30,Doe,31'))
      .toThrow('CSV header row contains duplicate column name(s): name, age')
  })

  it('keeps a whitespace-only row by default', () => {
    const csv = 'name\n   '
    expect(parseCSV(csv)).toEqual([{ name: '   ' }])
  })

  it('skips whitespace-only rows with trim', () => {
    const csv = 'name\n   '
    expect(parseCSV(csv, { trim: true })).toEqual([])
  })

  it.each([
    ['the first column', 'name,age\n"John,30'],
    ['the last column', 'name,age\nJohn,"30'],
    ['a column whose closing quote is escaped', 'name,age\n"John"",30'],
  ])('throws SyntaxError for an unterminated quoted field in %s', (_label, csv) => {
    expect(() => parseCSV(csv)).toThrow(SyntaxError)
    expect(() => parseCSV(csv)).toThrow('CSV contains unterminated quoted field at row 2')
  })
})

describe('createCSVStream', () => {
  it('yields the header and every row followed by a line ending', async () => {
    const chunks = await collect(createCSVStream(people, ['name', 'age', 'city']))
    expect(chunks.join('')).toBe('name,age,city\nJohn,30,New York\nJane,25,Boston\nBob,40,Chicago\n')
  })

  it('writes rows from an async iterable', async () => {
    async function* generateData() {
      yield* people
    }

    const chunks = await collect(createCSVStream(generateData(), ['name', 'age']))
    expect(chunks.join('')).toBe('name,age\nJohn,30\nJane,25\nBob,40\n')
  })

  it('writes quoted rows joined by delimiter \';\' without a header row', async () => {
    const chunks = await collect(createCSVStream(people, ['name', 'age'], {
      delimiter: ';',
      quoteAll: true,
      addHeader: false,
    }))
    expect(chunks.join('')).toBe('"John";"30"\n"Jane";"25"\n"Bob";"40"\n')
  })
})

describe('createCSVAsync', () => {
  it('returns the CSV with a trailing line ending', async () => {
    const csv = await createCSVAsync(people, ['name', 'age'])
    expect(csv).toBe('name,age\nJohn,30\nJane,25\nBob,40\n')
  })

  it('writes rows from an async iterable', async () => {
    async function* generateData() {
      yield* people
    }

    const csv = await createCSVAsync(generateData(), ['name', 'age'])
    expect(csv).toBe('name,age\nJohn,30\nJane,25\nBob,40\n')
  })
})

describe('parseCSVStream', () => {
  it('joins a field split across chunks', async () => {
    const chunks = ['name,age\nJo', 'hn,30\nJane,25\nB', 'ob,40']
    expect(await collect(parseCSVStream(chunks))).toEqual([
      { name: 'John', age: '30' },
      { name: 'Jane', age: '25' },
      { name: 'Bob', age: '40' },
    ])
  })

  it('keeps a line break in a quoted field split across chunks', async () => {
    const chunks = ['name,bio\n"John","Line 1\nLi', 'ne 2"\n"Jane","Single line"']
    expect(await collect(parseCSVStream(chunks))).toEqual([
      { name: 'John', bio: 'Line 1\nLine 2' },
      { name: 'Jane', bio: 'Single line' },
    ])
  })

  it('unescapes a quote pair split across chunks', async () => {
    const chunks = ['a\n"x"', '"y"']
    expect(await collect(parseCSVStream(chunks))).toEqual([{ a: 'x"y' }])
  })

  it('yields the same rows at every chunk split point', async () => {
    const csv = 'name,note\r\n"John ""JJ""","line1\nline2"\r\nJane, plain '

    for (let splitIndex = 1; splitIndex < csv.length; splitIndex++) {
      const chunks = [csv.slice(0, splitIndex), csv.slice(splitIndex)]
      expect(await collect(parseCSVStream(chunks))).toEqual([
        { name: 'John "JJ"', note: 'line1\nline2' },
        { name: 'Jane', note: ' plain ' },
      ])
    }
  })

  it('strips a leading byte order mark from the first chunk', async () => {
    const chunks = ['\uFEFFname,age\nJo', 'hn,30']
    expect(await collect(parseCSVStream(chunks))).toEqual([{ name: 'John', age: '30' }])
  })

  it('reports row 3 for an extra field after CRLF pairs split across chunks', async () => {
    const chunks = ['a,b\r', '\n1,2\r', '\n3,4,5']
    await expect(collect(parseCSVStream(chunks))).rejects.toThrow(SyntaxError)
    await expect(collect(parseCSVStream(chunks))).rejects.toThrow('CSV row 3 has 1 extra field(s)')
  })

  it('parses rows from an async iterable', async () => {
    async function* generateChunks() {
      yield 'name,age\n'
      yield 'John,30\n'
      yield 'Jane,25'
    }

    expect(await collect(parseCSVStream(generateChunks()))).toEqual([
      { name: 'John', age: '30' },
      { name: 'Jane', age: '25' },
    ])
  })

  it('splits fields on delimiter \';\'', async () => {
    const chunks = ['name;age\nJohn;30\nJane;25']
    expect(await collect(parseCSVStream(chunks, { delimiter: ';' }))).toEqual([
      { name: 'John', age: '30' },
      { name: 'Jane', age: '25' },
    ])
  })
})

describe('round-trip', () => {
  it('round-trips with a tab delimiter, quoteAll, and lineEnding \'\\r\\n\'', () => {
    const csv = createCSV(people, ['name', 'age', 'city'], { delimiter: '\t', quoteAll: true, lineEnding: '\r\n' })
    expect(parseCSV(csv, { delimiter: '\t' })).toEqual(people)
  })

  it('round-trips fields containing commas, quotes, and line breaks', () => {
    const data = [
      { name: 'John "Johnny" Doe', note: 'Line 1\nLine 2, with comma' },
      { name: 'Jane', note: 'He said "Hi"' },
    ]
    expect(parseCSV(createCSV(data, ['name', 'note']))).toEqual(data)
  })

  it('round-trips values with leading and trailing whitespace', () => {
    const data = [{ value: '  padded  ' }]
    expect(parseCSV(createCSV(data, ['value']))).toEqual(data)
  })

  it('round-trips quoted fields from createCSVStream through parseCSVStream split into three chunks', async () => {
    const data = [
      { name: 'John "Johnny" Doe', note: 'Line 1\nLine 2, with comma' },
      { name: 'Jane', note: 'He said "Hi"' },
    ]
    const csv = (await collect(createCSVStream(data, ['name', 'note']))).join('')
    const chunks = [csv.slice(0, 15), csv.slice(15, 40), csv.slice(40)]
    expect(await collect(parseCSVStream(chunks))).toEqual(data)
  })
})
