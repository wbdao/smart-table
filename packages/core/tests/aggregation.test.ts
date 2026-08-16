// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import {
  aggregate,
  aggregateRows,
  AGGREGATION_OPS,
  isValidAggregateConfig,
} from '../src/features/aggregation/aggregations';
import { groupRowsWithAggregates } from '../src/features/grouping/GroupingEngine';
import type { Column, DataRow } from '../src/types';
import type { NormalizedColumn } from '../src/types/column';
import type { ViewRow } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'category', title: 'Category', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
];

const rows: DataRow[] = [
  { id: 1, category: 'Electronics', price: 1200 },
  { id: 2, category: 'Accessories', price: 25 },
  { id: 3, category: 'Electronics', price: 300 },
  { id: 4, category: 'Accessories', price: 80 },
  { id: 5, category: 'Office', price: 40 },
];

afterEach(() => {
  document.body.replaceChildren();
});

describe('aggregate (pure)', () => {
  it('computes built-in operations', () => {
    expect(aggregate(rows, 'price', 'sum')).toBe(1645);
    expect(aggregate(rows, 'price', 'avg')).toBe(329);
    expect(aggregate(rows, 'price', 'count')).toBe(5);
    expect(aggregate(rows, 'price', 'min')).toBe(25);
    expect(aggregate(rows, 'price', 'max')).toBe(1200);
  });

  it('skips non-numeric values', () => {
    const mixed = [{ price: 10 }, { price: 'x' }, { price: '5' }];
    expect(aggregate(mixed as DataRow[], 'price', 'sum')).toBe(15);
    expect(aggregate(mixed as DataRow[], 'price', 'count')).toBe(2);
  });

  it('aggregateRows applies the whole config', () => {
    const result = aggregateRows(rows, { price: 'sum', id: 'max' });
    expect(result).toEqual({ price: 1645, id: 5 });
  });

  it('supports custom functions', () => {
    const result = aggregateRows(rows, { price: (list) => list.length });
    expect(result.price).toBe(5);
  });

  it('lists the supported operations', () => {
    expect(AGGREGATION_OPS).toEqual(['sum', 'avg', 'count', 'min', 'max']);
  });

  it('validates configs', () => {
    expect(isValidAggregateConfig({ price: 'sum' })).toBe(true);
    expect(isValidAggregateConfig({ price: 'median' })).toBe(false);
    expect(isValidAggregateConfig(null)).toBe(false);
    expect(isValidAggregateConfig([])).toBe(false);
  });
});

describe('SmartTable aggregations', () => {
  it('computes a footer over the filtered view', () => {
    const table = new SmartTable({ columns, data: rows });
    table.aggregate({ price: 'sum' });
    expect(table.getAggregations()).toEqual({ price: 'sum' });
    expect(table.getAggregateFooter()).toEqual({ price: 1645 });
  });

  it('emits aggregationChanged when the config is set', () => {
    const table = new SmartTable({ columns, data: rows });
    const changed = vi.fn();
    table.on('aggregationChanged', changed);
    table.aggregate({ price: 'avg' });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0]![0]).toMatchObject({ aggregations: { price: 'avg' } });
  });

  it('accepts aggregations from the constructor options', () => {
    const table = new SmartTable({ columns, data: rows, aggregations: { price: 'max' } });
    expect(table.getAggregateFooter()).toEqual({ price: 1200 });
  });

  it('rejects invalid aggregation configs', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(() => table.aggregate({ price: 'median' as never })).toThrowError(
      ERROR_CODES.INVALID_AGGREGATION
    );
    expect(
      () => new SmartTable({ columns, data: rows, aggregations: { price: 'median' as never } })
    ).toThrowError(ERROR_CODES.INVALID_AGGREGATION);
  });

  it('filters are applied before aggregating', () => {
    const table = new SmartTable({ columns, data: rows });
    table.aggregate({ price: 'sum' });
    table.filter('electronics');
    expect(table.getAggregateFooter().price).toBe(1500);
  });
});

describe('group aggregates', () => {
  it('attaches per-group aggregates via groupRowsWithAggregates', () => {
    const viewRows: ViewRow[] = rows.map((row) => ({ type: 'row', id: String(row.id), row }));
    const result = groupRowsWithAggregates(viewRows, columns[1] as NormalizedColumn, new Set(), {
      price: 'sum',
    });
    const electronics = result.groups.find((g) => g.key === 'Electronics');
    expect(electronics?.aggregates).toEqual({ price: 1500 });
    const accessories = result.groups.find((g) => g.key === 'Accessories');
    expect(accessories?.aggregates).toEqual({ price: 105 });
  });
});
