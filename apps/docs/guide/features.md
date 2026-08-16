# Feature catalogue

Everything below ships in `@smart-table/core` and is available through every framework binding.

## Data & view

- **Sorting** — single or multi-pass, per column. `sortable: false` on a column disables it; `aria-sort` and indicators are rendered.
- **Filtering** — per-column operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `endsWith`) and a global search box in the toolbar.
- **Pagination** — local paging with size switching, go-to-page and `setPageSize`. `pageSize: 0` disables paging and shows the full view.
- **Virtual scrolling** — renders only the viewport (plus overscan), so 100k+ rows stay smooth.
- **Responsive layout** — below the mobile breakpoint the table becomes a **card layout**; between mobile and desktop it stays compact with a sticky header.
- **Infinite scroll** — loads the next page as you scroll (works with a remote `dataSource` too).

## Editing

- Full inline **cell editor** with per-column types and tab navigation.
- Per-column **validators** run on commit; failures raise `validationFailed`.
- Row **actions**, **clone/duplicate**, and **undo/redo** from the toolbar.
- **History** (bounded by `historySize`) with `undo()` / `redo()`.

## Organization

- **Grouping** — `groupBy(field)` renders group headers with toggle + aggregate footer.
- **Aggregations** — `sum`, `avg`, `min`, `max`, `count`, `distinct` per column, shown in the footer.
- **Tree data** — nested `children` arrays or lazy-loaded children with expand/collapse.
- **Pivot** — `pivot({ rows, columns, values })` computes a cross-tabulation with aggregations.
- **Column management** — visibility toggles, drag-reorder, resize, save/restore via layouts.

## Server mode

Pass a `dataSource`. Pagination, sort and filter are forwarded as typed parameters, the response is committed atomically, and **late responses are discarded** so only the newest request wins.

## State & persistence

- `exportState()/importState()` and `resetState()` for toolbar state (sort, filter, page, visibility).
- **Saved layouts** per user over pluggable `layoutStorage` (`localStorage` by default).

## Presentation

- **Themes** — `light`, `dark`, `corporate` or a custom `ThemeDefinition` via `setTheme()`.
- **Context menu** — built-in right-click menu with custom items.
- **Export** — `exportCSV()`, `exportJSON()` and toolbar copy.

## Events

Every interaction is broadcast on a typed event bus — see [Events](/api/events) for the full map. List as many handlers as you need with `table.on()`.
