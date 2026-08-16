import { describe, expect, it } from 'vitest';
import { getCellText, serializeRows } from '../src/utils/serialize';
import type { Column } from '../src/types';

describe('getCellText', () => {
  it('renders primitives', () => {
    const column: Column = { field: 'v' };
    expect(getCellText(column, { v: 'hello' })).toBe('hello');
    expect(getCellText(column, { v: 0 })).toBe('0');
    expect(getCellText(column, { v: false })).toBe('false');
    expect(getCellText(column, { v: null })).toBe('');
    expect(getCellText(column, { v: undefined })).toBe('');
  });

  it('renders dates as ISO strings', () => {
    const column: Column = { field: 'v' };
    const date = new Date('2024-01-15T00:00:00.000Z');
    expect(getCellText(column, { v: date })).toBe('2024-01-15T00:00:00.000Z');
  });

  it('uses the column formatter when present', () => {
    const column: Column = {
      field: 'price',
      formatter: (value) => `$${String(value)}`,
    };
    expect(getCellText(column, { price: 100 })).toBe('$100');
  });
});

describe('serializeRows', () => {
  const columns: Column[] = [
    { field: 'name', title: 'Name' },
    { field: 'qty', title: 'Qty', type: 'number' },
  ];

  it('text format uses tabs and a header row', () => {
    const text = serializeRows(columns, [{ name: 'A', qty: 1 }], 'text');
    expect(text).toBe('Name\tQty\nA\t1');
  });

  it('json format is pretty-printed raw data', () => {
    const json = serializeRows(columns, [{ name: 'A', qty: 1 }], 'json');
    expect(JSON.parse(json)).toEqual([{ name: 'A', qty: 1 }]);
    expect(json).toContain('\n');
  });

  it('csv format quotes delimiters, quotes and line breaks', () => {
    const csv = serializeRows(
      columns,
      [
        { name: 'a,b', qty: 1 },
        { name: 'c"d', qty: 2 },
        { name: 'e\nf', qty: 3 },
      ],
      'csv'
    );
    expect(csv).toBe('Name,Qty\r\n"a,b",1\r\n"c""d",2\r\n"e\nf",3');
  });

  it('skips hidden columns', () => {
    const hidden = [{ field: 'a' }, { field: 'b', visible: false }] as Column[];
    expect(serializeRows(hidden, [{ a: 'x', b: 'y' }], 'text')).toBe('a\nx');
  });
});
