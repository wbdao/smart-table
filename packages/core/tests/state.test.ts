// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import type { Column, DataRow } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'category', title: 'Category', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
];

const rows: DataRow[] = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  category: i % 2 === 0 ? 'Electronics' : 'Office',
  price: (i + 1) * 10,
}));

afterEach(() => {
  document.body.replaceChildren();
});

describe('SmartTable state manager', () => {
  it('exports the full grid state', () => {
    const table = new SmartTable({ columns, data: rows, pageSize: 10 });
    table.filter('item 1');
    table.sort('price', 'desc');
    table.setMode('editable');
    table.selectRow('3');
    table.goToPage(2);
    table.groupBy('category');
    table.toggleGroup('Electronics');

    const state = table.exportState();
    expect(state.version).toBe(1);
    expect(state.mode).toBe('editable');
    expect(state.query).toBe('item 1');
    expect(state.sort).toEqual({ field: 'price', direction: 'desc' });
    expect(state.selection).toContain('3');
    expect(state.page).toBe(2);
    expect(state.pageSize).toBe(10);
    expect(state.grouping).toEqual({ field: 'category', collapsed: ['Electronics'] });
    expect(state.columns).toHaveLength(4);
    expect(state.scrollTop).toBe(0);
  });

  it('restores the state on a fresh instance', () => {
    const source = new SmartTable({ columns, data: rows, pageSize: 10, tree: true });
    source.filter('office');
    source.sort('price', 'asc');
    source.where('price', 'greaterThan', 100);
    source.setPageSize(25);
    source.goToPage(1);
    source.groupBy('category');
    source.toggleGroup('Office');
    source.selectRow('2');
    const state = source.exportState();

    const target = new SmartTable({ columns, data: rows, pageSize: 10, tree: true });
    target.importState(state);

    expect(target.getMode()).toBe(source.getMode());
    expect(target.getSortState()).toEqual({ field: 'price', direction: 'asc' });
    expect(target.getPageSize()).toBe(25);
    expect(target.getGroupState().field).toBe('category');
    expect(target.isGroupCollapsed('Office')).toBe(true);
    expect(target.getSelectedRowIds()).toContain('2');
    expect(target.getFilterState().query).toBe('office');
    expect(target.getStructuredFilters()).toHaveLength(1);
  });

  it('is a round trip after manual mutations', () => {
    const table = new SmartTable({ columns, data: rows });
    table.sort('id', 'asc');
    table.where('category', 'equals', 'Electronics');
    const restored = new SmartTable({ columns, data: rows });
    restored.importState(table.exportState());
    expect(restored.getStructuredFilters()[0]).toMatchObject({
      field: 'category',
      operator: 'equals',
    });
    expect(restored.getRows().every((r) => r.category === 'Electronics')).toBe(true);
  });

  it('resetState clears sort, filter, selection and grouping', () => {
    const table = new SmartTable({ columns, data: rows });
    table.filter('item');
    table.sort('price', 'desc');
    table.selectRow('1');
    table.groupBy('category');
    table.setPageSize(7);
    table.resetState();

    expect(table.getFilterState().query).toBe('');
    expect(table.getSortState().field).toBeNull();
    expect(table.getSelectedRowIds()).toEqual([]);
    expect(table.getGroupState().field).toBeNull();
    expect(table.getPageSize()).toBe(7); // page size is not part of reset
    expect(table.getCurrentPage()).toBe(1);
  });

  it('rejects malformed snapshots', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(() => table.importState({ version: 99 } as never)).toThrowError(
      ERROR_CODES.INVALID_STATE
    );
    expect(() => table.importState(null as never)).toThrowError(ERROR_CODES.INVALID_STATE);
  });
});
