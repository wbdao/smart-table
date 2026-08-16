/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { SmartTable, type DataSourceParams } from '@smart-table/core';
import { invalidateTableQueries, queryDataSource, tableQueryKey } from '../src/index';
import type { QueryPage } from '../src/index';

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function params(page: number): DataSourceParams {
  return {
    page,
    pageSize: 10,
    sort: { field: null, direction: null },
    filters: { query: '', structured: [] },
  };
}

function loader(calls: DataSourceParams[] = []): (p: DataSourceParams) => QueryPage {
  return (p: DataSourceParams) => {
    calls.push(p);
    const total = 100;
    const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
    const start = (p.page - 1) * p.pageSize;
    return { rows: rows.slice(start, start + p.pageSize), total };
  };
}

describe('queryDataSource', () => {
  it('wraps a loader as a DataSource carrying param suffixes in the key', async () => {
    const queryClient = client();
    const calls: DataSourceParams[] = [];
    const source = queryDataSource({
      queryClient,
      queryKey: ['rows'],
      queryFn: loader(calls),
    });

    const params: DataSourceParams = {
      page: 2,
      pageSize: 10,
      sort: { field: 'id', direction: 'asc' },
      filters: { query: '', structured: [] },
    };
    const result = await source(params);
    expect(result.total).toBe(100);
    expect(result.rows).toHaveLength(10);
    expect(calls).toHaveLength(1);
  });

  it('serves repeated identical requests from the query cache while fresh', async () => {
    const queryClient = client();
    const fn = vi.fn(loader());
    const source = queryDataSource({
      queryClient,
      queryKey: ['cache'],
      queryFn: fn,
      staleTime: 60_000,
    });

    await source(params(1));
    await source(params(1));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('creates distinct cache nodes per param set', async () => {
    const queryClient = client();
    const fn = vi.fn(loader());
    const source = queryDataSource({ queryClient, queryKey: ['pages'], queryFn: fn });

    await source(params(1));
    await source(params(2));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('invalidateTableQueries busts the shared cache', async () => {
    const queryClient = client();
    const fn = vi.fn(loader());
    const source = queryDataSource({ queryClient, queryKey: ['bust'], queryFn: fn });

    await source(params(1));
    await invalidateTableQueries(queryClient, ['bust']);
    await source(params(1));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('tableQueryKey reproduces the source key shape', () => {
    expect(tableQueryKey(['orders'], params(3))).toEqual(['orders', params(3)]);
  });
});

describe('queryDataSource with a live table', () => {
  it('drives SmartTable server pagination through queryDataSource', async () => {
    const queryClient = client();
    const table = new SmartTable({
      columns: [{ field: 'id', type: 'number' }],
      pageSize: 10,
      dataSource: queryDataSource({ queryClient, queryKey: ['orders'], queryFn: loader() }),
    });
    table.goToPage(2);
    // wait out the server controller debounce (120ms default)
    await new Promise((r) => setTimeout(r, 220));
    expect(table.getData().length).toBeGreaterThan(0);
    expect(table.getRemoteTotal()).toBe(100);
  });
});
