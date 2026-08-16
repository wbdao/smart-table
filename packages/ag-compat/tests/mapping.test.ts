import { describe, expect, it } from 'vitest';
import { convertAgGridOptions, flattenAgColumns } from '../src/mapping';
import type { AgColumnDef, AgGridOptions } from '../src/ag-types';

describe('flattenAgColumns', () => {
  it('flattens nested groups into ordered leaf columns', () => {
    const defs: AgColumnDef[] = [
      { field: 'id', headerName: 'ID' },
      {
        headerName: 'Profile',
        children: [{ field: 'name' }, { field: 'email', children: [{ field: 'mail' }] }],
      },
    ];
    expect(flattenAgColumns(defs).map((d) => d.field)).toEqual(['id', 'name', 'mail']);
  });

  it('keeps single leaves without field skipped at the leaf level', () => {
    expect(flattenAgColumns([{ field: 'a' }, { field: 'b' }]).length).toBe(2);
  });
});

describe('convertAgGridOptions', () => {
  it('maps headers, widths, hidden and sortable flags', () => {
    const ag: AgGridOptions = {
      defaultColDef: { sortable: false },
      columnDefs: [
        { field: 'id', headerName: 'Order ID', width: 120 },
        { field: 'secret', hide: true },
        { field: 'name', sortable: true },
      ],
    };
    const { options } = convertAgGridOptions(ag);
    expect(options.columns).toEqual([
      {
        field: 'id',
        title: 'Order ID',
        sortable: false,
        visible: true,
        width: 120,
        minWidth: undefined,
        type: undefined,
      },
      {
        field: 'secret',
        title: 'secret',
        sortable: false,
        visible: false,
        width: undefined,
        minWidth: undefined,
        type: undefined,
      },
      {
        field: 'name',
        title: 'name',
        sortable: true,
        visible: true,
        width: undefined,
        minWidth: undefined,
        type: undefined,
      },
    ]);
  });

  it('applies defaultColDef width and minWidth to columns missing them', () => {
    const ag: AgGridOptions = {
      defaultColDef: { width: 100, minWidth: 50 },
      columnDefs: [{ field: 'a' }, { field: 'b', width: 200 }],
    };
    const { options } = convertAgGridOptions(ag);
    expect(options.columns![0]?.width).toBe(100);
    expect(options.columns![0]?.minWidth).toBe(50);
    expect(options.columns![1]?.width).toBe(200);
  });

  it('infers numeric/boolean types from built-in filters', () => {
    const ag: AgGridOptions = {
      columnDefs: [
        { field: 'price', filter: 'agNumberColumnFilter' },
        { field: 'flag', filter: 'agBooleanColumnFilter' },
        { field: 'label', filter: 'agTextColumnFilter' },
        { field: 'explicit', filter: { filter: 'number' } },
      ],
    };
    const types = convertAgGridOptions(ag).options.columns!.map((c) => c.type);
    expect(types).toEqual(['number', 'boolean', 'string', 'number']);
  });

  it('maps pagination and autoHeight layout', () => {
    const paged = convertAgGridOptions({
      pagination: true,
      paginationPageSize: 25,
      columnDefs: [{ field: 'a' }],
    });
    expect(paged.options.pageSize).toBe(25);
    expect(paged.options.virtualScroll).toBe(true);

    const normal = convertAgGridOptions({ columnDefs: [{ field: 'a' }] });
    expect(normal.options.pageSize).toBe(0);

    const autoHeight = convertAgGridOptions({
      domLayout: 'autoHeight',
      columnDefs: [{ field: 'a' }],
    });
    expect(autoHeight.options.virtualScroll).toBe(false);
  });

  it('maps filter models (equals, contains, inRange, set values)', () => {
    const ag: AgGridOptions = {
      columnDefs: [{ field: 'name' }, { field: 'price' }],
      filterModel: {
        name: { filterType: 'text', type: 'contains', filter: 'zzz' },
        price: { filterType: 'number', type: 'inRange', filter: 10, filterTo: 20 },
        tag: { values: ['a', 'b'] },
      },
    };
    const { filters } = convertAgGridOptions(ag);
    expect(filters).toEqual([
      { field: 'name', operator: 'contains', operands: ['zzz'] },
      { field: 'price', operator: 'between', operands: [10, 20] },
      { field: 'tag', operator: 'inList', operands: ['a', 'b'] },
    ]);
  });

  it('warns about unsupported features instead of failing', () => {
    const ag: AgGridOptions = {
      columnDefs: [{ field: 'a', maxWidth: 300 }, {}],
      filterModel: {
        ok: { type: 'equals', filter: 'x' },
        no: { type: 'notEqual', filter: 'x' },
        or: {
          operator: 'OR',
          filters: [
            { type: 'contains', filter: 'a' },
            { type: 'contains', filter: 'b' },
          ],
        },
      },
    };
    const { warnings, options } = convertAgGridOptions(ag);
    expect(warnings.some((w) => w.code === 'max-width-ignored')).toBe(true);
    expect(warnings.some((w) => w.code === 'missing-field')).toBe(true);
    expect(warnings.some((w) => w.code === 'unsupported-filter')).toBe(true);
    expect(warnings.some((w) => w.code === 'unsupported-or-group')).toBe(true);
    expect(options.columns!.some((c) => c.field === 'a')).toBe(true);
  });
});
