# Methods

Every interaction available in the UI is also a programmatic method. All mutating methods throw `TABLE_*` errors after `destroy()`.

## Data

| Method                                                    | Description                           |
| --------------------------------------------------------- | ------------------------------------- |
| `setData(rows)`                                           | Replaces the dataset.                 |
| `getData()`                                               | Raw rows (no filter/sort).            |
| `getRows()`                                               | Current view — filtered, then sorted. |
| `getRowCount()` / `getViewCount()`                        | Row totals.                           |
| `getRowById(id)` / `getRowByIndex(i)` / `getRow(i)`       | Lookup a row.                         |
| `addRow(data?)` / `removeRow(rowId)` / `duplicate(rowId)` | Row mutations.                        |
| `updateCell(rowId, field, value)`                         | Commit a cell edit (runs validators). |

## Sorting & filtering

| Method                                                               | Description                                  |
| -------------------------------------------------------------------- | -------------------------------------------- |
| `sort(field, direction)` / `clearSort()`                             | Sort by a column (throws if not `sortable`). |
| `getSortState()`                                                     | Current sort state.                          |
| `filter(query)` / `filterColumn(field, operator, value)`             | Global search / column filter.               |
| `clearFilter()` / `clearColumnFilter(field)`                         | Remove filters.                              |
| `getFilteredCount()` / `getFilterState()` / `getStructuredFilters()` | Filter introspection.                        |

## Paging & virtualization

| Method                                                           | Description                   |
| ---------------------------------------------------------------- | ----------------------------- |
| `setPageSize(n)` / `getPageSize()`                               | Paging size.                  |
| `goToPage(n)` / `nextPage()` / `prevPage()` / `getCurrentPage()` | Paging navigation.            |
| `getTotalPages()` / `canGoNext()` / `canGoPrev()`                | Paging state.                 |
| `getVirtualScrollOptions()`                                      | Active virtual-scroll config. |
| `loadMore()` / `hasMore()`                                       | Infinite scroll.              |

## Grouping, tree & pivot

| Method                                                                                                                 | Description    |
| ---------------------------------------------------------------------------------------------------------------------- | -------------- |
| `groupBy(field)` / `ungroup()` / `getGroups()` / `getGroupState()`                                                     | Grouping.      |
| `toggleGroup(key)` / `setGroupCollapsed(key, bool)` / `isGroupCollapsed(key)`                                          | Group headers. |
| `toggleNode(id)` / `expandNode(id)` / `collapseNode(id)` / `isNodeExpanded(id)` / `getTreeState()` / `isTreeEnabled()` | Tree data.     |
| `pivot(config)` / `clearPivot()` / `getPivotResult()`                                                                  | Pivot view.    |
| `aggregate(field, op)` / `getAggregations()` / `getAggregateFooter()`                                                  | Aggregations.  |

## Selection

| Method                                                           | Description      |
| ---------------------------------------------------------------- | ---------------- |
| `selectRow(id)` / `unselectRow(id)` / `clearSelection()`         | Selection.       |
| `getSelection()` / `getSelectionCount()` / `getSelectedRowIds()` | Selection state. |

## Columns & layout

| Method                                                                                                                | Description        |
| --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `hideColumn(field)` / `showColumn(field)` / `toggleColumn(field)` / `isColumnVisible(field)`                          | Visibility.        |
| `setColumnWidth(field, px)` / `resetColumnWidth(field)` / `getColumnWidth(field)`                                     | Resizing.          |
| `moveColumn(field, toIndex)` / `setColumnsState(state)` / `getVisibleColumns()` / `getColumn(field)` / `getColumns()` | Ordering.          |
| `saveLayout(name?)` / `loadLayout(name?)` / `getLayouts()` / `getLayout()` / `deleteLayout(name)`                     | Persisted layouts. |

## State

| Method                                                                                                   | Description                                |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `exportState()` / `importState(state)` / `resetState()`                                                  | Serialize / restore / reset toolbar state. |
| `undo()` / `redo()` / `canUndo()` / `canRedo()` / `clearHistory()` / `getUndoCount()` / `getRedoCount()` | History.                                   |

## Appearance & mode

| Method                                                   | Description          |
| -------------------------------------------------------- | -------------------- |
| `setMode(mode)` / `getMode()` / `isEditable()`           | Edit/read-only mode. |
| `setTheme(theme)` / `getTheme()` / `getThemeVariables()` | Themes.              |

## Server mode

| Method                    | Description                        |
| ------------------------- | ---------------------------------- |
| `isServerMode()`          | Whether a `dataSource` is active.  |
| `applyServerPage(result)` | Commit a server page.              |
| `getRemoteTotal()`        | Total rows reported by the source. |

## Lifecycle & plugins

| Method                                                               | Description                 |
| -------------------------------------------------------------------- | --------------------------- |
| `mount(target?)` / `unmount()` / `getRenderer()`                     | Renderer lifecycle.         |
| `getContainer()`                                                     | Mount target.               |
| `destroy()` / `isDestroyed()`                                        | Teardown.                   |
| `use(plugin)` / `unuse(plugin)` / `getPlugin(name)` / `getPlugins()` | Plugin registry.            |
| `setTheme(theme)`                                                    | Re-applies theme variables. |

## Utilities

| Method                                                                           | Description         |
| -------------------------------------------------------------------------------- | ------------------- |
| `serialize(format)` / `exportCSV()` / `exportJSON()` / `clone()`                 | Export helpers.     |
| `validateCell(rowId, field, value)` / `validateRow(rowId)` / `isRowValid(rowId)` | Validation.         |
| `getRowId(row)` / `getRowIndex(id)`                                              | Row lookup helpers. |
| `where(predicate)`                                                               | Filtering helper.   |
