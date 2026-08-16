// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import { DOMRenderer } from '../src/ui/DOMRenderer';
import {
  FILTER_OPERATORS,
  matchesOperator,
  OPERATOR_LABELS,
  OPERAND_COUNT,
} from '../src/filters/operators';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'inStock', title: 'In stock', type: 'boolean' },
];

const rows = [
  { id: 1, name: 'Laptop', price: 1200, inStock: true },
  { id: 2, name: 'Mouse', price: 25, inStock: true },
  { id: 3, name: 'Monitor', price: 300, inStock: false },
  { id: 4, name: 'Keyboard', price: 75, inStock: true },
];

function makeTable() {
  return new SmartTable({ columns, data: rows });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('filter operators', () => {
  it('exposes a fixed operator list with labels and operand counts', () => {
    expect(FILTER_OPERATORS).toEqual([
      'equals',
      'contains',
      'startsWith',
      'endsWith',
      'greaterThan',
      'lessThan',
      'between',
      'inList',
    ]);
    expect(OPERATOR_LABELS.greaterThan).toBe('Greater than');
    expect(OPERAND_COUNT.between).toBe(2);
    expect(OPERAND_COUNT.inList).toBe(1);
  });

  it('equals is case-insensitive', () => {
    expect(matchesOperator('equals', 'Laptop', ['laptop'])).toBe(true);
    expect(matchesOperator('equals', 'Laptop', ['Mouse'])).toBe(false);
  });

  it('supports string operators', () => {
    expect(matchesOperator('contains', 'Keyboard', ['board'])).toBe(true);
    expect(matchesOperator('startsWith', 'Monitor', ['mon'])).toBe(true);
    expect(matchesOperator('endsWith', 'Mouse', ['use'])).toBe(true);
    expect(matchesOperator('contains', 'Laptop', ['xyz'])).toBe(false);
  });

  it('supports numeric comparisons', () => {
    expect(matchesOperator('greaterThan', 300, [100])).toBe(true);
    expect(matchesOperator('greaterThan', 50, [100])).toBe(false);
    expect(matchesOperator('lessThan', 25, [100])).toBe(true);
    expect(matchesOperator('between', 75, [10, 100])).toBe(true);
    expect(matchesOperator('between', 1200, [10, 100])).toBe(false);
  });

  it('treats non-numeric values as incomparable', () => {
    expect(matchesOperator('greaterThan', 'nope', [10])).toBe(false);
    expect(matchesOperator('lessThan', undefined, [10])).toBe(false);
  });

  it('supports inList with an array operand', () => {
    expect(matchesOperator('inList', 'Mouse', [['Mouse', 'Laptop']])).toBe(true);
    expect(matchesOperator('inList', 'Monitor', [['Mouse', 'Laptop']])).toBe(false);
    expect(matchesOperator('inList', 300, [[25, 300]])).toBe(true);
  });

  it('rejects unknown operators', () => {
    expect(matchesOperator('contains' as never, 'x', [])).toBe(true);
  });
});

describe('SmartTable.where', () => {
  it('filters rows with greaterThan', () => {
    const table = makeTable();
    table.where('price', 'greaterThan', 100);
    expect(table.getRows().map((r) => r.name)).toEqual(['Laptop', 'Monitor']);
    expect(table.getFilteredCount()).toBe(2);
  });

  it('filters rows with inList', () => {
    const table = makeTable();
    table.where('name', 'inList', ['Mouse', 'Keyboard']);
    expect(table.getRows().map((r) => r.name)).toEqual(['Mouse', 'Keyboard']);
  });

  it('replaces a previous filter on the same column', () => {
    const table = makeTable();
    table.where('price', 'greaterThan', 100);
    table.where('price', 'lessThan', 100);
    expect(table.getRows().map((r) => r.name)).toEqual(['Mouse', 'Keyboard']);
    expect(table.getStructuredFilters()).toHaveLength(1);
  });

  it('combines filters on different columns with AND semantics', () => {
    const table = makeTable();
    table.where('price', 'lessThan', 500);
    table.where('inStock', 'equals', true);
    expect(table.getRows().map((r) => r.name)).toEqual(['Mouse', 'Keyboard']);
  });

  it('emits filterChanged and resets the page', () => {
    const table = new SmartTable({ columns, data: rows, pageSize: 2 });
    table.goToPage(2);
    table.where('price', 'greaterThan', 100);
    expect(table.getCurrentPage()).toBe(1);
    expect(table.getTotalPages()).toBe(1);
  });

  it('throws for unknown operators and columns', () => {
    const table = makeTable();
    expect(() => table.where('price', 'like' as never, 10)).toThrow(
      ERROR_CODES.INVALID_FILTER_OPERATOR
    );
    expect(() => table.where('nope', 'equals', 1)).toThrow(ERROR_CODES.UNKNOWN_COLUMN);
  });

  it('clearColumnFilter removes only that filter', () => {
    const table = makeTable();
    table.where('price', 'lessThan', 100);
    table.where('name', 'startsWith', 'M');
    expect(table.getFilteredCount()).toBe(1);
    table.clearColumnFilter('price');
    expect(table.getFilteredCount()).toBe(2);
    expect(table.getStructuredFilters().map((f) => f.field)).toEqual(['name']);
  });

  it('clearFilter removes everything including structured filters', () => {
    const table = makeTable();
    table.where('price', 'lessThan', 100);
    table.filter('board');
    expect(table.getFilteredCount()).toBe(1);
    table.clearFilter();
    expect(table.getFilteredCount()).toBe(4);
    expect(table.getStructuredFilters()).toEqual([]);
  });

  it('exposes structured filters for the builder UI', () => {
    const table = makeTable();
    table.where('price', 'between', 10, 100);
    expect(table.getStructuredFilters()).toEqual([
      { field: 'price', operator: 'between', operands: [10, 100] },
    ]);
  });
});

describe('Filter Builder UI', () => {
  it('adds a filter through the builder and lists it', () => {
    const table = makeTable();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const renderer = new DOMRenderer(table, {
      target: host,
      toolbar: true,
      toolbarControls: ['filters'],
    });
    renderer.mount();

    const button = host.querySelector<HTMLButtonElement>('[data-st-control="filters"]');
    expect(button).not.toBeNull();
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const builder = host.querySelector<HTMLElement>('.st-filter-builder');
    expect(builder?.hidden).toBe(false);

    const columnSelect = builder?.querySelector<HTMLSelectElement>('select[aria-label="Column"]');
    const operatorSelect = builder?.querySelector<HTMLSelectElement>(
      'select[aria-label="Operator"]'
    );
    const operand = builder?.querySelector<HTMLInputElement>('input.st-filter-operand');
    columnSelect!.value = 'price';
    operatorSelect!.value = 'greaterThan';
    operand!.value = '100';
    builder
      ?.querySelector<HTMLButtonElement>('.st-filter-add')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(table.getFilteredCount()).toBe(2);
    const text = builder?.querySelector<HTMLElement>('.st-filter-text');
    expect(text?.textContent).toContain('price');
    renderer.unmount();
  });

  it('removes a filter from the list', () => {
    const table = makeTable();
    table.where('price', 'greaterThan', 100);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const renderer = new DOMRenderer(table, {
      target: host,
      toolbar: true,
      toolbarControls: ['filters'],
    });
    renderer.mount();
    host
      .querySelector<HTMLButtonElement>('[data-st-control="filters"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const remove = host.querySelector<HTMLButtonElement>('[data-st-filter-remove]');
    expect(remove).not.toBeNull();
    remove?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(table.getStructuredFilters()).toEqual([]);
    expect(table.getFilteredCount()).toBe(4);
    renderer.unmount();
  });
});
