/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { SmartTable, type DataRow } from '@smart-table/core';
import { createRouterStateSync } from '../src/index';
import type { RouterDriver, RouterSearch } from '../src/index';

const rows: DataRow[] = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `row ${i + 1}` }));

function makeTable(): SmartTable {
  const table = new SmartTable({
    columns: [
      { field: 'id', title: 'ID', type: 'number' },
      { field: 'name', title: 'Name', type: 'string' },
    ],
    data: rows,
    pageSize: 10,
  });
  return table;
}

function memoryDriver(store: RouterSearch = {}): RouterDriver {
  return {
    getSearch: () => ({ ...store }),
    setSearch: (patch) => {
      Object.assign(store, patch);
    },
  };
}

describe('createRouterStateSync', () => {
  it('serializes page, sort and query into prefixed search params', () => {
    const store: RouterSearch = {};
    const table = makeTable();
    table.filter('row 2');
    table.sort('id', 'desc');
    table.goToPage(2);

    createRouterStateSync(table, { driver: memoryDriver(store), prefix: 'grid' }).pushToRouter();

    expect(store['grid:page']).toBe(2);
    expect(store['grid:sort']).toBe('id');
    expect(store['grid:dir']).toBe('desc');
    expect(store['grid:q']).toBe('row 2');
  });

  it('restores table state from search params (toTable)', () => {
    const store: RouterSearch = { 'g:page': 2, 'g:sort': 'name', 'g:dir': 'asc', 'g:q': 'row 2' };
    const table = makeTable();
    const sync = createRouterStateSync(table, {
      driver: memoryDriver(store),
      prefix: 'g',
      sync: 'toTable',
    });
    sync.applyFromRouter();

    expect(table.getCurrentPage()).toBe(2);
    expect(table.getSortState()).toEqual({ field: 'name', direction: 'asc' });
    expect(table.getFilteredCount()).toBeGreaterThan(0);
    expect(table.getFilteredCount()).toBeLessThan(30);
  });

  it('start() applies then watches table changes', () => {
    const store: RouterSearch = {};
    const table = makeTable();
    const sync = createRouterStateSync(table, { driver: memoryDriver(store), prefix: 'g' });
    sync.start();

    expect(store['g:page']).toBe(1);
    table.sort('id', 'asc');
    expect(store['g:sort']).toBe('id');
    expect(store['g:dir']).toBe('asc');

    table.goToPage(3);
    expect(store['g:page']).toBe(3);

    table.filter('row 1');
    expect(store['g:q']).toBe('row 1');
  });

  it('stop() detaches the watchers', () => {
    const store: RouterSearch = {};
    const table = makeTable();
    const sync = createRouterStateSync(table, {
      driver: memoryDriver(store),
      prefix: 'g',
      sync: 'toRouter',
    });
    sync.start();
    table.sort('id', 'asc');
    expect(store['g:sort']).toBe('id');

    sync.stop();
    delete store['g:sort'];
    table.sort('name', 'desc');
    expect(store['g:sort']).toBeUndefined();
  });

  it('supports custom serialize/apply callbacks', () => {
    const store: RouterSearch = {};
    const table = makeTable();
    const sync = createRouterStateSync(table, {
      driver: memoryDriver(store),
      prefix: 'grid',
      serialize: (snapshot) => ({
        [':page']: snapshot.page,
        [':sort']: snapshot.sort.field ?? 'none',
      }),
      apply: (patch, t) => {
        const p = Number(patch[':page']);
        if (p > 0) t.goToPage(p);
      },
    });
    sync.pushToRouter();
    expect(store[':page']).toBe(1);
    expect(store[':sort']).toBe('none');
  });
});
