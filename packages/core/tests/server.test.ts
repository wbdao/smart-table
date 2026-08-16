// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import type { Column } from '../src/types';
import type { DataSource, DataSourceParams, DataSourceResult } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
];

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    price: (i + 1) * 10,
  }));
}

function makeServer(rows = makeRows(250), pageSize = 50) {
  const calls: DataSourceParams[] = [];
  const source = vi.fn<DataSource>(async (params) => {
    calls.push(params);
    const filtered = rows.filter((r) =>
      String(r.name).toLowerCase().includes(params.filters.query.toLowerCase())
    );
    const sorted = params.sort.field
      ? [...filtered].sort((a, b) => {
          const aVal = a[params.sort.field as keyof typeof a];
          const bVal = b[params.sort.field as keyof typeof b];
          if (aVal < bVal) return params.sort.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return params.sort.direction === 'asc' ? 1 : -1;
          return 0;
        })
      : filtered;
    const start = (params.page - 1) * params.pageSize;
    return { rows: sorted.slice(start, start + params.pageSize), total: sorted.length };
  });
  const table = new SmartTable({ columns, pageSize, dataSource: source });
  return { table, source, calls };
}

/** Waits out the request debounce and the in-flight fetch. */
async function nextLoad(table: SmartTable): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  await table.waitForLoad();
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('server data source', () => {
  it('loads the first page on construction and reports the remote total', async () => {
    const { table, source, calls } = makeServer();
    await table.waitForLoad();
    expect(source).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({ page: 1, pageSize: 50 });
    expect(table.getRows()).toHaveLength(50);
    expect(table.getRowCount()).toBe(50);
    expect(table.getRemoteTotal()).toBe(250);
    expect(table.isServerMode()).toBe(true);
  });

  it('emits dataLoading then dataLoaded around a request', async () => {
    const { table } = makeServer();
    const loading = vi.fn();
    const loaded = vi.fn();
    await table.waitForLoad();
    table.on('dataLoading', loading);
    table.on('dataLoaded', loaded);
    table.goToPage(2);
    await nextLoad(table);
    expect(loading).toHaveBeenCalledTimes(1);
    expect(loaded).toHaveBeenCalledTimes(1);
    const loadedEvent = loaded.mock.calls[0]![0];
    expect(loadedEvent).toMatchObject({ mode: 'replace', total: 250 });
  });

  it('routes pagination to the server', async () => {
    const { table, source } = makeServer();
    await table.waitForLoad();
    table.goToPage(3);
    await nextLoad(table);
    expect(source).toHaveBeenCalledTimes(2);
    expect(table.getCurrentPage()).toBe(3);
    const rows = table.getRows();
    expect(rows).toHaveLength(50);
    expect(rows[0]?.id).toBe(101);
  });

  it('routes sort to the server and resets to page 1', async () => {
    const { table, source } = makeServer();
    await table.waitForLoad();
    table.goToPage(3);
    await nextLoad(table);
    table.sort('price', 'desc');
    await nextLoad(table);
    expect(source).toHaveBeenCalledTimes(3);
    const last = source.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ page: 1, sort: { field: 'price', direction: 'desc' } });
  });

  it('forwards the global query to the server', async () => {
    const { table, source } = makeServer(makeRows(100));
    await table.waitForLoad();
    table.filter('Item 1');
    await nextLoad(table);
    const last = source.mock.calls.at(-1)?.[0];
    // Queries are normalized to lowercase before being forwarded.
    expect(last?.filters.query).toBe('item 1');
  });

  it('emits dataLoadFailed when the source rejects', async () => {
    const failing = vi.fn(async () => {
      throw new Error('network down');
    });
    const table = new SmartTable({
      columns,
      pageSize: 20,
      dataSource: failing as never,
    });
    const failed = vi.fn();
    table.on('dataLoadFailed', failed);
    await table.waitForLoad();
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed.mock.calls[0]![0].error).toBeInstanceOf(Error);
  });

  it('discards late responses so only the newest request commits', async () => {
    let resolvePage2!: (value: DataSourceResult | PromiseLike<DataSourceResult>) => void;
    const source = vi.fn<DataSource>((params) => {
      if (params.page === 2) {
        return new Promise((resolve) => {
          resolvePage2 = resolve;
        });
      }
      return Promise.resolve({ rows: [{ id: 999 }], total: 250 });
    });
    const table = new SmartTable({ columns, pageSize: 50, dataSource: source });
    await table.waitForLoad(); // page 1 committed
    const loaded = vi.fn();
    table.on('dataLoaded', loaded);
    // Request page 2 (its debounce fires after 120ms) and let it start.
    table.goToPage(2);
    await new Promise((resolve) => setTimeout(resolve, 150)); // page 2 now pending
    // Now issue a newer request that supersedes page 2.
    table.sort('price', 'desc');
    await nextLoad(table); // newest (sorted page 1) commits
    // Resolve the stale page-2 response — it must be discarded.
    resolvePage2({ rows: [{ id: 888 }], total: 250 });
    await table.waitForLoad();
    // Only the newest request emitted dataLoaded.
    expect(loaded).toHaveBeenCalledTimes(1);
    expect(loaded.mock.calls[0]![0].page).toBe(1);
    // The discarded page-2 rows (id 888) must not appear.
    expect(table.getRows().map((r) => r.id)).toEqual([999]);
  });

  it('debounces rapid param changes into a single request', async () => {
    vi.useFakeTimers();
    const { table, source } = makeServer(makeRows(100), 20);
    await table.waitForLoad();
    source.mockClear();
    table.filter('a');
    table.filter('b');
    table.filter('c');
    vi.advanceTimersByTime(150);
    await table.waitForLoad();
    expect(source).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('server options validation', () => {
  it('rejects a non-function dataSource', () => {
    expect(() => new SmartTable({ columns, dataSource: 'nope' as never })).toThrowError(
      ERROR_CODES.INVALID_DATA_SOURCE
    );
  });
});
