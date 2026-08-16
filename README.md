# SmartTableJS

Framework-agnostic, high-performance data table library for TypeScript and
JavaScript — works with Vanilla JS, React, Vue and Angular.

> **Status:** Phase 7 complete, **next milestone: `v1.0.0`** — a pnpm monorepo
> with first-class **React / Vue / Angular / Web Components** bindings, a
> plugin marketplace (`table.use()`), a VitePress docs site, a public
> marketing site, an interactive playground, Storybook stories, a comparative
> performance lab, and changesets + GitHub Actions release pipelines.
> Phases 1–4 core: virtual scrolling (100k+ rows), server data source,
> infinite scroll, row grouping, aggregations, tree data, grid state manager
> and a headless pivot engine. Phase 7 shipped the **`v0.9.0-beta`** release
> prep: governance files, AG Grid migration (`@smart-table/ag-compat`),
> TanStack Query/Router integration (`@smart-table/tanstack`), observability
> (`@smart-table/telemetry`, `@smart-table/devtools`), collaboration / charts
> / security foundations, and the API-stability + performance certification.
> See [docs/PHASE_1.md](docs/PHASE_1.md),
> [docs/PHASE_2.md](docs/PHASE_2.md),
> [docs/PHASE_3.md](docs/PHASE_3.md),
> [docs/PHASE_4.md](docs/PHASE_4.md),
> [docs/PHASE_5.md](docs/PHASE_5.md),
> [docs/PHASE_6.md](docs/PHASE_6.md),
> [docs/PHASE_7.md](docs/PHASE_7.md) and [ROADMAP.md](ROADMAP.md).

## Install

```bash
npm install @smart-table/core
```

Framework adapters (same headless core, zero renderer leakage):

```bash
npm install @smart-table/react    # React 18+
npm install @smart-table/vue      # Vue 3
npm install @smart-table/angular  # Angular 17+ (standalone)
npm install @smart-table/web      # framework-free <smart-table> element
```

Beta-flavored companions for the v0.9.0-beta release:

```bash
npm install @smart-table/ag-compat    # migrate existing AG Grid options
npm install @smart-table/tanstack     # TanStack Query + Router sync
npm install @smart-table/telemetry    # observable metrics collector
npm install @smart-table/devtools     # development overlay
```

```tsx
// React — controlled component over the core.
import { SmartTable } from '@smart-table/react';
<SmartTable columns={columns} data={rows} onSortChanged={...} />;

// Vue — component with v-model:data through the core options.
import { SmartTable } from '@smart-table/vue';
<SmartTable v-model:data="rows" :columns="columns" />;

// Angular — standalone component, inputs mirror core options.
import { SmartTableComponent } from '@smart-table/angular';
<smart-table [columns]="columns" [data]="rows" (sortChanged)="..."></smart-table>;
```

## Quick start

```ts
import { SmartTable } from '@smart-table/core';
import '@smart-table/core/styles.css';

const table = new SmartTable({
  columns: [
    { field: 'id', title: 'ID', type: 'number' },
    { field: 'name', title: 'Name', type: 'string' },
    { field: 'price', title: 'Price', type: 'number', validators: { min: 0 } },
  ],
  data: [
    { id: 1, name: 'Laptop', price: 1200 },
    { id: 2, name: 'Mouse', price: 25 },
  ],
  container: '#app', // render here
  responsive: true, // card layout on narrow screens
  pageSize: 10, // enable pagination (0 = off)
  contextMenu: true, // right-click menu on headers/cells/rows
});

table.mount(); // toolbar, sorting, selection, in-cell editing

table.on('cellEdit', (e) => console.log(e.field, e.oldValue, '->', e.newValue));
table.selectRow('1');
table.setTheme('dark');
table.sort('price', 'desc');
table.filter('laptop');
table.hideColumn('price');
table.setColumnWidth('name', 180);
table.moveColumn('price', 'name');
table.undo(); // revert the last mutation
table.where('price', 'between', 10, 50);
table.saveLayout('Compact'); // save current view
table.exportCSV('report.csv'); // download CSV
await table.copy('csv');
const clone = table.clone();
```

## Features

| Feature           | API / option                                    |
| ----------------- | ----------------------------------------------- |
| Column visibility | `hideColumn` / `showColumn` / `toggleColumn`    |
| Column resize     | `setColumnWidth` / `resetColumnWidth`           |
| Column reorder    | `moveColumn` (drag & drop on headers)           |
| Undo / redo       | `undo` / `redo` / `canUndo` / `canRedo`         |
| Validation        | `validators` on columns, `validateRow`          |
| Pagination        | `pageSize`, `goToPage`, `nextPage`              |
| Advanced filters  | `where(field, operator, ...operands)`           |
| Saved layouts     | `saveLayout` / `loadLayout` / `getLayouts`      |
| Context menu      | `contextMenu` option, `contextMenuAction`       |
| Export            | `exportCSV` / `exportJSON` / `serialize`        |
| Virtual scrolling | `virtualScroll` option (100k+ rows)             |
| Server data       | `dataSource` option, `waitForLoad`              |
| Infinite scroll   | `infiniteScroll` option, `loadMore` / `hasMore` |
| Row grouping      | `groupBy` / `ungroup` / `toggleGroup`           |
| Aggregations      | `aggregate` / `getAggregateFooter`              |
| Tree data         | `tree` option, `expandNode` / `toggleNode`      |
| Grid state        | `exportState` / `importState` / `resetState`    |
| Pivot             | `pivot` / `clearPivot` + `PivotView`            |
| Themes            | `setTheme` (built-in or custom variables)       |
| Responsive        | `responsive` (card layout on mobile)            |

### Advanced filters

Operators: `equals`, `contains`, `startsWith`, `endsWith`, `greaterThan`,
`lessThan`, `between`, `inList`. Standalone helpers are exported from the
package entry: `FILTER_OPERATORS`, `OPERATOR_LABELS`, `OPERAND_COUNT`,
`isFilterOperator`, `matchesOperator`.

```ts
table.where('name', 'contains', 'la');
table.where('price', 'between', 10, 50);
table.where('category', 'inList', ['A', 'B']);
table.clearColumnFilter('price');
table.getStructuredFilters(); // serializable, used by saved layouts
```

### Saved layouts

Layouts snapshot column order/visibility/width, sort, search query and active
filters. They persist through a storage adapter (default `localStorage` with an
in-memory fallback) under the key `smarttable.layouts.<namespace>`.

```ts
table.saveLayout('Compact');
table.loadLayout(id);
table.deleteLayout(id);
table.getLayouts();

const table = new SmartTable({
  columns,
  data,
  layoutStorage: myAdapter, // { get, set, remove } — optional
  layoutNamespace: 'orders', // optional, defaults to table id
});
```

### Context menu

```ts
contextMenu: {
  items: [
    {
      id: 'ping',
      label: 'Ping row',
      target: 'row', // 'header' | 'cell' | 'row'
      run: ({ row }) => console.log(row),
    },
  ],
}

table.on('contextMenu', (e) => console.log(e.target, e.field, e.row));
table.on('contextMenuAction', (e) => console.log(e.action, e.field, e.row));
```

### Export

```ts
table.exportCSV('report.csv'); // downloads + emits `exported`
table.exportJSON('report.json');
const csv = table.serialize('csv'); // string, no download
```

### Large datasets (Phase 4)

```ts
// Virtual scrolling — render only the visible window of 100k+ rows.
const table = new SmartTable({
  columns,
  data,
  virtualScroll: { rowHeight: 40, overscan: 5 },
});

// Server data source — remote filtering/sorting/pagination.
const remote = new SmartTable({
  columns,
  pageSize: 50,
  dataSource: async (params) => {
    const res = await fetch(`/api?page=${params.page}&q=${params.filters.query}`);
    return await res.json(); // { rows, total }
  },
});
remote.on('dataLoaded', (e) => console.log('page', e.page, 'of', e.total));
remote.goToPage(2);
await remote.waitForLoad();

// Infinite scroll (local or server).
const inf = new SmartTable({ columns, data, infiniteScroll: true });
while (inf.hasMore()) inf.loadMore();

// Grouping + aggregations.
table.groupBy('category');
table.aggregate({ price: 'sum' });
table.toggleGroup('Electronics');

// Tree data.
const tree = new SmartTable({ columns, data, tree: { lazyChildren: async (row) => [...] } });
await tree.expandNode('1');

// Grid state snapshots.
table.importState(table.exportState());

// Pivot — headless engine + the `PivotView` renderer (swapped in while active).
table.pivot({
  rows: ['category'],
  columns: ['name'],
  values: [{ field: 'price', aggregation: 'sum' }],
});
table.getPivotResult()?.getValue(['Electronics'], ['Laptop'], 'price', 'sum');
table.clearPivot(); // the grid returns
```

## Events

| Event                     | Payload                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `cellEdit`                | `{ row, rowId, field, oldValue, newValue }`                            |
| `selectionChanged`        | `{ rows, rowIds }`                                                     |
| `dataChanged`             | `{ operation, row?, rowId?, rowIndex?, field?, oldValue?, newValue? }` |
| `sortChanged`             | `{ field, direction }`                                                 |
| `filterChanged`           | `{ field?, query?, totalPages }`                                       |
| `pageChanged`             | `{ page, pageSize, totalPages, rowCount, totalCount }`                 |
| `columnVisibilityChanged` | `{ field, visible, visibleColumns }`                                   |
| `columnResized`           | `{ field, width }`                                                     |
| `columnReordered`         | `{ field, beforeField, columns }`                                      |
| `historyChanged`          | `{ canUndo, canRedo, undoCount, redoCount }`                           |
| `validationFailed`        | `{ field, rowId, messages }`                                           |
| `validationPassed`        | `{ field, rowId }`                                                     |
| `layoutChanged`           | `{ id, label? }`                                                       |
| `contextMenu`             | `{ target, field, row, x, y, items }`                                  |
| `contextMenuAction`       | `{ action, target, field, row }`                                       |
| `exported`                | `{ format, filename, rowCount }`                                       |
| `themeChanged`            | `{ name, custom }`                                                     |
| `modeChanged`             | `{ mode }`                                                             |
| `viewportChanged`         | `{ start, end, total, firstVisibleRow, lastVisibleRow }`               |
| `dataLoading`             | `{ page }`                                                             |
| `dataLoaded`              | `{ page, mode, total }`                                                |
| `dataLoadFailed`          | `{ error }`                                                            |
| `loadMoreRequested`       | `{ page, loadedCount, totalCount }`                                    |
| `groupChanged`            | `{ field, collapsed }`                                                 |
| `nodeExpanded`            | `{ rowId, row, depth, childCount }`                                    |
| `nodeCollapsed`           | `{ rowId, row, depth }`                                                |
| `aggregationChanged`      | `{ aggregations }`                                                     |
| `pivotChanged`            | `{ config }`                                                           |
| `toolbar:*`               | `search`, `copy`, `clone`, `add`, `mode`, `page`, `export`             |

## Scripts

| Command                | Purpose                                |
| ---------------------- | -------------------------------------- |
| `pnpm dev`             | Vite dev server for `examples/`        |
| `pnpm build`           | Build all packages (ESM + CJS + types) |
| `pnpm typecheck`       | Strict `tsc --noEmit` across workspace |
| `pnpm test`            | Vitest (Node + jsdom suites)           |
| `pnpm bench`           | Vitest bench (Phase 4 suite)           |
| `pnpm lint`            | ESLint 9 + Prettier compat             |
| `pnpm docs:dev`        | VitePress docs site (local dev)        |
| `pnpm docs:build`      | Build static docs site                 |
| `pnpm playground:dev`  | Interactive playground                 |
| `pnpm storybook`       | Storybook (component stories)          |
| `pnpm performance:dev` | Performance lab vs other grids         |
| `pnpm changeset`       | Record a change for release            |
| `pnpm release`         | Publish via changesets                 |

## Migration notes

- **`ColumnResizedEvent.width`** is now `string | number | undefined`.
  `resetColumnWidth` emits `undefined`; code comparing against a number should
  treat `undefined` as "auto" / reset.
- **`filterChanged`** now also carries `totalPages`. Optional, but helpful when
  migrating paginated tables off manual bookkeeping.
- **New toolbar controls** `pagination`, `filters`, `layouts`, `export` are
  opt-in — existing `toolbarControls` arrays keep working unchanged.
- **`getRows()`** returns the filtered + sorted view (and the current page when
  pagination is enabled). Use `getFilteredCount()` for the all-pages count.
- **`setColumns`** prunes structured filters whose column is gone and validates
  the sort/visibility state — old layouts referencing unknown fields are
  ignored gracefully.

## Community & governance

- [ROADMAP.md](ROADMAP.md) — status, beta strategy, path to v1.0
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, conventions, PR process
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md) — how to report vulnerabilities
- [SUPPORTED_VERSIONS.md](SUPPORTED_VERSIONS.md) — support matrix
- [docs/COMMUNITY.md](docs/COMMUNITY.md) — Discussions guidelines
- [docs/RELEASING.md](docs/RELEASING.md) — release & versioning strategy

## License

MIT
