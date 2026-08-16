// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import { DOMRenderer } from '../src/ui/DOMRenderer';
import { validateColumnValue, validateRow } from '../src/validation/validators';
import type { Column, ColumnValidators } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  {
    field: 'price',
    title: 'Price',
    type: 'number',
    validators: { required: true, min: 10, max: 5000 },
  },
  {
    field: 'sku',
    title: 'SKU',
    type: 'string',
    validators: { minLength: 3, maxLength: 10, pattern: '^[A-Z0-9]+$' },
  },
];

function makeRows() {
  return [
    { id: 1, name: 'Laptop', price: 1200, sku: 'LAP001' },
    { id: 2, name: 'Mouse', price: 25, sku: 'MOU22' },
    { id: 3, name: 'Monitor', price: 300, sku: 'MON100' },
  ];
}

function makeTable() {
  return new SmartTable({ columns, data: makeRows() });
}

function mountRenderer(table: SmartTable) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const renderer = new DOMRenderer(table, { target: host, toolbar: false });
  renderer.mount();
  return { host, renderer };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('validation: validators module', () => {
  it('returns no messages when the column has no validators', () => {
    const column = { field: 'name', type: 'string' } as Column;
    expect(validateColumnValue(column, { name: '' })).toEqual([]);
  });

  it('rejects empty required values', () => {
    const column = { field: 'name', validators: { required: true } } as Column;
    for (const value of [undefined, null, '', []]) {
      expect(validateColumnValue(column, { name: value })).toEqual(['This field is required']);
    }
  });

  it('enforces min and max on numbers', () => {
    const column = { field: 'price', validators: { min: 10, max: 100 } } as Column;
    expect(validateColumnValue(column, { price: 5 })).toEqual(['Must be at least 10']);
    expect(validateColumnValue(column, { price: 150 })).toEqual(['Must be at most 100']);
    expect(validateColumnValue(column, { price: 50 })).toEqual([]);
  });

  it('skips min/max when the value is not numeric', () => {
    const column = { field: 'price', validators: { min: 10 } } as Column;
    expect(validateColumnValue(column, { price: 'abc' })).toEqual([]);
  });

  it('enforces string length constraints', () => {
    const column = { field: 'sku', validators: { minLength: 3, maxLength: 4 } } as Column;
    expect(validateColumnValue(column, { sku: 'ab' })).toEqual(['Must be at least 3 characters']);
    expect(validateColumnValue(column, { sku: 'abcde' })).toEqual(['Must be at most 4 characters']);
    expect(validateColumnValue(column, { sku: 'abcd' })).toEqual([]);
  });

  it('enforces patterns using strings and RegExp', () => {
    const column = { field: 'sku', validators: { pattern: '^[A-Z]+$' } } as Column;
    expect(validateColumnValue(column, { sku: 'abc' })).toEqual([
      'Does not match the required pattern',
    ]);
    expect(validateColumnValue(column, { sku: 'ABC' })).toEqual([]);
    const regex = { field: 'sku', validators: { pattern: /^A/ } } as Column;
    expect(validateColumnValue(regex, { sku: 'bee' })).toHaveLength(1);
  });

  it('runs custom validators against the value and full row', () => {
    const custom = vi.fn((value: unknown, row: Record<string, unknown>) =>
      value === row.other ? true : 'Must match other'
    );
    const column = { field: 'a', validators: { custom } } as Column;
    expect(validateColumnValue(column, { a: 1, other: 1 })).toEqual([]);
    expect(validateColumnValue(column, { a: 1, other: 2 })).toEqual(['Must match other']);
    expect(custom).toHaveBeenCalledTimes(2);
  });

  it('collects every failing rule into one result', () => {
    const column = {
      field: 'sku',
      validators: { required: true, minLength: 3, pattern: '^[A-Z]+$' } as ColumnValidators,
    } as Column;
    expect(validateColumnValue(column, { sku: '' })).toHaveLength(2);
  });

  it('validateRow skips columns without validators', () => {
    const result = validateRow(columns, { id: 1, name: '', price: 5, sku: 'x' });
    expect(result).toEqual([
      { field: 'price', messages: ['Must be at least 10'] },
      {
        field: 'sku',
        messages: ['Must be at least 3 characters', 'Does not match the required pattern'],
      },
    ]);
  });
});

describe('validation: SmartTable API', () => {
  it('throws VALIDATION_FAILED and leaves the value unchanged on invalid edit', () => {
    const table = makeTable();
    const listener = vi.fn();
    table.on('validationFailed', listener);
    expect(() => table.updateCell('1', 'price', 5)).toThrow(ERROR_CODES.VALIDATION_FAILED);
    expect(table.getRow('1')?.price).toBe(1200);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ field: 'price', rowId: '1' }));
    expect(listener.mock.calls[0]?.[0].messages).toEqual(['Must be at least 10']);
  });

  it('accepts valid edits and emits validationPassed', () => {
    const table = makeTable();
    const passed = vi.fn();
    table.on('validationPassed', passed);
    table.updateCell('1', 'price', 1500);
    expect(table.getRow('1')?.price).toBe(1500);
    expect(passed).toHaveBeenCalledTimes(1);
    expect(passed.mock.calls[0]?.[0]).toMatchObject({ field: 'price', rowId: '1' });
  });

  it('does not validate columns without validators', () => {
    const table = makeTable();
    const failed = vi.fn();
    table.on('validationFailed', failed);
    expect(() => table.updateCell('1', 'name', '')).not.toThrow();
    expect(table.getRow('1')?.name).toBe('');
    expect(failed).not.toHaveBeenCalled();
  });

  it('does not emit validationPassed when the value is unchanged', () => {
    const table = makeTable();
    const passed = vi.fn();
    table.on('validationPassed', passed);
    table.updateCell('1', 'price', 1200);
    expect(passed).not.toHaveBeenCalled();
  });

  it('validateCell reports current errors', () => {
    const table = makeTable();
    expect(table.validateCell('1', 'price')).toEqual([]);
    expect(table.validateCell('1', 'sku')).toEqual([]);
  });

  it('validateCell returns empty for unknown rows or columns', () => {
    const table = makeTable();
    expect(table.validateCell(99, 'price')).toEqual([]);
    expect(table.validateCell('1', 'nope')).toEqual([]);
  });

  it('validateRow and isRowValid evaluate a whole row', () => {
    const table = makeTable();
    expect(table.isRowValid('1')).toBe(true);
    table.updateCell('1', 'sku', 'AB12');
    expect(table.isRowValid('1')).toBe(true);

    const invalid = new SmartTable({
      columns: [{ field: 'sku', validators: { minLength: 3 } }],
      data: [{ sku: 'x' }],
    });
    expect(invalid.validateRow(0)).toEqual([
      { field: 'sku', messages: ['Must be at least 3 characters'] },
    ]);
    expect(invalid.isRowValid(0)).toBe(false);
  });

  it('rejects empty required cells even when the value parses to a number type', () => {
    const table = new SmartTable({
      columns: [{ field: 'qty', type: 'number', validators: { required: true } }],
      data: [{ qty: 3 }],
    });
    expect(() => table.updateCell(0, 'qty', null)).toThrow(ERROR_CODES.VALIDATION_FAILED);
  });
});

describe('validation: UI', () => {
  it('renders a validation error class on the rejected cell', () => {
    const table = makeTable();
    const { host } = mountRenderer(table);
    const cell = host.querySelector('td[data-field="price"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector<HTMLInputElement>('input.st-cell-input');
    expect(input).not.toBeNull();
    input!.value = '5';
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const patched = host.querySelector('td[data-field="price"]') as HTMLElement;
    expect(patched.classList.contains('st-validation-error')).toBe(true);
    expect(patched.getAttribute('data-st-error')).toBe('Must be at least 10');
  });

  it('clears the error once a valid value is committed', () => {
    const table = makeTable();
    const { host } = mountRenderer(table);
    const cell = host.querySelector('td[data-field="price"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector<HTMLInputElement>('input.st-cell-input')!;
    input.value = '5';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const cell2 = host.querySelector('td[data-field="price"]') as HTMLElement;
    cell2.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input2 = host.querySelector<HTMLInputElement>('input.st-cell-input')!;
    input2.value = '1500';
    input2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const patched = host.querySelector('td[data-field="price"]') as HTMLElement;
    expect(patched.classList.contains('st-validation-error')).toBe(false);
    expect(patched.textContent).toBe('1500');
  });
});
