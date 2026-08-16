/**
 * Temporary performance measurement harness used to produce
 * PERFORMANCE_REPORT.md (Phase 7.11). It is intentionally NOT part of the
 * `pnpm bench` gate — run manually:
 *   node scripts/measure-perf.mjs [npm run build:core-first]
 */
/* eslint-disable no-undef */
import { SmartTable } from '../packages/core/dist/index.js';

const COUNTS = [1_000, 10_000, 50_000, 100_000];
const ITERATIONS = {
  construct: 5,
  getRows: 50,
  filter: 30,
  sort: 30,
  paginate: 100,
  group: 20,
  server: 20,
};

const columns = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'category', title: 'Category', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'stock', title: 'Stock', type: 'number' },
];

function makeRows(count) {
  const categories = ['Electronics', 'Office', 'Accessories', 'Furniture', 'Audio'];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    category: categories[i % categories.length],
    price: Math.round((i % 1000) + 0.99),
    stock: i % 500,
  }));
}

function time(fn, iterations) {
  fn(); // warmup
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) fn();
  return (performance.now() - start) / iterations;
}

const results = [];
for (const count of COUNTS) {
  const rows = makeRows(count);
  const table = new SmartTable({ columns, data: rows });

  const construct = time(() => new SmartTable({ columns, data: rows }), ITERATIONS.construct);
  const getRows = time(() => table.getRows(), ITERATIONS.getRows);
  const filter = time(() => table.filter(`item ${count / 2}`), ITERATIONS.filter);
  const sort = time(() => {
    table.clearSort();
    table.sort('price', 'desc');
    table.getRows();
  }, ITERATIONS.sort);
  const paginate = time(() => {
    table.setPageSize(100);
    table.goToPage(500);
  }, ITERATIONS.paginate);
  const group = time(() => table.groupBy('category'), ITERATIONS.group);
  const server = time(
    () => table.applyServerPage(rows.slice(0, 100), count, 'replace'),
    ITERATIONS.server
  );

  results.push({ count, construct, getRows, filter, sort, paginate, group, server });
}

const header = [
  'rows',
  'construct',
  'getRows()',
  'filter (query)',
  'sort',
  'goToPage(500)',
  'groupBy',
  'applyServerPage',
];
console.log(header.join('\t'));
for (const r of results) {
  console.log(
    [
      r.count,
      r.construct.toFixed(2),
      r.getRows.toFixed(3),
      r.filter.toFixed(2),
      r.sort.toFixed(2),
      r.paginate.toFixed(3),
      r.group.toFixed(2),
      r.server.toFixed(3),
    ].join('\t')
  );
}

// Derived throughput notes (rows/second for the 100k dataset).
const max = results.at(-1);
console.log(
  `\n100k rows/sec: filter ${(100000 / (max.filter / 1)).toFixed(0)} rps | sort ${(100000 / (max.sort / 1)).toFixed(0)} rps`
);
