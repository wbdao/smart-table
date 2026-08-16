import { createElement, clearChildren } from './dom';
import { getCellText } from '../utils/serialize';
import {
  startCellEdit,
  createBooleanControl,
  showValidationError,
  clearValidationError,
  type EditSession,
} from './editing';
import type { SmartTable } from '../core/SmartTable';
import type { DataRow, NormalizedColumn } from '../types/column';
import type { SortDirection, TableMode } from '../types/modes';

export interface CardViewOptions {
  table: SmartTable;
  /** Render Edit/Delete actions (editable mode only). Default `true`. */
  actions?: boolean;
}

function cellValueToBool(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === 'yes' || value === '1';
}

/**
 * The mobile layout. Rows are rendered as a responsive grid of cards, each
 * showing its columns as label/value pairs, a title (first visible column)
 * and optional Edit/Delete actions. Cards mirror the table's selection and
 * editing behavior so the two views feel identical.
 */
export class CardView {
  readonly element: HTMLElement;

  private readonly table: SmartTable;
  private readonly actionsEnabled: boolean;
  private readonly cards = new Map<string, HTMLElement>();
  private readonly ac = new AbortController();
  private activeEdit: EditSession | null = null;
  private actionsRendered = false;

  constructor(options: CardViewOptions) {
    this.table = options.table;
    this.actionsEnabled = options.actions !== false;
    this.element = createElement('div', {
      className: 'st-cards',
      attrs: { role: 'region', 'aria-label': 'Table cards' },
    });
    this.bind();
    this.render();
  }

  private get showActions(): boolean {
    return this.actionsEnabled && this.table.isEditable();
  }

  /** Columns currently rendered, in column order (live visibility). */
  private get visibleColumns(): NormalizedColumn[] {
    return this.table.getVisibleColumns();
  }

  // ------------------------------------------------------------- rendering

  render(): void {
    clearChildren(this.element);
    this.cards.clear();
    this.actionsRendered = this.showActions;
    const rows = this.table.getRows();
    if (rows.length === 0) {
      const empty = createElement('div', { className: 'st-empty-cell' });
      empty.textContent = 'No rows to display';
      this.element.appendChild(empty);
      return;
    }
    for (const row of rows) {
      const card = this.createCard(row);
      this.element.appendChild(card);
      this.cards.set(this.table.getRowId(row) ?? '', card);
    }
    this.setSelection(this.table.getSelectedRowIds());
    this.setMode(this.table.getMode());
  }

  /** Rebuilds the cards (keeps the same layout rules as a row re-render). */
  syncRows(): void {
    this.render();
  }

  private createCard(row: DataRow): HTMLElement {
    const rowId = this.table.getRowId(row) ?? '';
    const card = createElement('article', {
      className: 'st-card',
      attrs: { 'data-row-id': rowId, 'aria-selected': 'false', tabindex: '0' },
    });

    const head = createElement('header', { className: 'st-card-head' });
    const titleColumn = this.visibleColumns[0];
    const title = createElement('div', { className: 'st-card-title' });
    title.textContent = titleColumn ? getCellText(titleColumn, row) : rowId;
    head.appendChild(title);
    if (this.showActions) head.appendChild(this.createActions(rowId));
    card.appendChild(head);

    const fields = createElement('div', { className: 'st-card-fields' });
    for (const column of this.visibleColumns) {
      const field = createElement('div', {
        className: 'st-card-field',
        attrs: { 'data-field': column.field },
      });
      const label = createElement('div', { className: 'st-card-label' });
      label.textContent = column.title;
      field.appendChild(label);

      const value = createElement('div', {
        className: 'st-card-value',
        attrs: { 'data-field-value': column.field, tabindex: '0' },
      });
      if (column.type === 'boolean') {
        value.setAttribute('data-st-boolean', 'true');
        value.appendChild(createBooleanControl(this.table, row, column));
      } else {
        value.textContent = getCellText(column, row);
        if (column.editable) value.setAttribute('data-st-editable', 'true');
      }
      field.appendChild(value);
      card.appendChild(field);
    }
    card.appendChild(fields);
    return card;
  }

  private createActions(rowId: string): HTMLElement {
    const actions = createElement('div', { className: 'st-card-actions' });
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
    actions.append(editBtn, deleteBtn);
    return actions;
  }

  // -------------------------------------------------------------- patching

  updateCell(rowId: string, field: string): void {
    const card = this.cards.get(rowId);
    if (!card) return;
    const column = this.table.getColumn(field);
    const row = this.table.getRow(rowId);
    if (!column || !row) return;
    const valueEl = card.querySelector<HTMLElement>(`[data-field-value="${field}"]`);
    if (!valueEl) return;
    if (column.type === 'boolean') {
      const checkbox = valueEl.querySelector<HTMLInputElement>('input.st-boolean');
      if (checkbox) checkbox.checked = cellValueToBool(row[field]);
    } else {
      valueEl.textContent = getCellText(column, row);
    }
    clearValidationError(valueEl);
  }

  /** Marks a value with the messages from a failed validation. */
  showValidationErrors(rowId: string, field: string, messages: string[]): void {
    const card = this.cards.get(rowId);
    const valueEl = card?.querySelector<HTMLElement>(`[data-field-value="${field}"]`);
    if (valueEl) showValidationError(valueEl, messages);
  }

  setSelection(rowIds: string[]): void {
    const selected = new Set(rowIds);
    for (const [id, card] of this.cards) {
      const isSelected = selected.has(id);
      card.classList.toggle('st-selected', isSelected);
      card.setAttribute('aria-selected', String(isSelected));
    }
  }

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

  /** Cards have no sort indicators; kept for a uniform view interface. */
  setSort(_field: string | null, _direction: SortDirection | null): void {
    // no-op
  }

  // -------------------------------------------------------------- actions

  private bind(): void {
    this.element.addEventListener('click', this.onClick, { signal: this.ac.signal });
    this.element.addEventListener('dblclick', this.onDblClick, { signal: this.ac.signal });
    this.element.addEventListener('keydown', this.onKeydown, { signal: this.ac.signal });
  }

  private onClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    if (!target) return;
    if (target.closest('[data-st-row-action]')) {
      this.handleRowAction(target.closest<HTMLElement>('[data-st-row-action]') as HTMLElement);
      return;
    }
    if ((target as HTMLElement).tagName === 'INPUT') return;
    const card = target.closest<HTMLElement>('.st-card');
    if (!card || !this.element.contains(card)) return;
    const rowId = card.dataset.rowId;
    const row = rowId ? this.table.getRow(rowId) : undefined;
    if (!row) return;
    if (event.ctrlKey || event.metaKey) {
      if (this.table.getSelectedRowIds().includes(rowId ?? '')) this.table.unselectRow(rowId!);
      else this.table.selectRow(rowId!);
    } else {
      this.table.clearSelection();
      this.table.selectRow(rowId!);
    }
    card.focus();
  };

  private onDblClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const value = target?.closest<HTMLElement>('.st-card-value');
    if (value && this.element.contains(value)) this.editValue(value);
  };

  private onKeydown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
    ) {
      return;
    }
    const card = target?.closest<HTMLElement>('.st-card');
    if (!card || !this.element.contains(card)) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const cards = this.element.querySelectorAll<HTMLElement>('.st-card');
      const index = Array.from(cards).indexOf(card);
      const next = event.key === 'ArrowDown' ? cards[index + 1] : cards[index - 1];
      if (next) next.focus();
    } else if (event.key === 'Enter' && this.table.isEditable()) {
      event.preventDefault();
      const value = card.querySelector<HTMLElement>('[data-st-editable="true"]');
      if (value) this.editValue(value);
    }
  };

  private handleRowAction(action: HTMLElement): void {
    const rowId = action.closest<HTMLElement>('.st-card')?.dataset.rowId;
    const row = rowId ? this.table.getRow(rowId) : undefined;
    if (!row || !this.table.isEditable()) return;
    if (action.dataset.stRowAction === 'delete') {
      this.table.removeRow(row);
    } else if (action.dataset.stRowAction === 'edit') {
      const card = action.closest('.st-card');
      const value = card?.querySelector<HTMLElement>('[data-st-editable="true"]');
      if (value) this.editValue(value);
    }
  }

  private editValue(value: HTMLElement): void {
    if (!this.table.isEditable()) return;
    if (value.dataset.stBoolean === 'true') {
      const checkbox = value.querySelector<HTMLInputElement>('input.st-boolean');
      if (checkbox && !checkbox.disabled) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    if (value.dataset.stEditable !== 'true') return;
    const card = value.closest<HTMLElement>('.st-card');
    const rowId = card?.dataset.rowId;
    const row = rowId ? this.table.getRow(rowId) : undefined;
    const field = value.dataset.fieldValue;
    const column = field ? this.table.getColumn(field) : undefined;
    if (!row || !field || !column) return;
    this.activeEdit?.cancel();
    this.activeEdit = startCellEdit({
      table: this.table,
      cell: value,
      row,
      column,
      onCommit: (newValue) => {
        try {
          this.table.updateCell(row, field, newValue);
        } catch {
          // Readonly may have been enabled while editing. Failed validation is
          // surfaced by the `validationFailed` event.
        }
      },
    });
  }

  /** Starts in-place editing for the field of a card (no-op when not editable). */
  editCellAt(rowId: string, field: string): void {
    if (!this.table.isEditable()) return;
    const value = this.cards
      .get(rowId)
      ?.querySelector<HTMLElement>(`[data-field-value="${field}"]`);
    if (value) this.editValue(value);
  }

  // ------------------------------------------------------------- teardown

  destroy(): void {
    this.ac.abort();
    this.activeEdit?.cancel();
    this.activeEdit = null;
  }
}
