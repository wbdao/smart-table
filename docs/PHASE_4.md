# PHASE 4 — Enterprise Performance & Large Dataset Architecture

Status: **complete** (virtual scrolling, server data source, infinite scroll,
row grouping, aggregations, tree data, grid state manager, pivot engine with
`PivotView` renderer, benchmarks — 387 tests / 28 suites).

Phase 4 turns SmartTableJS into an enterprise-grade grid for 100k+ row
datasets. It keeps the Phase 1–3 guarantees intact: the core
(`SmartTable`/`DataManager`) stays headless, feature modules live under
`src/features/`, the renderer stays thin and everything is wired through the
public API + typed event bus. Existing functionality was extended, never
rewritten.

---

## 1. Architecture decisions

### 1.1 Virtual scrolling — a windowed renderer, not a DOM rewrite

`TableView` gains a `virtualizer` (a `ViewportManager` + fixed `rowHeight`,
default 40). When `virtualScroll` is enabled:

- `Table` root gets the `st-virtual` class; the inner scroll container owns the
  scrollbar.
- `syncRows()` branches to `syncVirtual()`, which renders only the window
  computed by `ViewportManager.renderWindow()` — two spacer rows
  (`.st-virtual-spacer-row`) frame the live rows, whose absolute `top` is
  derived from the window start and the fixed row height.
- Every scroll tick calls `renderVirtualWindow(range)`; rows leave/re-enter the
  DOM as the window moves, so a 100k-row table never has more than ~visible +
  `overscan` rows mounted.
- `maybeLoadMore()` runs after a render: when infinite scroll is on and the
  window is within 3 rows of the end, it calls `table.loadMore()`.
- `viewportChanged` (`{ start, end, total, firstVisibleRow, lastVisibleRow }`)
  is emitted on window moves so toolbar/plugins can react cheaply.

`RowPool` recycles row elements across frames the window reuses them; destroyed
once per frame key scroll to keep the DOM small. Drop-in for existing tables:
`virtualScroll: true` keeps `getRows()` semantics unchanged (it still returns
the full logical view, not the window).

### 1.2 Server data source — remote mode owns pagination

Supplying `dataSource(params) => { rows, total }` flips `DataManager` into
`remoteMode`. In remote mode the data layer **skips** local filtering, sorting
and pagination (`getViewRows()` returns the server `view` page as-is — a real
double-pagination bug was found and fixed here). The server owns those concerns
via `ServerController`:

- `refreshParams()` builds `{ page, pageSize, sort, filters: { query, structured } }`
  and any mutating API (`sort`, `clearSort`, `filter`, `filterColumn`,
  `clearFilter`, `where`, `clearColumnFilter`, `setPageSize`, `goToPage`,
  `nextPage`, `prevPage`) requests a new page through `serverController.request()`.
- Requests are **debounced** (120ms) and **serialized**: only the newest request
  commits, stale responses are discarded (a sequence counter guards it).
- `dataLoading` → `dataLoaded` (`{ page, mode: 'replace' | 'append', total }`)
  frame every fetch; rejections emit `dataLoadFailed` (`{ error }`).
- `waitForLoad()` resolves when the current in-flight request settles; `loadMore()`
  requests the next page in append mode for infinite scroll.

Queries are normalized to lowercase before forwarding. `getRemoteTotal()`
reports the server-reported total; `isServerMode()` and `hasMore()` let the UI
disable local pager math.

### 1.3 Infinite scroll — a view limit for local rows, a page request for server rows

Native mode: `DataManager.infiniteLimit` reveals `step` rows at a time (step =
`pageSize`, or 100 when pagination is off). `loadMore()` bumps the limit,
emits `dataChanged` with `operation: 'loadMore'`, and `loadMoreRequested`
(`{ page, loadedCount, totalCount }`) before the bump. `hasMore()` is false
once the limit covers the filtered count. Server mode: `loadMore()` appends the
next page through the same event contract.

### 1.4 Row grouping — headers interleaved in the view, not UI state

`groupRows(rows, { column, collapsed, summarizer? })` in
`features/grouping/GroupingEngine.ts` buckets the filtered view by the column's
value and interleaves `type: 'group'` header rows with their `type: 'row'`
entries (group order follows first appearance). Collapsed groups contribute
only their header. Aggregates per group come from `groupRowsWithAggregates`
using the active `AggregateConfig`.

`SmartTable.groupBy/ungroup/toggleGroup/isGroupCollapsed/getGroupState/getGroups`
drive the core; `groupChanged` carries `{ field, collapsed }`. Grouping and tree
mode are mutually exclusive flattens — the data layer applies one or the other
in the view pipeline (filter → sort → group/tree → paginate).

### 1.5 Aggregations — a reusable pure engine, config-driven

`features/aggregation/aggregations.ts` exports pure helpers: `aggregate(rows,
field, op)` and `aggregateRows(rows, config)` with ops `sum`, `avg`, `count`,
`min`, `max` (non-numeric values are skipped). `AggregateConfig` maps
`field -> op | custom fn`; `assertValidAggregateConfig` throws
`INVALID_AGGREGATION`, `isValidAggregateConfig` is the boolean form.

`aggregate()` on the table sets the config and emits `aggregationChanged`;
`getAggregateFooter()` computes values over the **filtered** view (all pages),
so filters and aggregations compose. Group summaries reuse the same config.

### 1.6 Tree data — flattening + lazy children

`flattenTree(viewRows, { childrenKey, expanded, lazy })` in
`features/tree/TreeEngine.ts` flattens nested rows (`children` array by default)
depth-first pre-order, attaches `tree: { hasChildren, expanded, depth }` meta to
each row, and omits collapsed subtrees entirely. Lazy nodes (no children array
yet) render expandable when `lazy: true`.

`expandNode` (async, resolves lazy children first), `collapseNode`, `toggleNode`,
`isNodeExpanded`, `getTreeState`, `isTreeEnabled` form the public tree API;
`nodeExpanded` (`{ rowId, row, depth, childCount }`) and `nodeCollapsed` are
emitted. Row ids come from each node's `id` field.

### 1.7 Grid state manager — full snapshot export/import

`features/state/StateManager.ts` captures the entire grid state into a
versioned `GridState` object: mode, theme, columns (visibility + width), sort,
query, structured filters, selection ids, page/pageSize, grouping
(field + collapsed), tree expansion and the viewport scroll position.

- `exportState()` → serializable snapshot (safe for JSON).
- `importState(snapshot)` applies it strictly through the **public API**
  (`setColumnsState`, `setMode`, `setTheme`, filters, `goToPage`, selection,
  `groupBy`/`toggleGroup`, `toggleNode`, scroll restore) so every listener
  stays in sync; malformed input throws `INVALID_STATE`.
- `resetState()` clears sort/filter/selection/grouping back to defaults.

This is the primitive framework peristence (localStorage, URL, server) can be
built on top of without touching the library.

### 1.8 Pivot engine — headless Excel-like pivoting

`features/pivot/PivotEngine.ts` is DOM-free. `PivotEngine.compute(rows,
config)` buckets rows by every `rows` + `columns` dimension combination and
aggregates each intersection per `values` (`PivotValue` = field + op). The
result exposes `getRowKeys()`, `getColumnKeys()`, `getValue(rowKey,
columnKey, field, op)`, a two-pass `rows()` grid and `toJSON()`.
`assertValidPivotConfig` validates dims + value fields exist and the ops are
known (throws `INVALID_PIVOT_CONFIG`); dims and value fields are checked
against the table's columns.

`SmartTable.pivot(config)` computes over `getData()` and emits `pivotChanged`;
`clearPivot()` re-emits with `config: null`; `getPivotResult()` returns the
result or `null`. The `PivotView` renderer (`src/ui/PivotView.ts`) consumes the
result: it renders the aggregation label in the corner cell, one column header
per pivot column combination, one row header per row combination and the value
at every intersection. `DOMRenderer` swaps the grid for `PivotView` while a
pivot result is active (and back on `clearPivot`); the view is read-only.

### 1.9 New error codes

`INVALID_DATA_SOURCE`, `INVALID_VIRTUAL_SCROLL`, `INVALID_AGGREGATION`,
`INVALID_PIVOT_CONFIG`, `INVALID_STATE` — each thrown with a human message, all
reachable through `SmartTableError.code`.

---

## 2. Folder structure (additions since Phase 3)

```
src/
  features/
    virtualization/
      ViewportManager.ts  range math + scroll container binding (DOM)
      VirtualScroller.ts  scroll-driven window scheduler
      RowPool.ts          row element recycling
    server/
      params.ts           DataSourceParams building + request serialization
      ServerController.ts debounced, newest-wins server orchestration
    grouping/
      GroupingEngine.ts   groupRows / groupRowsWithAggregates
    aggregation/
      aggregations.ts     aggregate / aggregateRows / AggregateConfig
    tree/
      TreeEngine.ts       flattenTree
    state/
      StateManager.ts     export/import/reset grid state
    pivot/
      PivotEngine.ts      PivotEngine / PivotResult / assertValidPivotConfig
  core/
    DataManager.ts        + remoteMode, grouping, tree, infinite limit
    SmartTable.ts         + Phase 4 public API + server routing
  ui/
    TableView.ts          + virtualizer integration, spacers, load-more hook
    PivotView.ts          read-only pivot grid consuming PivotResult
  styles/
    smart-table.css       + .st-virtual / .st-virtual-spacer / pivot rules
  types/
    index.ts              + ViewRow/GroupedViewMeta/TreeViewMeta, DataSource*, events
    events.ts             + all Phase 4 event types
benchmarks/
  phase4.bench.ts         vitest bench suite (100k-row pipeline, tree, pivot)
tests/
  virtualization.test.ts, server.test.ts, infinite-scroll.test.ts,
  grouping.test.ts, aggregation.test.ts, tree.test.ts, state.test.ts,
  pivot.test.ts, pivot-view.test.ts
```

---

## 3. Public API (Phase 4 additions)

### Virtual scrolling

```ts
const table = new SmartTable({ columns, data, virtualScroll: { rowHeight: 40, overscan: 5 } });
table.getVirtualScrollOptions(); // { enabled, rowHeight, overscan }
table.getRows(); // still the full logical view, not the window
```

### Server data source

```ts
const table = new SmartTable({
  columns,
  pageSize: 50,
  dataSource: async (params) => {
    // params: { page, pageSize, sort, filters: { query, structured } }
    const rows = await fetchRows(params);
    return { rows, total: 100_000 };
  },
});
await table.waitForLoad();
table.getRemoteTotal(); // server-reported total
table.isServerMode();
table.applyServerPage(rows, total, 'replace'); // manual hydration
```

### Infinite scroll

```ts
const table = new SmartTable({ columns, data, infiniteScroll: true });
table.hasMore();
table.loadMore(); // + dataChanged(loadMore) / loadMoreRequested
```

### Row grouping

```ts
table.groupBy('category'); // + groupChanged
table.toggleGroup('Electronics'); // collapse/expand
table.isGroupCollapsed(key);
table.getGroupState(); // { field, collapsed }
table.getGroups(); // GroupViewHeader[]
table.ungroup();
```

### Aggregations

```ts
table.aggregate({ price: 'sum', orderCount: 'count' }); // + aggregationChanged
table.getAggregations();
table.getAggregateFooter(); // computed over the filtered view
// Pure helpers: aggregate, aggregateRows, AGGREGATION_OPS,
// assertValidAggregateConfig, isValidAggregateConfig
```

### Tree data

```ts
const table = new SmartTable({
  columns,
  data,
  tree: { childrenKey: 'children', expanded: ['1'], lazyChildren: async (row) => [...] },
});
await table.expandNode('1');   // async, lazy children resolved first
table.collapseNode('1');
table.toggleNode('1');
table.isNodeExpanded('1');
table.getTreeState();          // { expanded: string[] }
// Pure helper: flattenTree
```

### Grid state

```ts
const state = table.exportState(); // versioned snapshot
table.importState(state); // strict apply via public API
table.resetState();
```

### Pivot

```ts
const result = table.pivot({
  rows: ['region'],
  columns: ['product'],
  values: [{ field: 'sales', aggregation: 'sum' }],
});
result.getRowKeys(); // [['North'], ['South']]
result.getValue(['North'], ['Laptop'], 'sales', 'sum');
table.clearPivot();
table.getPivotResult();
// Pure helpers: PivotEngine.compute, assertValidPivotConfig
```

---

## 4. New events

| Event                | Payload                                                  |
| -------------------- | -------------------------------------------------------- |
| `viewportChanged`    | `{ start, end, total, firstVisibleRow, lastVisibleRow }` |
| `dataLoading`        | `{ page }`                                               |
| `dataLoaded`         | `{ page, mode: 'replace' \| 'append', total }`           |
| `dataLoadFailed`     | `{ error }`                                              |
| `loadMoreRequested`  | `{ page, loadedCount, totalCount }`                      |
| `groupChanged`       | `{ field, collapsed }`                                   |
| `nodeExpanded`       | `{ rowId, row, depth, childCount }`                      |
| `nodeCollapsed`      | `{ rowId, row, depth }`                                  |
| `aggregationChanged` | `{ aggregations }`                                       |
| `pivotChanged`       | `{ config }` (`config: null` on clear)                   |
| `dataChanged`        | extended with `operation: 'loadMore'`                    |

---

## 5. Benchmarks

`npm run bench` runs the vitest bench suite (`benchmarks/phase4.bench.ts`),
covering a synthetic 100k-row pipeline. Representative results (Node on this
machine, ops/sec higher = better):

| Benchmark                     | Ops/sec | Mean   |
| ----------------------------- | ------- | ------ |
| Construct a 100k-row table    | ~11     | ~92ms  |
| `getRows()` (full view)       | ~47     | ~21ms  |
| Filter query over 100k rows   | ~6      | ~156ms |
| Sort 100k rows (incl. view)   | ~17     | ~57ms  |
| Paginate 100k (page 500/1000) | ~4      | ~227ms |
| Aggregate `sum` over 100k     | ~319    | ~3.1ms |
| Group 100k rows into headers  | ~27     | ~38ms  |
| Flatten a 10k-node tree       | ~232    | ~4.3ms |
| Pivot over 20k rows           | ~29     | ~34ms  |

These are micro-benchmarks of the headless pipeline; rendering cost is bounded
by window size thanks to virtualization.

---

## 6. Quality gates

- `npm run typecheck` — strict `tsc --noEmit`
- `npm run lint` — ESLint 9 flat config
- `npm run test` — 387 tests / 28 suites (jsdom for renderer-level suites)
- `npm run bench` — `vitest bench` Phase 4 suite
- `npm run format:check` — Prettier
- `npm run build` — ESM + CJS + `.d.ts` + `dist/smart-table.css`

---

## 7. Roadmap

- **Phase 5** — Framework bindings (React, Vue, Angular) + integration docs.

---

## 8. Design decisions worth revisiting

| Decision                                    | Rationale                             | Revisit when                        |
| ------------------------------------------- | ------------------------------------- | ----------------------------------- |
| Fixed-height virtual rows                   | Simple math, predictable perf         | Variable-height rows / auto height  |
| Server mode bypasses local transforms       | Server owns sorting/filter/pagination | Hybrid client+server transforms     |
| 120ms debounce for server requests          | Avoids request storms while typing    | SLAs that need lower latency        |
| Infinite scroll native = view limit         | Cheap, no data duplication            | Windowed loading of huge arrays     |
| Grouping & tree are exclusive view flattens | Simple pipeline, one active transform | Nested group + tree combination     |
| Pivot is headless; renderer is separate     | Testable core, thin UI                | Reactive pivot with cell drill-down |
