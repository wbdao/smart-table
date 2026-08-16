import { getCellText } from '../utils/serialize';
import type { DataRow, NormalizedColumn } from '../types/column';
import type { SmartTable } from '../core/SmartTable';

/**
 * In-place cell editing.
 *
 * Editing replaces a cell's contents with a typed `<input>`:
 * - `string`  -> `<input type="text">`
 * - `number`  -> `<input type="number">` (invalid input cancels the edit)
 * - `date`    -> `<input type="date">` (stored back as an ISO 8601 string)
 * - `boolean` -> rendered as an always-on checkbox, toggled in place
 *
 * Commit is triggered by Enter or blur; Escape cancels. Only the cell's own
 * keydown/blur listeners are used, so multiple cells can never edit at once —
 * starting a new edit first commits/cancels any active session.
 */

export interface EditSession {
  /** Commits the current input value back to the table. */
  commit: () => void;
  /** Discards the current input and restores the cell. */
  cancel: () => void;
  /** The input element attached to the cell. */
  input: HTMLInputElement;
}

export interface EditOptions {
  table: SmartTable;
  cell: HTMLElement;
  row: DataRow;
  column: NormalizedColumn;
  /** Called with the parsed value after a successful commit. */
  onCommit?: (newValue: unknown) => void;
}

const TRUE_VALUES = new Set([true, 1, 'true', 'yes', '1']);

function toBoolean(value: unknown): boolean {
  return TRUE_VALUES.has(value as never);
}

function formatDateInput(value: unknown): string {
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ''));
  if (!Number.isFinite(ms)) return '';
  return new Date(ms as number).toISOString().slice(0, 10);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Parses the input value for a column type. Returns `undefined` to signal an
 * invalid value (the edit is then cancelled instead of committed).
 */
function parseInput(column: NormalizedColumn, input: HTMLInputElement): unknown {
  switch (column.type) {
    case 'number': {
      const trimmed = input.value.trim();
      if (trimmed === '') return null;
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : undefined;
    }
    case 'date': {
      if (input.value === '') return null;
      const date = new Date(input.value);
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }
    default:
      return input.value;
  }
}

function restoreCell(cell: HTMLElement, row: DataRow, column: NormalizedColumn): void {
  cell.classList.remove('st-editing');
  clearValidationError(cell);
  cell.textContent = getCellText(column, row);
}

/** Marks a cell as failed validation, keeping the invalid value on screen. */
export function showValidationError(cell: HTMLElement, messages: string[]): void {
  cell.classList.add('st-validation-error');
  cell.setAttribute('data-st-error', messages[0] ?? 'Invalid value');
  cell.title = messages.join('\n');
}

/** Clears any validation error state from a cell. */
export function clearValidationError(cell: HTMLElement): void {
  cell.classList.remove('st-validation-error');
  cell.removeAttribute('data-st-error');
  cell.removeAttribute('title');
}

/**
 * Starts an editing session on `cell`. Committing writes the parsed value
 * through `onCommit` (the caller is expected to call `table.updateCell`),
 * then restores the cell's display text.
 */
export function startCellEdit(options: EditOptions): EditSession {
  const { cell, row, column } = options;

  const input = document.createElement('input');
  input.type = column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text';
  input.className = 'st-cell-input';
  input.setAttribute('data-st-edit', 'true');
  input.setAttribute('aria-label', `Edit ${column.title}`);
  if (column.type === 'number') {
    input.value =
      row[column.field] === null || row[column.field] === undefined
        ? ''
        : String(row[column.field]);
  } else if (column.type === 'date') {
    input.value = formatDateInput(row[column.field]);
  } else {
    input.value = displayValue(row[column.field]);
  }

  cell.textContent = '';
  cell.classList.add('st-editing');
  cell.appendChild(input);

  let done = false;

  const finish = (): void => {
    if (done) return;
    done = true;
    input.removeEventListener('keydown', onKeydown);
    input.removeEventListener('blur', onBlur);
  };

  const onBlur = (): void => commit();

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  };

  function commit(): void {
    if (done) return;
    const parsed = parseInput(column, input);
    finish();
    cell.classList.remove('st-editing');
    if (parsed === undefined) {
      restoreCell(cell, row, column);
      return;
    }
    cell.textContent = displayValue(parsed);
    options.onCommit?.(parsed);
    input.remove();
  }

  function cancel(): void {
    if (done) return;
    finish();
    cell.classList.remove('st-editing');
    restoreCell(cell, row, column);
    input.remove();
  }

  input.addEventListener('keydown', onKeydown);
  input.addEventListener('blur', onBlur);
  input.focus();
  if (column.type !== 'date') input.select();

  return { commit, cancel, input };
}

/**
 * Creates the checkbox used for boolean cells. Toggling commits the new value
 * immediately via `table.updateCell`; committed values are `true`/`false`.
 * Non-editable tables render a static checkbox that is `disabled`.
 */
export function createBooleanControl(
  table: SmartTable,
  row: DataRow,
  column: NormalizedColumn
): HTMLInputElement {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'st-boolean';
  checkbox.checked = toBoolean(row[column.field]);
  checkbox.setAttribute('aria-label', column.title);
  if (table.isEditable() && column.editable) {
    checkbox.addEventListener('change', () => {
      if (table.isEditable()) {
        table.updateCell(row, column.field, checkbox.checked);
      } else {
        checkbox.checked = !checkbox.checked;
      }
    });
  } else {
    checkbox.disabled = true;
  }
  return checkbox;
}
