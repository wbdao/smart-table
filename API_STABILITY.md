# API stability

This document records the stability level of every public surface of `@smart-table/*`.
It is part of the v1.0 hardening work (Phase 7.10) and is reviewed with every minor release.

## Stability levels

| Level            | Meaning                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stable**       | Guaranteed for `v1.0`. Breaking changes are only allowed in a major release and only after the deprecation window defined in [`SUPPORTED_VERSIONS.md`](./SUPPORTED_VERSIONS.md). |
| **Experimental** | Shipped and usable, but the exact surface may be adjusted during the `0.x` cycle. Reachable today, opt-in, and always announced in the release notes.                            |
| **Internal**     | Exported for framework-agnostic builds but not part of the public contract. Marked `@internal` in JSDoc; changes do not require a major bump.                                    |

## Status by area (`@smart-table/core`)

### Stable (locked for 1.0)

- `SmartTable` constructor and core options: `columns`, `data`, `pageSize`, `responsive`, `contextMenu`, `readonly`, `container`, `id`, breakpoints and theme inputs.
- Instance API used by every renderer and adapter:
  - Data: `setData`, `getData`, `getRows`, `getRowCount`, `getViewCount`, `updateCell`, `addRow`, `removeRow`, `getRow`, `getRowById`, `getRowIndex`, `getRowId`.
  - Querying: `sort`, `filter`, `where`, `clearSort`, `clearFilter`, `getSortState`, `getFilterState`, `getStructuredFilters`.
  - Pagination: `goToPage`, `nextPage`, `previousPage`, `setPageSize`, `getCurrentPage`, `getPageSize`, `getTotalPages`, `getFilteredCount`.
  - Selection: `selectRow`, `clearSelection`, `getSelection`, `getSelectedRowIds`, `getSelectionCount`.
  - Columns: `getColumns`, `getColumn`, `getVisibleColumns`, column width/visibility/reorder methods.
  - Lifecycle: `mount`, `unmount`, `on`/`off`, `events`, `destroy`, `getRenderer`, `getContainer`.
- Event names in `SmartTableEvents` / `DEFAULT_EVENTS` (camelCase, stable since 0.1).
- `DataSource` / `DataSourceParams` / `DataSourceResult` and `ServerController` usage.
- Error contract: `SmartTableError` and `ERROR_CODES`.

### Experimental

- Plugins: `SmartTablePlugin`, plugin registry, `eventLogPlugin`, `summaryFooterPlugin` (plugin ABI may tighten before 1.0).
- Advanced features exposed as helper exports: aggregation, grouping/tree, pivot, layouts, history, validation, state (`GridState`).
- `Capability`-gated renderer options and future chart/collaboration hooks.

### Internal

- Virtualization internals: `RowPool`, `VirtualScroller`, `ViewportManager` (marked `@internal`).
- DOM-specific UI classes (`DOMRenderer`, `TableView`, `CardView`, `PivotView`, `Toolbar`) and `utils` helpers: their types are exported so renderers can be built, but consumers should not rely on their exact members.

## Community packages (`@smart-table/*`)

| Package                                                                                              | Level                                                                    |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `@smart-table/ag-compat`, `tanstack`, `telemetry`, `devtools`, `collaboration`, `charts`, `security` | **Experimental** for `0.9.0-beta`; targeted for **Stable** at `v1.0`.    |
| Framework adapters (`react`, `vue`, `angular`, `web`)                                                | **Stable** at the adapter boundary; they forward to `@smart-table/core`. |

## Deprecations

No `@deprecated` markers are currently active. The deprecation mechanism works as follows:

1. The removal candidate is annotated with `@deprecated` in its JSDoc and listed in this section.
2. A replacement is provided (usually a renamed/more general API) and announced in the release notes.
3. The replacement ships for the full deprecation window (two `0.x` minor releases, per `SUPPORTED_VERSIONS.md`) before the old API is removed in the next major.

### Candidates under review (not yet annotated)

- `StateManager`/`GridState` naming vs. the newer plugin-based state access; likely rename before 1.0 rather than deprecate.
- `serializeRows` / `getCellText` utility signatures — candidates for tightening or moving to `@smart-table/core/utils` internal scope.

## v1.0 migration strategy

- Move every **Experimental** area that is exercised by the v1.0 milestone checklist to **Stable**.
- Re-classify anything not ready as **Internal** rather than shipping it half-guaranteed.
- Perform any renames via the deprecation window above — no silent breaking changes.
- After `v1.0.0`, apply strict semver: behavior-preserving fixes are patches, additive changes are minors, breaking removals wait for a major.
