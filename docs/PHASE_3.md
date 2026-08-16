# PHASE 3 — Professional Data Grid Features

Status: **complete** (column visibility, resize, reorder, undo/redo, validation,
pagination, advanced filters, saved layouts, context menu, export — 307 tests).

Phase 3 layers ten professional-data-grid features on top of the headless core
([PHASE_1.md](PHASE_1.md)) and the DOM renderer ([PHASE_2.md](PHASE_2.md)). The
Phase 1 & 2 guarantees hold throughout: the core stays headless, the renderer
only displays state, and every feature is driven through the public API + event
bus.

---

## 1. Architecture decisions

### 1.1 Features are core-first, toolbar/UI optional

Each feature lands in three layers, in this order:

1. **Core** (`DataManager` / `SmartTable`) — the state, validation and events.
   Tests are written here and must pass with no DOM.
2. **Toolbar / renderer** — a control or interaction that calls the public API
   and reacts to events.
3. **Styles** — CSS variables with hard-coded fallbacks.

The renderer never computes grid state; it calls `table.sort()`,
`table.where()`, `table.loadLayout()`, etc. and re-renders from event payloads.

### 1.2 Column visibility — state on the normalized column

`hideColumn` / `showColumn` / `toggleColumn` flip `NormalizedColumn.visible`
(unknown columns are rejected with `UNKNOWN_COLUMN`). Hidden columns keep their
data, order and sort/filter state and are excluded from rendering **and**
serialization. `columnVisibilityChanged` carries `field`, `visible` and the full
`visibleColumns` order so the toolbar picker and any framework binding can
re-sync in one event. The toolbar `columns` control is a check-list popover
(open/close on outside click + Escape).

### 1.3 Column resize — drag state is transient

Drag resize is owned by `TableView` (`beginResize` → `mousemove` → `mouseup`);
during the drag it applies widths directly to header/data cells to avoid layout
shift, then commits through `table.setColumnWidth(field, width)`. Numeric widths
clamp to the column's `minWidth` (default `80`); CSS length strings pass
through; invalid input throws `INVALID_COLUMN_WIDTH`. `columnResized` fires on
every commit (not per mousemove). `resetColumnWidth` clears an explicit width
back to auto and emits `columnResized` with `width: undefined`.

### 1.4 Column reorder — HTML5 drag & drop, order lives in the core

Header cells are `draggable`; `dragover`/`drop` resolve the drop target column
and call `table.moveColumn(field, beforeField)`. The order is stored in
`DataManager.columns` so it survives sorting, filtering and re-renders.
`columnReordered` carries the full resulting field order.

### 1.5 Undo/redo — an operation log, not value snapshots

`history/HistoryManager` is a bounded ring buffer (default `historySize: 100`,
`0` disables). Mutating APIs (`addRow`, `removeRow`, `updateCell`) push a
reversible entry **before** applying the change; `undo`/`redo` replay/apply it.
`updateCell` undo needs the pre-edit value, so the history entry stores the
entire previous row and restores it (undoing past another change to the same
row keeps that row's other fields intact). `historyChanged` exposes
`canUndo/canRedo/undoCount/redoCount`.

### 1.6 Validation — checked in the core, surfaced by the renderer

`Column.validators` (`required`, `min`, `max`, `minLength`, `maxLength`,
`pattern`, `custom`) are copied onto `NormalizedColumn` at normalize time.
`validation/validators.ts` is pure: `validateColumnValue` returns
`ValidationError[]`, `validateRow` runs every column, `isRowValid` is the
boolean shortcut. `updateCell` validates the **candidate** before writing —
rejected values throw `ERROR_CODES.VALIDATION_FAILED` and the cell keeps its old
value. Events: `validationFailed` (`{ field, rowId, messages }`) and
`validationPassed`. The renderer marks failing cells with `.st-validation-error`
(using `--st-error` variables) and clears it on the next successful edit.

### 1.7 Pagination — a view transform, not a copy of the data

`DataManager` keeps `pageSize`/`currentPage`; `getRows()` = filtered →
sorted → sliced. `pageSize: 0` (default) disables paging. Mutating APIs reset or
clamp the page: `setData` → page 1, filters → page 1, `removeRow` → clamp into
range. `pageChanged` (`page, pageSize, totalPages, rowCount, totalCount`) and
`filterChanged.totalPages` keep renderers and the toolbar pager in sync. The
toolbar `pagination` control emits `toolbar:page`.

### 1.8 Advanced filters — declarative predicates stored per column

`filters/operators.ts` defines the operator catalog (`equals`, `contains`,
`startsWith`, `endsWith`, `greaterThan`, `lessThan`, `between`, `inList`) with
labels and operand counts. `DataManager.where(field, operator, ...operands)`
validates the operator/column, compiles a predicate and stores a
`StructuredFilter` keyed by field. `clearColumnFilter` / `clearFilter` remove
both the compiled predicate and the structured record; `setColumns` prunes
stale structured filters. `getStructuredFilters()` makes the active filters
serializable (used by saved layouts). The toolbar `filters` control opens
`filters/FilterBuilder.ts`, a small form (column → operator → operands) that
adds/removes filters through `where` / `clearColumnFilter`.

### 1.9 Saved layouts — serializable snapshots behind a storage adapter

`layouts/LayoutManager.ts` persists `SavedLayout` records under the key
`smarttable.layouts.<namespace>` (default namespace = table id) through a
synchronous `LayoutStorage` adapter (`get/set/remove`). The default adapter is
`localStorage` with an in-memory fallback so SSR never crashes. `captureLayout`
snapshots column order/visibility/width, sort, query and structured filters.
`loadLayout` applies them through `applyColumnsState` (which tolerates unknown
fields so old layouts survive column-schema changes), resets to page 1 and
emits `layoutChanged` + `filterChanged` + `pageChanged`. The toolbar `layouts`
control saves the current view under a label and lists saved layouts for
load/delete.

### 1.10 Context menu — a thin, keyboard-accessible UI

`ui/ContextMenu.ts` is a single positioned `role="menu"` in the table root.
Right-click delegation on the renderer root resolves a `ContextMenuTarget`
(`header` | `cell` | `row`) plus `field`/`row`, builds the built-in items
(header: sort asc/desc, clear sort, hide column, reset width; cell/row: copy
cell, copy row, edit cell, delete row — readonly disables mutating items), and
appends user items from `options.contextMenu.items` (filtered by `target`).
Positioning clamps to the root; outside click, blur, Escape or another
right-click closes it; arrows + Enter navigate. The core emits `contextMenu`
(open) and `contextMenuAction` (chosen).

### 1.11 Export — pure serialization plus a download helper

`serialize(format)` returns the filtered + sorted view (all pages) as text, CSV
or JSON **without** touching the clipboard. `exportCSV(filename?)` /
`exportJSON(filename?)` serialize the same view and trigger a file download via
`utils/download.ts` (Blob + object URL + anchor, no-op where unsupported),
defaulting the filename to `<table-id>-<timestamp>.<ext>`. Both emit
`exported` (`{ format, filename, rowCount }`). The toolbar `export` control
offers CSV/JSON download buttons and emits `toolbar:export`.

---

## 2. Folder structure (additions since Phase 2)

```
src/
  types/
    filter.ts        FilterOperator / FilterScalar / FilterOperand / StructuredFilter
    layout.ts        LayoutColumnState / SavedLayout / LayoutStorage
    context-menu.ts  ContextMenuTarget / ContextMenuContext / ContextMenuItem /
                     ContextMenuOptions / ContextMenuAction
  history/
    HistoryManager.ts bounded undo/redo operation log
  validation/
    validators.ts    validateColumnValue / validateRow / isRowValid / hasValidators
  filters/
    operators.ts     operator catalog + matchesOperator
    FilterBuilder.ts toolbar filter popover
  layouts/
    LayoutManager.ts createDefaultLayoutStorage / LayoutManager / captureLayout
  ui/
    ContextMenu.ts   right-click menu
    Toolbar.ts       + pagination / filters / layouts / export controls
    TableView.ts     + resize, reorder drag, editCellAt, width reset
    CardView.ts      + editCellAt
  utils/
    download.ts      downloadFile helper (Blob + anchor)
tests/
  validation.test.ts  per-column rules, events, error UI
  pagination.test.ts  page math, pageChanged, toolbar pager
  filters.test.ts     operators + FilterBuilder behavior
  layouts.test.ts     LayoutManager + save/load/delete/apply
  context-menu.test.ts header/cell/row menus, custom items, events, dismissal
  exports.test.ts     serialize + exportCSV/JSON + toolbar export
```

---

## 3. Public API (Phase 3 additions)

### Column features

```ts
table.hideColumn('price'); // + columnVisibilityChanged
table.showColumn('price');
table.toggleColumn('price');
table.setColumnWidth('name', 180); // px, clamped to minWidth
table.resetColumnWidth('name'); // back to auto
table.moveColumn('price', 'name'); // move before another column
```

### Undo / redo

```ts
table.undo(); // reverts the last mutation
table.redo();
table.canUndo(); // boolean
table.canRedo();
table.getUndoCount(); // number
table.getRedoCount();
table.clearHistory();
```

### Validation

```ts
table.validateCell(row, 'email');   // ValidationError[]
table.validateRow(row);             // ValidationResult
table.isRowValid(row);              // boolean
// Column option:
{ field: 'age', validators: { min: 0, max: 120, required: true } }
```

### Pagination

```ts
table.setPageSize(10); // 0 disables
table.getPageSize();
table.goToPage(2);
table.getCurrentPage();
table.getTotalPages();
table.nextPage(); // boolean (whether it moved)
table.prevPage();
table.canGoNext(); // boolean
table.canGoPrev();
table.getFilteredCount(); // rows matching filters, all pages
```

### Advanced filters

```ts
table.where('price', 'between', 10, 50);
table.where('name', 'contains', 'la');
table.clearColumnFilter('price');
table.clearFilter();
table.getStructuredFilters(); // [{ field, operator, operands }]
// Standalone helpers: FILTER_OPERATORS, OPERATOR_LABELS, OPERAND_COUNT,
// isFilterOperator, matchesOperator
```

### Saved layouts

```ts
table.saveLayout('Compact');         // snapshots columns/sort/query/filters
table.loadLayout(id);                // applies + layoutChanged
table.deleteLayout(id);
table.getLayouts();                  // SavedLayout[]
table.getLayout(id);
// Options:
{ layoutStorage: myAdapter, layoutNamespace: 'orders' }
// Adapter:
{ get(key): string | null, set(key, value): void, remove(key): void }
```

### Context menu

```ts
table.getContextMenuOptions();
// Options:
contextMenu: false, // or
contextMenu: {
  items: [{ id: 'ping', label: 'Ping', target: 'row',
            run: ({ row }) => console.log(row) }],
}
// Events: contextMenu (open), contextMenuAction (chosen)
```

### Export

```ts
table.serialize('csv' | 'json' | 'text'); // string, no clipboard
table.exportCSV('report.csv'); // download + exported event
table.exportJSON('report.json');
```

---

## 4. New events

| Event                     | Payload                                                |
| ------------------------- | ------------------------------------------------------ |
| `columnVisibilityChanged` | `{ field, visible, visibleColumns }`                   |
| `columnResized`           | `{ field, width }` (width `undefined` on reset)        |
| `columnReordered`         | `{ field, beforeField, columns }`                      |
| `historyChanged`          | `{ canUndo, canRedo, undoCount, redoCount }`           |
| `validationFailed`        | `{ field, rowId, messages }`                           |
| `validationPassed`        | `{ field, rowId }`                                     |
| `pageChanged`             | `{ page, pageSize, totalPages, rowCount, totalCount }` |
| `filterChanged`           | now also `{ ..., totalPages }`                         |
| `layoutChanged`           | `{ id, label? }`                                       |
| `contextMenu`             | `{ target, field, row, x, y, items }`                  |
| `contextMenuAction`       | `{ action, target, field, row }`                       |
| `exported`                | `{ format, filename, rowCount }`                       |
| `toolbar:page`            | `{ page, pageSize }`                                   |
| `toolbar:export`          | `{ format }`                                           |

---

## 5. Design decisions worth revisiting

| Decision                                           | Rationale                                 | Revisit when                         |
| -------------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| Filters stored per column (one predicate each)     | Simple model, matches the UI              | OR-groups / nested boolean filters   |
| `where` replaces any previous filter on the column | Predictable "filter + refine" UX          | Multiple operators per column        |
| History entries restore the whole previous row     | Survives interleaved edits to one row     | Large rows (memory), multi-cell undo |
| Layouts are full snapshots, not deltas             | Simple, schema-tolerant                   | Column add/remove sync, migrations   |
| Context-menu actions call table methods directly   | Reuses existing events/patching           | Plugin-defined actions with prompts  |
| Export always serializes all filtered pages        | "Export what you filtered" is unambiguous | "Export current page only" option    |
| Toolbar default controls unchanged                 | Backwards compatible                      | New defaults when UI revs            |

---

## 6. Quality gates

- `npm run typecheck` — strict `tsc --noEmit`
- `npm run lint` — ESLint 9 flat config
- `npm run test` — 307 tests / 19 suites (jsdom for renderer-level suites)
- `npm run format:check` — Prettier
- `npm run build` — ESM + CJS + `.d.ts` + `dist/smart-table.css`

---

## 7. Roadmap

- **Phase 4** — Virtual scrolling, server data source, infinite scroll, row
  grouping, aggregations, tree data, grid state manager, pivot engine.
  See [PHASE_4.md](PHASE_4.md).
- **Phase 5** — Framework bindings (React, Vue, Angular) + integration docs.
