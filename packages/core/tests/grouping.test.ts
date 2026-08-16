// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import { groupRows } from '../src/features/grouping/GroupingEngine';
import type { Column, DataRow } from '../src/types';
import type { NormalizedColumn } from '../src/types/column';
import type { ViewRow } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'category', title: 'Category', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
];

const rows: DataRow[] = [
  { id: 1, category: 'Electronics', price: 1200 },
  { id: 2, category: 'Accessories', price: 25 },
  { id: 3, category: 'Electronics', price: 300 },
  { id: 4, category: 'Accessories', price: 80 },
  { id: 5, category: 'Office', price: 40 },
];

const categoryColumn = columns[1] as NormalizedColumn;

afterEach(() => {
  document.body.replaceChildren();
});

describe('GroupingEngine (pure)', () => {
  it('groups rows by a column and interleaves headers', () => {
    const viewRows: ViewRow[] = rows.map((row) => ({ type: 'row', id: String(row.id), row }));
    const result = groupRows(viewRows, {
      column: categoryColumn,
      collapsed: new Set(),
    });
    const types = result.viewRows.map((v) =>
      v.type === 'group' ? `group:${v.group.label}` : `row:${v.row.id}`
    );
    expect(types).toEqual([
      'group:Electronics',
      'row:1',
      'row:3',
      'group:Accessories',
      'row:2',
      'row:4',
      'group:Office',
      'row:5',
    ]);
    expect(result.groups.map((g) => g.key)).toEqual(['Electronics', 'Accessories', 'Office']);
    expect(result.groups[0]).toMatchObject({ rowCount: 2, collapsed: false, startIndex: 0 });
  });

  it('omits the rows of collapsed groups', () => {
    const viewRows: ViewRow[] = rows.map((row) => ({ type: 'row', id: String(row.id), row }));
    const result = groupRows(viewRows, {
      column: categoryColumn,
      collapsed: new Set(['Electronics']),
    });
    const types = result.viewRows.map((v) => (v.type === 'group' ? 'group' : 'row'));
    // Electronics is collapsed, so only its header appears (no data rows).
    expect(types).toEqual(['group', 'group', 'row', 'row', 'group', 'row']);
    expect(result.viewRows.filter((v) => v.type === 'row')).toHaveLength(3);
  });
});

describe('SmartTable grouping', () => {
  it('starts ungrouped', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(table.getGroupState().field).toBeNull();
    expect(table.getRows()).toHaveLength(5);
  });

  it('groups by a known column and emits groupChanged', () => {
    const table = new SmartTable({ columns, data: rows });
    const changed = vi.fn();
    table.on('groupChanged', changed);
    table.groupBy('category');
    expect(table.getGroupState().field).toBe('category');
    expect(table.getGroups()).toHaveLength(3);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0]![0]).toMatchObject({ field: 'category' });
  });

  it('throws when grouping by an unknown column', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(() => table.groupBy('nope')).toThrowError(ERROR_CODES.UNKNOWN_COLUMN);
  });

  it('collapses and toggles groups', () => {
    const table = new SmartTable({ columns, data: rows });
    table.groupBy('category');
    expect(table.isGroupCollapsed('Electronics')).toBe(false);
    const collapsed = table.toggleGroup('Electronics');
    expect(collapsed).toBe(true);
    expect(table.isGroupCollapsed('Electronics')).toBe(true);
    expect(table.toggleGroup('Electronics')).toBe(false);
  });

  it('ungroups and restores the flat view', () => {
    const table = new SmartTable({ columns, data: rows });
    table.groupBy('category');
    table.ungroup();
    expect(table.getGroupState().field).toBeNull();
    expect(table.getRows()).toHaveLength(5);
  });
});
