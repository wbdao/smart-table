/**
 * Reference example — router state sync.
 *
 * Type-checked only. In a real app, replace the memory driver below with
 * TanStack Router's `useSearch`/`useNavigate`:
 *
 * const search = useSearch({ from: routeTree.id });
 * const navigate = useNavigate();
 * const driver = {
 *   getSearch: () => search,
 *   setSearch: (patch) => navigate({ search: (prev) => ({ ...prev, ...patch }) }),
 * };
 */
import { SmartTable, type Column, type DataRow } from '@smart-table/core';
import { createRouterStateSync, type RouterSearch } from '../src/index';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
];

const rows: DataRow[] = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
}));

function demo(): void {
  const table = new SmartTable({ columns, data: rows, pageSize: 10 });

  let search: RouterSearch = {};
  const sync = createRouterStateSync(table, {
    prefix: 'grid',
    driver: {
      getSearch: () => ({ ...search }),
      setSearch: (patch) => {
        search = { ...search, ...patch };
      },
    },
  });

  sync.start();
  // Now grid:page / grid:sort / grid:dir / grid:q stay in sync with the URL.
  // sync.stop() when the view unmounts.
  void sync;
}

void demo;
