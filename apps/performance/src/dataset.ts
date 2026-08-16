import type { Column, DataRow } from '@smart-table/core';

/** Deterministic pseudo-random generator so the benchmark is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PRODUCT_COLUMNS: Column[] = [
  { field: 'id', title: 'ID', type: 'number', sortable: true, filterable: true },
  { field: 'name', title: 'Name', type: 'string', sortable: true, filterable: true },
  { field: 'category', title: 'Category', type: 'string', sortable: true, filterable: true },
  { field: 'price', title: 'Price', type: 'number', sortable: true, filterable: true },
  { field: 'stock', title: 'Stock', type: 'number', sortable: true, filterable: true },
  { field: 'rating', title: 'Rating', type: 'number', sortable: true, filterable: true },
  { field: 'active', title: 'Active', type: 'boolean', sortable: true, filterable: true },
];

const CATEGORIES = ['Electronics', 'Books', 'Clothing', 'Toys', 'Furniture'];
const REGIONS = ['EMEA', 'Americas', 'APAC'];

export function makeProducts(count: number): DataRow[] {
  const rand = mulberry32(42);
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Product ${(i % 997) + 1}`,
    category: CATEGORIES[i % CATEGORIES.length],
    price: Math.round((5 + rand() * 1495) * 100) / 100,
    stock: Math.floor(rand() * 900),
    rating: Math.round((1 + rand() * 4) * 10) / 10,
    active: rand() > 0.3,
    region: REGIONS[i % REGIONS.length],
  }));
}
