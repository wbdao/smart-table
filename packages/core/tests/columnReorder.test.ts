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
];

function mountRenderer(table: SmartTable) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const renderer = new DOMRenderer(table, { target: host, toolbar: false });
  renderer.mount();
  return { host, renderer };
}

function headerFields(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll<HTMLElement>('th[data-field]')).map(
    (th) => th.dataset.field as string
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('Column reorder — headless API', () => {
  it('moves a column in front of the target column', () => {
    const table = new SmartTable({ columns, data: rows });
    table.moveColumn('price', 'name');
    expect(table.getColumns().map((c) => c.field)).toEqual(['id', 'price', 'name', 'inStock']);
  });

  it('emits columnReordered with the new order', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('columnReordered', handler);
    table.moveColumn('id', 'inStock');
    expect(table.getColumns().map((c) => c.field)).toEqual(['name', 'price', 'id', 'inStock']);
    expect(handler).toHaveBeenCalledWith({
      field: 'id',
      beforeField: 'inStock',
      columns: ['name', 'price', 'id', 'inStock'],
    });
  });

  it('does not emit when nothing changed', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('columnReordered', handler);
    expect(table.moveColumn('price', 'price')).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('throws for unknown columns', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(() => table.moveColumn('nope', 'name')).toThrowError(ERROR_CODES.UNKNOWN_COLUMN);
    expect(() => table.moveColumn('price', 'nope')).toThrowError(ERROR_CODES.UNKNOWN_COLUMN);
  });

  it('is allowed in readonly mode and works while sorted', () => {
    const table = new SmartTable({ columns, data: rows, editable: false });
    table.sort('price', 'desc');
    table.moveColumn('inStock', 'id');
    expect(table.getColumns().map((c) => c.field)).toEqual(['inStock', 'id', 'name', 'price']);
    expect(table.getRows().map((r) => r.id)).toEqual([1, 2]);
  });

  it('reordering does not affect visibility or widths', () => {
    const table = new SmartTable({ columns, data: rows });
    table.setColumnWidth('price', 250);
    table.hideColumn('inStock');
    table.moveColumn('price', 'id');
    expect(table.getColumns().map((c) => c.field)).toEqual(['price', 'id', 'name', 'inStock']);
    expect(table.getVisibleColumns().map((c) => c.field)).toEqual(['price', 'id', 'name']);
    expect(table.getColumnWidth('price')).toBe(250);
  });
});

describe('Column reorder — renderer integration', () => {
  it('renders headers in the current order', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host } = mountRenderer(table);
    expect(headerFields(host)).toEqual(['id', 'name', 'price', 'inStock']);
    table.moveColumn('price', 'name');
    expect(headerFields(host)).toEqual(['id', 'price', 'name', 'inStock']);
    expect(host.querySelectorAll('tr.st-row')).toHaveLength(2);
  });

  it('drags a header onto another to reorder columns', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host, renderer } = mountRenderer(table);
    const from = host.querySelector('th[data-field="price"]') as HTMLElement;
    const to = host.querySelector('th[data-field="name"]') as HTMLElement;
    from.dispatchEvent(new Event('dragstart', { bubbles: true }));
    to.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    to.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    expect(table.getColumns().map((c) => c.field)).toEqual(['id', 'price', 'name', 'inStock']);
    expect(headerFields(host)).toEqual(['id', 'price', 'name', 'inStock']);
    renderer.unmount();
  });

  it('keeps header order after a visibility round trip', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host } = mountRenderer(table);
    table.moveColumn('inStock', 'id');
    table.hideColumn('name');
    table.showColumn('name');
    expect(headerFields(host)).toEqual(['inStock', 'id', 'name', 'price']);
    expect(
      Array.from(host.querySelectorAll<HTMLElement>('tr[data-row-id="1"] td[data-field]')).map(
        (td) => td.dataset.field
      )
    ).toEqual(['inStock', 'id', 'name', 'price']);
  });

  it('drags cells stay aligned after reorder', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host } = mountRenderer(table);
    table.moveColumn('name', 'price');
    const cells = Array.from(
      host.querySelectorAll<HTMLElement>('tr[data-row-id="1"] td[data-field]')
    ).map((td) => td.dataset.field);
    expect(cells).toEqual(['id', 'name', 'price', 'inStock']);
    expect(host.querySelector('tr[data-row-id="1"] td[data-field="price"]')?.textContent).toBe(
      '1200'
    );
  });
});
