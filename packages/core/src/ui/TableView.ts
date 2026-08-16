import { createElement, clearChildren } from './dom';
import { getCellText } from '../utils/serialize';
import {
  startCellEdit,
  createBooleanControl,
  showValidationError,
  clearValidationError,
  type EditSession,
} from './editing';
import { attachGridNavigation, type GridNavigator } from './navigation';
import { DEFAULT_MIN_COLUMN_WIDTH } from '../core/DataManager';
import { ViewportManager } from '../features/virtualization/ViewportManager';
import type { VirtualRange } from '../features/virtualization/VirtualScroller';
import type { SmartTable } from '../core/SmartTable';
import type { DataRow, NormalizedColumn } from '../types/column';
import type { SortDirection, TableMode } from '../types/modes';

export interface TableViewOptions {
  table: SmartTable;
  /** Render the Edit/Delete actions column (editable mode only). Default `true`. */
  actions?: boolean;
  /** Make the header sticky within the scroll area. Default `true`. */
  stickyHeader?: boolean;
}

function cellValueToBool(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === 'yes' || value === '1';
}

function setCellWidth(el: HTMLElement, width: string | number | undefined): void {
  if (width !== undefined) {
    el.style.width = typeof width === 'number' ? `${width}px` : width;
  }
}

/**
 * The desktop/tablet grid. Renders a real `<table>` with a sticky header,
 * sortable columns, a selection column (select-all in the header, per-row
 * checkboxes), editable cells and an actions column.
 *
 * Event delegation is used exclusively: a single `click` / `dblclick` /
 * `change` listener on the scroll root handles thousands of cells without
 * per-cell listeners. Row bodies are rebuilt on view changes, but a single
 * cell update (`patchCell`) mutates one `<td>` in place.
 */
export class TableView {
  readonly element: HTMLElement;

  private readonly table: SmartTable;
  private readonly actionsEnabled: boolean;
  private readonly tableEl: HTMLTableElement;
  private readonly rowElements = new Map<string, HTMLTableRowElement>();
  private readonly ac = new AbortController();
  private readonly navigator: GridNavigator;
  private thead: HTMLTableSectionElement | null = null;
  private tbody: HTMLTableSectionElement | null = null;
  private activeEdit: EditSession | null = null;
  private actionsRendered = false;
  private resizing: { field: string; startX: number; startWidth: number } | null = null;
  private dragField: string | null = null;

  /** Virtual-scrolling state. `null` when virtualization is disabled. */
  private virtualizer: {
    manager: ViewportManager;
    rowHeight: number;
    lastLoadRequested: boolean;
  } | null = null;

  constructor(options: TableViewOptions) {
    this.table = options.table;
    this.actionsEnabled = options.actions !== false;
    this.element = createElement('div', {
      className: 'st-scroll',
      attrs: { role: 'region', 'aria-label': 'Table rows' },
    });
    if (options.stickyHeader === false) this.element.classList.add('st-scroll-no-sticky');
    this.tableEl = createElement('table', { className: 'st-table', attrs: { role: 'grid' } });
    this.element.appendChild(this.tableEl);
    this.navigator = attachGridNavigation({
      root: this.element,
      rowCount: () => this.table.getRows().length,
      columnCount: () => this.columnCount,
      getCell: (row, col) => this.getCell(row, col),
      isEditable: () => this.table.isEditable(),
      activate: (cell) => this.activateCell(cell),
      edit: (cell) => this.editCell(cell),
    });
    this.bind();
    this.setupVirtual();
    this.render();
  }

  /** Columns currently rendered, in column order (live visibility). */
  private get visibleColumns(): NormalizedColumn[] {
    return this.table.getVisibleColumns();
  }

  /** Number of columns including the selection column (and actions when editable). */
  private get columnCount(): number {
    return 1 + this.visibleColumns.length + (this.showActions ? 1 : 0);
  }

  private get showActions(): boolean {
    return this.actionsEnabled && this.table.isEditable();
  }

  private get virtualEnabled(): boolean {
    return this.virtualizer !== null;
  }

  private setupVirtual(): void {
    const options = this.table.getVirtualScrollOptions();
    if (!options) return;
    const rowHeight = options.rowHeight ?? 40;
    this.virtualizer = {
      rowHeight,
      lastLoadRequested: false,
      manager: new ViewportManager({
        element: this.element,
        rowHeight,
        overscan: options.overscan ?? 10,
        onViewportChange: (range, scrollTop, viewportHeight) => {
          this.renderVirtualWindow(range);
          this.maybeLoadMore();
          this.emitViewportChanged(range, scrollTop, viewportHeight);
        },
      }),
    };
    this.element.classList.add('st-virtual');
  }

  // ------------------------------------------------------------- rendering

  /** Rebuilds the whole table (header + rows) from the current table state. */
  render(): void {
    this.clearDrag();
    clearChildren(this.tableEl);
    this.thead = document.createElement('thead');
    this.tbody = document.createElement('tbody');
    this.actionsRendered = this.showActions;
    this.tableEl.append(this.thead, this.tbody);
    this.renderHeader();
    this.syncRows();
    const sort = this.table.getSortState();
    this.setSort(sort.field, sort.direction);
    this.setSelection(this.table.getSelectedRowIds());
    this.setMode(this.table.getMode());
  }

  private renderHeader(): void {
    const tr = createElement('tr', { attrs: { role: 'row' } });
    const thSelect = createElement('th', {
      className: 'st-cell st-th-selection',
      attrs: { role: 'columnheader', scope: 'col' },
    });
    const selectAll = createElement('input', {
      className: 'st-select-all',
      attrs: { type: 'checkbox', 'aria-label': 'Select all rows' },
    });
    thSelect.appendChild(selectAll);
    tr.appendChild(thSelect);

    for (const column of this.visibleColumns) {
      const th = createElement('th', {
        className: 'st-cell st-th',
        attrs: {
          role: 'columnheader',
          scope: 'col',
          'data-field': column.field,
          draggable: 'true',
        },
      });
      th.textContent = column.title;
      if (column.align) th.classList.add(`st-align-${column.align}`);
      if (column.headerClassName) th.classList.add(column.headerClassName);
      setCellWidth(th, column.width);
      if (column.sortable) {
        th.classList.add('st-sortable');
        th.tabIndex = 0;
        th.setAttribute('aria-sort', 'none');
        th.appendChild(
          createElement('span', {
            className: 'st-sort-indicator',
            attrs: { 'aria-hidden': 'true' },
          })
        );
      }
      th.classList.add('st-resizable');
      th.appendChild(
        createElement('span', {
          className: 'st-resizer',
          attrs: {
            'data-st-resize': column.field,
            'aria-hidden': 'true',
            title: 'Drag to resize',
          },
        })
      );
      tr.appendChild(th);
    }

    if (this.showActions) {
      const thActions = createElement('th', {
        className: 'st-cell st-th-actions',
        attrs: { role: 'columnheader', scope: 'col' },
      });
      thActions.textContent = 'Actions';
      tr.appendChild(thActions);
    }
    this.thead?.appendChild(tr);
  }

  /** Rebuilds only the row body (keeps the header and scroll position). */
  syncRows(): void {
    if (!this.tbody) return;
    if (this.virtualizer) {
      this.syncVirtual();
      return;
    }
    clearChildren(this.tbody);
    this.rowElements.clear();
    const rows = this.table.getRows();
    if (rows.length === 0) {
      const td = createElement('td', {
        className: 'st-empty-cell',
        attrs: { colspan: String(this.columnCount) },
      });
      td.textContent = 'No rows to display';
      const tr = createElement('tr', { className: 'st-empty', attrs: { role: 'row' } });
      tr.appendChild(td);
      this.tbody.appendChild(tr);
      return;
    }
    for (const row of rows) {
      const tr = this.createRow(row);
      this.tbody.appendChild(tr);
      this.rowElements.set(this.table.getRowId(row) ?? '', tr);
    }
    this.setSelection(this.table.getSelectedRowIds());
    this.navigator.refresh();
  }

  /** Virtualized body: recomputes the total and renders the current window. */
  private syncVirtual(): void {
    const v = this.virtualizer;
    if (!v || !this.tbody) return;
    v.lastLoadRequested = false;
    v.manager.setTotalRows(this.table.getRows().length);
    v.manager.recompute();
  }

  private renderEmptyState(): void {
    if (!this.tbody) return;
    clearChildren(this.tbody);
    this.rowElements.clear();
    const td = createElement('td', {
      className: 'st-empty-cell',
      attrs: { colspan: String(this.columnCount) },
    });
    td.textContent = 'No rows to display';
    const tr = createElement('tr', { className: 'st-empty', attrs: { role: 'row' } });
    tr.appendChild(td);
    this.tbody.appendChild(tr);
    this.navigator.refresh();
  }

  /** Renders only the rows inside `range`, framed by height spacers. */
  private renderVirtualWindow(range: VirtualRange): void {
    const v = this.virtualizer;
    if (!v || !this.tbody) return;
    const rows = this.table.getRows();
    const total = rows.length;
    if (total === 0) {
      this.renderEmptyState();
      return;
    }
    clearChildren(this.tbody);
    this.rowElements.clear();
    const start = Math.max(0, range.start);
    const end = Math.min(total, range.end);
    if (start > 0) this.tbody.appendChild(this.createSpacer(start));
    for (let i = start; i < end; i += 1) {
      const row = rows[i];
      if (!row) continue;
      const tr = this.createRow(row);
      tr.style.height = `${v.rowHeight}px`;
      this.tbody.appendChild(tr);
      this.rowElements.set(this.table.getRowId(row) ?? '', tr);
    }
    if (end < total) this.tbody.appendChild(this.createSpacer(total - end));
    this.setSelection(this.table.getSelectedRowIds());
    this.navigator.refresh();
  }

  private createSpacer(rowCount: number): HTMLTableRowElement {
    const v = this.virtualizer;
    const td = createElement('td', {
      className: 'st-virtual-spacer',
      attrs: { colspan: String(this.columnCount) },
    });
    td.style.height = `${rowCount * (v?.rowHeight ?? 40)}px`;
    const tr = createElement('tr', {
      className: 'st-virtual-spacer-row',
      attrs: { 'aria-hidden': 'true' },
    });
    tr.appendChild(td);
    return tr;
  }

  /** Triggers `loadMore` when infinite scroll is near the viewport end. */
  private maybeLoadMore(): void {
    const v = this.virtualizer;
    if (!v || v.lastLoadRequested) return;
    if (!this.table.hasMore()) return;
    if (v.manager.isNearEnd(3)) {
      v.lastLoadRequested = true;
      this.table.loadMore();
    }
  }

  private emitViewportChanged(
    range: VirtualRange,
    scrollTop: number,
    viewportHeight: number
  ): void {
    const rows = this.table.getRows();
    this.table.events.emit('viewportChanged', {
      startIndex: range.start,
      endIndex: range.end,
      scrollTop,
      viewportHeight,
      firstVisibleRow: rows[range.start] ?? null,
      lastVisibleRow: rows[Math.max(0, range.end - 1)] ?? null,
    });
  }

  private createRow(row: DataRow): HTMLTableRowElement {
    const rowId = this.table.getRowId(row) ?? '';
    const tr = createElement('tr', {
      className: 'st-row',
      attrs: { 'data-row-id': rowId, role: 'row', 'aria-selected': 'false' },
    });
    tr.appendChild(this.createSelectionCell(rowId));
    for (const column of this.visibleColumns) {
      tr.appendChild(this.createDataCell(row, column));
    }
    if (this.showActions) tr.appendChild(this.createActionsCell(rowId));
    return tr;
  }

  private createSelectionCell(rowId: string): HTMLTableCellElement {
    const td = createElement('td', {
      className: 'st-cell st-cell-selection',
      attrs: { role: 'gridcell', 'data-st-selection': 'true' },
    });
    const checkbox = createElement('input', {
      className: 'st-select-row',
      attrs: { type: 'checkbox', 'aria-label': `Select row ${rowId}` },
    });
    td.appendChild(checkbox);
    return td;
  }

  private createDataCell(row: DataRow, column: NormalizedColumn): HTMLTableCellElement {
    const td = createElement('td', {
      className: `st-cell st-cell-${column.type}`,
      attrs: { role: 'gridcell', 'data-field': column.field, tabindex: '0' },
    });
    if (column.align) td.classList.add(`st-align-${column.align}`);
    if (column.className) td.classList.add(column.className);
    setCellWidth(td, column.width);
    if (column.type === 'boolean') {
      td.setAttribute('data-st-boolean', 'true');
      td.appendChild(createBooleanControl(this.table, row, column));
    } else {
      td.textContent = getCellText(column, row);
      if (column.editable) td.setAttribute('data-st-editable', 'true');
    }
    return td;
  }

  private createActionsCell(rowId: string): HTMLTableCellElement {
    const td = createElement('td', {
      className: 'st-cell st-cell-actions',
      attrs: { role: 'gridcell', 'data-st-actions': 'true' },
    });
    const editBtn = createElement('button', {
      className: 'st-action-btn',
      attrs: { type: 'button', 'data-st-row-action': 'edit', 'aria-label': `Edit row ${rowId}` },
    });
    editBtn.textContent = 'Edit';
    const deleteBtn = createElement('button', {
      className: 'st-action-btn st-action-delete',
      attrs: {
        type: 'button',
        'data-st-row-action': 'delete',
        'aria-label': `Delete row ${rowId}`,
      },
    });
    deleteBtn.textContent = 'Delete';
    td.append(editBtn, deleteBtn);
    return td;
  }

  // -------------------------------------------------------------- patching

  /** In-place update of a single cell after `cellEdit` (no re-render). */
  updateCell(rowId: string, field: string): void {
    const tr = this.rowElements.get(rowId);
    if (!tr) return;
    for (const cell of tr.querySelectorAll<HTMLElement>('td[data-field]')) {
      if (cell.dataset.field !== field) continue;
      if (cell.querySelector('[data-st-edit]')) return;
      const column = this.table.getColumn(field);
      const row = this.table.getRow(rowId);
      if (!column || !row) return;
      if (column.type === 'boolean') {
        const checkbox = cell.querySelector<HTMLInputElement>('input.st-boolean');
        if (checkbox) checkbox.checked = cellValueToBool(row[field]);
      } else {
        cell.textContent = getCellText(column, row);
      }
      clearValidationError(cell);
      return;
    }
  }

  /** Marks a cell with the messages from a failed validation. */
  showValidationErrors(rowId: string, field: string, messages: string[]): void {
    const tr = this.rowElements.get(rowId);
    const cell = tr?.querySelector<HTMLElement>(`td[data-field="${field}"]`);
    if (cell) showValidationError(cell, messages);
  }

  /** Applies the current selection to rows and checkboxes. */
  setSelection(rowIds: string[]): void {
    const selected = new Set(rowIds);
    for (const [id, tr] of this.rowElements) {
      const isSelected = selected.has(id);
      tr.classList.toggle('st-selected', isSelected);
      tr.setAttribute('aria-selected', String(isSelected));
      const checkbox = tr.querySelector<HTMLInputElement>('input.st-select-row');
      if (checkbox) checkbox.checked = isSelected;
    }
    this.updateSelectAll(selected);
  }

  private updateSelectAll(selected: Set<string>): void {
    const selectAll = this.thead?.querySelector<HTMLInputElement>('input.st-select-all');
    if (!selectAll) return;
    let total = 0;
    let any = false;
    let all = true;
    for (const id of this.rowElements.keys()) {
      total += 1;
      if (selected.has(id)) any = true;
      else all = false;
    }
    selectAll.checked = total > 0 && all;
    selectAll.indeterminate = !all && any;
  }

  /** Updates the mode-dependent UI (readonly hides/disables actions). */
  setMode(mode: TableMode): void {
    this.element.setAttribute('data-st-mode', mode);
    const shouldShow = this.actionsEnabled && mode === 'editable';
    if (shouldShow !== this.actionsRendered) {
      this.render();
      return;
    }
    for (const button of this.element.querySelectorAll<HTMLButtonElement>('[data-st-row-action]')) {
      button.disabled = mode === 'readonly';
    }
  }

  /** Applies the current sort indicators to the header. */
  setSort(field: string | null, direction: SortDirection | null): void {
    if (!this.thead) return;
    for (const th of this.thead.querySelectorAll<HTMLElement>('th[data-field]')) {
      const isActive = th.dataset.field === field;
      th.classList.toggle('st-sort-asc', isActive && direction === 'asc');
      th.classList.toggle('st-sort-desc', isActive && direction === 'desc');
      th.setAttribute(
        'aria-sort',
        isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
      );
    }
  }

  /**
   * Applies a width to the header cell and every data cell of a column
   * without rebuilding the table (used while resizing to avoid layout shift).
   * `undefined` clears the width (auto sizing).
   */
  applyColumnWidth(field: string, width: string | number | undefined): void {
    for (const el of this.tableEl.querySelectorAll<HTMLElement>(`[data-field="${field}"]`)) {
      if (width === undefined) el.style.width = '';
      else setCellWidth(el, width);
    }
  }

  // ------------------------------------------------------------ resizing

  private beginResize(handle: HTMLElement, event: MouseEvent): void {
    const field = handle.dataset.stResize;
    if (!field) return;
    event.preventDefault();
    event.stopPropagation();
    const current = this.table.getColumnWidth(field);
    const startWidth = typeof current === 'number' ? current : parseFloat(current ?? '') || 100;
    this.resizing = { field, startX: event.clientX, startWidth };
    this.tableEl.classList.add('st-resizing');
    window.addEventListener('mousemove', this.onResizeMove);
    window.addEventListener('mouseup', this.onResizeEnd);
  }

  private onResizeMove = (event: MouseEvent): void => {
    const resize = this.resizing;
    if (!resize) return;
    const column = this.table.getColumn(resize.field);
    const minWidth = column?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
    const width = Math.max(
      minWidth,
      Math.round(resize.startWidth + (event.clientX - resize.startX))
    );
    this.table.setColumnWidth(resize.field, width);
  };

  private onResizeEnd = (): void => {
    if (!this.resizing) return;
    this.resizing = null;
    this.tableEl.classList.remove('st-resizing');
    window.removeEventListener('mousemove', this.onResizeMove);
    window.removeEventListener('mouseup', this.onResizeEnd);
  };

  // -------------------------------------------------------------- actions

  private bind(): void {
    this.element.addEventListener('click', this.onClick, { signal: this.ac.signal });
    this.element.addEventListener('dblclick', this.onDblClick, { signal: this.ac.signal });
    this.element.addEventListener('change', this.onChange, { signal: this.ac.signal });
    this.element.addEventListener('mousedown', this.onMouseDown, { signal: this.ac.signal });
    this.element.addEventListener('dragstart', this.onDragStart, { signal: this.ac.signal });
    this.element.addEventListener('dragover', this.onDragOver, { signal: this.ac.signal });
    this.element.addEventListener('drop', this.onDrop, { signal: this.ac.signal });
    this.element.addEventListener('dragend', this.onDragEnd, { signal: this.ac.signal });
  }

  // -------------------------------------------------------------- reordering

  private onDragStart = (event: DragEvent): void => {
    const target = event.target as Element | null;
    if (target?.closest('.st-resizer')) return;
    const th = target?.closest<HTMLElement>('th[data-field]');
    if (!th || !this.element.contains(th)) return;
    const field = th.dataset.field;
    if (!field) return;
    this.dragField = field;
    th.classList.add('st-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', field);
    }
  };

  private onDragOver = (event: DragEvent): void => {
    if (!this.dragField) return;
    const th = (event.target as Element | null)?.closest<HTMLElement>('th[data-field]');
    if (!th || !this.element.contains(th)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    for (const el of this.element.querySelectorAll('.st-drop-target')) {
      el.classList.remove('st-drop-target');
    }
    th.classList.add('st-drop-target');
  };

  private onDrop = (event: DragEvent): void => {
    if (!this.dragField) return;
    const th = (event.target as Element | null)?.closest<HTMLElement>('th[data-field]');
    if (!th || !this.element.contains(th)) return;
    event.preventDefault();
    const beforeField = th.dataset.field;
    if (beforeField && beforeField !== this.dragField) {
      this.table.moveColumn(this.dragField, beforeField);
    }
    this.clearDrag();
  };

  private onDragEnd = (): void => {
    this.clearDrag();
  };

  private clearDrag(): void {
    this.dragField = null;
    for (const el of this.element.querySelectorAll('.st-dragging, .st-drop-target')) {
      el.classList.remove('st-dragging', 'st-drop-target');
    }
  }

  private onMouseDown = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const handle = target?.closest<HTMLElement>('.st-resizer');
    if (handle && this.element.contains(handle)) this.beginResize(handle, event);
  };

  private onClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    if (!target) return;
    if (target.closest('.st-resizer')) return;
    const rowAction = target.closest<HTMLElement>('[data-st-row-action]');
    if (rowAction && this.element.contains(rowAction)) {
      this.handleRowAction(rowAction);
      return;
    }
    const sortable = target.closest<HTMLElement>('th.st-sortable');
    if (sortable && this.element.contains(sortable)) {
      this.handleSort(sortable);
      return;
    }
    const cell = target.closest<HTMLTableCellElement>('td.st-cell');
    if (cell && this.element.contains(cell)) this.handleCellClick(cell, event);
  };

  private onDblClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const cell = target?.closest<HTMLTableCellElement>('td.st-cell');
    if (cell && this.element.contains(cell)) this.editCell(cell);
  };

  private onChange = (event: Event): void => {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    if (target.classList.contains('st-select-row')) {
      const rowId = target.closest<HTMLElement>('tr.st-row')?.dataset.rowId;
      const row = rowId ? this.table.getRow(rowId) : undefined;
      if (!row) return;
      if (target.checked) this.table.selectRow(row);
      else this.table.unselectRow(row);
    } else if (target.classList.contains('st-select-all')) {
      if (target.checked) {
        for (const row of this.table.getRows()) this.table.selectRow(row);
      } else {
        this.table.clearSelection();
      }
    }
  };

  private handleRowAction(action: HTMLElement): void {
    const rowId = action.closest<HTMLElement>('tr.st-row')?.dataset.rowId;
    const row = rowId ? this.table.getRow(rowId) : undefined;
    if (!row || !this.table.isEditable()) return;
    if (action.dataset.stRowAction === 'delete') {
      this.table.removeRow(row);
    } else if (action.dataset.stRowAction === 'edit') {
      this.editRow(row);
    }
  }

  private handleSort(th: HTMLElement): void {
    const field = th.dataset.field;
    if (!field) return;
    const column = this.table.getColumn(field);
    if (!column?.sortable) return;
    const state = this.table.getSortState();
    if (state.field !== field) {
      this.table.sort(field, 'asc');
    } else if (state.direction === 'asc') {
      this.table.sort(field, 'desc');
    } else {
      this.table.clearSort();
    }
  }

  private handleCellClick(cell: HTMLTableCellElement, event: MouseEvent): void {
    const rowId = cell.closest<HTMLElement>('tr.st-row')?.dataset.rowId;
    if (!rowId) return;
    if ((event.target as Element).tagName === 'INPUT') return;
    const row = this.table.getRow(rowId);
    if (!row) return;
    if (event.ctrlKey || event.metaKey) {
      if (this.table.getSelectedRowIds().includes(rowId)) this.table.unselectRow(rowId);
      else this.table.selectRow(rowId);
    } else {
      this.table.clearSelection();
      this.table.selectRow(rowId);
    }
    const tr = cell.closest<HTMLTableRowElement>('tr.st-row');
    const rows = this.tbody?.querySelectorAll<HTMLTableRowElement>('tr.st-row');
    const rowIndex = tr && rows ? Array.from(rows).indexOf(tr) : -1;
    if (rowIndex >= 0) {
      cell.focus();
      this.navigator.focus(rowIndex, cell.cellIndex);
    }
  }

  /** Starts in-cell editing (or toggles selection / boolean checkboxes). */
  editCell(cell: HTMLElement): void {
    if (!this.table.isEditable()) return;
    if (cell.dataset.stSelection === 'true') {
      this.toggleCheckbox(cell, '.st-select-row');
      return;
    }
    if (cell.dataset.stBoolean === 'true') {
      this.toggleCheckbox(cell, '.st-boolean');
      return;
    }
    if (cell.dataset.stEditable !== 'true') return;
    const rowId = cell.closest<HTMLElement>('tr.st-row')?.dataset.rowId;
    const row = rowId ? this.table.getRow(rowId) : undefined;
    const field = cell.dataset.field;
    const column = field ? this.table.getColumn(field) : undefined;
    if (!row || !field || !column) return;
    this.activeEdit?.cancel();
    this.activeEdit = startCellEdit({
      table: this.table,
      cell,
      row,
      column,
      onCommit: (value) => {
        try {
          this.table.updateCell(row, field, value);
        } catch {
          // Readonly may have been enabled while editing. Failed validation is
          // surfaced by the `validationFailed` event.
        }
      },
    });
  }

  private toggleCheckbox(cell: HTMLElement, selector: string): void {
    const checkbox = cell.querySelector<HTMLInputElement>(selector);
    if (!checkbox || checkbox.disabled) return;
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Starts in-cell editing for the cell at `rowId`/`field` (no-op when not editable). */
  editCellAt(rowId: string, field: string): void {
    if (!this.table.isEditable()) return;
    const cell = this.rowElements
      .get(rowId)
      ?.querySelector<HTMLElement>(`td[data-field="${field}"]`);
    if (cell) this.editCell(cell);
  }

  private editRow(row: DataRow): void {
    const rowId = this.table.getRowId(row);
    const tr = rowId ? this.rowElements.get(rowId) : undefined;
    const cell = tr?.querySelector<HTMLElement>('td[data-st-editable="true"]');
    if (cell) this.editCell(cell);
  }

  private activateCell(cell: HTMLElement): void {
    for (const active of this.element.querySelectorAll('.st-active')) {
      active.classList.remove('st-active');
    }
    cell.classList.add('st-active');
    cell.focus();
    if (typeof cell.scrollIntoView === 'function') {
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  private getCell(row: number, col: number): HTMLElement | null {
    const rows = this.tbody?.querySelectorAll<HTMLTableRowElement>('tr.st-row');
    const tr = rows ? rows[row] : undefined;
    if (!tr) return null;
    const cell = tr.cells[col];
    return cell ?? null;
  }

  // ------------------------------------------------------------- teardown

  destroy(): void {
    this.ac.abort();
    this.virtualizer?.manager.destroy();
    this.virtualizer = null;
    this.navigator.destroy();
    this.activeEdit?.cancel();
    this.activeEdit = null;
  }
}
