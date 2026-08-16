// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import {
  captureLayout,
  createDefaultLayoutStorage,
  LayoutManager,
} from '../src/layouts/LayoutManager';
import type { Column, LayoutStorage } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'inStock', title: 'In stock', type: 'boolean' },
];

const rows = [
  { id: 1, name: 'Laptop', price: 1200, inStock: true },
  { id: 2, name: 'Mouse', price: 25, inStock: true },
  { id: 3, name: 'Monitor', price: 300, inStock: false },
  { id: 4, name: 'Keyboard', price: 75, inStock: true },
];

function makeStorage(): LayoutStorage {
  const store = new Map<string, string>();
  return {
    get(key: string): string | null {
      return store.get(key) ?? null;
    },
    set(key: string, value: string): void {
      store.set(key, value);
    },
    remove(key: string): void {
      store.delete(key);
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('LayoutManager', () => {
  it('saves and loads a layout through the storage adapter', () => {
    const manager = new LayoutManager(makeStorage(), 'orders');
    manager.save({
      id: 'l1',
      label: 'Compact',
      columns: [{ field: 'id', visible: true }],
      sort: null,
      query: '',
      filters: [],
      savedAt: Date.now(),
    });
    const loaded = manager.load('l1');
    expect(loaded?.label).toBe('Compact');
    expect(manager.list().map((l) => l.id)).toEqual(['l1']);
  });

  it('isolates namespaces and persists ids across instances', () => {
    const storage = makeStorage();
    const a = new LayoutManager(storage, 'a');
    const b = new LayoutManager(storage, 'b');
    a.save({
      id: 'shared',
      label: 'A layout',
      columns: [],
      sort: null,
      query: '',
      filters: [],
      savedAt: Date.now(),
    });
    expect(b.list()).toEqual([]);
    const fresh = new LayoutManager(storage, 'a');
    expect(fresh.list().map((l) => l.id)).toEqual(['shared']);
  });

  it('deletes and clears layouts', () => {
    const storage = makeStorage();
    const manager = new LayoutManager(storage, 'x');
    const base = {
      columns: [] as never[],
      sort: null,
      query: '',
      filters: [] as never[],
      savedAt: Date.now(),
    };
    manager.save({ id: 'a', ...base });
    manager.save({ id: 'b', ...base });
    manager.delete('a');
    expect(manager.list().map((l) => l.id)).toEqual(['b']);
    manager.clear();
    expect(manager.list()).toEqual([]);
  });

  it('ignores corrupt payloads on load', () => {
    const storage = makeStorage();
    storage.set('smarttable.layouts.x', '{not-json');
    const manager = new LayoutManager(storage, 'x');
    expect(manager.list()).toEqual([]);
  });

  it('falls back to an in-memory store without localStorage', () => {
    const storage = createDefaultLayoutStorage();
    storage.set('k', 'v');
    expect(storage.get('k')).toBe('v');
    storage.remove('k');
    expect(storage.get('k')).toBeNull();
  });
});

describe('captureLayout', () => {
  it('snapshots columns, sort, query and filters', () => {
    const table = new SmartTable({ columns, data: rows });
    table.setColumnWidth('name', 180);
    table.hideColumn('inStock');
    table.moveColumn('price', 'name');
    table.sort('price', 'desc');
    table.filter('Laptop');
    table.where('inStock', 'equals', true);

    const layout = captureLayout(table, 'l1', 'Snapshot');
    expect(layout.label).toBe('Snapshot');
    expect(layout.columns.map((c) => c.field)).toEqual(['id', 'price', 'name', 'inStock']);
    expect(layout.columns.find((c) => c.field === 'inStock')?.visible).toBe(false);
    expect(layout.columns.find((c) => c.field === 'name')?.width).toBe(180);
    expect(layout.sort).toEqual({ field: 'price', direction: 'desc' });
    expect(layout.query).toBe('laptop');
    expect(layout.filters).toEqual([{ field: 'inStock', operator: 'equals', operands: [true] }]);
  });
});

describe('SmartTable layout API', () => {
  it('persists layouts via a provided storage adapter', () => {
    const storage = makeStorage();
    const table = new SmartTable({
      columns,
      data: rows,
      layoutStorage: storage,
      layoutNamespace: 't1',
    });
    table.hideColumn('inStock');
    table.sort('name', 'asc');
    table.saveLayout('Compact');
    expect(table.getLayouts()).toHaveLength(1);
    const layout = table.getLayout(table.getLayouts()[0]!.id);
    expect(layout?.label).toBe('Compact');
    expect(layout?.columns.find((c) => c.field === 'inStock')?.visible).toBe(false);
  });

  it('uses the table id as the default namespace', () => {
    const storage = makeStorage();
    const table = new SmartTable({ columns, data: rows, layoutStorage: storage });
    table.saveLayout('Default');
    expect(storage.get('smarttable.layouts.' + table.id)).not.toBeNull();
  });

  it('loads a layout and applies columns, sort, query and filters', () => {
    const storage = makeStorage();
    const table = new SmartTable({ columns, data: rows, layoutStorage: storage });
    table.hideColumn('inStock');
    table.sort('name', 'asc');
    table.where('price', 'greaterThan', 30);
    const saved = table.saveLayout('Pricing');

    const fresh = new SmartTable({
      columns,
      data: rows,
      layoutStorage: storage,
      layoutNamespace: table.id,
    });
    expect(fresh.getVisibleColumns().map((c) => c.field)).toContain('inStock');
    fresh.loadLayout(saved.id);
    expect(fresh.getVisibleColumns().map((c) => c.field)).not.toContain('inStock');
    expect(fresh.getSortState()).toEqual({ field: 'name', direction: 'asc' });
    expect(fresh.getRows().map((r) => r.name)).toEqual(['Keyboard', 'Laptop', 'Monitor']);
  });

  it('applies a stored column order, tolerating unknown fields', () => {
    const storage = makeStorage();
    const table = new SmartTable({ columns, data: rows, layoutStorage: storage });
    table.moveColumn('inStock', 'id');
    const saved = table.saveLayout('Reordered');
    const fresh = new SmartTable({
      columns,
      data: rows,
      layoutStorage: storage,
      layoutNamespace: table.id,
    });
    fresh.loadLayout(saved.id);
    expect(fresh.getColumns().map((c) => c.field)).toEqual(['inStock', 'id', 'name', 'price']);
  });

  it('emits layoutChanged with id and label', () => {
    const storage = makeStorage();
    const table = new SmartTable({ columns, data: rows, layoutStorage: storage });
    const saved = table.saveLayout('One');
    const events: Array<{ id: string; label?: string }> = [];
    table.on('layoutChanged', (e) => events.push(e));
    table.loadLayout(saved.id);
    expect(events).toEqual([{ id: saved.id, label: 'One' }]);
  });

  it('deletes a layout', () => {
    const storage = makeStorage();
    const table = new SmartTable({ columns, data: rows, layoutStorage: storage });
    const saved = table.saveLayout('Temp');
    table.deleteLayout(saved.id);
    expect(table.getLayouts()).toEqual([]);
    expect(table.getLayout(saved.id)).toBeUndefined();
  });

  it('starts on page 1 and re-filters after loading a layout', () => {
    const table = new SmartTable({ columns, data: rows, layoutStorage: makeStorage() });
    table.goToPage(2);
    table.saveLayout('Snapshot');
    table.loadLayout('Snapshot');
    expect(table.getCurrentPage()).toBe(1);
    expect(table.getFilteredCount()).toBe(4);
  });
});
