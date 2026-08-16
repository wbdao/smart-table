// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import { DOMRenderer } from '../src/ui/DOMRenderer';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number', width: 80 },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number', minWidth: 120 },
];

const rows = [
  { id: 1, name: 'Laptop', price: 1200 },
  { id: 2, name: 'Mouse', price: 25 },
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

describe('Column resize — headless API', () => {
  it('getColumnWidth returns the configured width', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(table.getColumnWidth('id')).toBe(80);
    expect(table.getColumnWidth('name')).toBeUndefined();
  });

  it('setColumnWidth stores the width and emits columnResized', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('columnResized', handler);
    table.setColumnWidth('name', 250);
    expect(table.getColumnWidth('name')).toBe(250);
    expect(handler).toHaveBeenCalledWith({ field: 'name', width: 250 });
  });

  it('accepts CSS length strings and clamps numbers to minWidth', () => {
    const table = new SmartTable({ columns, data: rows });
    table.setColumnWidth('name', '12rem');
    expect(table.getColumnWidth('name')).toBe('12rem');
    table.setColumnWidth('price', 30);
    expect(table.getColumnWidth('price')).toBe(120);
    table.setColumnWidth('id', 40);
    expect(table.getColumnWidth('id')).toBe(60);
  });

  it('throws for unknown columns and invalid widths', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(() => table.setColumnWidth('nope', 100)).toThrowError(ERROR_CODES.UNKNOWN_COLUMN);
    expect(() => table.setColumnWidth('name', 0)).toThrowError(ERROR_CODES.INVALID_COLUMN_WIDTH);
    expect(() => table.setColumnWidth('name', -5)).toThrowError(ERROR_CODES.INVALID_COLUMN_WIDTH);
    expect(() => table.setColumnWidth('name', '')).toThrowError(ERROR_CODES.INVALID_COLUMN_WIDTH);
  });

  it('is allowed in readonly mode and after mount', () => {
    const table = new SmartTable({ columns, data: rows, editable: false });
    const { renderer } = mountRenderer(table);
    expect(() => table.setColumnWidth('name', 200)).not.toThrow();
    expect(table.getColumnWidth('name')).toBe(200);
    renderer.unmount();
  });
});

describe('Column resize — renderer integration', () => {
  it('renders a resizer handle on each data column header', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host } = mountRenderer(table);
    expect(host.querySelectorAll('.st-resizer')).toHaveLength(3);
    const handle = host.querySelector('.st-resizer') as HTMLElement;
    expect(handle.dataset.stResize).toBe('id');
  });

  it('applies setColumnWidth to header and cells without a full re-render', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host, renderer } = mountRenderer(table);
    table.setColumnWidth('name', 250);
    expect(host.querySelector<HTMLElement>('th[data-field="name"]')?.style.width).toBe('250px');
    expect(host.querySelector<HTMLElement>('td[data-field="name"]')?.style.width).toBe('250px');
    expect(host.querySelectorAll('tr.st-row')).toHaveLength(2);
    renderer.unmount();
  });

  it('keeps the width after a visibility round trip', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host } = mountRenderer(table);
    table.setColumnWidth('name', 250);
    table.hideColumn('name');
    table.showColumn('name');
    expect(host.querySelector<HTMLElement>('th[data-field="name"]')?.style.width).toBe('250px');
  });

  it('drags the resizer to resize the column with a min width floor', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host } = mountRenderer(table);
    const handle = host.querySelector('[data-st-resize="name"]') as HTMLElement;
    const start = handle.getBoundingClientRect();
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: start.left + 2 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: start.left + 102 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(table.getColumnWidth('name')).toBe(200);
    expect(host.querySelector<HTMLElement>('th[data-field="name"]')?.style.width).toBe('200px');
  });

  it('clamps the drag to the column min width', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host } = mountRenderer(table);
    const handle = host.querySelector('[data-st-resize="price"]') as HTMLElement;
    const start = handle.getBoundingClientRect();
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: start.left + 2 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: start.left - 500 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(table.getColumnWidth('price')).toBe(120);
  });

  it('resizing does not trigger a column sort', () => {
    const table = new SmartTable({ columns, data: rows });
    const { host } = mountRenderer(table);
    const sort = vi.fn();
    table.on('sortChanged', sort);
    const handle = host.querySelector('[data-st-resize="name"]') as HTMLElement;
    handle.click();
    expect(table.getSortState().field).toBeNull();
    expect(sort).not.toHaveBeenCalled();
  });
});
