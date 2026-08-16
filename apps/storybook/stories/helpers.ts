import { SmartTable, type Column, type DataRow } from '@smart-table/core';

export const productColumns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'category', title: 'Category', type: 'string' },
  { field: 'city', title: 'City', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'stock', title: 'Stock', type: 'number' },
  { field: 'active', title: 'Active', type: 'boolean' },
];

const CATEGORIES = ['Electronics', 'Books', 'Clothing', 'Toys', 'Furniture'];
const CITIES = ['Amsterdam', 'Berlin', 'Cairo', 'Madrid', 'Oslo', 'Tokyo'];

export function productRows(count = 40): DataRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Product ${i + 1}`,
    category: CATEGORIES[i % CATEGORIES.length],
    city: CITIES[i % CITIES.length],
    price: Math.round((10 + ((i * 37) % 990)) * 100 + 50) / 100,
    stock: (i * 13) % 500,
    active: i % 4 !== 0,
  }));
}

export interface MountResult {
  element: HTMLElement;
  table: SmartTable;
}

/**
 * Builds a SmartTable synchronously and returns its host element plus the
 * instance, ready to be returned from a Storybook render function.
 */
export function mountTable(options: ConstructorParameters<typeof SmartTable>[0]): MountResult {
  const element = document.createElement('div');
  const table = new SmartTable(options);
  table.mount(element);
  return { element, table };
}
