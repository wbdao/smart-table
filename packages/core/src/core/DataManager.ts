import { SmartTableError, ERROR_CODES } from './errors';
import { getCellText, serializeRows } from '../utils/serialize';
import { matchesOperator } from '../filters/operators';
import type { Column, DataRow, NormalizedColumn, SortState } from '../types/column';
import type { ColumnType, CopyFormat, SortDirection } from '../types/modes';
import type { FilterOperand, FilterOperator, StructuredFilter } from '../types/filter';
import type { GroupViewHeader, ViewRow } from '../types/view';
import { groupRowsWithAggregates } from '../features/grouping/GroupingEngine';
import { flattenTree } from '../features/tree/TreeEngine';
import { aggregateRows, type AggregateConfig } from '../features/aggregation/aggregations';

/** Predicate used by `filterColumn`. Receives the raw cell value. */
export type ColumnFilterPredicate = (value: unknown) => boolean;

/** Result of a successful row removal. */
export interface RemoveResult {
  row: DataRow;
  rowId: string;
  rowIndex: number;
}

/** Result of a successful cell update. */
export interface UpdateResult {
  row: DataRow;
  rowId: string;
  rowIndex: number;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/** Snapshot of the active filters. */
export interface FilterState {
  /** Trimmed, lower-cased global search query (may be empty). */
  query: string;
  /** Number of active column filters. */
  columnFilterCount: number;
  hasActiveFilter: boolean;
}

/**
 * Applies defaults to a user column definition. Every returned column is
 * guaranteed to have `title`, `type`, `sortable`, `filterable`, `editable`,
 * `visible` and `align` filled in.
 */
export function normalizeColumn(column: Column): NormalizedColumn {
  return {
    field: column.field,
    title: column.title ?? column.field,
    type: column.type ?? 'string',
    sortable: column.sortable ?? true,
    filterable: column.filterable ?? true,
    editable: column.editable ?? true,
    visible: column.visible ?? true,
    align: column.align ?? 'left',
    width: column.width,
    minWidth: column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH,
    validators: column.validators,
    className: column.className,
    headerClassName: column.headerClassName,
    formatter: column.formatter,
  };
}

/** Default minimum width (px) enforced when resizing a column. */
export const DEFAULT_MIN_COLUMN_WIDTH = 60;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toDateMs(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === 'yes' || value === '1';
}

/**
 * Creates a comparator for a column type. All comparators are total and
 * stable: unknown/missing values sort consistently (empty values first for
 * ascending order).
 */
function createComparator(type: ColumnType): (a: unknown, b: unknown) => number {
  switch (type) {
    case 'number':
      return (a, b) => {
        const na = toNumber(a);
        const nb = toNumber(b);
        return (na ?? 0) - (nb ?? 0);
      };
    case 'date':
      return (a, b) => {
        const da = toDateMs(a);
        const db = toDateMs(b);
        if (da === null && db === null) return 0;
        if (da === null) return -1;
        if (db === null) return 1;
        return da - db;
      };
    case 'boolean':
      return (a, b) => Number(toBoolean(a)) - Number(toBoolean(b));
    case 'string':
    default:
      return (a, b) =>
        String(a ?? '').localeCompare(String(b ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
  }
}

/**
 * The headless data layer of SmartTableJS.
 *
 * Responsibilities:
 * - Store rows and normalize/assign stable row ids (a `WeakMap` keyed by row
 *   object plus a reverse `Map` for lookups, so ids never pollute user data).
 * - CRUD operations (`addRow`, `removeRow`, `updateCell`, `setData`).
 * - Derived views: `getRows()` returns the current view after filters and
 *   sorting are applied.
 * - Type-aware, stable sorting (string / number / date / boolean).
 * - Global search + per-column predicate filters, combined with AND semantics.
 * - Serialization to text / JSON / CSV.
 *
 * The DataManager is deliberately DOM-free so it can be unit-tested in Node
 * and reused by any renderer (Vanilla, React, Vue, Angular) or future plugin.
 */
export class DataManager {
  private columns: NormalizedColumn[];
  private data: DataRow[] = [];
  private readonly rowIds = new WeakMap<object, string>();
  private readonly idIndex = new Map<string, DataRow>();
  private idCounter = 0;

  private sortField: string | null = null;
  private sortDirection: SortDirection = 'asc';

  private globalQuery = '';
  private readonly columnFilters = new Map<string, ColumnFilterPredicate>();
  private readonly structuredFilters = new Map<string, StructuredFilter>();

  private pageSize = 0;
  private currentPage = 1;

  // -- Phase 4: view pipeline (grouping / tree / infinite / remote) ---------
  private groupField: string | null = null;
  private collapsedGroups = new Set<string>();
  private treeEnabled = false;
  private treeChildrenKey = 'children';
  private expandedNodes = new Set<string>();
  private lazyChildrenFn?: (row: DataRow) => DataRow[] | Promise<DataRow[]>;
  private infiniteStep = 0;
  private infiniteLimit = 0;
  private remoteMode = false;
  private remoteTotal = 0;
  private aggregateConfig: AggregateConfig = {};

  constructor(columns: Column[]) {
    this.columns = this.validateAndNormalize(columns);
  }

  // ------------------------------------------------------------------ setup

  private validateAndNormalize(columns: Column[]): NormalizedColumn[] {
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_COLUMNS,
        'SmartTable requires at least one column.'
      );
    }
    return columns.map(normalizeColumn);
  }

  setColumns(columns: Column[]): void {
    this.columns = this.validateAndNormalize(columns);
    for (const field of [...this.columnFilters.keys()]) {
      if (!this.getColumn(field)) {
        this.columnFilters.delete(field);
        this.structuredFilters.delete(field);
      }
    }
    if (this.groupField !== null && !this.getColumn(this.groupField)) {
      this.groupField = null;
      this.collapsedGroups.clear();
    }
  }

  /**
   * Reorders columns and applies per-field visibility/width in bulk, without
   * emitting events (used by layout loading). Unknown fields are ignored and
   * columns absent from `fields` keep their position after the listed ones.
   */
  applyColumnsState(
    fields: Array<{ field: string; visible: boolean; width?: string | number }>
  ): void {
    const ordered: NormalizedColumn[] = [];
    const seen = new Set<string>();
    for (const state of fields) {
      const column = this.getColumn(state.field);
      if (!column || seen.has(state.field)) continue;
      seen.add(state.field);
      column.visible = state.visible;
      if (state.width !== undefined) column.width = state.width;
      ordered.push(column);
    }
    for (const column of this.columns) {
      if (seen.has(column.field)) continue;
      seen.add(column.field);
      ordered.push(column);
    }
    this.columns = ordered;
  }

  getColumns(): NormalizedColumn[] {
    return this.columns;
  }

  getColumn(field: string): NormalizedColumn | undefined {
    return this.columns.find((c) => c.field === field);
  }

  /** Columns currently rendered / serialized, in column order. */
  getVisibleColumns(): NormalizedColumn[] {
    return this.columns.filter((c) => c.visible);
  }

  /** Whether a column is currently visible (false for unknown columns). */
  isColumnVisible(field: string): boolean {
    return this.getColumn(field)?.visible ?? false;
  }

  /** Hides a column. Returns whether the visibility actually changed. */
  hideColumn(field: string): boolean {
    const column = this.getColumn(field);
    if (!column || !column.visible) return false;
    column.visible = false;
    return true;
  }

  /** Shows a column. Returns whether the visibility actually changed. */
  showColumn(field: string): boolean {
    const column = this.getColumn(field);
    if (!column || column.visible) return false;
    column.visible = true;
    return true;
  }

  /** Flips a column's visibility and returns its new state. */
  toggleColumn(field: string): boolean {
    const column = this.getColumn(field);
    if (!column) return false;
    column.visible = !column.visible;
    return column.visible;
  }

  // ------------------------------------------------------------------ widths

  /** Current width of a column (`undefined` until explicitly set). */
  getColumnWidth(field: string): string | number | undefined {
    return this.getColumn(field)?.width;
  }

  /**
   * Sets a column's width. Numbers are clamped to the column's `minWidth`;
   * CSS strings are stored verbatim. Throws for unknown columns.
   */
  setColumnWidth(field: string, width: string | number): void {
    const column = this.getColumn(field);
    if (!column) {
      throw new SmartTableError(
        ERROR_CODES.UNKNOWN_COLUMN,
        `Cannot resize unknown column "${field}".`
      );
    }
    if (typeof width === 'number') {
      if (!Number.isFinite(width) || width <= 0) {
        throw new SmartTableError(
          ERROR_CODES.INVALID_COLUMN_WIDTH,
          `Column width must be a positive number, received "${width}".`
        );
      }
      column.width = Math.max(width, column.minWidth);
      return;
    }
    if (typeof width === 'string' && width.trim() !== '') {
      column.width = width;
      return;
    }
    throw new SmartTableError(
      ERROR_CODES.INVALID_COLUMN_WIDTH,
      `Column width must be a positive number or a CSS length string, received "${String(width)}".`
    );
  }

  /** Clears an explicitly-set column width (back to auto). Returns whether a width was set. */
  resetColumnWidth(field: string): boolean {
    const column = this.getColumn(field);
    if (!column) {
      throw new SmartTableError(
        ERROR_CODES.UNKNOWN_COLUMN,
        `Cannot reset the width of unknown column "${field}".`
      );
    }
    if (column.width === undefined) return false;
    column.width = undefined;
    return true;
  }

  // ---------------------------------------------------------------- reorder

  /**
   * Moves a column so it is placed immediately before another column.
   * Returns whether the order actually changed. Throws for unknown columns.
   */
  moveColumn(field: string, beforeField: string): boolean {
    if (field === beforeField) return false;
    const sourceIndex = this.columns.findIndex((c) => c.field === field);
    if (sourceIndex === -1) {
      throw new SmartTableError(
        ERROR_CODES.UNKNOWN_COLUMN,
        `Cannot move unknown column "${field}".`
      );
    }
    if (!this.columns.some((c) => c.field === beforeField)) {
      throw new SmartTableError(
        ERROR_CODES.UNKNOWN_COLUMN,
        `Cannot move column before unknown column "${beforeField}".`
      );
    }
    const moved = this.columns[sourceIndex];
    if (!moved) return false;
    this.columns.splice(sourceIndex, 1);
    const targetIndex = this.columns.findIndex((c) => c.field === beforeField);
    this.columns.splice(targetIndex, 0, moved);
    return true;
  }

  // ------------------------------------------------------------------- data

  /** Full dataset in insertion order (shallow copy). */
  getData(): DataRow[] {
    return [...this.data];
  }

  /**
   * Current view: full dataset filtered, then sorted, then grouped / flattened
   * (tree), then paginated to the active page. A new array is returned each
   * call; the row objects themselves are shared references.
   */
  getRows(): DataRow[] {
    return this.getViewRows()
      .filter((entry): entry is Extract<ViewRow, { type: 'row' }> => entry.type === 'row')
      .map((entry) => entry.row);
  }

  /**
   * The renderable view: filter -> sort -> grouping -> tree flatten. Every
   * entry is either a data row (`type: 'row'`) or a synthetic group header
   * (`type: 'group'`). Pagination (and the infinite-scroll limit, when active)
   * is applied last.
   */
  getViewRows(): ViewRow[] {
    const view = this.getAllViewRows();
    if (this.remoteMode) return view;
    if (this.infiniteLimit > 0) {
      return view.slice(0, this.infiniteLimit);
    }
    if (this.pageSize <= 0) return view;
    const start = (this.currentPage - 1) * this.pageSize;
    return view.slice(start, start + this.pageSize);
  }

  /** Filtered + sorted rows, before grouping / tree flatten / pagination. */
  getAllViewRows(): ViewRow[] {
    let rows = this.data;
    if (!this.remoteMode) {
      if (this.globalQuery !== '' || this.columnFilters.size > 0) {
        rows = this.applyFilters(rows);
      }
      if (this.sortField !== null) {
        rows = this.applySort(rows);
      }
    }
    let view: ViewRow[] = rows.map((row) => ({
      type: 'row',
      id: this.rowIds.get(row) ?? '',
      row,
    }));
    if (this.groupField !== null) {
      const column = this.getColumn(this.groupField);
      if (column) {
        view = groupRowsWithAggregates(
          view,
          column,
          this.collapsedGroups,
          this.aggregateConfig
        ).viewRows;
      }
    }
    if (this.treeEnabled) {
      view = flattenTree(view, {
        childrenKey: this.treeChildrenKey,
        expanded: this.expandedNodes,
        lazy: this.lazyChildrenFn !== undefined,
      }).viewRows;
    }
    return view;
  }

  /** Number of view rows currently rendered (includes group headers). */
  getViewRowCount(): number {
    return this.getViewRows().length;
  }

  /** Filtered + sorted rows, before grouping / tree flatten / pagination. */
  getFilteredRows(): DataRow[] {
    if (this.remoteMode) return [...this.data];
    let rows = this.data;
    if (this.globalQuery !== '' || this.columnFilters.size > 0) {
      rows = this.applyFilters(rows);
    }
    if (this.sortField !== null) {
      rows = this.applySort(rows);
    }
    return [...rows];
  }

  getRowCount(): number {
    return this.data.length;
  }

  /**
   * Number of rows matching the current filters (before pagination). In remote
   * mode this is the server-reported total.
   */
  getFilteredCount(): number {
    if (this.remoteMode) return this.remoteTotal;
    return this.getAllViewRows().filter((entry) => entry.type === 'row').length;
  }

  getViewCount(): number {
    return this.getRows().length;
  }

  // ------------------------------------------------------------- pagination

  /** Rows per page. `0` disables pagination. */
  getPageSize(): number {
    return this.pageSize;
  }

  /**
   * Sets the page size. `0` disables pagination (all rows are returned).
   * The current page is clamped into range.
   */
  setPageSize(size: number): void {
    if (!Number.isInteger(size) || size < 0) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_PAGE_SIZE,
        `pageSize must be a non-negative integer, received "${String(size)}".`
      );
    }
    this.pageSize = size;
    this.currentPage = Math.min(this.currentPage, this.getTotalPages());
  }

  /** 1-based index of the active page. */
  getCurrentPage(): number {
    return this.currentPage;
  }

  /** Sets the active page (1-based, clamped into range). */
  setCurrentPage(page: number): void {
    const total = this.getTotalPages();
    const next = Math.max(1, Math.min(page, total));
    if (next !== this.currentPage) this.currentPage = next;
  }

  /** Total number of pages for the current view state (min 1). */
  getTotalPages(): number {
    if (this.pageSize <= 0) return 1;
    if (this.remoteMode) return Math.max(1, Math.ceil(this.remoteTotal / this.pageSize));
    return Math.max(1, Math.ceil(this.getAllViewRows().length / this.pageSize));
  }

  /** Advances to the next page. Returns whether the page changed. */
  nextPage(): boolean {
    if (this.currentPage >= this.getTotalPages()) return false;
    this.currentPage += 1;
    return true;
  }

  /** Moves back one page. Returns whether the page changed. */
  prevPage(): boolean {
    if (this.currentPage <= 1) return false;
    this.currentPage -= 1;
    return true;
  }

  setData(rows: DataRow[], options: { resetPage?: boolean } = {}): void {
    this.data = [];
    this.idCounter = 0;
    if (options.resetPage !== false) this.currentPage = 1;
    for (const row of rows) {
      this.data.push(this.normalizeRow(row));
    }
  }

  /** Appends rows without touching the page (infinite scroll / server append). */
  appendRows(rows: DataRow[]): number {
    let added = 0;
    for (const row of rows) {
      this.data.push(this.normalizeRow(row));
      added += 1;
    }
    return added;
  }

  getRowById(id: string): DataRow | undefined {
    return this.idIndex.get(id);
  }

  getRowByIndex(index: number): DataRow | undefined {
    return this.data[index];
  }

  /**
   * Resolves a row reference (object), stable id (string) or data index
   * (number) to the row currently stored in the table, if any.
   */
  getRow(target: DataRow | string | number): DataRow | undefined {
    const index = this.findRowIndex(target);
    return index === -1 ? undefined : this.data[index];
  }

  getRowId(row: DataRow): string | undefined {
    return this.rowIds.get(row);
  }

  getRowIndex(row: DataRow): number {
    return this.data.indexOf(row);
  }

  private normalizeRow(row: DataRow): DataRow {
    const existingId = this.rowIds.get(row);
    if (existingId !== undefined) return row;
    const id = this.resolveRowId(row);
    this.rowIds.set(row, id);
    this.idIndex.set(id, row);
    return row;
  }

  private resolveRowId(row: DataRow): string {
    const id = row['id'];
    if (id !== null && id !== undefined && (typeof id === 'string' || typeof id === 'number')) {
      return String(id);
    }
    this.idCounter += 1;
    return `row-${this.idCounter}`;
  }

  // ------------------------------------------------------------------- CRUD

  /**
   * Appends a row and returns the normalized copy that lives inside the
   * table. The row's `id` field is preserved when present (string or number);
   * otherwise a generated id is assigned and tracked in the id index.
   */
  addRow(row: DataRow): DataRow {
    const copy = { ...row };
    const normalized = this.normalizeRow(copy);
    this.data.push(normalized);
    return normalized;
  }

  /**
   * Re-inserts a previously stored row object at an index, restoring its id
   * mapping. Used by undo/redo so the exact same object (and thus its
   * selection identity) comes back. Clamps the index into range.
   */
  insertRow(index: number, row: DataRow, rowId: string): DataRow {
    const at = Math.max(0, Math.min(index, this.data.length));
    this.data.splice(at, 0, row);
    this.rowIds.set(row, rowId);
    if (rowId !== '') this.idIndex.set(rowId, row);
    return row;
  }

  /**
   * Removes a row by object reference, by id (string), or by index (number).
   * Returns the removed row with its resolved id and index, or `null` when
   * the target could not be found.
   */
  removeRow(target: DataRow | string | number): RemoveResult | null {
    const index = this.findRowIndex(target);
    if (index === -1) return null;
    const removed = this.data[index];
    if (!removed) return null;
    const rowId = this.rowIds.get(removed) ?? '';
    this.data.splice(index, 1);
    if (rowId !== '') this.idIndex.delete(rowId);
    this.rowIds.delete(removed);
    return { row: removed, rowId, rowIndex: index };
  }

  /**
   * Writes a new value into a cell. Returns the diff (`oldValue`/`newValue`)
   * plus row metadata, or `null` when the target row was not found.
   */
  updateCell(
    target: DataRow | string | number,
    field: string,
    value: unknown
  ): UpdateResult | null {
    const index = this.findRowIndex(target);
    if (index === -1) return null;
    const row = this.data[index];
    if (!row) return null;
    const oldValue = row[field];
    row[field] = value;
    return {
      row,
      rowId: this.rowIds.get(row) ?? '',
      rowIndex: index,
      field,
      oldValue,
      newValue: value,
    };
  }

  private findRowIndex(target: DataRow | string | number): number {
    if (target !== null && typeof target === 'object') {
      return this.data.indexOf(target);
    }
    if (typeof target === 'string') {
      const row = this.idIndex.get(target);
      return row === undefined ? -1 : this.data.indexOf(row);
    }
    if (typeof target === 'number') {
      return target >= 0 && target < this.data.length ? target : -1;
    }
    return -1;
  }

  // ------------------------------------------------------------------ sort

  sort(field: string, direction: SortDirection = 'asc'): void {
    this.sortField = field;
    this.sortDirection = direction;
  }

  clearSort(): void {
    this.sortField = null;
    this.sortDirection = 'asc';
  }

  getSortState(): SortState {
    return {
      field: this.sortField,
      direction: this.sortField === null ? null : this.sortDirection,
    };
  }

  private applySort(rows: DataRow[]): DataRow[] {
    const field = this.sortField;
    if (field === null) return rows;
    const column = this.getColumn(field);
    const compare = createComparator(column?.type ?? 'string');
    const factor = this.sortDirection === 'desc' ? -1 : 1;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const result = compare(a.row[field], b.row[field]);
        return result !== 0 ? result * factor : a.index - b.index;
      })
      .map((entry) => entry.row);
  }

  // ---------------------------------------------------------------- filter

  /** Sets the global (case-insensitive) search query. Empty string clears it. */
  filter(query: string): void {
    this.globalQuery = query.trim().toLocaleLowerCase();
  }

  /**
   * Registers a predicate filter for a column. The predicate receives the
   * raw cell value and must return whether the row stays visible.
   */
  filterColumn(field: string, predicate: ColumnFilterPredicate): void {
    if (!this.getColumn(field)) {
      throw new SmartTableError(
        ERROR_CODES.UNKNOWN_COLUMN,
        `Cannot filter unknown column "${field}".`
      );
    }
    this.columnFilters.set(field, predicate);
    this.structuredFilters.delete(field);
  }

  /**
   * Registers a structured filter built from an operator and its operands.
   * The same column can only hold one filter; a second call replaces it.
   */
  where(field: string, operator: FilterOperator, ...operands: FilterOperand[]): void {
    if (!this.getColumn(field)) {
      throw new SmartTableError(
        ERROR_CODES.UNKNOWN_COLUMN,
        `Cannot filter unknown column "${field}".`
      );
    }
    this.structuredFilters.set(field, { field, operator, operands });
    this.columnFilters.set(field, (value: unknown) => matchesOperator(operator, value, operands));
  }

  /** Every active structured filter, in insertion order. */
  getStructuredFilters(): StructuredFilter[] {
    return [...this.structuredFilters.values()];
  }

  clearColumnFilter(field: string): void {
    this.columnFilters.delete(field);
    this.structuredFilters.delete(field);
  }

  clearFilter(): void {
    this.globalQuery = '';
    this.columnFilters.clear();
    this.structuredFilters.clear();
  }

  getFilterState(): FilterState {
    return {
      query: this.globalQuery,
      columnFilterCount: this.columnFilters.size,
      hasActiveFilter: this.globalQuery !== '' || this.columnFilters.size > 0,
    };
  }

  private applyFilters(rows: DataRow[]): DataRow[] {
    const searchable = this.columns.filter((c) => c.filterable);
    const result: DataRow[] = [];
    for (const row of rows) {
      if (this.globalQuery !== '') {
        let matched = false;
        for (const column of searchable) {
          if (getCellText(column, row).toLocaleLowerCase().includes(this.globalQuery)) {
            matched = true;
            break;
          }
        }
        if (!matched) continue;
      }
      let ok = true;
      for (const [field, predicate] of this.columnFilters) {
        if (!predicate(row[field])) {
          ok = false;
          break;
        }
      }
      if (ok) result.push(row);
    }
    return result;
  }

  // ----------------------------------------------------------- serialization

  serialize(format: CopyFormat): string {
    return serializeRows(this.columns, this.getRows(), format);
  }

  // ------------------------------------------------- Phase 4: remote mode

  /** Enables remote mode: local filters/sort are skipped, rows come from the server. */
  setServerMode(on: boolean): void {
    this.remoteMode = on;
  }

  isServerMode(): boolean {
    return this.remoteMode;
  }

  /** Sets the server-reported total (drives pagination in remote mode). */
  setRemoteTotal(total: number): void {
    this.remoteTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  }

  getRemoteTotal(): number {
    return this.remoteTotal;
  }

  // ------------------------------------------------- Phase 4: grouping

  setGroupField(field: string | null): void {
    this.groupField = field;
    this.collapsedGroups.clear();
  }

  getGroupField(): string | null {
    return this.groupField;
  }

  isGroupCollapsed(key: string): boolean {
    return this.collapsedGroups.has(key);
  }

  /** Toggles a group's collapsed state. Returns `true` when now collapsed. */
  toggleGroup(key: string): boolean {
    if (this.collapsedGroups.has(key)) {
      this.collapsedGroups.delete(key);
      return false;
    }
    this.collapsedGroups.add(key);
    return true;
  }

  setGroupCollapsed(keys: Iterable<string>): void {
    this.collapsedGroups = new Set(keys);
  }

  getCollapsedGroups(): string[] {
    return [...this.collapsedGroups];
  }

  /** Current group headers, computed over the filtered view. */
  getGroupHeaders(): GroupViewHeader[] {
    if (this.groupField === null) return [];
    const column = this.getColumn(this.groupField);
    if (!column) return [];
    const rows: ViewRow[] = this.getFilteredRows().map((row) => ({
      type: 'row',
      id: this.rowIds.get(row) ?? '',
      row,
    }));
    return groupRowsWithAggregates(rows, column, this.collapsedGroups, this.aggregateConfig).groups;
  }

  // ----------------------------------------------------- Phase 4: tree

  setTree(
    enabled: boolean,
    options?: {
      childrenKey?: string;
      lazyChildren?: (row: DataRow) => DataRow[] | Promise<DataRow[]>;
      expanded?: string[];
    }
  ): void {
    this.treeEnabled = enabled;
    if (enabled && options) {
      if (options.childrenKey !== undefined) this.treeChildrenKey = options.childrenKey;
      if (options.lazyChildren !== undefined) this.lazyChildrenFn = options.lazyChildren;
      if (options.expanded !== undefined) this.expandedNodes = new Set(options.expanded);
    } else if (!enabled) {
      this.expandedNodes.clear();
      this.lazyChildrenFn = undefined;
    }
  }

  isTreeEnabled(): boolean {
    return this.treeEnabled;
  }

  getChildrenKey(): string {
    return this.treeChildrenKey;
  }

  getLazyChildren(): ((row: DataRow) => DataRow[] | Promise<DataRow[]>) | undefined {
    return this.lazyChildrenFn;
  }

  isNodeExpanded(id: string): boolean {
    return this.expandedNodes.has(id);
  }

  expandNode(id: string): void {
    this.expandedNodes.add(id);
  }

  collapseNode(id: string): void {
    this.expandedNodes.delete(id);
  }

  /** Toggles a node's expansion. Returns `true` when now expanded. */
  toggleNode(id: string): boolean {
    if (this.expandedNodes.has(id)) {
      this.expandedNodes.delete(id);
      return false;
    }
    this.expandedNodes.add(id);
    return true;
  }

  getExpandedNodes(): string[] {
    return [...this.expandedNodes];
  }

  setExpandedNodes(ids: Iterable<string>): void {
    this.expandedNodes = new Set(ids);
  }

  // -------------------------------------------- Phase 4: infinite scroll

  /** Enables local infinite scroll, revealing `step` rows at a time. */
  setInfiniteScroll(step: number): void {
    this.infiniteStep = Math.max(1, Math.floor(step));
    if (this.infiniteLimit === 0) this.infiniteLimit = this.infiniteStep;
  }

  isInfiniteScrollEnabled(): boolean {
    return this.infiniteStep > 0;
  }

  getInfiniteLimit(): number {
    return this.infiniteLimit;
  }

  /** Rows revealed per `loadMore` chunk. */
  getInfiniteStep(): number {
    return this.infiniteStep;
  }

  /** Whether more rows can be revealed / loaded. */
  hasMore(): boolean {
    if (this.remoteMode) return this.data.length < this.remoteTotal;
    if (this.infiniteStep <= 0) return false;
    return this.infiniteLimit < this.getAllViewRows().length;
  }

  /** Reveals the next infinite-scroll chunk. Returns whether it grew. */
  expandInfinite(): boolean {
    if (!this.hasMore()) return false;
    const next = Math.min(this.infiniteLimit + this.infiniteStep, this.getAllViewRows().length);
    if (next === this.infiniteLimit) return false;
    this.infiniteLimit = next;
    return true;
  }

  // ----------------------------------------------------- Phase 4: totals

  setAggregations(config: AggregateConfig): void {
    this.aggregateConfig = config;
  }

  getAggregations(): AggregateConfig {
    return this.aggregateConfig;
  }

  /** Footer aggregate values over the filtered view. */
  getAggregateFooter(): Record<string, number | string> {
    if (Object.keys(this.aggregateConfig).length === 0) return {};
    return aggregateRows(this.getFilteredRows(), this.aggregateConfig);
  }
}
