import { describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import type { Column, SmartTablePlugin } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number', sortable: false },
];

const rows = [
  { id: 1, name: 'Laptop', price: 1200 },
  { id: 2, name: 'Mouse', price: 25 },
  { id: 3, name: 'Monitor', price: 300 },
];

describe('SmartTable — construction and mode', () => {
  it('defaults to editable mode, light theme, generated id', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(table.getMode()).toBe('editable');
    expect(table.isEditable()).toBe(true);
    expect(table.getTheme()).toBe('light');
    expect(table.id).toMatch(/^table-/);
    expect(table.responsive).toBe(false);
  });

  it('honors editable:false (readonly initial mode)', () => {
    const table = new SmartTable({ columns, editable: false });
    expect(table.getMode()).toBe('readonly');
  });

  it('lets mode option override editable', () => {
    const table = new SmartTable({ columns, editable: true, mode: 'readonly' });
    expect(table.getMode()).toBe('readonly');
  });

  it('respects id, theme, responsive and container options', () => {
    const table = new SmartTable({ columns, id: 'my-table', theme: 'dark', responsive: true });
    expect(table.id).toBe('my-table');
    expect(table.getTheme()).toBe('dark');
    expect(table.responsive).toBe(true);
    expect(table.getContainer()).toBeNull();
  });

  it('throws on empty columns', () => {
    expect(() => new SmartTable({ columns: [] })).toThrowError(ERROR_CODES.INVALID_COLUMNS);
  });

  it('setMode emits modeChanged and no-ops on the same mode', () => {
    const table = new SmartTable({ columns });
    const handler = vi.fn();
    table.on('modeChanged', handler);
    table.setMode('readonly');
    expect(handler).toHaveBeenCalledWith({ mode: 'readonly', previousMode: 'editable' });
    table.setMode('readonly');
    expect(handler).toHaveBeenCalledTimes(1);
    table.setMode('editable');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('setMode rejects invalid modes', () => {
    const table = new SmartTable({ columns });
    expect(() => table.setMode('edit' as never)).toThrowError(ERROR_CODES.INVALID_MODE);
  });
});

describe('SmartTable — readonly enforcement', () => {
  it('blocks addRow, removeRow and updateCell in readonly mode', () => {
    const table = new SmartTable({ columns, data: rows, editable: false });
    expect(() => table.addRow({ name: 'x' })).toThrowError(ERROR_CODES.READONLY_MODE);
    expect(() => table.removeRow('1')).toThrowError(ERROR_CODES.READONLY_MODE);
    expect(() => table.updateCell('1', 'name', 'y')).toThrowError(ERROR_CODES.READONLY_MODE);
    expect(table.getRowCount()).toBe(3);
  });

  it('still allows setData in readonly mode', () => {
    const table = new SmartTable({ columns, data: rows, editable: false });
    table.setData([{ name: 'only' }]);
    expect(table.getRowCount()).toBe(1);
  });

  it('re-enables mutations after switching back to editable', () => {
    const table = new SmartTable({ columns, data: rows, editable: false });
    table.setMode('editable');
    const added = table.addRow({ name: 'Webcam' });
    expect(table.getRowCount()).toBe(4);
    expect(table.getRowId(added)).toMatch(/^row-/);
  });
});

describe('SmartTable — CRUD events', () => {
  it('addRow emits rowAdded with row, id and index', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('rowAdded', handler);
    const added = table.addRow({ id: 9, name: 'Webcam' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ row: added, rowId: '9', rowIndex: 3 });
    expect(added).toEqual({ id: 9, name: 'Webcam' });
  });

  it('removeRow emits rowDeleted and returns the removed row', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('rowDeleted', handler);
    const removed = table.removeRow('2');
    expect(removed?.name).toBe('Mouse');
    expect(handler).toHaveBeenCalledWith({ row: removed, rowId: '2', rowIndex: 1 });
    expect(table.getRowCount()).toBe(2);
  });

  it('removeRow returns null for unknown targets without emitting', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('rowDeleted', handler);
    expect(table.removeRow('nope')).toBeNull();
    expect(handler).not.toHaveBeenCalled();
  });

  it('updateCell emits cellEdit only when the value changes', () => {
    const table = new SmartTable({ columns, data: [{ id: 1, name: 'Laptop', price: 1200 }] });
    const handler = vi.fn();
    table.on('cellEdit', handler);
    table.updateCell('1', 'price', 999);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      rowId: '1',
      field: 'price',
      oldValue: 1200,
      newValue: 999,
      column: { field: 'price' },
    });
    table.updateCell('1', 'price', 999);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('updateCell rejects unknown columns', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(() => table.updateCell('1', 'nope', 1)).toThrowError(ERROR_CODES.UNKNOWN_COLUMN);
  });
});

describe('SmartTable — events API', () => {
  it('on returns an unsubscribe function', () => {
    const table = new SmartTable({ columns });
    const handler = vi.fn();
    const unsubscribe = table.on('modeChanged', handler);
    table.setMode('readonly');
    unsubscribe();
    table.setMode('editable');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('once fires a single time', () => {
    const table = new SmartTable({ columns });
    const handler = vi.fn();
    table.once('modeChanged', handler);
    table.setMode('readonly');
    table.setMode('editable');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('off removes a handler', () => {
    const table = new SmartTable({ columns });
    const handler = vi.fn();
    table.on('modeChanged', handler);
    table.off('modeChanged', handler);
    table.setMode('readonly');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('SmartTable — sorting', () => {
  it('sorts and emits sortChanged', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('sortChanged', handler);
    table.sort('name', 'asc');
    expect(table.getRows().map((r) => r.name)).toEqual(['Laptop', 'Monitor', 'Mouse']);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      field: 'name',
      direction: 'asc',
      column: { field: 'name', title: 'Name' },
    });
  });

  it('throws for unknown or non-sortable columns', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(() => table.sort('nope')).toThrowError(ERROR_CODES.UNKNOWN_COLUMN);
    expect(() => table.sort('price')).toThrowError(ERROR_CODES.NOT_SORTABLE);
    expect(() => table.sort('name', 'sideways' as never)).toThrowError(
      ERROR_CODES.INVALID_SORT_DIRECTION
    );
  });

  it('clearSort emits sortChanged with a null state', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('sortChanged', handler);
    table.sort('name', 'asc');
    table.clearSort();
    expect(handler).toHaveBeenLastCalledWith({ field: null, direction: null, column: null });
    expect(table.getSortState()).toEqual({ field: null, direction: null });
  });
});

describe('SmartTable — filtering', () => {
  it('filter emits filterChanged with counts', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('filterChanged', handler);
    table.filter('monitor');
    expect(table.getViewCount()).toBe(1);
    expect(handler).toHaveBeenCalledWith({
      query: 'monitor',
      columnFilterCount: 0,
      rowCount: 1,
      totalCount: 3,
      totalPages: 1,
    });
  });

  it('filterColumn and clearFilter emit filterChanged too', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('filterChanged', handler);
    table.filterColumn('price', (value) => (value as number) > 100);
    expect(table.getViewCount()).toBe(2);
    expect(handler).toHaveBeenCalledTimes(1);
    table.clearFilter();
    expect(table.getViewCount()).toBe(3);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe('SmartTable — cloning', () => {
  it('clone copies data and emits cloned', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('cloned', handler);
    const clone = table.clone();
    expect(clone).toBeInstanceOf(SmartTable);
    expect(clone).not.toBe(table);
    expect(clone.getRowCount()).toBe(3);
    expect(clone.getMode()).toBe(table.getMode());
    expect(clone.getTheme()).toBe(table.getTheme());
    expect(handler).toHaveBeenCalledWith({ clone, includeData: true });
  });

  it('duplicate with includeData:false starts empty', () => {
    const table = new SmartTable({ columns, data: rows });
    const clone = table.duplicate({ includeData: false });
    expect(clone.getRowCount()).toBe(0);
    expect(clone.getColumns()).toHaveLength(3);
  });

  it('the clone is independent of the source', () => {
    const table = new SmartTable({ columns, data: [{ id: 1, name: 'Laptop', price: 1200 }] });
    const clone = table.clone();
    clone.addRow({ name: 'Webcam' });
    clone.updateCell('1', 'price', 1);
    clone.setMode('readonly');
    expect(table.getRowCount()).toBe(1);
    expect(table.getRows()[0]?.price).toBe(1200);
    expect(table.getMode()).toBe('editable');
  });

  it('cloning works after filtering and sorting (data layer untouched)', () => {
    const table = new SmartTable({ columns, data: rows });
    table.filter('monitor');
    table.sort('name', 'desc');
    const clone = table.clone();
    expect(clone.getRowCount()).toBe(3);
    expect(clone.getViewCount()).toBe(3);
  });
});

describe('SmartTable — copy', () => {
  it('copy returns the serialized payload and emits copied', async () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('copied', handler);
    const payload = await table.copy('text');
    expect(payload.split('\n')[0]).toBe('ID\tName\tPrice');
    expect(payload).toContain('Laptop');
    expect(handler).toHaveBeenCalledWith({ format: 'text', rowCount: 3 });
  });

  it('copy("json") returns parseable JSON', async () => {
    const table = new SmartTable({ columns, data: rows });
    const json = await table.copy('json');
    expect(JSON.parse(json)).toHaveLength(3);
  });

  it('copy("csv") returns comma-separated data', async () => {
    const table = new SmartTable({ columns, data: rows });
    const csv = await table.copy('csv');
    expect(csv.split('\r\n')[0]).toBe('ID,Name,Price');
  });

  it('copy rejects unsupported formats', async () => {
    const table = new SmartTable({ columns });
    await expect(table.copy('pdf' as never)).rejects.toThrowError(ERROR_CODES.INVALID_FORMAT);
  });

  it('copy serializes only the current view', async () => {
    const table = new SmartTable({ columns, data: rows });
    table.filter('monitor');
    const json = await table.copy('json');
    expect(JSON.parse(json)).toHaveLength(1);
  });
});

describe('SmartTable — plugins', () => {
  it('installs a plugin and returns the table for chaining', () => {
    const table = new SmartTable({ columns });
    const install = vi.fn();
    const plugin: SmartTablePlugin = { name: 'test', install };
    expect(table.use(plugin)).toBe(table);
    expect(install).toHaveBeenCalledWith(table);
    expect(table.getPlugin('test')).toBe(plugin);
    expect(table.getPlugins()).toEqual([plugin]);
  });

  it('rejects duplicate plugin names and invalid plugins', () => {
    const table = new SmartTable({ columns });
    const plugin: SmartTablePlugin = { name: 'test', install: () => {} };
    table.use(plugin);
    expect(() => table.use(plugin)).toThrowError(ERROR_CODES.PLUGIN_ALREADY_REGISTERED);
    expect(() => table.use({ name: 'bad' } as SmartTablePlugin)).toThrowError(
      ERROR_CODES.INVALID_PLUGIN
    );
  });

  it('unuse uninstalls a plugin', () => {
    const table = new SmartTable({ columns });
    const uninstall = vi.fn();
    table.use({ name: 'test', install: () => {}, uninstall });
    expect(table.unuse('test')).toBe(true);
    expect(uninstall).toHaveBeenCalledWith(table);
    expect(table.unuse('test')).toBe(false);
  });

  it('supports custom plugin events through the event bus', () => {
    const table = new SmartTable({ columns });
    const handler = vi.fn();
    table.on('paginationChanged', handler);
    table.events.emit('paginationChanged', { page: 2 });
    expect(handler).toHaveBeenCalledWith({ page: 2 });
  });
});

describe('SmartTable — lifecycle', () => {
  it('destroy uninstalls plugins, clears events and blocks further use', () => {
    const table = new SmartTable({ columns, data: rows });
    const uninstall = vi.fn();
    const handler = vi.fn();
    table.use({ name: 'test', install: () => {}, uninstall });
    table.on('modeChanged', handler);
    table.destroy();
    expect(table.isDestroyed()).toBe(true);
    expect(uninstall).toHaveBeenCalledTimes(1);
    expect(() => table.use({ name: 'x', install: () => {} })).toThrowError(
      ERROR_CODES.TABLE_DESTROYED
    );
    expect(() => table.addRow({})).toThrowError(ERROR_CODES.TABLE_DESTROYED);
    expect(() => table.setMode('readonly')).toThrowError(ERROR_CODES.TABLE_DESTROYED);
    expect(() => table.sort('name')).toThrowError(ERROR_CODES.TABLE_DESTROYED);
  });

  it('destroy is idempotent', () => {
    const table = new SmartTable({ columns });
    table.destroy();
    expect(() => table.destroy()).not.toThrow();
  });

  it('setTheme validates input', () => {
    const table = new SmartTable({ columns });
    expect(() => table.setTheme('neon' as never)).toThrowError(ERROR_CODES.INVALID_THEME);
    table.setTheme('corporate');
    expect(table.getTheme()).toBe('corporate');
  });
});
