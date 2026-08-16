/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { createAgCompatibleTable } from '../src/index';
import type { AgGridOptions } from '../src/ag-types';

const columnDefs = [
  { field: 'id', headerName: 'ID', sort: 'desc' as const },
  { field: 'name', headerName: 'Name' },
  { field: 'price', headerName: 'Price', sortable: false },
];

const rowData = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  price: i * 10,
}));

describe('createAgCompatibleTable', () => {
  it('builds a live table with mapped columns and row data', () => {
    const { table } = createAgCompatibleTable({ columnDefs, rowData });
    expect(table.getData()).toHaveLength(30);
    expect(table.getColumns().map((c) => c.field)).toEqual(['id', 'name', 'price']);
    expect(table.getColumn('price')?.sortable).toBe(false);
  });

  it('applies per-column initial sorts', () => {
    const { table } = createAgCompatibleTable({ columnDefs, rowData });
    expect(table.getSortState()).toEqual({ field: 'id', direction: 'desc' });
  });

  it('applies supported filter models', () => {
    const ag: AgGridOptions = {
      columnDefs,
      rowData,
      filterModel: { name: { type: 'contains', filter: 'Item 1' } },
    };
    const { table } = createAgCompatibleTable(ag);
    expect(table.getFilteredCount()).toBe(11); // Item 1, Item 10…19
    expect(table.getStructuredFilters()).toEqual([
      { field: 'name', operator: 'contains', operands: ['Item 1'] },
    ]);
  });

  it('enables pagination from AG options', () => {
    const { table } = createAgCompatibleTable({
      columnDefs,
      rowData,
      pagination: true,
      paginationPageSize: 25,
    });
    expect(table.getPageSize()).toBe(25);
    expect(table.getTotalPages()).toBe(2);
  });

  it('surfaces conversion warnings without throwing', () => {
    const { warnings } = createAgCompatibleTable({
      columnDefs: [{ field: 'a', maxWidth: 100 }, { field: 'b' }],
      rowData,
      filterModel: { a: { type: 'notEqual', filter: 'x' } },
    });
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain('max-width-ignored');
    expect(codes).toContain('unsupported-filter');
  });
});
