import { summaryFooterPlugin, type Column, type DataRow } from '@smart-table/core';
import { defineSmartTableElement, SmartTableElement } from '../src/index';

// Register `<smart-table>` (idempotent) and grab the element.
defineSmartTableElement('smart-table');
const el = document.querySelector<SmartTableElement>('#orders');

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'category', title: 'Category', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'stock', title: 'Stock', type: 'number' },
  { field: 'active', title: 'Active', type: 'boolean' },
];

const seed: DataRow[] = Array.from({ length: 500 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  category: ['Electronics', 'Books', 'Clothing', 'Toys', 'Furniture'][i % 5],
  price: Math.round((10 + ((i * 37) % 990)) * 100 + 50) / 100,
  stock: (i * 13) % 500,
  active: i % 4 !== 0,
}));

if (el) {
  el.columns = columns;
  el.data = seed;
  el.use(summaryFooterPlugin({ label: 'View' }));

  const log = document.querySelector<HTMLElement>('#events');
  el.addEventListener('sort-changed', (e: Event) => {
    const { payload } = (e as CustomEvent).detail as {
      payload: { field?: string; direction?: string };
    };
    if (log) {
      const line = `sort-changed -> ${payload.field ?? '?'} ${payload.direction ?? ''}`;
      log.append(line + '\n');
    }
  });

  document.querySelector<HTMLSelectElement>('#theme')?.addEventListener('change', (e) => {
    el.setAttribute('theme', (e.target as HTMLSelectElement).value);
  });
  document.querySelector<HTMLSelectElement>('#page-size')?.addEventListener('change', (e) => {
    el.setAttribute('page-size', (e.target as HTMLSelectElement).value);
  });

  // Surface the table for console experiments: window.orders
  (window as unknown as { orders: SmartTableElement }).orders = el;
}
