// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
];

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('local infinite scroll', () => {
  it('reveals rows in chunks and reports more remaining', () => {
    const table = new SmartTable({ columns, data: makeRows(250), infiniteScroll: true });
    expect(table.hasMore()).toBe(true);
    expect(table.getRows()).toHaveLength(100); // default step of 100 when pagination off
    table.loadMore();
    expect(table.getRows()).toHaveLength(200);
    expect(table.hasMore()).toBe(true);
    table.loadMore();
    expect(table.getRows()).toHaveLength(250);
    expect(table.hasMore()).toBe(false);
  });

  it('uses the page size as the initial step', () => {
    const table = new SmartTable({
      columns,
      data: makeRows(100),
      pageSize: 20,
      infiniteScroll: true,
    });
    expect(table.getRows()).toHaveLength(20);
    expect(table.hasMore()).toBe(true);
    table.loadMore();
    expect(table.getRows()).toHaveLength(40);
    table.loadMore();
    expect(table.getRows()).toHaveLength(60);
  });

  it('stops when all rows are revealed', () => {
    const table = new SmartTable({
      columns,
      data: makeRows(5),
      pageSize: 2,
      infiniteScroll: true,
    });
    expect(table.hasMore()).toBe(true);
    table.loadMore();
    table.loadMore();
    expect(table.getRows()).toHaveLength(5);
    expect(table.hasMore()).toBe(false);
    expect(table.loadMore()).toBe(false);
  });

  it('emits loadMoreRequested and dataChanged while loading', () => {
    const table = new SmartTable({
      columns,
      data: makeRows(50),
      pageSize: 10,
      infiniteScroll: true,
    });
    const requested = vi.fn();
    const changed = vi.fn();
    table.on('loadMoreRequested', requested);
    table.on('dataChanged', changed);
    table.loadMore();
    expect(requested).toHaveBeenCalledTimes(1);
    expect(requested.mock.calls[0]![0]).toMatchObject({
      page: 2,
      loadedCount: 10,
      totalCount: 50,
    });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0]![0].operation).toBe('loadMore');
  });

  it('is disabled by default', () => {
    const table = new SmartTable({ columns, data: makeRows(10) });
    expect(table.hasMore()).toBe(false);
    expect(table.loadMore()).toBe(false);
  });
});

describe('server-mode infinite scroll', () => {
  it('requests the next page and appends it', async () => {
    const calls: number[] = [];
    const table = new SmartTable({
      columns,
      pageSize: 20,
      dataSource: async (params) => {
        calls.push(params.page);
        const start = (params.page - 1) * 20;
        return { rows: makeRows(20).map((r, i) => ({ ...r, id: start + i + 1 })), total: 100 };
      },
    });
    await table.waitForLoad();
    expect(table.getRows()).toHaveLength(20);
    const requested = vi.fn();
    table.on('loadMoreRequested', requested);
    expect(table.loadMore()).toBe(true);
    await table.waitForLoad();
    expect(calls).toEqual([1, 2]);
    expect(table.getRows()).toHaveLength(40);
    expect(requested).toHaveBeenCalledTimes(1);
    expect(requested.mock.calls[0]![0]).toMatchObject({ page: 2, totalCount: 100 });
  });

  it('refuses to load past the reported total', async () => {
    const table = new SmartTable({
      columns,
      pageSize: 20,
      dataSource: async (params) => {
        const start = (params.page - 1) * 20;
        return { rows: makeRows(20).map((r, i) => ({ ...r, id: start + i + 1 })), total: 40 };
      },
    });
    await table.waitForLoad();
    table.loadMore();
    await table.waitForLoad();
    expect(table.getRows()).toHaveLength(40);
    expect(table.hasMore()).toBe(false);
    expect(table.loadMore()).toBe(false);
  });
});
