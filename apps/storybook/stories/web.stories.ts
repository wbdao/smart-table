import { summaryFooterPlugin, type Column, type DataRow } from '@smart-table/core';
import {
  defineSmartTableElement,
  SmartTableElement,
  toKebab,
} from '../../../packages/web/src/index';

defineSmartTableElement('smart-table');

const meta: { title: string; parameters: { layout: string } } = {
  title: 'Web Component/<smart-table>',
  parameters: { layout: 'fullscreen' },
};

export default meta;

const COLUMNS: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'category', title: 'Category', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'stock', title: 'Stock', type: 'number' },
  { field: 'active', title: 'Active', type: 'boolean' },
];

function rows(count = 60): DataRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Product ${i + 1}`,
    category: ['Electronics', 'Books', 'Clothing'][i % 3],
    price: Math.round((10 + ((i * 37) % 990)) * 100 + 50) / 100,
    stock: (i * 13) % 500,
    active: i % 4 !== 0,
  }));
}

function host(title: string, configure: (el: SmartTableElement) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:20px;font-family:system-ui,sans-serif';
  const h = document.createElement('h3');
  h.style.cssText = 'margin:0 0 10px;font-size:15px;color:#444';
  h.textContent = title;
  const el = document.createElement('smart-table') as SmartTableElement;
  el.style.height = '360px';
  configure(el);
  wrap.append(h, el);
  return wrap;
}

export const Basic = () =>
  host('Attributes + properties', (el) => {
    el.setAttribute('page-size', '10');
    el.setAttribute('theme', 'light');
    el.columns = COLUMNS;
    el.data = rows(120);
  });
Basic.storyName = 'Basic (attributes + properties)';

export const Events = () =>
  host('Custom events (sort-changed)', (el) => {
    el.setAttribute('page-size', '0');
    el.columns = COLUMNS;
    el.data = rows(40);
    const note = document.createElement('div');
    note.style.cssText = 'margin-top:8px;font-size:12px;color:#6b7280';
    note.textContent = 'click a column header — events land below';
    el.parentElement?.appendChild(note);
    el.addEventListener('sort-changed', (e) => {
      const { payload } = (e as CustomEvent).detail as {
        payload: { field?: string; direction?: string };
      };
      note.textContent = `${toKebab('sortChanged')}: ${payload.field} ${payload.direction}`;
    });
  });
Events.storyName = 'Custom events';

export const Plugins = () =>
  host('Marketplace plugins via el.use()', (el) => {
    el.setAttribute('page-size', '0');
    el.columns = COLUMNS;
    el.data = rows(40);
    el.use(summaryFooterPlugin({ fields: { price: 'sum' }, label: 'View' }));
  });
Plugins.storyName = 'Plugins (summary footer)';
