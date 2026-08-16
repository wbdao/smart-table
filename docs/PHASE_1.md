# PHASE 1 — Core Architecture

Status: **complete** (EventBus, DataManager, base SmartTable, types, project setup).

This document explains the architecture decisions behind the Phase 1 core. It
is written for contributors and consumers who want to understand _why_ the
core is shaped the way it is before the renderer and features land.

---

## 1. Architecture decisions

### 1.1 Headless core (separation of state from presentation)

`SmartTable` is **deliberately DOM-free** in Phase 1. All state, data, ids,
sorting, filtering, mode and events live in `core/`. Nothing renders.

Why:

- The library must be framework agnostic (Vanilla / React / Vue / Angular).
  The core is the one piece every framework integration shares.
- The core is fully testable in Node without `jsdom`.
- Renderers (Phase 2) become thin adapters: they read `getRows()` and
  subscribe to the event bus. React/Vue/Angular bindings are the same work
  as the Vanilla renderer, just wired to the framework's reactivity model.

### 1.2 A typed event bus as the integration seam

Every state change emits a **typed event** (`cellEdit`, `rowAdded`,
`rowDeleted`, `sortChanged`, `filterChanged`, `modeChanged`, `copied`,
`cloned`). The bus is a plain class (`EventBus`) with no DOM or library
dependencies.

- Handlers are stored per-event in a `Set` (deduplication is free).
- `emit` iterates over a **snapshot**, so handlers can safely subscribe or
  unsubscribe during emission.
- `on` returns an unsubscribe function; `once` is built on top.
- The `SmartTableEvents` type is `SmartEventMap & Record<string, unknown>`,
  so plugins (Pagination, Excel Import/Export, PDF, Virtual Scroll, Tree)
  can register their own events (`table.events.emit('paginationChanged')`)
  while the 8 built-in events stay fully type-checked.

### 1.3 DataManager owns the data, SmartTable owns the contract

`DataManager` is the headless data layer: CRUD, stable ids, type-aware
sorting, filtering and serialization. `SmartTable` is the public facade that:

- normalizes options and validates input,
- enforces modes (readonly vs editable),
- delegates mutations and emits events with rich payloads.

This split means the data layer can be reused by the renderer, plugins and
future features (virtual scroll needs the same `getRows()` pipeline) without
going through the public facade.

### 1.4 Stable row ids that never pollute user data

Rows are tracked by id via `WeakMap<DataRow, string>` + a reverse
`Map<string, DataRow>`. Ids come from the row's own `id` field (string or
number) or are generated (`row-1`, `row-2`, …). Because the id lives in a
`WeakMap`, user row objects are never mutated by the library.

### 1.5 Modes are enforced at the API level, not just the UI

In `'readonly'` mode, `addRow`, `removeRow` and `updateCell` **throw** a
typed `SmartTableError(READONLY_MODE)`. UI layers are free to hide the
controls, but the guarantee holds even if they forget. `setData` (bulk
replace) stays allowed in readonly so data loading pipelines keep working.

### 1.6 Sorting and filtering live in the data layer

Sorting (string / number / date / boolean, stable, `localeCompare` with
numeric:true) and filtering (case-insensitive global search + per-column
predicates with AND semantics) are pure data operations. Feature _plugins_
added later (Pagination, Excel, …) build on these primitives rather than
reimplementing them. Multi-column sorting is reserved for the future
`SortingPlugin` — the comparator pipeline already supports it.

### 1.7 Serialization is separate from the clipboard

`utils/serialize.ts` produces text / JSON / CSV (RFC-4180-ish quoting). The
clipboard write in `SmartTable.copy()` is a thin, failure-tolerant wrapper:
no clipboard → the payload is still returned. This keeps serialization
unit-testable and lets renderers implement their own copy buttons.

### 1.8 Every failure is a typed, machine-readable error

All thrown errors are `SmartTableError` instances carrying a stable `code`
(`INVALID_COLUMNS`, `READONLY_MODE`, `UNKNOWN_COLUMN`, `NOT_SORTABLE`, …).
Consumers can branch on `error.code` instead of parsing messages.

### 1.9 Strict, modern TypeScript

`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
`isolatedModules`, `useDefineForClassFields`. Literal tuples
(`TABLE_MODES`, `COPY_FORMATS`, `COLUMN_TYPES`, `THEMES`, `SORT_DIRECTIONS`)
provide both runtime validation and compile-time literal types.

---

## 2. Folder structure

```
src/
  core/
    SmartTable.ts      public facade, modes, events, plugins, copy/clone
    DataManager.ts     headless data layer (CRUD, sort, filter, serialize)
    EventBus.ts        typed event bus
    errors.ts          SmartTableError + ERROR_CODES
  types/
    modes.ts           literal tuples + union types
    column.ts          Column / NormalizedColumn / DataRow / SortState
    options.ts         SmartTableOptions
    events.ts          SmartEventMap + event payloads
    plugin.ts          SmartTablePlugin
    index.ts           re-exports
  utils/
    id.ts              createId()
    deepClone.ts       structuredClone fallback
    serialize.ts       getCellText / serializeRows (text | json | csv)
    index.ts
  index.ts             public entry point
tests/                 Vitest suites (node environment, no DOM)
examples/vanilla/      Phase 1 headless demo (drive API, log events)
docs/                  this document + future phase docs
```

Features (`features/`), UI (`ui/`), plugins and styles are intentionally
**empty** in Phase 1 — they land in later phases.

---

## 3. Public API (Phase 1)

```ts
import { SmartTable } from 'smart-table-js';

const table = new SmartTable({
  columns: [
    { field: 'id', title: 'ID', type: 'number' },
    { field: 'name', title: 'Name', type: 'string' },
    { field: 'price', title: 'Price', type: 'number' },
  ],
  data: [{ id: 1, name: 'Laptop', price: 1200 }],
  editable: true, // initial mode shortcut
  theme: 'light', // 'light' | 'dark' | 'corporate'
  responsive: false, // consumed by the renderer (Phase 2)
});
```

### Events

| Event           | Payload                                                            |
| --------------- | ------------------------------------------------------------------ |
| `cellEdit`      | `{ row, rowId, rowIndex, column, field, oldValue, newValue }`      |
| `rowAdded`      | `{ row, rowId, rowIndex }`                                         |
| `rowDeleted`    | `{ row, rowId, rowIndex }`                                         |
| `sortChanged`   | `{ field, direction, column }` (`field`/`direction` may be `null`) |
| `filterChanged` | `{ query, columnFilterCount, rowCount, totalCount }`               |
| `modeChanged`   | `{ mode, previousMode }`                                           |
| `copied`        | `{ format, rowCount }`                                             |
| `cloned`        | `{ clone, includeData }`                                           |

```ts
table.on('cellEdit', (e) => console.log(e.field, e.oldValue, e.newValue));
table.on('cellEdit', handler); // -> unsubscribe fn, or use table.off()
table.once('sortChanged', handler);
```

### Modes

```ts
table.getMode(); // 'readonly' | 'editable'
table.isEditable();
table.setMode('readonly'); // blocks addRow / removeRow / updateCell
table.setMode('editable');
```

### Data

```ts
table.setData(rows); // always allowed, even in readonly
table.addRow(row); // readonly -> throws
table.removeRow(row | id | index);
table.updateCell(target, field, value); // readonly / unknown column -> throws
table.getData(); // full dataset
table.getRows(); // current view (filtered then sorted)
table.getRowCount();
table.getViewCount();
table.getRowId(row);
table.getRowIndex(row);
table.getColumns();
table.getColumn(field);
```

### Sorting & filtering

```ts
table.sort('price', 'asc' | 'desc'); // unknown / non-sortable -> throws
table.clearSort();
table.getSortState();

table.filter('laptop'); // case-insensitive global search
table.filterColumn('price', (v) => v > 100);
table.clearFilter();
table.getFilterState();
```

### Copy & clone

```ts
await table.copy(); // 'text' (default) | 'json' | 'csv'
await table.copy('csv');
table.clone(); // duplicate({ includeData: true })
table.duplicate({ includeData: false }); // columns only, empty data
```

`copy` writes to the clipboard when available and always returns the payload;
`clone`/`duplicate` deep-copy data so the clone is fully independent.

### Plugins

```ts
table.use(plugin); // chainable; duplicate name -> throws
table.unuse(name); // calls plugin.uninstall(table)
table.getPlugin(name); // typed lookup
table.destroy(); // uninstalls plugins, clears events
```

Custom plugin events work out of the box:

```ts
table.use({
  name: 'pagination',
  install(t) {
    t.events.emit('paginationChanged', { page: 2 });
  },
});
table.on('paginationChanged', (e) => {
  /* { page: 2 } */
});
```

---

## 4. Design decisions worth revisiting

| Decision                                               | Rationale                                         | Revisit when                                  |
| ------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------- |
| `removeRow(number)` means index                        | Ambiguity with numeric ids; documented and tested | A future `rowsById` opt-in                    |
| `copy` returns the payload                             | Clipboard may be unavailable                      | Virtual scroll renderer wants it anyway       |
| `filter` lower-cases and trims                         | Predictable case-insensitive matching             | Locale-specific case folding (e.g. Turkish i) |
| `setColumns` prunes stale column filters               | No silent dead filters                            | Dynamic schemas                               |
| `clone` copies the full dataset, not the filtered view | Predictable, cheap                                | `duplicate({ view: true })` option            |

---

## 5. Quality gates

- `npm run typecheck` — strict `tsc --noEmit`
- `npm run lint` — ESLint 9 flat config + Prettier compatibility
- `npm run test` — Vitest (Node env, no DOM required)
- `npm run build` — Vite library build (ESM + CJS + `.d.ts`)

---

## 6. Roadmap

- **Phase 2** — Renderer (`ui/Renderer.ts`, `ui/Toolbar.ts`, `ui/Themes.ts`)
  with CSS variables, responsive card layout, editable cells + keyboard nav.
- **Phase 3** — Feature plugins: sorting, filtering, editing, readonly.
- **Phase 4** — Clipboard, cloning, Excel Import/Export, PDF Export,
  Pagination, Virtual Scroll, Tree Data.
- **Phase 5** — Framework bindings (React, Vue, Angular) + integration docs.
