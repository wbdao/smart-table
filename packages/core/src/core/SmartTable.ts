import { EventBus, type EventHandler } from './EventBus';
import { DataManager, type ColumnFilterPredicate, type FilterState } from './DataManager';
import { SmartTableError, ERROR_CODES } from './errors';
import type { DataRow, NormalizedColumn, SortState } from '../types/column';
import type { CopyFormat, SortDirection, TableMode, ThemeName } from '../types/modes';
import type {
  SmartTableOptions,
  ResponsiveBreakpoints,
  VirtualScrollOptions,
} from '../types/options';
import type { SmartTablePlugin } from '../types/plugin';
import type {
  SmartTableEvents,
  DataChangeOperation,
  ExportFormat,
  DataSourceRequestFilters,
} from '../types/events';
import type { FilterOperand, FilterOperator, StructuredFilter } from '../types/filter';
import type { ContextMenuOptions } from '../types/context-menu';
import type { SavedLayout } from '../types/layout';
import type { GroupViewHeader } from '../types/view';
import type { ThemeDefinition, ThemeInput, ThemeVariables } from '../types/theme';
import type { Renderer, RendererFactory } from '../ui/Renderer';
import { COPY_FORMATS, SORT_DIRECTIONS, TABLE_MODES, THEMES } from '../types/modes';
import { applyThemeVariables, resolveBuiltInTheme } from './themes';
import { normalizeBreakpoints } from './breakpoints';
import { HistoryManager, type HistoryEntry } from '../history/HistoryManager';
import {
  hasValidators,
  isRowValid,
  validateColumnValue,
  validateRow,
  type ValidationResult,
} from '../validation/validators';
import { isFilterOperator } from '../filters/operators';
import { captureLayout, createDefaultLayoutStorage, LayoutManager } from '../layouts/LayoutManager';
import {
  assertValidAggregateConfig,
  type AggregateConfig,
} from '../features/aggregation/aggregations';
import { ServerController, type DataSource } from '../features/server/ServerController';
import { StateManager, type GridState } from '../features/state/StateManager';
import {
  PivotEngine,
  PivotResult,
  assertValidPivotConfig,
  type PivotConfig,
} from '../features/pivot/PivotEngine';
import { createId, deepClone, downloadFile, serializeRows } from '../utils';

function resolveContainer(container?: HTMLElement | string | null): HTMLElement | null {
  if (container === null || container === undefined) return null;
  if (typeof container === 'string') {
    if (typeof document === 'undefined') return null;
    return document.querySelector<HTMLElement>(container);
  }
  return container;
}

function isCustomTheme(value: ThemeInput): value is ThemeDefinition {
  return typeof value === 'object' && value !== null;
}

/** Normalizes the `virtualScroll` option into a valid config (or `null`). */
function normalizeVirtualScroll(
  value: boolean | VirtualScrollOptions | undefined
): VirtualScrollOptions | null {
  if (value === undefined || value === false) return null;
  if (value === true) return { enabled: true };
  const rowHeight = value.rowHeight ?? 40;
  const overscan = value.overscan ?? 10;
  if (
    !Number.isFinite(rowHeight) ||
    rowHeight <= 0 ||
    !Number.isInteger(overscan) ||
    overscan < 0
  ) {
    throw new SmartTableError(
      ERROR_CODES.INVALID_VIRTUAL_SCROLL,
      'virtualScroll requires rowHeight > 0 and an integer overscan >= 0.'
    );
  }
  return { enabled: value.enabled !== false, rowHeight, overscan };
}

/**
 * SmartTable — a framework-agnostic data table.
 *
 * The class is intentionally headless in its core: all state, data, sorting,
 * filtering, selection, mode and events live here without touching the DOM. A
 * renderer (Vanilla / React / Vue / Angular) subscribes to the same data
 * through `getRows()` / `getSelection()` and the event bus. The built-in
 * `DOMRenderer` is registered as the default factory, so `table.mount(target)`
 * is the convenient entry point while the core itself stays DOM-free.
 *
 * Guarantees:
 * - Mutable operations are blocked in `'readonly'` mode (`addRow`,
 *   `removeRow`, `updateCell`) and throw a typed `SmartTableError`.
 * - Every state change emits a typed event on `table.events` / `table.on`.
 * - Rows are normalized once and tracked by stable ids that never pollute
 *   the user's row objects.
 * - Selection is reference-based and survives sorting/filtering; it is pruned
 *   when rows are removed or the dataset is replaced.
 */
export class SmartTable {
  /** Unique instance id (from `options.id` or auto-generated). */
  readonly id: string;

  /** Typed event bus. Built-in events use the `SmartEventMap`; the `string`
   *  index lets plugins register custom events too. */
  readonly events: EventBus<SmartTableEvents>;

  /** Whether the responsive layout is enabled for the renderer. */
  readonly responsive: boolean;

  private readonly initialOptions: SmartTableOptions;
  private readonly dataManager: DataManager;
  private readonly container: HTMLElement | null;
  private readonly plugins = new Map<string, SmartTablePlugin>();
  private readonly selection = new Set<DataRow>();
  private readonly breakpoints: ResponsiveBreakpoints;

  private mode: TableMode;
  private themeName: string;
  private customTheme: ThemeDefinition | null = null;
  private renderer: Renderer | null = null;
  private destroyed = false;
  private readonly history: HistoryManager;
  private readonly layoutManager: LayoutManager;
  private readonly virtualScroll: VirtualScrollOptions | null;
  private readonly serverController: ServerController | null;
  private readonly stateManager: StateManager;
  private pivotResult: PivotResult | null = null;

  /** Default renderer factory, set by the UI entry point. Override via
   *  {@link SmartTable.registerRenderer}. */
  private static rendererFactory: RendererFactory | null = null;

  constructor(options: SmartTableOptions) {
    if (!options || !Array.isArray(options.columns) || options.columns.length === 0) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_COLUMNS,
        'SmartTable requires at least one column.'
      );
    }
    this.initialOptions = options;
    this.id = options.id ?? createId('table');
    this.events = new EventBus<SmartTableEvents>();
    this.container = resolveContainer(options.container);
    const responsiveInput = options.responsive ?? false;
    this.responsive = typeof responsiveInput === 'boolean' ? responsiveInput : true;
    this.breakpoints = normalizeBreakpoints(
      typeof responsiveInput === 'object' ? responsiveInput : undefined
    );
    this.mode = options.mode ?? (options.editable !== false ? 'editable' : 'readonly');

    const initialTheme = options.theme ?? 'light';
    if (typeof initialTheme === 'string') {
      if (!THEMES.includes(initialTheme as ThemeName)) {
        throw new SmartTableError(
          ERROR_CODES.INVALID_THEME,
          `Unknown theme "${initialTheme}". Use "light", "dark", "corporate" or a custom theme object.`
        );
      }
      this.themeName = initialTheme;
    } else if (isCustomTheme(initialTheme)) {
      this.validateCustomTheme(initialTheme);
      this.themeName = initialTheme.name;
      this.customTheme = initialTheme;
    } else {
      this.themeName = 'light';
    }

    this.dataManager = new DataManager(options.columns);
    if (options.data && options.data.length > 0) {
      this.dataManager.setData(options.data);
    }
    if (options.pageSize !== undefined) {
      this.setPageSize(options.pageSize);
    }

    const historySize = options.historySize ?? 100;
    if (typeof historySize !== 'number' || !Number.isInteger(historySize) || historySize < 0) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_HISTORY_SIZE,
        `historySize must be a non-negative integer, received "${String(historySize)}".`
      );
    }
    this.history = new HistoryManager(historySize);

    const layoutNamespace = options.layoutNamespace ?? this.id;
    this.layoutManager = new LayoutManager(
      options.layoutStorage ?? createDefaultLayoutStorage(),
      layoutNamespace
    );

    // ------------------------------------------------------- Phase 4 setup

    this.virtualScroll = normalizeVirtualScroll(options.virtualScroll);

    if (options.aggregations !== undefined) {
      assertValidAggregateConfig(options.aggregations);
      this.dataManager.setAggregations(options.aggregations as AggregateConfig);
    }

    if (options.tree) {
      const treeOptions = typeof options.tree === 'object' ? options.tree : {};
      this.dataManager.setTree(true, {
        childrenKey: treeOptions.childrenKey,
        lazyChildren: treeOptions.lazyChildren,
        expanded: treeOptions.expanded,
      });
    }

    if (options.infiniteScroll) {
      const step = this.dataManager.getPageSize() > 0 ? this.dataManager.getPageSize() : 100;
      this.dataManager.setInfiniteScroll(step);
    }

    if (options.dataSource !== undefined) {
      if (typeof options.dataSource !== 'function') {
        throw new SmartTableError(
          ERROR_CODES.INVALID_DATA_SOURCE,
          'dataSource must be a function returning { rows, total }.'
        );
      }
      this.dataManager.setServerMode(true);
      if (this.dataManager.getPageSize() <= 0) this.dataManager.setPageSize(100);
      this.serverController = new ServerController({
        table: this,
        dataSource: options.dataSource as DataSource,
      });
      this.serverController.refreshParams();
      this.serverController.reload();
    } else {
      this.serverController = null;
    }

    this.stateManager = new StateManager(this);

    this.applyTheme();
  }

  // ----------------------------------------------------------------- events

  /** Registers an event handler. Returns an unsubscribe function. */
  on<K extends keyof SmartTableEvents>(
    event: K,
    handler: EventHandler<SmartTableEvents[K]>
  ): () => void {
    return this.events.on(event, handler);
  }

  /** Registers a one-shot event handler. Returns an unsubscribe function. */
  once<K extends keyof SmartTableEvents>(
    event: K,
    handler: EventHandler<SmartTableEvents[K]>
  ): () => void {
    return this.events.once(event, handler);
  }

  /** Removes a previously registered handler. */
  off<K extends keyof SmartTableEvents>(
    event: K,
    handler: EventHandler<SmartTableEvents[K]>
  ): void {
    this.events.off(event, handler);
  }

  // ------------------------------------------------------------------- mode

  getMode(): TableMode {
    return this.mode;
  }

  isEditable(): boolean {
    return this.mode === 'editable';
  }

  setMode(mode: TableMode): void {
    this.ensureNotDestroyed();
    if (!TABLE_MODES.includes(mode)) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_MODE,
        `Invalid mode "${String(mode)}". Use "readonly" or "editable".`
      );
    }
    if (this.mode === mode) return;
    const previousMode = this.mode;
    this.mode = mode;
    this.events.emit('modeChanged', { mode, previousMode });
  }

  /**
   * Normalized context-menu configuration (enabled flag + custom items).
   * `enabled` defaults to `true`; `items` defaults to `[]`.
   */
  getContextMenuOptions(): ContextMenuOptions {
    this.ensureNotDestroyed();
    const raw = this.initialOptions.contextMenu;
    if (raw === false) return { enabled: false };
    if (raw === undefined || raw === true) return { enabled: true };
    return { enabled: raw.enabled !== false, items: raw.items ?? [] };
  }

  // ------------------------------------------------------------------- data

  /** Full dataset in insertion order. */
  getData(): DataRow[] {
    return this.dataManager.getData();
  }

  /** Current view: filtered, then sorted. */
  getRows(): DataRow[] {
    return this.dataManager.getRows();
  }

  getRowCount(): number {
    return this.dataManager.getRowCount();
  }

  getViewCount(): number {
    return this.dataManager.getViewCount();
  }

  getColumns(): NormalizedColumn[] {
    return this.dataManager.getColumns();
  }

  getColumn(field: string): NormalizedColumn | undefined {
    return this.dataManager.getColumn(field);
  }

  // ------------------------------------------------------------ columns

  /** Columns currently rendered / serialized, in column order. */
  getVisibleColumns(): NormalizedColumn[] {
    return this.dataManager.getVisibleColumns();
  }

  /** Whether a column is currently visible. */
  isColumnVisible(field: string): boolean {
    this.ensureNotDestroyed();
    return this.dataManager.isColumnVisible(field);
  }

  /** Current width of a column (`undefined` until explicitly set). */
  getColumnWidth(field: string): string | number | undefined {
    this.ensureNotDestroyed();
    this.assertKnownColumn(field);
    return this.dataManager.getColumnWidth(field);
  }

  /**
   * Sets a column's width (pixels or a CSS length string). Numeric widths are
   * clamped to the column's `minWidth`. Allowed in every mode.
   * Emits `columnResized`.
   */
  setColumnWidth(field: string, width: string | number): void {
    this.ensureNotDestroyed();
    this.assertKnownColumn(field);
    this.dataManager.setColumnWidth(field, width);
    const resolved = this.dataManager.getColumnWidth(field);
    this.events.emit('columnResized', { field, width: resolved ?? width });
  }

  /**
   * Clears an explicitly-set column width so the column sizes automatically.
   * Allowed in every mode. Emits `columnResized` with `width: undefined`.
   */
  resetColumnWidth(field: string): void {
    this.ensureNotDestroyed();
    this.assertKnownColumn(field);
    this.dataManager.resetColumnWidth(field);
    this.events.emit('columnResized', { field, width: this.dataManager.getColumnWidth(field) });
  }

  /**
   * Moves a column so it is placed immediately before another column. The new
   * order is kept during sorting, filtering and re-renders. Allowed in every
   * mode. Emits `columnReordered` when the order actually changed.
   */
  moveColumn(field: string, beforeField: string): boolean {
    this.ensureNotDestroyed();
    this.assertKnownColumn(field);
    this.assertKnownColumn(beforeField);
    const changed = this.dataManager.moveColumn(field, beforeField);
    if (changed) {
      this.events.emit('columnReordered', {
        field,
        beforeField,
        columns: this.getColumns().map((c) => c.field),
      });
    }
    return changed;
  }

  /**
   * Hides a column (it is no longer rendered or serialized). Data is
   * preserved and sort/filter state is unaffected. Allowed in every mode.
   * Emits `columnVisibilityChanged` when the state actually changed.
   */
  hideColumn(field: string): boolean {
    this.ensureNotDestroyed();
    this.assertKnownColumn(field);
    const changed = this.dataManager.hideColumn(field);
    if (changed) this.emitColumnVisibilityChanged(field, false);
    return changed;
  }

  /**
   * Shows a previously hidden column. Data is preserved. Allowed in every
   * mode. Emits `columnVisibilityChanged` when the state actually changed.
   */
  showColumn(field: string): boolean {
    this.ensureNotDestroyed();
    this.assertKnownColumn(field);
    const changed = this.dataManager.showColumn(field);
    if (changed) this.emitColumnVisibilityChanged(field, true);
    return changed;
  }

  /**
   * Flips a column's visibility and returns its new state. Allowed in every
   * mode. Emits `columnVisibilityChanged`.
   */
  toggleColumn(field: string): boolean {
    this.ensureNotDestroyed();
    this.assertKnownColumn(field);
    const visible = this.dataManager.toggleColumn(field);
    this.emitColumnVisibilityChanged(field, visible);
    return visible;
  }

  /** Resolved stable id for a row currently inside the table. */
  getRowId(row: DataRow): string | undefined {
    return this.dataManager.getRowId(row);
  }

  /** Index of a row inside the full dataset (insertion order). */
  getRowIndex(row: DataRow): number {
    return this.dataManager.getRowIndex(row);
  }

  /** Row stored at `index` inside the full dataset, if any. */
  getRowByIndex(index: number): DataRow | undefined {
    return this.dataManager.getRowByIndex(index);
  }

  /** Resolves a row reference (object), id (string) or index (number). */
  getRow(target: DataRow | string | number): DataRow | undefined {
    return this.dataManager.getRow(target);
  }

  /** Row currently stored under a stable id, if any. */
  getRowById(rowId: string): DataRow | undefined {
    this.ensureNotDestroyed();
    return this.dataManager.getRowById(rowId);
  }

  /** Replaces the entire dataset. Always allowed, regardless of mode. */
  setData(rows: DataRow[]): void {
    this.ensureNotDestroyed();
    const hadSelection = this.selection.size > 0;
    this.dataManager.setData(rows);
    this.selection.clear();
    this.history.clear();
    this.events.emit('dataChanged', { operation: 'setData' });
    if (hadSelection) this.emitSelectionChanged();
    this.emitHistoryChanged();
    this.emitPageChanged();
  }

  /**
   * Appends a row. Throws in readonly mode. Emits `rowAdded` and `dataChanged`
   * with the normalized row, its resolved id and its index.
   */
  addRow(row: DataRow): DataRow {
    this.assertEditable('addRow');
    const added = this.dataManager.addRow(row);
    const rowId = this.dataManager.getRowId(added) ?? '';
    const rowIndex = this.dataManager.getRowIndex(added);
    this.history.push({ type: 'rowAdd', rowId, row: added, index: rowIndex });
    this.events.emit('rowAdded', { row: added, rowId, rowIndex });
    this.events.emit('dataChanged', { operation: 'addRow', row: added, rowId, rowIndex });
    this.emitHistoryChanged();
    return added;
  }

  /**
   * Removes a row by object reference, id (string) or index (number).
   * Returns the removed row or `null`. Throws in readonly mode and emits
   * `rowDeleted` / `dataChanged` on success. Removed rows are pruned from the
   * selection.
   */
  removeRow(target: DataRow | string | number): DataRow | null {
    this.assertEditable('removeRow');
    const result = this.dataManager.removeRow(target);
    if (result) {
      const wasSelected = this.selection.delete(result.row);
      this.history.push({
        type: 'rowDelete',
        rowId: result.rowId,
        row: result.row,
        index: result.rowIndex,
      });
      this.events.emit('rowDeleted', {
        row: result.row,
        rowId: result.rowId,
        rowIndex: result.rowIndex,
      });
      this.events.emit('dataChanged', {
        operation: 'removeRow',
        row: result.row,
        rowId: result.rowId,
        rowIndex: result.rowIndex,
      });
      if (wasSelected) this.emitSelectionChanged();
      this.emitHistoryChanged();
      this.clampPageAfterMutation();
    }
    return result?.row ?? null;
  }

  /**
   * Writes a value into a cell. Throws in readonly mode and for unknown
   * columns. Emits `cellEdit` / `dataChanged` only when the value changed.
   */
  updateCell(target: DataRow | string | number, field: string, value: unknown): DataRow | null {
    this.assertEditable('updateCell');
    const column = this.dataManager.getColumn(field);
    if (!column) {
      throw new SmartTableError(
        ERROR_CODES.UNKNOWN_COLUMN,
        `Cannot edit unknown column "${field}".`
      );
    }
    const row = this.dataManager.getRow(target);
    if (!row) return null;
    if (hasValidators(column)) {
      const messages = validateColumnValue(column, { ...row, [field]: value });
      if (messages.length > 0) {
        this.events.emit('validationFailed', {
          field,
          rowId: this.dataManager.getRowId(row) ?? '',
          messages,
        });
        throw new SmartTableError(ERROR_CODES.VALIDATION_FAILED, `${column.title}: ${messages[0]}`);
      }
    }
    const result = this.dataManager.updateCell(row, field, value);
    if (result) {
      if (!Object.is(result.oldValue, result.newValue)) {
        this.events.emit('cellEdit', {
          row: result.row,
          rowId: result.rowId,
          rowIndex: result.rowIndex,
          column,
          field,
          oldValue: result.oldValue,
          newValue: result.newValue,
        });
        this.events.emit('dataChanged', {
          operation: 'updateCell',
          row: result.row,
          rowId: result.rowId,
          rowIndex: result.rowIndex,
          field,
          oldValue: result.oldValue,
          newValue: result.newValue,
        });
        this.history.push({
          type: 'cellEdit',
          rowId: result.rowId,
          field,
          oldValue: result.oldValue,
          newValue: result.newValue,
        });
        this.emitHistoryChanged();
        if (hasValidators(column)) {
          this.events.emit('validationPassed', {
            field,
            rowId: result.rowId,
          });
        }
      }
    }
    return result?.row ?? null;
  }

  // -------------------------------------------------------------- validation

  /** Validates a single field against the current rules. */
  validateCell(target: DataRow | string | number, field: string): string[] {
    this.ensureNotDestroyed();
    const row = this.dataManager.getRow(target);
    if (!row) return [];
    const column = this.dataManager.getColumn(field);
    if (!column || !hasValidators(column)) return [];
    return validateColumnValue(column, row);
  }

  /** Validates every column against a single row. */
  validateRow(target: DataRow | string | number): ValidationResult {
    this.ensureNotDestroyed();
    const row = this.dataManager.getRow(target);
    if (!row) return [];
    return validateRow(this.getColumns(), row);
  }

  /** Whether a row passes every column's validation rules. */
  isRowValid(target: DataRow | string | number): boolean {
    this.ensureNotDestroyed();
    const row = this.dataManager.getRow(target);
    if (!row) return false;
    return isRowValid(this.getColumns(), row);
  }

  // -------------------------------------------------------------- history

  /**
   * Reverts the most recent recorded operation (cell edit, row add or row
   * delete). Returns whether an operation was undone. Emits `historyChanged`
   * and the usual data events.
   */
  undo(): boolean {
    this.ensureNotDestroyed();
    const entry = this.history.peekUndo();
    if (!entry) return false;
    if (!this.applyUndo(entry)) return false;
    this.history.popUndo();
    this.history.pushRedo(entry);
    this.emitHistoryChanged();
    return true;
  }

  /** Re-applies the last undone operation. Emits `historyChanged`. */
  redo(): boolean {
    this.ensureNotDestroyed();
    const entry = this.history.peekRedo();
    if (!entry) return false;
    if (!this.applyRedo(entry)) return false;
    this.history.popRedo();
    this.history.push(entry);
    this.emitHistoryChanged();
    return true;
  }

  /** Whether at least one operation can be undone. */
  canUndo(): boolean {
    this.ensureNotDestroyed();
    return this.history.canUndo();
  }

  /** Whether at least one undone operation can be re-applied. */
  canRedo(): boolean {
    this.ensureNotDestroyed();
    return this.history.canRedo();
  }

  /** Number of operations currently available to undo. */
  getUndoCount(): number {
    this.ensureNotDestroyed();
    return this.history.getUndoCount();
  }

  /** Number of undone operations available to redo. */
  getRedoCount(): number {
    this.ensureNotDestroyed();
    return this.history.getRedoCount();
  }

  /** Drops every recorded operation. Emits `historyChanged`. */
  clearHistory(): void {
    this.ensureNotDestroyed();
    if (!this.history.canUndo() && !this.history.canRedo()) return;
    this.history.clear();
    this.emitHistoryChanged();
  }

  private emitHistoryChanged(): void {
    this.events.emit('historyChanged', this.history.getState());
  }

  private applyUndo(entry: HistoryEntry): boolean {
    switch (entry.type) {
      case 'cellEdit':
        return this.restoreCell(entry.rowId, entry.field, entry.oldValue);
      case 'rowAdd':
        return this.removeHistoryRow(entry);
      case 'rowDelete':
        return this.restoreHistoryRow(entry);
    }
  }

  private applyRedo(entry: HistoryEntry): boolean {
    switch (entry.type) {
      case 'cellEdit':
        return this.restoreCell(entry.rowId, entry.field, entry.newValue);
      case 'rowAdd':
        return this.restoreHistoryRow(entry);
      case 'rowDelete':
        return this.removeHistoryRow(entry);
    }
  }

  private restoreCell(rowId: string, field: string, value: unknown): boolean {
    const row = this.dataManager.getRowById(rowId);
    if (!row) return false;
    const oldValue = row[field];
    row[field] = value;
    const column = this.dataManager.getColumn(field);
    if (!column) return false;
    this.events.emit('cellEdit', {
      row,
      rowId,
      rowIndex: this.dataManager.getRowIndex(row),
      column,
      field,
      oldValue,
      newValue: value,
    });
    this.events.emit('dataChanged', {
      operation: 'updateCell',
      row,
      rowId,
      rowIndex: this.dataManager.getRowIndex(row),
      field,
      oldValue,
      newValue: value,
    });
    return true;
  }

  private restoreHistoryRow(entry: { rowId: string; row: DataRow; index: number }): boolean {
    this.dataManager.insertRow(entry.index, entry.row, entry.rowId);
    const rowIndex = this.dataManager.getRowIndex(entry.row);
    this.events.emit('rowAdded', { row: entry.row, rowId: entry.rowId, rowIndex });
    this.events.emit('dataChanged', {
      operation: 'addRow',
      row: entry.row,
      rowId: entry.rowId,
      rowIndex,
    });
    return true;
  }

  private removeHistoryRow(entry: { rowId: string; row: DataRow; index: number }): boolean {
    const result = this.dataManager.removeRow(entry.row);
    if (!result) return false;
    if (this.selection.delete(entry.row)) this.emitSelectionChanged();
    this.events.emit('rowDeleted', {
      row: entry.row,
      rowId: entry.rowId,
      rowIndex: result.rowIndex,
    });
    this.events.emit('dataChanged', {
      operation: 'removeRow',
      row: entry.row,
      rowId: entry.rowId,
      rowIndex: result.rowIndex,
    });
    return true;
  }

  // ------------------------------------------------------------- selection

  /**
   * Adds a row to the selection. Accepts a row reference, stable id (string)
   * or data index (number). Selection is allowed in every mode and survives
   * sorting and filtering. Emits `selectionChanged`.
   */
  selectRow(target: DataRow | string | number): DataRow | null {
    this.ensureNotDestroyed();
    const row = this.dataManager.getRow(target) ?? null;
    if (!row) return null;
    if (!this.selection.has(row)) {
      this.selection.add(row);
      this.emitSelectionChanged();
    }
    return row;
  }

  /** Removes a row from the selection. Emits `selectionChanged`. */
  unselectRow(target: DataRow | string | number): DataRow | null {
    this.ensureNotDestroyed();
    const row = this.dataManager.getRow(target) ?? null;
    if (!row) return null;
    if (this.selection.delete(row)) this.emitSelectionChanged();
    return row;
  }

  /** Clears the whole selection. Emits `selectionChanged` when non-empty. */
  clearSelection(): void {
    this.ensureNotDestroyed();
    if (this.selection.size === 0) return;
    this.selection.clear();
    this.emitSelectionChanged();
  }

  /** Currently selected rows, in dataset order. */
  getSelection(): DataRow[] {
    return this.dataManager.getData().filter((row) => this.selection.has(row));
  }

  /** Stable ids of the selected rows, in dataset order. */
  getSelectedRowIds(): string[] {
    return this.getSelection().map((row) => this.dataManager.getRowId(row) ?? '');
  }

  /** Number of selected rows. */
  getSelectionCount(): number {
    return this.selection.size;
  }

  private emitSelectionChanged(): void {
    const rows = this.getSelection();
    this.events.emit('selectionChanged', {
      rows,
      rowIds: rows.map((row) => this.dataManager.getRowId(row) ?? ''),
    });
  }

  // ------------------------------------------------------------------ sort

  /** Sorts the view by a column. Emits `sortChanged`. */
  sort(field: string, direction: SortDirection = 'asc'): void {
    this.ensureNotDestroyed();
    if (!SORT_DIRECTIONS.includes(direction)) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_SORT_DIRECTION,
        `Invalid sort direction "${String(direction)}". Use "asc" or "desc".`
      );
    }
    const column = this.dataManager.getColumn(field);
    if (!column) {
      throw new SmartTableError(
        ERROR_CODES.UNKNOWN_COLUMN,
        `Cannot sort unknown column "${field}".`
      );
    }
    if (!column.sortable) {
      throw new SmartTableError(ERROR_CODES.NOT_SORTABLE, `Column "${field}" is not sortable.`);
    }
    this.dataManager.sort(field, direction);
    this.serverController?.request({ sort: this.dataManager.getSortState() });
    this.events.emit('sortChanged', { field, direction, column });
  }

  /** Clears the current sort. Emits `sortChanged` with a null state. */
  clearSort(): void {
    this.ensureNotDestroyed();
    this.dataManager.clearSort();
    this.serverController?.request({ sort: this.dataManager.getSortState() });
    this.events.emit('sortChanged', { field: null, direction: null, column: null });
  }

  getSortState(): SortState {
    return this.dataManager.getSortState();
  }

  // ---------------------------------------------------------------- filter

  /**
   * Sets the global, case-insensitive search query across filterable
   * columns. Passing an empty string clears it. Emits `filterChanged`.
   */
  filter(query: string): void {
    this.ensureNotDestroyed();
    this.dataManager.filter(query);
    this.dataManager.setCurrentPage(1);
    this.serverController?.request({ filters: this.buildServerFilters() });
    this.emitFilterChanged(query.trim());
    this.emitPageChanged();
  }

  /** Registers a predicate filter for a column. Emits `filterChanged`. */
  filterColumn(field: string, predicate: ColumnFilterPredicate): void {
    this.ensureNotDestroyed();
    this.dataManager.filterColumn(field, predicate);
    this.dataManager.setCurrentPage(1);
    this.serverController?.request({ filters: this.buildServerFilters() });
    this.emitFilterChanged(this.dataManager.getFilterState().query);
    this.emitPageChanged();
  }

  /** Removes the global query and every column filter. Emits `filterChanged`. */
  clearFilter(): void {
    this.ensureNotDestroyed();
    this.dataManager.clearFilter();
    this.dataManager.setCurrentPage(1);
    this.serverController?.request({ filters: this.buildServerFilters() });
    this.emitFilterChanged('');
    this.emitPageChanged();
  }

  /**
   * Applies a structured filter to a column, e.g.
   * `table.where('price', 'greaterThan', 100)` or
   * `table.where('name', 'inList', ['Laptop', 'Mouse'])`.
   * Replaces any existing filter on the same column. Emits `filterChanged`.
   */
  where(field: string, operator: FilterOperator, ...operands: FilterOperand[]): void {
    this.ensureNotDestroyed();
    if (!isFilterOperator(operator)) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_FILTER_OPERATOR,
        `Unsupported filter operator "${String(operator)}".`
      );
    }
    this.dataManager.where(field, operator, ...operands);
    this.dataManager.setCurrentPage(1);
    this.serverController?.request({ filters: this.buildServerFilters() });
    this.emitFilterChanged(this.dataManager.getFilterState().query);
    this.emitPageChanged();
  }

  /** Removes the structured/predicate filter from a single column. */
  clearColumnFilter(field: string): void {
    this.ensureNotDestroyed();
    this.dataManager.clearColumnFilter(field);
    this.dataManager.setCurrentPage(1);
    this.serverController?.request({ filters: this.buildServerFilters() });
    this.emitFilterChanged(this.dataManager.getFilterState().query);
    this.emitPageChanged();
  }

  /** Every active structured filter, in insertion order. */
  getStructuredFilters(): StructuredFilter[] {
    this.ensureNotDestroyed();
    return this.dataManager.getStructuredFilters();
  }

  getFilterState(): FilterState {
    return this.dataManager.getFilterState();
  }

  // ------------------------------------------------------------- pagination

  /** Rows per page. `0` when pagination is disabled. */
  getPageSize(): number {
    this.ensureNotDestroyed();
    return this.dataManager.getPageSize();
  }

  /**
   * Sets the page size. `0` disables pagination (the full filtered view is
   * rendered). Throws for negative or non-integer sizes. Emits `pageChanged`
   * when the page count changes.
   */
  setPageSize(size: number): void {
    this.ensureNotDestroyed();
    const prevPage = this.dataManager.getCurrentPage();
    const prevTotal = this.dataManager.getTotalPages();
    this.dataManager.setPageSize(size);
    if (
      this.dataManager.getCurrentPage() !== prevPage ||
      this.dataManager.getTotalPages() !== prevTotal
    ) {
      this.serverController?.request({ pageSize: this.dataManager.getPageSize() });
      this.emitPageChanged();
    }
  }

  /** 1-based index of the active page. */
  getCurrentPage(): number {
    this.ensureNotDestroyed();
    return this.dataManager.getCurrentPage();
  }

  /**
   * Jumps to a page (1-based, clamped into range). Returns the page actually
   * shown. Emits `pageChanged` when the page changed.
   */
  goToPage(page: number): number {
    this.ensureNotDestroyed();
    const previous = this.dataManager.getCurrentPage();
    this.dataManager.setCurrentPage(page);
    if (this.dataManager.getCurrentPage() !== previous) {
      this.serverController?.request({ page: this.dataManager.getCurrentPage() });
      this.emitPageChanged();
    }
    return this.dataManager.getCurrentPage();
  }

  /** Total pages for the current filter state (min 1). */
  getTotalPages(): number {
    this.ensureNotDestroyed();
    return this.dataManager.getTotalPages();
  }

  /** Advances to the next page. Returns whether the page changed. */
  nextPage(): boolean {
    this.ensureNotDestroyed();
    if (this.dataManager.nextPage()) {
      this.serverController?.request({ page: this.dataManager.getCurrentPage() });
      this.emitPageChanged();
      return true;
    }
    return false;
  }

  /** Moves back one page. Returns whether the page changed. */
  prevPage(): boolean {
    this.ensureNotDestroyed();
    if (this.dataManager.prevPage()) {
      this.serverController?.request({ page: this.dataManager.getCurrentPage() });
      this.emitPageChanged();
      return true;
    }
    return false;
  }

  /** Whether a next page exists for the current filter state. */
  canGoNext(): boolean {
    this.ensureNotDestroyed();
    return this.dataManager.getCurrentPage() < this.dataManager.getTotalPages();
  }

  /** Whether a previous page exists. */
  canGoPrev(): boolean {
    this.ensureNotDestroyed();
    return this.dataManager.getCurrentPage() > 1;
  }

  /** Number of rows matching the filters across every page. */
  getFilteredCount(): number {
    this.ensureNotDestroyed();
    return this.dataManager.getFilteredCount();
  }

  // ----------------------------------------------------------------- layouts

  /**
   * Captures the current column order/visibility/width, sort and filters into
   * a named layout and persists it. Emits nothing; returns the saved layout.
   */
  saveLayout(label?: string): SavedLayout {
    this.ensureNotDestroyed();
    const layout = captureLayout(this, createId('layout'), label);
    this.layoutManager.save(layout);
    return layout;
  }

  /** Loads a saved layout by id, applying its column/sort/filter state. */
  loadLayout(id: string): SavedLayout | undefined {
    this.ensureNotDestroyed();
    const layout = this.layoutManager.load(id);
    if (!layout) return undefined;
    this.applyLayout(layout);
    return layout;
  }

  /** Deletes a saved layout. Returns whether one was removed. */
  deleteLayout(id: string): boolean {
    this.ensureNotDestroyed();
    return this.layoutManager.delete(id);
  }

  /** Every saved layout, in insertion order. */
  getLayouts(): SavedLayout[] {
    this.ensureNotDestroyed();
    return this.layoutManager.list();
  }

  /** Reads a single saved layout without applying it. */
  getLayout(id: string): SavedLayout | undefined {
    this.ensureNotDestroyed();
    return this.layoutManager.load(id);
  }

  /** Applies a saved layout to the current table state. Emits `layoutChanged`. */
  private applyLayout(layout: SavedLayout): void {
    this.dataManager.applyColumnsState(layout.columns);
    this.dataManager.clearFilter();
    if (layout.query) this.dataManager.filter(layout.query);
    for (const filter of layout.filters) {
      if (this.dataManager.getColumn(filter.field)) {
        this.dataManager.where(filter.field, filter.operator, ...filter.operands);
      }
    }
    if (layout.sort && layout.sort.field && layout.sort.direction) {
      this.dataManager.sort(layout.sort.field, layout.sort.direction);
    } else {
      this.dataManager.clearSort();
    }
    this.dataManager.setCurrentPage(1);
    this.events.emit('layoutChanged', { id: layout.id, label: layout.label });
    this.emitFilterChanged(this.dataManager.getFilterState().query);
    this.emitPageChanged();
  }

  // ------------------------------------------------------------------ copy

  /**
   * Serializes the current view (filtered + sorted rows) and writes it to the
   * clipboard via the async Clipboard API. When no clipboard is available the
   * method still returns the payload. Emits `copied`.
   */
  async copy(format: CopyFormat = 'text'): Promise<string> {
    this.ensureNotDestroyed();
    if (!COPY_FORMATS.includes(format)) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_FORMAT,
        `Unsupported copy format "${String(format)}". Use "text", "json" or "csv".`
      );
    }
    const payload = this.dataManager.serialize(format);
    await this.writeToClipboard(payload);
    this.events.emit('copied', { format, rowCount: this.dataManager.getViewCount() });
    return payload;
  }

  private async writeToClipboard(text: string): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access may be rejected (permissions, insecure context).
      // The payload is still returned so callers can copy manually.
    }
  }

  // ----------------------------------------------------------------- export

  /**
   * Serializes the current filtered + sorted view (every page) into the given
   * format. Unlike `copy`, it never touches the clipboard — the caller owns
   * the returned string.
   */
  serialize(format: CopyFormat = 'text'): string {
    this.ensureNotDestroyed();
    if (!COPY_FORMATS.includes(format)) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_FORMAT,
        `Unsupported serialization format "${String(format)}". Use "text", "json" or "csv".`
      );
    }
    return serializeRows(this.getVisibleColumns(), this.dataManager.getFilteredRows(), format);
  }

  /** Downloads the filtered + sorted view as a CSV file. Emits `exported`. */
  exportCSV(filename?: string): void {
    this.exportFile('csv', filename);
  }

  /** Downloads the filtered + sorted view as a JSON file. Emits `exported`. */
  exportJSON(filename?: string): void {
    this.exportFile('json', filename);
  }

  private exportFile(format: ExportFormat, filename?: string): void {
    this.ensureNotDestroyed();
    const payload = serializeRows(
      this.getVisibleColumns(),
      this.dataManager.getFilteredRows(),
      format
    );
    const name =
      filename ??
      `${this.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.${format === 'json' ? 'json' : 'csv'}`;
    downloadFile(name, payload, format === 'json' ? 'application/json' : 'text/csv;charset=utf-8');
    this.events.emit('exported', {
      format,
      filename: name,
      rowCount: this.dataManager.getFilteredCount(),
    });
  }

  // ------------------------------------------------------------------ clone

  /** Duplicates the table including its data. Emits `cloned`. */
  clone(): SmartTable {
    return this.duplicate({ includeData: true });
  }

  /**
   * Duplicates the table. With `includeData: false` the clone starts empty
   * but keeps the column definitions, mode and theme. The clone is fully
   * independent (deep-copied data). Emits `cloned`.
   */
  duplicate(options: { includeData?: boolean } = {}): SmartTable {
    this.ensureNotDestroyed();
    const includeData = options.includeData !== false;
    const cloneOptions: SmartTableOptions = {
      ...this.initialOptions,
      mode: this.mode,
      theme: this.customTheme ?? (this.themeName as ThemeName),
      id: undefined,
      container: null,
      data: includeData ? deepClone(this.dataManager.getData()) : [],
      dataSource: undefined,
    };
    const clone = new SmartTable(cloneOptions);
    this.events.emit('cloned', { clone, includeData });
    return clone;
  }

  // ----------------------------------------------------------------- theme

  /** Name of the active theme (a built-in name or a custom theme's name). */
  getTheme(): string {
    return this.themeName;
  }

  /** Resolved variable map of the active theme. */
  getThemeVariables(): ThemeVariables {
    return this.customTheme?.variables ?? resolveBuiltInTheme(this.themeName as ThemeName);
  }

  /**
   * Sets the active theme. Accepts a built-in name (`'light' | 'dark' |
   * 'corporate'`) or a custom theme `{ name, variables }`. Applies the CSS
   * variables onto the container (or `document.documentElement`) and emits
   * `themeChanged`.
   */
  setTheme(theme: ThemeInput): void {
    this.ensureNotDestroyed();
    let definition: ThemeDefinition;
    if (typeof theme === 'string') {
      if (!THEMES.includes(theme as ThemeName)) {
        throw new SmartTableError(
          ERROR_CODES.INVALID_THEME,
          `Unknown theme "${theme}". Use "light", "dark", "corporate" or a custom theme object.`
        );
      }
      definition = { name: theme, variables: resolveBuiltInTheme(theme) };
    } else {
      this.validateCustomTheme(theme);
      definition = { name: theme.name, variables: theme.variables };
    }
    this.themeName = definition.name;
    this.customTheme = typeof theme === 'object' ? definition : null;
    this.applyTheme();
    this.events.emit('themeChanged', { name: definition.name, custom: this.customTheme !== null });
  }

  private validateCustomTheme(theme: ThemeDefinition): void {
    if (
      typeof theme.name !== 'string' ||
      theme.name.trim() === '' ||
      !theme.variables ||
      typeof theme.variables !== 'object' ||
      Array.isArray(theme.variables)
    ) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_THEME,
        'Invalid custom theme: expected { name: string, variables: Record<string, string> }.'
      );
    }
  }

  private applyTheme(): void {
    if (typeof document === 'undefined') return;
    const target = this.container ?? document.documentElement;
    target.setAttribute('data-st-theme', this.themeName);
    applyThemeVariables(target, this.getThemeVariables());
  }

  // ------------------------------------------------------------ responsive

  /** Resolved responsive breakpoints (defaults filled in). */
  getBreakpoints(): ResponsiveBreakpoints {
    return { ...this.breakpoints };
  }

  // --------------------------------------------------------------- plugins

  /**
   * Registers and installs a plugin. Returns the table for chaining.
   * A plugin with the same name cannot be installed twice.
   */
  use(plugin: SmartTablePlugin): this {
    this.ensureNotDestroyed();
    if (!plugin || typeof plugin.install !== 'function') {
      throw new SmartTableError(
        ERROR_CODES.INVALID_PLUGIN,
        'Invalid plugin: expected { name, install(table) }.'
      );
    }
    if (this.plugins.has(plugin.name)) {
      throw new SmartTableError(
        ERROR_CODES.PLUGIN_ALREADY_REGISTERED,
        `Plugin "${plugin.name}" is already registered.`
      );
    }
    this.plugins.set(plugin.name, plugin);
    plugin.install(this);
    return this;
  }

  /** Removes and uninstalls a plugin by name. Returns whether it was found. */
  unuse(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    plugin.uninstall?.(this);
    this.plugins.delete(name);
    return true;
  }

  getPlugin<T extends SmartTablePlugin = SmartTablePlugin>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }

  getPlugins(): SmartTablePlugin[] {
    return [...this.plugins.values()];
  }

  // -------------------------------------------------------------- rendering

  /** The renderer currently attached via `mount()`, if any. */
  getRenderer(): Renderer | null {
    return this.renderer;
  }

  /**
   * Registers the default renderer factory used by `mount()`. The built-in
   * `DOMRenderer` registers itself on import; call this to swap in a custom
   * renderer (for example a React binding) for every future table.
   */
  static registerRenderer(factory: RendererFactory): void {
    SmartTable.rendererFactory = factory;
  }

  /**
   * Mounts a renderer onto `target` (element or CSS selector). When omitted,
   * the `container` option is used. The renderer is created through the
   * registered factory and mounted once; calling `mount()` again returns the
   * existing renderer. Throws `NO_RENDERER` when no factory is registered and
   * `NO_CONTAINER` when no target resolves.
   */
  mount(target?: HTMLElement | string): Renderer {
    this.ensureNotDestroyed();
    if (this.renderer) return this.renderer;
    if (!SmartTable.rendererFactory) {
      throw new SmartTableError(
        ERROR_CODES.NO_RENDERER,
        'No renderer registered. Import the UI entry (e.g. "smart-table-js") or call SmartTable.registerRenderer(factory) first.'
      );
    }
    const resolvedTarget = target !== undefined ? resolveContainer(target) : this.container;
    if (!resolvedTarget) {
      throw new SmartTableError(
        ERROR_CODES.NO_CONTAINER,
        'No mount target. Pass an element/selector to mount() or set the "container" option.'
      );
    }
    this.renderer = SmartTable.rendererFactory(this, resolvedTarget);
    this.renderer.mount();
    return this.renderer;
  }

  /** Unmounts the active renderer (removes DOM and unsubscribes). */
  unmount(): void {
    this.renderer?.unmount();
    this.renderer = null;
  }

  // ------------------------------------------------------------- lifecycle

  getContainer(): HTMLElement | null {
    return this.container;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Uninstalls all plugins, unmounts the renderer, clears every listener and
   * marks the instance as destroyed. Any further API call throws
   * `TABLE_DESTROYED`.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.renderer?.unmount();
    this.renderer = null;
    this.serverController?.destroy();
    for (const plugin of this.plugins.values()) {
      plugin.uninstall?.(this);
    }
    this.plugins.clear();
    this.events.clear();
    this.selection.clear();
    this.destroyed = true;
  }

  // -------------------------------------------------------- Phase 4: view

  /** Normalized virtual-scroll config, or `null` when disabled. */
  getVirtualScrollOptions(): VirtualScrollOptions | null {
    this.ensureNotDestroyed();
    return this.virtualScroll;
  }

  /** Applies bulk column order/visibility/width without emitting events. */
  setColumnsState(
    fields: Array<{ field: string; visible: boolean; width?: string | number }>
  ): void {
    this.ensureNotDestroyed();
    this.dataManager.applyColumnsState(fields);
  }

  // ----------------------------------------------- Phase 4: server mode

  /** Total rows reported by the server (remote mode) — same as `getFilteredCount`. */
  getRemoteTotal(): number {
    this.ensureNotDestroyed();
    return this.dataManager.getRemoteTotal();
  }

  /** Whether rows are loaded from a remote `dataSource`. */
  isServerMode(): boolean {
    this.ensureNotDestroyed();
    return this.dataManager.isServerMode();
  }

  /** Commits a resolved server page into the table (used by the data source). */
  applyServerPage(rows: DataRow[], total: number, mode: 'replace' | 'append'): void {
    this.ensureNotDestroyed();
    if (mode === 'append') {
      this.dataManager.appendRows(rows);
    } else {
      this.dataManager.setData(rows, { resetPage: false });
    }
    this.dataManager.setRemoteTotal(total);
    this.emitPageChanged();
  }

  /**
   * Resolves once the current remote request (if any) has settled. Useful for
   * awaiting the initial load or after sort/filter/page changes.
   */
  async waitForLoad(): Promise<void> {
    this.ensureNotDestroyed();
    await this.serverController?.flush();
  }

  /**
   * Requests the next page of data (server mode) or reveals the next chunk of
   * rows (local infinite scroll). Emits `loadMoreRequested`. Returns whether a
   * load actually started.
   */
  loadMore(): boolean {
    this.ensureNotDestroyed();
    if (this.serverController) return this.serverController.loadMore();
    if (!this.dataManager.isInfiniteScrollEnabled()) return false;
    this.events.emit('loadMoreRequested', {
      page:
        Math.floor(this.dataManager.getInfiniteLimit() / this.dataManager.getInfiniteStep()) + 1,
      loadedCount: this.dataManager.getViewCount(),
      totalCount: this.dataManager.getFilteredCount(),
    });
    const grew = this.dataManager.expandInfinite();
    if (grew) {
      this.events.emit('dataChanged', { operation: 'loadMore' });
      this.emitPageChanged();
    }
    return grew;
  }

  /** Whether more rows can be loaded (infinite scroll). */
  hasMore(): boolean {
    this.ensureNotDestroyed();
    return this.dataManager.hasMore();
  }

  // ----------------------------------------------------- Phase 4: grouping

  /** Groups the view by a column's values. Emits `groupChanged`. */
  groupBy(field: string): void {
    this.ensureNotDestroyed();
    this.assertKnownColumn(field);
    this.dataManager.setGroupField(field);
    this.emitGroupChanged();
  }

  /** Removes grouping. Emits `groupChanged`. */
  ungroup(): void {
    this.ensureNotDestroyed();
    if (this.dataManager.getGroupField() === null) return;
    this.dataManager.setGroupField(null);
    this.emitGroupChanged();
  }

  /** Toggles a group's collapsed state. Returns `true` when now collapsed. */
  toggleGroup(key: string): boolean {
    this.ensureNotDestroyed();
    const collapsed = this.dataManager.toggleGroup(key);
    this.emitGroupChanged();
    return collapsed;
  }

  /** Whether a group is currently collapsed. */
  isGroupCollapsed(key: string): boolean {
    this.ensureNotDestroyed();
    return this.dataManager.isGroupCollapsed(key);
  }

  /** Current grouping state (field + collapsed keys + headers). */
  getGroupState(): { field: string | null; collapsed: string[]; groups: GroupViewHeader[] } {
    this.ensureNotDestroyed();
    return {
      field: this.dataManager.getGroupField(),
      collapsed: this.dataManager.getCollapsedGroups(),
      groups: this.dataManager.getGroupHeaders(),
    };
  }

  /** Current group headers, computed over the filtered view. */
  getGroups(): GroupViewHeader[] {
    this.ensureNotDestroyed();
    return this.dataManager.getGroupHeaders();
  }

  /** Sets the collapsed state for a set of group keys. Emits `groupChanged`. */
  setGroupCollapsed(keys: Iterable<string>): void {
    this.ensureNotDestroyed();
    this.dataManager.setGroupCollapsed(keys);
    this.emitGroupChanged();
  }

  private emitGroupChanged(): void {
    this.events.emit('groupChanged', {
      field: this.dataManager.getGroupField(),
      collapsed: this.dataManager.getCollapsedGroups(),
      groups: this.dataManager.getGroupHeaders(),
    });
  }

  // ----------------------------------------------------- Phase 4: tree

  /** Whether tree mode is active. */
  isTreeEnabled(): boolean {
    this.ensureNotDestroyed();
    return this.dataManager.isTreeEnabled();
  }

  /** Expands a tree node, loading lazy children first when needed. */
  async expandNode(rowId: string): Promise<boolean> {
    this.ensureNotDestroyed();
    const row = this.dataManager.getRowById(rowId);
    if (!row) return false;
    const lazy = this.dataManager.getLazyChildren();
    const children = row[this.dataManager.getChildrenKey()];
    if (lazy && !Array.isArray(children)) {
      const resolved = await lazy(row);
      row[this.dataManager.getChildrenKey()] = resolved;
    }
    this.dataManager.expandNode(rowId);
    const depth = this.nodeDepth(rowId);
    this.events.emit('nodeExpanded', {
      rowId,
      row,
      depth,
      childCount: Array.isArray(row[this.dataManager.getChildrenKey()])
        ? (row[this.dataManager.getChildrenKey()] as unknown[]).length
        : 0,
    });
    return true;
  }

  /** Collapses a tree node. Emits `nodeCollapsed`. */
  collapseNode(rowId: string): boolean {
    this.ensureNotDestroyed();
    const row = this.dataManager.getRowById(rowId);
    if (!row) return false;
    this.dataManager.collapseNode(rowId);
    this.events.emit('nodeCollapsed', { rowId, row, depth: this.nodeDepth(rowId) });
    return true;
  }

  /** Toggles a tree node. Returns `true` when now expanded. */
  toggleNode(rowId: string): boolean {
    if (this.dataManager.isNodeExpanded(rowId)) {
      this.collapseNode(rowId);
      return false;
    }
    void this.expandNode(rowId);
    return true;
  }

  /** Whether a tree node's children are currently visible. */
  isNodeExpanded(rowId: string): boolean {
    this.ensureNotDestroyed();
    return this.dataManager.isNodeExpanded(rowId);
  }

  /** Current tree expansion state. */
  getTreeState(): { expanded: string[] } {
    this.ensureNotDestroyed();
    return { expanded: this.dataManager.getExpandedNodes() };
  }

  private nodeDepth(rowId: string): number {
    for (const entry of this.dataManager.getAllViewRows()) {
      if (entry.type === 'row' && entry.id === rowId) return entry.tree?.depth ?? 0;
    }
    return 0;
  }

  // --------------------------------------------------- Phase 4: totals

  /** Sets the aggregation config shown in the footer / group summaries. */
  aggregate(config: AggregateConfig): void {
    this.ensureNotDestroyed();
    assertValidAggregateConfig(config);
    this.dataManager.setAggregations(config);
    this.events.emit('aggregationChanged', {
      aggregations: Object.fromEntries(
        Object.entries(config).map(([field, op]) => [field, String(op)])
      ),
    });
  }

  /** The active aggregation config. */
  getAggregations(): AggregateConfig {
    this.ensureNotDestroyed();
    return this.dataManager.getAggregations();
  }

  /** Footer aggregate values over the filtered view. */
  getAggregateFooter(): Record<string, number | string> {
    this.ensureNotDestroyed();
    return this.dataManager.getAggregateFooter();
  }

  // ----------------------------------------------------- Phase 4: state

  /** Exports the table's full state (columns, sort, filters, selection, …). */
  exportState(): GridState {
    this.ensureNotDestroyed();
    return this.stateManager.export();
  }

  /** Restores a previously exported state. Throws `INVALID_STATE` for bad input. */
  importState(state: GridState): void {
    this.ensureNotDestroyed();
    this.stateManager.import(state);
  }

  /** Resets the table to its default state (no sort/filter/selection/grouping). */
  resetState(): void {
    this.ensureNotDestroyed();
    this.stateManager.reset();
  }

  // ----------------------------------------------------- Phase 4: pivot

  /** Computes an Excel-like pivot view over the current data. Headless. */
  pivot(config: PivotConfig): PivotResult {
    this.ensureNotDestroyed();
    assertValidPivotConfig(config, new Set(this.getColumns().map((c) => c.field)));
    this.pivotResult = PivotEngine.compute(this.getData(), config);
    this.events.emit('pivotChanged', {
      config: {
        rows: config.rows,
        columns: config.columns,
        values: config.values.map((v) => ({ field: v.field, aggregation: v.aggregation })),
      },
    });
    return this.pivotResult;
  }

  /** Clears the active pivot result (renders the normal table again). */
  clearPivot(): void {
    this.ensureNotDestroyed();
    if (this.pivotResult === null) return;
    this.pivotResult = null;
    this.events.emit('pivotChanged', { config: null });
  }

  /** The active pivot result, or `null`. */
  getPivotResult(): PivotResult | null {
    this.ensureNotDestroyed();
    return this.pivotResult;
  }

  // --------------------------------------------------------------- helpers

  private ensureNotDestroyed(): void {
    if (this.destroyed) {
      throw new SmartTableError(
        ERROR_CODES.TABLE_DESTROYED,
        'This SmartTable instance has been destroyed.'
      );
    }
  }

  private assertEditable(operation: string): void {
    this.ensureNotDestroyed();
    if (this.mode === 'readonly') {
      throw new SmartTableError(
        ERROR_CODES.READONLY_MODE,
        `Cannot perform "${operation}" while the table is in readonly mode. Call setMode('editable') first.`
      );
    }
  }

  private assertKnownColumn(field: string): void {
    if (!this.dataManager.getColumn(field)) {
      throw new SmartTableError(
        ERROR_CODES.UNKNOWN_COLUMN,
        `Cannot operate on unknown column "${field}".`
      );
    }
  }

  private buildServerFilters(): DataSourceRequestFilters {
    const state = this.dataManager.getFilterState();
    return {
      query: state.query,
      structured: this.dataManager.getStructuredFilters(),
    };
  }

  private emitColumnVisibilityChanged(field: string, visible: boolean): void {
    this.events.emit('columnVisibilityChanged', {
      field,
      visible,
      visibleColumns: this.getVisibleColumns().map((c) => c.field),
    });
  }

  private emitFilterChanged(query: string): void {
    const state = this.dataManager.getFilterState();
    this.events.emit('filterChanged', {
      query,
      columnFilterCount: state.columnFilterCount,
      rowCount: this.dataManager.getFilteredCount(),
      totalCount: this.dataManager.getRowCount(),
      totalPages: this.dataManager.getTotalPages(),
    });
  }

  private emitPageChanged(): void {
    this.events.emit('pageChanged', {
      page: this.dataManager.getCurrentPage(),
      pageSize: this.dataManager.getPageSize(),
      totalPages: this.dataManager.getTotalPages(),
      rowCount: this.dataManager.getViewCount(),
      totalCount: this.dataManager.getFilteredCount(),
    });
  }

  private clampPageAfterMutation(): void {
    const previous = this.dataManager.getCurrentPage();
    this.dataManager.setCurrentPage(this.dataManager.getCurrentPage());
    if (this.dataManager.getCurrentPage() !== previous) this.emitPageChanged();
  }
}

/** Re-exported for `emitDataChanged`-style helper typing in renderers. */
export type { DataChangeOperation };
