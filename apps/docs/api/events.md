# Events

The core broadcasts strongly-typed events on an internal bus. Subscribe with `table.on(name, handler)`:

```ts
import { SmartTable } from '@smart-table/core';

table.on('cellEdit', (e) => {
  // e: { rowId, field, previousValue, value }
});
table.on('sortChanged', (e) => {
  // e: { field, direction }
});
```

`on()` returns an unsubscribe function. Framework adapters map events to their native output mechanism (`eventHandlers` in React, `@event` in Vue, `(event)` in Angular).

## Full event map

`SmartEventMap` / `SmartTableEvents` (plugins may register custom events; a `string` index signature keeps those type-safe).

| Event                     | Payload                        | Fired when                               |
| ------------------------- | ------------------------------ | ---------------------------------------- |
| `cellEdit`                | `CellEditEvent`                | A cell value was committed.              |
| `rowAdded`                | `RowAddedEvent`                | A row was inserted.                      |
| `rowDeleted`              | `RowDeletedEvent`              | A row was removed.                       |
| `dataChanged`             | `DataChangedEvent`             | The dataset changed (add/update/remove). |
| `dataLoaded`              | `DataLoadedEvent`              | A server / local load completed.         |
| `dataLoading`             | `DataLoadingEvent`             | A load started.                          |
| `dataLoadFailed`          | `DataLoadFailedEvent`          | A load failed.                           |
| `loadMoreRequested`       | `LoadMoreRequestedEvent`       | Infinite scroll requested more rows.     |
| `sortChanged`             | `SortChangedEvent`             | The sort state changed.                  |
| `filterChanged`           | `FilterChangedEvent`           | A filter or search changed.              |
| `pageChanged`             | `PageChangedEvent`             | The current page changed.                |
| `selectionChanged`        | `SelectionChangedEvent`        | The selection set changed.               |
| `modeChanged`             | `ModeChangedEvent`             | The edit/read-only mode changed.         |
| `themeChanged`            | `ThemeChangedEvent`            | The theme changed.                       |
| `columnVisibilityChanged` | `ColumnVisibilityChangedEvent` | A column was shown/hidden.               |
| `columnResized`           | `ColumnResizedEvent`           | A column width changed.                  |
| `columnReordered`         | `ColumnReorderedEvent`         | Columns were reordered.                  |
| `groupChanged`            | `GroupChangedEvent`            | Grouping changed.                        |
| `nodeExpanded`            | `NodeExpandedEvent`            | A tree node expanded.                    |
| `nodeCollapsed`           | `NodeCollapsedEvent`           | A tree node collapsed.                   |
| `aggregationChanged`      | `AggregationChangedEvent`      | An aggregation config changed.           |
| `pivotChanged`            | `PivotChangedEvent`            | The pivot configuration changed.         |
| `historyChanged`          | `HistoryChangedEvent`          | The undo/redo stack changed.             |
| `validationFailed`        | `ValidationFailedEvent`        | A validator rejected a value.            |
| `validationPassed`        | `ValidationPassedEvent`        | A validator accepted a value.            |
| `copied`                  | `CopiedEvent`                  | Rows were copied to the clipboard.       |
| `cloned`                  | `ClonedEvent`                  | Rows were cloned.                        |
| `exported`                | `ExportedEvent`                | An export completed.                     |
| `layoutChanged`           | `LayoutChangedEvent`           | A layout was saved/loaded.               |
| `contextMenu`             | `ContextMenuEvent`             | The context menu opened.                 |
| `contextMenuAction`       | `ContextMenuActionEvent`       | A context menu item was chosen.          |
| `viewportChanged`         | `ViewportChangedEvent`         | The responsive viewport changed.         |
| `toolbar:search`          | `ToolbarSearchEvent`           | The toolbar search was submitted.        |
| `toolbar:copy`            | `ToolbarCopyEvent`             | The toolbar copy action ran.             |
| `toolbar:clone`           | `ToolbarCloneEvent`            | The toolbar clone action ran.            |
| `toolbar:add`             | `ToolbarAddEvent`              | The toolbar "add row" action ran.        |
| `toolbar:mode`            | `ToolbarModeEvent`             | The toolbar toggled edit mode.           |
| `toolbar:page`            | `ToolbarPageEvent`             | The toolbar pagination action ran.       |
| `toolbar:export`          | `ToolbarExportEvent`           | The toolbar export action ran.           |

> [!TIP]
> All payload types (`CellEditEvent`, `SortChangedEvent`, …) are exported from `@smart-table/core` so you can type your handlers.
