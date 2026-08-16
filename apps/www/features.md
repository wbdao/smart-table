# Features

SmartTableJS ships a complete data-grid feature set, engineered from a single
headless core.

## Data & performance

- Virtual scrolling over 100k+ rows with a pooled renderer.
- Pagination, page-size changes, and client-side reset semantics.
- Filter builder with typed operators and structured filters.
- Multi-column sorting with per-column direction control.
- Full-text toolbar search sync.

## Enterprise data

- **Server data source** — client-driven request params, race-cancellation of
  stale responses, loading/loaded events.
- **Infinite scroll** with load-more hooks and results caps.
- **Row grouping** with group headers, collapse state and per-group
  aggregations.
- **Tree data** — nested rows, expand/collapse per node, depth-aware flattening.
- **Headless pivot engine** — row/column/value pivots with aggregations.
- **Grid state manager** — persist columns, sort, filter and page through a
  storage abstraction.

## Interaction

- **Editing** — cell editing with validation, required/min/max validators and
  failure events.
- **Selection** — row multi-select, `rowSelected` / `selectionChanged` events.
- **Context menu** — custom actions, coordinates and payloads.
- **Copy / clone / export** — clipboard copy, row cloning and CSV/JSON export.
- **History** — undo/redo buffer over data mutations.

## Views & styling

- Table, card (responsive), and pivot views.
- Column resize, reorder and visibility control.
- Light, dark and corporate themes; custom theme definitions.
- Breakpoint-driven responsive layout (`responsive` option).

## Extensibility

- **Plugin marketplace** — `table.use(plugin)` / `table.unuse(name)`,
  `definePlugin`, `PluginRegistry`, and first-party `eventLogPlugin` and
  `summaryFooterPlugin`.
- Framework bindings mirror the same options everywhere.

See the [API reference](https://smart-table.dev/docs/api/options) and the
[feature stories](https://smart-table.dev/docs/guide/features) for details.
