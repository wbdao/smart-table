# Migrating from AG Grid

`@smart-table/ag-compat` is a compatibility layer that accepts a subset of AG
Grid's configuration and produces a live SmartTableJS instance — so you can
drop your existing `columnDefs` into a new grid with minimal edits.

## Install

```bash
npm install @smart-table/ag-compat @smart-table/core
```

## Quick start

```ts
import { createAgCompatibleTable } from '@smart-table/ag-compat';

const { table, warnings } = createAgCompatibleTable({
  // your existing AG Grid config (columnDefs / rowData / …)
  columnDefs,
  rowData,
  pagination: true,
  paginationPageSize: 25,
});

table.mount('#app');
```

Everything AG Grid set up for you — initial sorts, supported filter models,
pagination and layout — is applied automatically.

## What is mapped

| AG Grid config                      | SmartTableJS mapping                   |
| ----------------------------------- | -------------------------------------- |
| `columnDefs`                        | flattened leaf columns (`Column[]`)    |
| `headerName`                        | `title`                                |
| `width` / `minWidth`                | `width` / `minWidth`                   |
| `hide`                              | `visible: false`                       |
| `sortable`                          | `sortable`                             |
| `sort: 'asc'\|'desc'`               | applied via `table.sort()` after mount |
| `filter: true` + built-ins          | `type: 'number'\|'string'\|'boolean'`  |
| `filterModel`                       | structured filters via `table.where()` |
| `pagination` + `paginationPageSize` | `pageSize`                             |
| `defaultColDef`                     | merged defaults into every column      |
| `domLayout: 'autoHeight'\|'print'`  | virtual scrolling disabled             |
| `rowSelection: 'multiple'`          | row multi-select semantics accepted    |

Supported filter model operators: `equals`, `contains`, `startsWith`,
`endsWith`, `lessThan`, `greaterThan`, `inRange` (→ `between`) and set
`values` (→ `inList`).

## What is not mapped (yet)

The layer never throws — unsupported features become `ConversionWarning`s you
can inspect on the result:

```ts
for (const w of warnings) console.warn(`[ag-compat] ${w.code}: ${w.detail}`);
```

- **`maxWidth`** — SmartTableJS only constrains resizes via `minWidth`.
- **Column groups** — group _headers_ are flattened; children become leaf
  columns.
- **`notEqual` / `notContains` / `<=` / `>=` filters** — no 1:1 structured
  operator yet; implement with a `filter: 'string'` column + a custom predicate
  on `where()` once custom predicates ship.
- **OR filter groups** — structured filters are AND-composed.
- **Cell renderers, editors, value getters, pinned columns, row grouping,
  master/detail** — advance the migration by re-implementing these with core
  `Column` props (e.g. `formatter`, `editable`), grouping (`table.groupBy()`)
  or plugins.

## Incremental migration

1. **Run side-by-side.** Keep AG Grid in production and use
   `createAgCompatibleTable` on a staging route.
2. **Compare.** Assert same initial sort, filters and page counts with the
   result getters (`getSortState()`, `getStructuredFilters()`, `getTotalPages()`).
3. **Extend.** Replace mapped cut-offs (renderers → `formatter`, editors →
   `editable` + `validators`) and finally remove AG Grid.

## Rendering in framework adapters

Prefer the adapter for the migrated app, computing columns/data from the AG
config with `convertAgGridOptions()`:

```tsx
import { convertAgGridOptions } from '@smart-table/ag-compat';
import { SmartTable } from '@smart-table/react';

const { options } = convertAgGridOptions(agConfig);
<SmartTable columns={options.columns} data={options.data} pageSize={options.pageSize} />;
```
