import type { QueryClient } from '@tanstack/query-core';
import type { DataRow, DataSource, DataSourceParams, DataSourceResult } from '@smart-table/core';

/** A page of rows your server-side loader returns. */
export interface QueryPage {
  rows: DataRow[];
  total: number;
}

export interface QueryDataSourceOptions {
  /** TanStack Query client that owns the cache. */
  queryClient: QueryClient;
  /**
   * Base cache key (e.g. `['orders']`). Param changes become suffixes, so
   * each page/sort/filter combination caches separately.
   */
  queryKey: unknown[];
  /** Loads one page for the given params (your server call). */
  queryFn: (params: DataSourceParams) => Promise<QueryPage> | QueryPage;
  /** Freshness window in ms; cached pages within it are reused. */
  staleTime?: number;
  /** Maximum cache time in ms. Defaults to 5 minutes. */
  gcTime?: number;
}

/**
 * Wraps a TanStack Query-backed loader as a SmartTableJS `DataSource`.
 *
 * ```ts
 * const { queryClient } = useQueryClient();                   // React example
 * const table = new SmartTable({
 *   columns,
 *   pageSize: 25,
 *   dataSource: queryDataSource({
 *     queryClient,
 *     queryKey: ['orders'],
 *     queryFn: (params) => api.fetchOrders(params),
 *   }),
 * });
 * ```
 *
 * Sorting, filtering and pagination fire `fetchQuery` for the exact params —
 * repeated trips are served from the query cache until the data is stale.
 */
export function queryDataSource(options: QueryDataSourceOptions): DataSource {
  return (params: DataSourceParams): Promise<DataSourceResult> =>
    options.queryClient.fetchQuery({
      queryKey: [...options.queryKey, params],
      staleTime: options.staleTime,
      gcTime: options.gcTime,
      queryFn: () => Promise.resolve(options.queryFn(params)),
    });
}

/** Shortcut that matches the data source's cache suffix keys exactly. */
export function tableQueryKey(base: unknown[], params: DataSourceParams): unknown[] {
  return [...base, params];
}

/**
 * Invalidates every cached page for a table key, forcing the next fetch to
 * refetch. Call it after local mutations that the grid cannot see.
 */
export function invalidateTableQueries(
  queryClient: QueryClient,
  queryKey: unknown[]
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey });
}
