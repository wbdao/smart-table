# TanStack Query & Router

`@smart-table/tanstack` bridges the TanStack ecosystem with SmartTableJS:

- **`queryDataSource()`** — a SmartTableJS `DataSource` powered by TanStack
  Query's cache.
- **`createRouterStateSync()`** — two-way sync of table state (page, sort,
  query) with TanStack Router search params (or any router).

## Install

```bash
npm install @smart-table/tanstack @tanstack/query-core
```

## Query data source

`queryDataSource` returns a `DataSource` compatible with `new SmartTable`.
Each request becomes a cache node keyed by `queryKey + params`, so identical
mutations are served from the query cache until `staleTime` expires.

```ts
import { queryDataSource } from '@smart-table/tanstack';
import { QueryClient, useQueryClient } from '@tanstack/react-query';

function MyGrid() {
  const queryClient = useQueryClient();
  const table = useMemo(
    () =>
      new SmartTable({
        columns,
        pageSize: 25,
        dataSource: queryDataSource({
          queryClient,
          queryKey: ['orders'],
          staleTime: 5_000,
          queryFn: (params) => fetchOrders(params), // { rows, total }
        }),
      }),
    [queryClient],
  );
  return <div ref={(node) => node && table.mount(node)} />;
}
```

After a mutation that the grid cannot see, bust the cache:

```ts
import { invalidateTableQueries } from '@smart-table/tanstack';
await invalidateTableQueries(queryClient, ['orders']);
```

## Router state sync

`createRouterStateSync` reads and writes table state from a router's search
params (`page`, active sort, global query), namespaced by a prefix.

```ts
import { createRouterStateSync } from '@smart-table/tanstack';
import { useNavigate, useSearch } from '@tanstack/react-router';

const search = useSearch({ from: routeTree.id });
const navigate = useNavigate();

const sync = createRouterStateSync(table, {
  prefix: 'grid',
  driver: {
    getSearch: () => search,
    setSearch: (patch) => navigate({ search: (prev) => ({ ...prev, ...patch }) }),
  },
});

sync.start(); // one-time apply + push, then watch table changes
// … on unmount:
sync.stop();
```

Any object with `getSearch()` / `setSearch()` works — TanStack Router, Next.js
`useRouter`, or the browser History API. Default serialization uses
`grid:page`, `grid:sort`, `grid:dir`, `grid:q`; pass `serialize` / `apply`
callbacks for custom shapes, and `sync: 'toRouter' | 'toTable' | 'both'` to
restrict the direction.
