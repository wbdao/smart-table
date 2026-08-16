import { describe, expect, it } from 'vitest';
import { DataManager } from '../src/core/DataManager';
import { SmartTableError, ERROR_CODES } from '../src/core/errors';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'inStock', title: 'In Stock', type: 'boolean' },
  { field: 'released', title: 'Released', type: 'date' },
];

const rows = [
  { id: 1, name: 'Laptop', price: 1200, inStock: true, released: new Date('2024-01-15') },
  { id: 2, name: 'Mouse', price: 25, inStock: false, released: '2023-06-01' },
  { id: 3, name: 'Monitor', price: 300, inStock: true, released: 1700000000000 },
  { id: 4, name: 'keyboard', price: 80, inStock: true, released: new Date('2022-11-20') },
];

describe('DataManager — columns', () => {
  it('normalizes column defaults', () => {
    const dm = new DataManager([{ field: 'x' }]);
    expect(dm.getColumn('x')).toEqual({
      field: 'x',
      title: 'x',
      type: 'string',
      sortable: true,
      filterable: true,
      editable: true,
      visible: true,
      align: 'left',
      minWidth: 60,
    });
  });

  it('preserves explicitly provided column options', () => {
    const dm = new DataManager([
      { field: 'x', title: 'X!', type: 'number', sortable: false, visible: false, align: 'right' },
    ]);
    const column = dm.getColumn('x');
    expect(column?.title).toBe('X!');
    expect(column?.type).toBe('number');
    expect(column?.sortable).toBe(false);
    expect(column?.visible).toBe(false);
    expect(column?.align).toBe('right');
  });

  it('throws when no columns are provided', () => {
    expect(() => new DataManager([])).toThrowError(SmartTableError);
    expect(() => new DataManager([])).toThrowError(ERROR_CODES.INVALID_COLUMNS);
    expect(() => new DataManager([{ field: 'a' }]).setColumns([])).toThrowError(SmartTableError);
  });
});

describe('DataManager — data and ids', () => {
  it('stores data and reports counts', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    expect(dm.getRowCount()).toBe(4);
    expect(dm.getData()).toHaveLength(4);
    expect(dm.getViewCount()).toBe(4);
  });

  it('returns a copy of the data array', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    const data = dm.getData();
    data.pop();
    expect(dm.getRowCount()).toBe(4);
  });

  it('preserves the user-provided id field', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    expect(dm.getRowId(rows[0]!)).toBe('1');
    expect(dm.getRowById('3')?.name).toBe('Monitor');
  });

  it('assigns generated ids when no id field exists', () => {
    const dm = new DataManager(columns);
    dm.setData([{ name: 'A' }, { name: 'B' }]);
    const [a, b] = dm.getData();
    expect(dm.getRowId(a!)).toBe('row-1');
    expect(dm.getRowId(b!)).toBe('row-2');
  });

  it('addRow appends and tracks the new row', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    const added = dm.addRow({ name: 'Webcam', price: 45 });
    expect(dm.getRowCount()).toBe(5);
    expect(dm.getRowIndex(added)).toBe(4);
    expect(dm.getRowId(added)).toMatch(/^row-/);
  });

  it('does not mutate the caller-owned row on addRow', () => {
    const dm = new DataManager(columns);
    const source = { name: 'Webcam' };
    dm.addRow(source);
    expect(dm.getRowById('row-1')).not.toBe(source);
  });
});

describe('DataManager — removal', () => {
  it('removes by id string', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    const result = dm.removeRow('2');
    expect(result?.row.name).toBe('Mouse');
    expect(result?.rowId).toBe('2');
    expect(result?.rowIndex).toBe(1);
    expect(dm.getRowCount()).toBe(3);
    expect(dm.getRowById('2')).toBeUndefined();
  });

  it('removes by index', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    const result = dm.removeRow(0);
    expect(result?.row.name).toBe('Laptop');
    expect(dm.getRowCount()).toBe(3);
  });

  it('removes by object reference', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    const target = rows[2]!;
    const result = dm.removeRow(target);
    expect(result?.row.name).toBe('Monitor');
    expect(dm.getRowCount()).toBe(3);
  });

  it('returns null for unknown targets', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    expect(dm.removeRow('nope')).toBeNull();
    expect(dm.removeRow(99)).toBeNull();
    expect(dm.removeRow({ id: 999 })).toBeNull();
    expect(dm.getRowCount()).toBe(4);
  });
});

describe('DataManager — updateCell', () => {
  it('updates a cell and reports the diff', () => {
    const dm = new DataManager(columns);
    dm.setData([
      { id: 1, name: 'Laptop', price: 1200 },
      { id: 2, name: 'Mouse', price: 25 },
    ]);
    const result = dm.updateCell('1', 'price', 999);
    expect(result?.oldValue).toBe(1200);
    expect(result?.newValue).toBe(999);
    expect(dm.getRowById('1')?.price).toBe(999);
  });

  it('returns null when the row is unknown', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    expect(dm.updateCell('nope', 'price', 1)).toBeNull();
  });
});

describe('DataManager — sorting', () => {
  it('sorts numbers ascending and descending', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.sort('price', 'asc');
    expect(dm.getRows().map((r) => r.name)).toEqual(['Mouse', 'keyboard', 'Monitor', 'Laptop']);
    dm.sort('price', 'desc');
    expect(dm.getRows().map((r) => r.name)).toEqual(['Laptop', 'Monitor', 'keyboard', 'Mouse']);
  });

  it('sorts strings case-insensitively', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.sort('name', 'asc');
    expect(dm.getRows().map((r) => r.name)).toEqual(['keyboard', 'Laptop', 'Monitor', 'Mouse']);
  });

  it('sorts booleans (false before true ascending)', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.sort('inStock', 'asc');
    expect(dm.getRows()[0]?.name).toBe('Mouse');
    dm.sort('inStock', 'desc');
    expect(dm.getRows()[3]?.name).toBe('Mouse');
  });

  it('sorts dates across Date / ISO string / timestamp values', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.sort('released', 'asc');
    expect(dm.getRows().map((r) => r.name)).toEqual(['keyboard', 'Mouse', 'Monitor', 'Laptop']);
  });

  it('is stable for equal keys', () => {
    const dm = new DataManager(columns);
    dm.setData([
      { name: 'A', group: 1 },
      { name: 'B', group: 1 },
      { name: 'C', group: 2 },
      { name: 'D', group: 1 },
    ]);
    dm.sort('group', 'asc');
    expect(dm.getRows().map((r) => r.name)).toEqual(['A', 'B', 'D', 'C']);
  });

  it('exposes sort state and can clear it', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.sort('price', 'desc');
    expect(dm.getSortState()).toEqual({ field: 'price', direction: 'desc' });
    dm.clearSort();
    expect(dm.getSortState()).toEqual({ field: null, direction: null });
  });
});

describe('DataManager — filtering', () => {
  it('global search is case-insensitive and substring based', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.filter('LAPTOP');
    expect(dm.getViewCount()).toBe(1);
    expect(dm.getRows()[0]?.name).toBe('Laptop');
  });

  it('global search matches across multiple columns', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.filter('monitor');
    expect(dm.getViewCount()).toBe(1);
    expect(dm.getRows()[0]?.name).toBe('Monitor');
  });

  it('empty query clears the global filter', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.filter('laptop');
    expect(dm.getViewCount()).toBe(1);
    dm.filter('');
    expect(dm.getViewCount()).toBe(4);
  });

  it('filterColumn applies a predicate to raw values', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.filterColumn('price', (value) => (value as number) > 100);
    expect(dm.getViewCount()).toBe(2);
    expect(dm.getRows().map((r) => r.name)).toEqual(['Laptop', 'Monitor']);
  });

  it('combines global and column filters with AND semantics', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.filter('monitor');
    dm.filterColumn('price', (value) => (value as number) > 100);
    expect(dm.getViewCount()).toBe(1);
    expect(dm.getRows()[0]?.name).toBe('Monitor');
    dm.filterColumn('price', (value) => (value as number) < 100);
    expect(dm.getViewCount()).toBe(0);
  });

  it('reports filter state', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    expect(dm.getFilterState()).toEqual({
      query: '',
      columnFilterCount: 0,
      hasActiveFilter: false,
    });
    dm.filter('laptop');
    expect(dm.getFilterState()).toMatchObject({ query: 'laptop', hasActiveFilter: true });
    dm.filterColumn('price', () => true);
    expect(dm.getFilterState()).toMatchObject({ columnFilterCount: 1 });
  });

  it('throws when filtering an unknown column', () => {
    const dm = new DataManager(columns);
    expect(() => dm.filterColumn('nope', () => true)).toThrowError(ERROR_CODES.UNKNOWN_COLUMN);
  });

  it('clearFilter removes everything', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.filter('laptop');
    dm.filterColumn('price', () => true);
    dm.clearFilter();
    expect(dm.getViewCount()).toBe(4);
    expect(dm.getFilterState().hasActiveFilter).toBe(false);
  });

  it('setColumns prunes filters for removed columns', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    dm.filterColumn('price', (value) => (value as number) > 100);
    expect(dm.getFilterState().columnFilterCount).toBe(1);
    dm.setColumns([{ field: 'id' }]);
    expect(dm.getFilterState().columnFilterCount).toBe(0);
  });
});

describe('DataManager — serialization', () => {
  it('serializes to text with a header row', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    const text = dm.serialize('text');
    expect(text.split('\n')[0]).toBe('ID\tName\tPrice\tIn Stock\tReleased');
    expect(text).toContain('1\tLaptop\t1200\ttrue');
  });

  it('serializes only visible columns', () => {
    const dm = new DataManager([
      { field: 'name', title: 'Name' },
      { field: 'secret', visible: false },
    ]);
    dm.setData([{ name: 'A', secret: 'hidden' }]);
    expect(dm.serialize('text')).toBe('Name\nA');
  });

  it('serializes to CSV with quoting', () => {
    const dm = new DataManager([
      { field: 'name', title: 'Name' },
      { field: 'note', title: 'Note' },
    ]);
    dm.setData([
      { name: 'Smith, John', note: 'plain' },
      { name: 'Q', note: 'He said "hi"' },
    ]);
    const csv = dm.serialize('csv');
    expect(csv.split('\r\n')).toEqual(['Name,Note', '"Smith, John",plain', 'Q,"He said ""hi"""']);
  });

  it('serializes to pretty JSON', () => {
    const dm = new DataManager(columns);
    dm.setData(rows);
    const json = dm.serialize('json');
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toMatchObject({ id: 1, name: 'Laptop' });
  });
});
