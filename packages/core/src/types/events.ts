import type { Column, DataRow, SortState } from './column';
import type { CopyFormat, TableMode } from './modes';
import type { ContextMenuTarget } from './context-menu';
import type { GroupViewHeader } from './view';
import type { SmartTable } from '../core/SmartTable';

/** Fired after a cell value was changed through the API. */
export interface CellEditEvent {
  row: DataRow;
  rowId: string;
  rowIndex: number;
  column: Column;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/** Fired after a row was appended. */
export interface RowAddedEvent {
  row: DataRow;
  rowId: string;
  rowIndex: number;
}

/** Fired after a row was removed. */
export interface RowDeletedEvent {
  row: DataRow;
  rowId: string;
  rowIndex: number;
}

/** Fired after the sort state changed. */
export interface SortChangedEvent extends SortState {
  column: Column | null;
}

/** Fired after global search or a column filter changed the view. */
export interface FilterChangedEvent {
  /** Current (trimmed) global search query. Empty when only column filters are active. */
  query: string;
  /** Number of active column filters. */
  columnFilterCount: number;
  /** Number of rows matching the filters. */
  rowCount: number;
  /** Total number of rows in the table. */
  totalCount: number;
  /** Total pages for the current filter state (min 1). */
  totalPages: number;
}

/** Fired after the table switched between readonly and editable. */
export interface ModeChangedEvent {
  mode: TableMode;
  previousMode: TableMode;
}

/** Fired after table data was copied to the clipboard. */
export interface CopiedEvent {
  format: CopyFormat;
  rowCount: number;
}

/** Fired after the table was cloned / duplicated. */
export interface ClonedEvent {
  clone: SmartTable;
  includeData: boolean;
}

/** Fired whenever the selection of rows changed (select / unselect / clear). */
export interface SelectionChangedEvent {
  /** Currently selected rows, in table order. */
  rows: DataRow[];
  /** Stable ids of the selected rows, in table order. */
  rowIds: string[];
}

/** Operation that caused a `dataChanged` event. */
export type DataChangeOperation = 'setData' | 'addRow' | 'removeRow' | 'updateCell' | 'loadMore';

/**
 * Fired after any mutation of the dataset (`setData`, `addRow`, `removeRow`,
 * `updateCell`). Renderers use this as the coarse-grained "something changed"
 * signal; the granular events (`rowAdded`, `cellEdit`, …) remain available for
 * incremental updates.
 */
export interface DataChangedEvent {
  operation: DataChangeOperation;
  /** Present for `addRow`, `removeRow` and `updateCell`. */
  row?: DataRow;
  rowId?: string;
  rowIndex?: number;
  /** Present for `updateCell`. */
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/** Fired after the active theme changed (built-in or custom). */
export interface ThemeChangedEvent {
  /** Name of the theme now in effect (may be a custom theme name). */
  name: string;
  /** Whether the active theme is a user-supplied custom theme. */
  custom: boolean;
}

/** Fired by the toolbar after the search box was submitted. */
export interface ToolbarSearchEvent {
  query: string;
}

/** Fired by the toolbar after a copy action. */
export interface ToolbarCopyEvent {
  format: CopyFormat;
}

/** Fired by the toolbar after a clone action. */
export interface ToolbarCloneEvent {
  clone: SmartTable;
}

/** Fired by the toolbar after a "add row" action. */
export interface ToolbarAddEvent {
  row: DataRow;
  rowId: string;
  rowIndex: number;
}

/** Fired by the toolbar after toggling the edit mode. */
export interface ToolbarModeEvent {
  mode: TableMode;
}

/** Fired by the toolbar after a pagination action. */
export interface ToolbarPageEvent {
  page: number;
  pageSize: number;
}

/** Fired by the toolbar after an export action. */
export interface ToolbarExportEvent {
  format: ExportFormat;
}

/** Fired after a column was hidden or shown. */
export interface ColumnVisibilityChangedEvent {
  /** The column whose visibility changed. */
  field: string;
  /** Whether the column is now visible. */
  visible: boolean;
  /** Fields of the columns currently visible, in column order. */
  visibleColumns: string[];
}

/** Fired after a column's width changed (API call, drag resize or reset). */
export interface ColumnResizedEvent {
  /** The column whose width changed. */
  field: string;
  /** The new width (pixels or CSS length), or `undefined` after a reset. */
  width: string | number | undefined;
}

/** Fired after a column was moved to a new position. */
export interface ColumnReorderedEvent {
  /** The column that was moved. */
  field: string;
  /** The column it was moved in front of. */
  beforeField: string;
  /** Full column order (fields) after the move. */
  columns: string[];
}

/** Fired whenever the undo/redo stacks change. */
export interface HistoryChangedEvent {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

/** Fired when a validated cell edit is rejected. */
export interface ValidationFailedEvent {
  field: string;
  rowId: string;
  messages: string[];
}

/** Fired when a validated cell edit passes every rule. */
export interface ValidationPassedEvent {
  field: string;
  rowId: string;
}

/** Fired when the active page, page size or total page count changes. */
export interface PageChangedEvent {
  /** 1-based page currently displayed. */
  page: number;
  /** Rows per page (`0` when pagination is disabled). */
  pageSize: number;
  /** Total pages for the current filter state (min 1). */
  totalPages: number;
  /** Rows rendered on the current page. */
  rowCount: number;
  /** Rows matching the filters across every page. */
  totalCount: number;
}

/** Fired after a saved layout was loaded (columns, sort, filters applied). */
export interface LayoutChangedEvent {
  /** The id of the layout that was applied. */
  id: string;
  /** The layout's label, when it has one. */
  label?: string;
}

/** Fired when the built-in context menu opens. */
export interface ContextMenuEvent {
  /** Where the right-click happened. */
  target: ContextMenuTarget;
  /** The column field for `header`/`cell`, `null` for `row`. */
  field: string | null;
  /** The row for `cell`/`row`, `null` for `header`. */
  row: DataRow | null;
  /** Cursor position relative to the table root. */
  x: number;
  y: number;
  /** Ids of the items shown in the menu (built-in + custom). */
  items: string[];
}

/** Fired after a context-menu item was chosen. */
export interface ContextMenuActionEvent {
  /** The chosen item's id. */
  action: string;
  target: ContextMenuTarget;
  field: string | null;
  row: DataRow | null;
}

/** Export format for file downloads. */
export type ExportFormat = 'csv' | 'json';

/** Fired after the view was exported to a file. */
export interface ExportedEvent {
  /** The file format that was written. */
  format: ExportFormat;
  /** The filename the download used. */
  filename: string;
  /** Number of rows exported (filtered view, all pages). */
  rowCount: number;
}

/** Fired when the virtual-scrolling window moved. */
export interface ViewportChangedEvent {
  /** First row index visible in the viewport (already includes overscan). */
  startIndex: number;
  /** One past the last visible row index. */
  endIndex: number;
  /** Scroll position of the viewport in pixels. */
  scrollTop: number;
  /** Visible height of the viewport in pixels. */
  viewportHeight: number;
  /** First rendered data row in the window (or `null` when empty). */
  firstVisibleRow: DataRow | null;
  /** Last rendered data row in the window (or `null` when empty). */
  lastVisibleRow: DataRow | null;
}

/** Parameters sent to a remote `dataSource`. */
export interface DataSourceParams {
  /** 1-based page requested. */
  page: number;
  /** Rows per page (`0` = server's own default). */
  pageSize: number;
  sort: SortState;
  filters: DataSourceRequestFilters;
}

/** Filter state forwarded to a remote data source. */
export interface DataSourceRequestFilters {
  /** Current (trimmed) global search query. */
  query: string;
  /** Active structured column filters. */
  structured: Array<{ field: string; operator: string; operands: unknown[] }>;
}

/** Fired before a remote data request starts. */
export interface DataLoadingEvent {
  params: DataSourceParams;
}

/** Fired after a remote data request resolved. */
export interface DataLoadedEvent {
  /** The rows committed into the table. */
  rows: DataRow[];
  /** Total rows matching the current params (server-side). */
  total: number;
  /** 1-based page that was loaded. */
  page: number;
  pageSize: number;
  /** Elapsed time of the request in ms. */
  durationMs: number;
  /** `replace` for regular loads, `append` for infinite-scroll pages. */
  mode: 'replace' | 'append';
}

/** Fired when a remote data request rejects. */
export interface DataLoadFailedEvent {
  params: DataSourceParams;
  error: unknown;
}

/** Fired when infinite scroll reached the end of the current data. */
export interface LoadMoreRequestedEvent {
  /** Page that will be requested (server mode) or rows already revealed. */
  page: number;
  /** Total rows currently loaded. */
  loadedCount: number;
  /** Total rows available (server-reported or local). */
  totalCount: number;
}

/** Fired after the grouping state changed (field, expansion or both). */
export interface GroupChangedEvent {
  /** The grouping field, or `null` after `ungroup()`. */
  field: string | null;
  /** Group keys currently collapsed. */
  collapsed: string[];
  /** Current group headers (empty when not grouped). */
  groups: GroupViewHeader[];
}

/** Fired after a tree node was expanded. */
export interface NodeExpandedEvent {
  rowId: string;
  row: DataRow;
  /** Depth of the expanded node. */
  depth: number;
  /** Number of children now visible under the node. */
  childCount: number;
}

/** Fired after a tree node was collapsed. */
export interface NodeCollapsedEvent {
  rowId: string;
  row: DataRow;
  /** Depth of the collapsed node. */
  depth: number;
}

/** Fired after the aggregation configuration changed. */
export interface AggregationChangedEvent {
  /** The active aggregation config (field -> operation). */
  aggregations: Record<string, string>;
}

/** Fired after a pivot result was computed or cleared. */
export interface PivotChangedEvent {
  /** The pivot configuration, or `null` after `clearPivot()`. */
  config: {
    rows: string[];
    columns: string[];
    values: Array<{ field: string; aggregation: string }>;
  } | null;
}

/** Map of the built-in events to their payload types. */
export interface SmartEventMap {
  cellEdit: CellEditEvent;
  rowAdded: RowAddedEvent;
  rowDeleted: RowDeletedEvent;
  sortChanged: SortChangedEvent;
  filterChanged: FilterChangedEvent;
  modeChanged: ModeChangedEvent;
  copied: CopiedEvent;
  cloned: ClonedEvent;
  selectionChanged: SelectionChangedEvent;
  dataChanged: DataChangedEvent;
  themeChanged: ThemeChangedEvent;
  columnVisibilityChanged: ColumnVisibilityChangedEvent;
  columnResized: ColumnResizedEvent;
  columnReordered: ColumnReorderedEvent;
  historyChanged: HistoryChangedEvent;
  validationFailed: ValidationFailedEvent;
  validationPassed: ValidationPassedEvent;
  pageChanged: PageChangedEvent;
  layoutChanged: LayoutChangedEvent;
  contextMenu: ContextMenuEvent;
  contextMenuAction: ContextMenuActionEvent;
  exported: ExportedEvent;
  viewportChanged: ViewportChangedEvent;
  dataLoading: DataLoadingEvent;
  dataLoaded: DataLoadedEvent;
  dataLoadFailed: DataLoadFailedEvent;
  loadMoreRequested: LoadMoreRequestedEvent;
  groupChanged: GroupChangedEvent;
  nodeExpanded: NodeExpandedEvent;
  nodeCollapsed: NodeCollapsedEvent;
  aggregationChanged: AggregationChangedEvent;
  pivotChanged: PivotChangedEvent;
  'toolbar:search': ToolbarSearchEvent;
  'toolbar:copy': ToolbarCopyEvent;
  'toolbar:clone': ToolbarCloneEvent;
  'toolbar:add': ToolbarAddEvent;
  'toolbar:mode': ToolbarModeEvent;
  'toolbar:page': ToolbarPageEvent;
  'toolbar:export': ToolbarExportEvent;
}

/**
 * The event names known by {@link SmartTable}. Plugins may register custom
 * events (for example `'paginationChanged'`); the `string` index signature
 * keeps those extensions type-safe on the table event bus.
 */
export type SmartTableEvents = SmartEventMap & Record<string, unknown>;
