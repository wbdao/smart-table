// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SmartTableController } from '../src/controller';
import type { Column, DataRow } from '@smart-table/core';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
];

const rows: DataRow[] = [
  { id: 1, name: 'Laptop', price: 1200 },
  { id: 2, name: 'Mouse', price: 25 },
];

describe('SmartTableController', () => {
  it('mounts the table into the host element', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const controller = new SmartTableController(host, { columns, data: rows });
    const table = controller.mount();
    expect(table.getRowCount()).toBe(2);
    expect(host.querySelectorAll('.st-root')).toHaveLength(1);
    controller.destroy();
    host.remove();
  });

  it('is idempotent: mount() returns the same instance', () => {
    const host = document.createElement('div');
    const controller = new SmartTableController(host, { columns, data: rows });
    const a = controller.mount();
    const b = controller.mount();
    expect(b).toBe(a);
    controller.destroy();
  });

  it('setData replaces the rows', () => {
    const host = document.createElement('div');
    const controller = new SmartTableController(host, { columns, data: rows });
    controller.mount();
    controller.setData([{ id: 9, name: 'Speaker', price: 100 }]);
    expect(controller.getTable()?.getRowCount()).toBe(1);
    expect(host.textContent).toContain('Speaker');
    controller.destroy();
  });

  it('forwards events through on()', () => {
    const host = document.createElement('div');
    const controller = new SmartTableController(host, { columns, data: rows });
    const table = controller.mount();
    const seen: unknown[] = [];
    controller.on('sortChanged', (e) => seen.push(e));
    table.sort('price', 'desc');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ field: 'price', direction: 'desc' });
    controller.destroy();
  });

  it('destroy() unmounts and destroys the instance', () => {
    const host = document.createElement('div');
    const controller = new SmartTableController(host, { columns, data: rows });
    const table = controller.mount();
    controller.destroy();
    expect(controller.getTable()).toBeNull();
    expect(() => table.setData([])).toThrowError('destroyed');
  });

  it('requires columns', () => {
    expect(() => SmartTableController.assertColumns(undefined as unknown as Column[])).toThrowError(
      'columns'
    );
  });
});
