// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import {
  assertValidPivotConfig,
  PivotEngine,
  type PivotConfig,
} from '../src/features/pivot/PivotEngine';
import type { Column, DataRow } from '../src/types';

const columns: Column[] = [
  { field: 'region', title: 'Region', type: 'string' },
  { field: 'product', title: 'Product', type: 'string' },
  { field: 'sales', title: 'Sales', type: 'number' },
  { field: 'units', title: 'Units', type: 'number' },
];

const sales: DataRow[] = [
  { region: 'North', product: 'Laptop', sales: 100, units: 2 },
  { region: 'North', product: 'Mouse', sales: 50, units: 5 },
  { region: 'South', product: 'Laptop', sales: 80, units: 1 },
  { region: 'South', product: 'Mouse', sales: 40, units: 4 },
  { region: 'North', product: 'Laptop', sales: 20, units: 1 },
];

const config: PivotConfig = {
  rows: ['region'],
  columns: ['product'],
  values: [{ field: 'sales', aggregation: 'sum' }],
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('assertValidPivotConfig', () => {
  it('accepts a valid config', () => {
    expect(() =>
      assertValidPivotConfig(config, new Set(['region', 'product', 'sales']))
    ).not.toThrow();
  });

  it('rejects unknown fields and aggregation ops', () => {
    expect(() =>
      assertValidPivotConfig(
        { ...config, values: [{ field: 'nope', aggregation: 'sum' }] },
        new Set(['sales'])
      )
    ).toThrow();
    expect(() =>
      assertValidPivotConfig(
        { ...config, values: [{ field: 'sales', aggregation: 'median' as never }] },
        new Set(['sales'])
      )
    ).toThrow();
    expect(() =>
      assertValidPivotConfig(
        { rows: [], columns: [], values: [{ field: 'sales', aggregation: 'sum' }] },
        new Set(['sales'])
      )
    ).toThrow();
  });
});

describe('PivotEngine (pure)', () => {
  it('computes row and column dimension keys', () => {
    const result = PivotEngine.compute(sales, config);
    expect(result.getRowKeys()).toEqual([['North'], ['South']]);
    expect(result.getColumnKeys()).toEqual([['Laptop'], ['Mouse']]);
  });

  it('aggregates values at intersections', () => {
    const result = PivotEngine.compute(sales, config);
    expect(result.getValue(['North'], ['Laptop'], 'sales', 'sum')).toBe(120);
    expect(result.getValue(['North'], ['Mouse'], 'sales', 'sum')).toBe(50);
    expect(result.getValue(['South'], ['Laptop'], 'sales', 'sum')).toBe(80);
    expect(result.getValue(['South'], ['Mouse'], 'sales', 'sum')).toBe(40);
    expect(result.getValue(['West'], ['Laptop'], 'sales', 'sum')).toBeUndefined();
  });

  it('exposes rows() with cells for every column', () => {
    const result = PivotEngine.compute(sales, config);
    const grid = result.rows();
    expect(grid).toHaveLength(2);
    expect(grid[0]).toMatchObject({ rowKey: ['North'] });
    expect(grid[0]!.cells).toHaveLength(2);
    expect(grid[0]!.cells[0]).toEqual({ columnKey: ['Laptop'], value: 120 });
  });

  it('serializes to plain JSON', () => {
    const result = PivotEngine.compute(sales, config);
    const json = result.toJSON();
    expect(json.cells).toHaveLength(4);
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
  });

  it('supports row-only dimensions', () => {
    const result = PivotEngine.compute(sales, {
      rows: ['region'],
      columns: [],
      values: [{ field: 'units', aggregation: 'sum' }],
    });
    expect(result.getColumnKeys()).toEqual([[]]);
    expect(result.rows()[0]!.cells[0]!.value).toBe(8);
  });
});

describe('SmartTable pivot', () => {
  it('computes a pivot result and emits pivotChanged', () => {
    const table = new SmartTable({ columns, data: sales });
    const changed = vi.fn();
    table.on('pivotChanged', changed);
    const result = table.pivot(config);
    expect(result.getRowKeys()).toEqual([['North'], ['South']]);
    expect(table.getPivotResult()).toBe(result);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0]![0].config).toEqual({
      rows: ['region'],
      columns: ['product'],
      values: [{ field: 'sales', aggregation: 'sum' }],
    });
  });

  it('clearPivot drops the result and re-emits pivotChanged', () => {
    const table = new SmartTable({ columns, data: sales });
    const changed = vi.fn();
    table.on('pivotChanged', changed);
    table.pivot(config);
    table.clearPivot();
    expect(table.getPivotResult()).toBeNull();
    expect(changed).toHaveBeenLastCalledWith({ config: null });
  });

  it('rejects invalid pivot configs', () => {
    const table = new SmartTable({ columns, data: sales });
    expect(() =>
      table.pivot({ rows: ['nope'], columns: [], values: [{ field: 'sales', aggregation: 'sum' }] })
    ).toThrowError(ERROR_CODES.INVALID_PIVOT_CONFIG);
  });
});
