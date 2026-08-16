import { createElement, clearChildren } from '../ui/dom';
import type { SmartTable } from '../core/SmartTable';
import type { NormalizedColumn } from '../types/column';
import type { FilterOperator, FilterOperand, FilterScalar } from '../types/filter';
import { FILTER_OPERATORS, OPERATOR_LABELS, OPERAND_COUNT } from './operators';

/** Parses a raw input string into a typed operand for the given column. */
export function parseFilterOperand(input: string, column: NormalizedColumn): FilterScalar | null {
  const raw = input.trim();
  if (raw === '') return null;
  switch (column.type) {
    case 'number': {
      const num = Number(raw);
      return Number.isFinite(num) ? num : null;
    }
    case 'date': {
      const date = new Date(raw);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    default:
      return raw;
  }
}

function parseListOperands(input: string, column: NormalizedColumn): FilterScalar[] | null {
  const parts = input
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length === 0) return null;
  const parsed = parts
    .map((part) => parseFilterOperand(part, column))
    .filter((value): value is FilterScalar => value !== null);
  if (parsed.length === 0) return null;
  return parsed;
}

function describeFilter(
  field: string,
  operator: FilterOperator,
  operands: FilterOperand[]
): string {
  const label = OPERATOR_LABELS[operator];
  const joined = operands
    .map((operand) => (Array.isArray(operand) ? operand.join(', ') : String(operand)))
    .join(' and ');
  return `${field} ${label.toLowerCase()} ${joined}`;
}

/**
 * The Filter Builder popover. Renders an "add filter" form (column, operator,
 * operands) and the list of active structured filters with remove buttons.
 * All changes go through the table's public `where` / `clearColumnFilter`
 * APIs, so the core stays authoritative.
 */
export class FilterBuilder {
  readonly element: HTMLElement;

  private readonly table: SmartTable;
  private readonly columnSelect: HTMLSelectElement;
  private readonly operatorSelect: HTMLSelectElement;
  private readonly operandInputs: HTMLInputElement[];
  private readonly operandRow: HTMLDivElement;
  private readonly list: HTMLDivElement;

  constructor(table: SmartTable) {
    this.table = table;
    this.element = createElement('div', {
      className: 'st-filter-builder',
      attrs: { hidden: '', role: 'dialog', 'aria-label': 'Filter builder' },
    });

    const form = createElement('div', { className: 'st-filter-form' });
    this.columnSelect = createElement('select', { attrs: { 'aria-label': 'Column' } });
    this.operatorSelect = createElement('select', { attrs: { 'aria-label': 'Operator' } });
    for (const operator of FILTER_OPERATORS) {
      const option = document.createElement('option');
      option.value = operator;
      option.textContent = OPERATOR_LABELS[operator];
      this.operatorSelect.appendChild(option);
    }
    this.operandRow = createElement('div', { className: 'st-filter-operands' });
    this.operandInputs = [];
    this.renderColumnOptions();
    this.renderOperandInputs(this.operatorSelect.value as FilterOperator);

    const addButton = createElement('button', {
      className: 'st-toolbar-btn st-filter-add',
      attrs: { type: 'button' },
    });
    addButton.textContent = 'Add';
    form.append(this.columnSelect, this.operatorSelect, this.operandRow, addButton);

    this.list = createElement('div', { className: 'st-filter-list' });

    this.element.append(form, this.list);

    this.operatorSelect.addEventListener('change', () => {
      this.renderOperandInputs(this.operatorSelect.value as FilterOperator);
    });
    addButton.addEventListener('click', () => this.addFilter());
    this.list.addEventListener('click', (event) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
        '[data-st-filter-remove]'
      );
      const field = button?.dataset.stFilterRemove;
      if (field) this.table.clearColumnFilter(field);
    });
  }

  private renderColumnOptions(): void {
    clearChildren(this.columnSelect);
    for (const column of this.table.getVisibleColumns()) {
      const option = document.createElement('option');
      option.value = column.field;
      option.textContent = column.title;
      this.columnSelect.appendChild(option);
    }
  }

  private renderOperandInputs(operator: FilterOperator): void {
    clearChildren(this.operandRow);
    this.operandInputs.length = 0;
    const count = OPERAND_COUNT[operator];
    for (let i = 0; i < count; i += 1) {
      const input = createElement('input', {
        className: 'st-filter-operand',
        attrs: {
          type: 'text',
          placeholder: operator === 'between' ? (i === 0 ? 'From' : 'To') : 'Value',
          'aria-label': operator === 'between' ? (i === 0 ? 'From' : 'To') : 'Value',
        },
      });
      if (operator === 'inList') input.placeholder = 'Comma-separated list';
      this.operandRow.appendChild(input);
      this.operandInputs.push(input);
    }
  }

  /** Rebuilds the column list and active-filter list. */
  render(): void {
    this.renderColumnOptions();
    this.renderActiveFilters();
  }

  private renderActiveFilters(): void {
    clearChildren(this.list);
    const filters = this.table.getStructuredFilters();
    if (filters.length === 0) {
      const empty = createElement('div', { className: 'st-filter-empty' });
      empty.textContent = 'No active filters';
      this.list.appendChild(empty);
      return;
    }
    for (const filter of filters) {
      const item = createElement('div', { className: 'st-filter-item' });
      const text = createElement('span', { className: 'st-filter-text' });
      text.textContent = describeFilter(filter.field, filter.operator, filter.operands);
      const remove = createElement('button', {
        className: 'st-filter-remove',
        attrs: {
          type: 'button',
          'data-st-filter-remove': filter.field,
          'aria-label': `Remove filter on ${filter.field}`,
        },
      });
      remove.textContent = '×';
      item.append(text, remove);
      this.list.appendChild(item);
    }
  }

  private addFilter(): void {
    const field = this.columnSelect.value;
    const operator = this.operatorSelect.value as FilterOperator;
    const column = this.table.getColumn(field);
    if (!column) return;
    let operands: FilterOperand[];
    if (operator === 'inList') {
      const list = parseListOperands(this.operandInputs[0]?.value ?? '', column);
      if (!list) return;
      operands = [list];
    } else {
      const values = this.operandInputs.map((input) => parseFilterOperand(input.value, column));
      if (values.some((value) => value === null)) return;
      operands = values as FilterOperand[];
    }
    this.table.where(field, operator, ...operands);
    for (const input of this.operandInputs) input.value = '';
    this.renderActiveFilters();
  }
}
