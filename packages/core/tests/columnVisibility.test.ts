// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import { DOMRenderer } from '../src/ui/DOMRenderer';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'inStock', title: 'In Stock', type: 'boolean' },
];

const rows = [
  { id: 1, name: 'Laptop', price: 1200, inStock: true },
  { id: 2, name: 'Mouse', price: 25, inStock: false },
  { id: 3, name: 'Monitor', price: 300, inStock: true },
];

function mountRenderer(table: SmartTable) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const renderer = new DOMRenderer(table, { target: host, toolbar: false });
  renderer.mount();
  return { host, renderer };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('Column visibility — headless API', () => {
  it('getVisibleColumns returns all columns by default, in column order', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(table.getVisibleColumns().map((c) => c.field)).toEqual([
      'id',
      'name',
      'price',
      'inStock',
    ]);
  });

  it('hideColumn hides, shows and toggles', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(table.hideColumn('price')).toBe(true);
    expect(table.getVisibleColumns().map((c) => c.field)).toEqual(['id', 'name', 'inStock']);
    expect(table.isColumnVisible('price')).toBe(false);
    expect(table.showColumn('price')).toBe(true);
    expect(table.isColumnVisible('price')).toBe(true);
    expect(table.toggleColumn('name')).toBe(false);
    expect(table.isColumnVisible('name')).toBe(false);
    expect(table.toggleColumn('name')).toBe(true);
  });

  it('does not re-emit when hiding an already hidden column', () => {
    const table = new SmartTable({ columns, data: rows });
    table.hideColumn('price');
    const handler = vi.fn();
    table.on('columnVisibilityChanged', handler);
    expect(table.hideColumn('price')).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('emits columnVisibilityChanged with field, visible and visibleColumns', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('columnVisibilityChanged', handler);
    table.hideColumn('price');
    expect(handler).toHaveBeenCalledWith({
      field: 'price',
      visible: false,
      visibleColumns: ['id', 'name', 'inStock'],
    });
  });

  it('throws UNKNOWN_COLUMN for unknown fields', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(() => table.hideColumn('nope')).toThrowError(ERROR_CODES.UNKNOWN_COLUMN);
    expect(() => table.showColumn('nope')).toThrowError(ERROR_CODES.UNKNOWN_COLUMN);
    expect(() => table.toggleColumn('nope')).toThrowError(ERROR_CODES.UNKNOWN_COLUMN);
  });

  it('is allowed in readonly mode', () => {
    const table = new SmartTable({ columns, data: rows, editable: false });
    expect(() => table.hideColumn('price')).not.toThrow();
    expect(table.isColumnVisible('price')).toBe(false);
  });

  it('is allowed while mounted and throws after destroy', () => {
    const table = new SmartTable({ columns, data: rows });
    const { renderer } = mountRenderer(table);
    expect(table.hideColumn('price')).toBe(true);
    renderer.unmount();
    table.destroy();
    expect(() => table.showColumn('price')).toThrow();
  });

  it('preserves data and sort state while a column is hidden', () => {
    const table = new SmartTable({ columns, data: rows });
    table.sort('price', 'desc');
    table.hideColumn('price');
    expect(table.getRowCount()).toBe(3);
    expect(table.getRows().map((r) => r.id)).toEqual([1, 3, 2]);
    table.filter('mouse');
    expect(table.getViewCount()).toBe(1);
    expect(table.getRows().map((r) => r.id)).toEqual([2]);
    expect(table.isColumnVisible('price')).toBe(false);
    table.clearFilter();
    table.showColumn('price');
    expect(table.isColumnVisible('price')).toBe(true);
  });

  it('initial hidden columns (visible: false) are respected and can be shown', () => {
    const table = new SmartTable({
      columns: [
        { field: 'id', title: 'ID', visible: false },
        { field: 'name', title: 'Name' },
      ],
      data: rows,
    });
    expect(table.getVisibleColumns().map((c) => c.field)).toEqual(['name']);
    table.showColumn('id');
    expect(table.getVisibleColumns().map((c) => c.field)).toEqual(['id', 'name']);
  });

  it('clone does not carry over runtime visibility', () => {
    const table = new SmartTable({ columns, data: rows });
    table.hideColumn('price');
    const clone = table.clone();
    expect(clone.getVisibleColumns().map((c) => c.field)).toEqual([
      'id',
      'name',
      'price',
      'inStock',
    ]);
  });
});

describe('Column visibility — renderer integration', () => {
  it('hides header and cells for the hidden column without losing rows', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host } = mountRenderer(table);
    const header = host.querySelector('th[data-field="price"]');
    expect(header).not.toBeNull();
    expect(host.querySelectorAll('tr.st-row td[data-field="price"]')).toHaveLength(3);
    table.hideColumn('price');
    expect(host.querySelector('th[data-field="price"]')).toBeNull();
    expect(host.querySelectorAll('tr.st-row td[data-field="price"]')).toHaveLength(0);
    expect(host.querySelectorAll('tr.st-row')).toHaveLength(3);
    expect(host.querySelector('tr[data-row-id="1"] td[data-field="name"]')?.textContent).toBe(
      'Laptop'
    );
    table.showColumn('price');
    expect(host.querySelector('th[data-field="price"]')).not.toBeNull();
    expect(host.querySelectorAll('tr.st-row td[data-field="price"]')).toHaveLength(3);
  });

  it('re-renders the table when a hidden column is restored', () => {
    const table = new SmartTable({
      columns: [
        { field: 'id', title: 'ID' },
        { field: 'name', title: 'Name' },
      ],
      data: rows,
    });
    const { host } = mountRenderer(table);
    table.hideColumn('name');
    expect(host.querySelector('th[data-field="name"]')).toBeNull();
    table.showColumn('name');
    expect(host.querySelector('th[data-field="name"]')?.textContent).toBe('Name');
    expect(host.querySelector('tr[data-row-id="2"] td[data-field="name"]')?.textContent).toBe(
      'Mouse'
    );
  });

  it('cell value formatting survives a hidden/restored round trip', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host } = mountRenderer(table);
    table.hideColumn('price');
    table.showColumn('price');
    expect(host.querySelector('tr[data-row-id="1"] td[data-field="price"]')?.textContent).toBe(
      '1200'
    );
  });
});
