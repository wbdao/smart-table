/**
 * Reference example — TanStack Query-backed data source.
 *
 * This file is type-checked but not runnable standalone: wire it into your
 * React app with `useQueryClient()` to share the cache.
 */
import { QueryClient } from '@tanstack/query-core';
import { SmartTable, type Column, type DataSourceParams } from '@smart-table/core';
import { queryDataSource } from '../src/index';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
];

async function fetchOrders(_params: DataSourceParams): Promise<{ rows: never[]; total: number }> {
  // e.g. return api.get('/orders', { query: params });
  const res = await fetch(`/api/orders?page=${_params.page}&pageSize=${_params.pageSize}`);
  const total = Number(res.headers.get('x-total-count') ?? 0);
  const rows = (await res.json()) as never[];
  return { rows, total };
}

function demo(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5_000 } },
  });

  const table = new SmartTable({
    columns,
    pageSize: 25,
    dataSource: queryDataSource({
      queryClient,
      queryKey: ['orders'],
      staleTime: 5_000,
      queryFn: fetchOrders,
    }),
  });

  table.mount('#app');
}

void demo;
