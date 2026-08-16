// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import { DOMRenderer } from '../src/ui/DOMRenderer';
import type { Column, ExportFormat } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number', width: 80 },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'inStock', title: 'In Stock', type: 'boolean' },
];

function makeRows(): Array<{ id: number; name: string; inStock: boolean }> {
  return [
    { id: 1, name: 'Laptop', inStock: true },
    { id: 2, name: 'Mouse', inStock: false },
    { id: 3, name: 'Monitor', inStock: true },
  ];
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('serialize', () => {
  it('serializes the filtered + sorted view as text/csv/json', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    table.sort('name', 'asc');
    expect(table.serialize('text')).toBe(
      'ID\tName\tIn Stock\n1\tLaptop\ttrue\n3\tMonitor\ttrue\n2\tMouse\tfalse'
    );
    const csv = table.serialize('csv');
    expect(csv.split('\r\n')[0]).toBe('ID,Name,In Stock');
    expect(table.serialize('json').includes('"name": "Laptop"')).toBe(true);
  });

  it('serializes the filtered view (all pages, every matching row)', () => {
    const table = new SmartTable({ columns, data: makeRows(), pageSize: 1 });
    table.filter('t');
    const json = JSON.parse(table.serialize('json')) as Array<{ name: string }>;
    expect(json).toHaveLength(2);
    expect(json.map((r) => r.name)).toEqual(['Laptop', 'Monitor']);
  });

  it('throws for an unknown format', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    expect(() => table.serialize('xml' as never)).toThrowError(ERROR_CODES.INVALID_FORMAT);
  });
});

describe('export to file', () => {
  it('emits exported with the default filename and row count', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const events: Array<{ format: ExportFormat; filename: string; rowCount: number }> = [];
    table.on('exported', (event) => events.push(event));
    table.exportCSV();
    expect(events).toHaveLength(1);
    expect(events[0]?.format).toBe('csv');
    expect(events[0]?.filename.endsWith('.csv')).toBe(true);
    expect(events[0]?.filename.startsWith(table.id)).toBe(true);
    expect(events[0]?.rowCount).toBe(3);
  });

  it('honors a custom filename', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const events: Array<{ format: ExportFormat; filename: string }> = [];
    table.on('exported', (event) => events.push(event));
    table.exportJSON('orders.json');
    expect(events[0]?.filename).toBe('orders.json');
    expect(events[0]?.format).toBe('json');
  });

  it('exports only the filtered rows', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    table.where('inStock', 'equals', true);
    const events: Array<{ rowCount: number }> = [];
    table.on('exported', (event) => events.push(event));
    table.exportCSV('stock.csv');
    expect(events[0]?.rowCount).toBe(2);
  });
});

describe('toolbar export control', () => {
  function mountWithExport() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const table = new SmartTable({ columns, data: makeRows() });
    const renderer = new DOMRenderer(table, {
      target: host,
      toolbar: true,
      toolbarControls: ['export'],
    });
    renderer.mount();
    return { host, table };
  }

  it('downloads CSV and emits toolbar:export', () => {
    const { host, table } = mountWithExport();
    const events: Array<{ format: ExportFormat }> = [];
    const exported: Array<{ format: ExportFormat }> = [];
    table.on('toolbar:export', (event) => events.push(event));
    table.on('exported', (event) => exported.push(event));
    host.querySelector<HTMLButtonElement>('[data-st-control="export"]')?.click();
    const menu = host.querySelector<HTMLElement>('.st-export-panel');
    expect(menu?.hasAttribute('hidden')).toBe(false);
    host.querySelector<HTMLButtonElement>('[data-st-export="csv"]')?.click();
    expect(events).toEqual([{ format: 'csv' }]);
    expect(exported).toHaveLength(1);
    expect(exported[0]?.format).toBe('csv');
    expect(menu?.hasAttribute('hidden')).toBe(true);
  });

  it('downloads JSON from the menu', () => {
    const { host, table } = mountWithExport();
    const events: Array<{ format: ExportFormat }> = [];
    table.on('toolbar:export', (event) => events.push(event));
    host.querySelector<HTMLButtonElement>('[data-st-control="export"]')?.click();
    host.querySelector<HTMLButtonElement>('[data-st-export="json"]')?.click();
    expect(events).toEqual([{ format: 'json' }]);
  });

  it('closes the menu on an outside click', () => {
    const { host } = mountWithExport();
    host.querySelector<HTMLButtonElement>('[data-st-control="export"]')?.click();
    const menu = host.querySelector<HTMLElement>('.st-export-panel');
    expect(menu?.hasAttribute('hidden')).toBe(false);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu?.hasAttribute('hidden')).toBe(true);
  });
});
