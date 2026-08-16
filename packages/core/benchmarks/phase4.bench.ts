import { bench, describe, beforeAll } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import type { Column, DataRow } from '../src/types';
import type { ViewRow } from '../src/types';
import { aggregate } from '../src/features/aggregation/aggregations';
import { groupRowsWithAggregates } from '../src/features/grouping/GroupingEngine';
import { flattenTree } from '../src/features/tree/TreeEngine';
import { PivotEngine } from '../src/features/pivot/PivotEngine';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'category', title: 'Category', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'stock', title: 'Stock', type: 'number' },
];

function makeRows(count: number): DataRow[] {
  const categories = ['Electronics', 'Office', 'Accessories', 'Furniture', 'Audio'];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    category: categories[i % categories.length],
    price: Math.round((i % 1000) + 0.99),
    stock: i % 500,
  }));
}

let rows: DataRow[];
let table: SmartTable;
let viewRows: ViewRow[];

beforeAll(() => {
  rows = makeRows(100_000);
  table = new SmartTable({ columns, data: rows });
  viewRows = rows.map((row, i) => ({ type: 'row' as const, id: String(i + 1), row }));
});

describe('100k-row data pipeline', () => {
  bench('construct a SmartTable with 100k rows', () => {
    new SmartTable({ columns, data: rows });
  });

  bench('getRows() (full view) over 100k rows', () => {
    table.getRows();
  });

  bench('filter by a query over 100k rows', () => {
    table.filter('item 4');
  });

  bench('sort 100k rows by price', () => {
    table.clearSort();
    table.sort('price', 'desc');
    table.getRows();
  });

  bench('paginate 100k rows (page 500 of 1000)', () => {
    table.setPageSize(100);
    table.goToPage(500);
    table.getRows();
  });

  bench('aggregate sum over 100k rows', () => {
    aggregate(rows, 'price', 'sum');
  });

  bench('group 100k rows into headers', () => {
    groupRowsWithAggregates(viewRows, table.getColumn('category')!, new Set(), { price: 'sum' });
  });
});

describe('tree + pivot', () => {
  bench('flatten a 10k-node tree', () => {
    const tree = makeRows(10_000).map((row, i) => ({
      type: 'row' as const,
      id: String(i + 1),
      row: i % 100 === 0 ? { ...row, children: [makeRows(3)[0], makeRows(3)[1]] } : row,
    }));
    flattenTree(tree, { expanded: new Set(['1', '101', '201']) });
  });

  bench('compute a pivot over 20k rows', () => {
    PivotEngine.compute(makeRows(20_000), {
      rows: ['category'],
      columns: ['name'],
      values: [{ field: 'price', aggregation: 'sum' }],
    });
  });
});
