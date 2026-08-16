import type { Column, DataRow } from '@smart-table/core';
import { mountTable, productColumns, productRows } from './helpers';

const meta: { title: string; parameters: { layout: string } } = {
  title: 'Features/SmartTable',
  parameters: { layout: 'fullscreen' },
};

export default meta;

function page(tables: Array<{ title: string; el: HTMLElement }>): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText =
    'padding:24px;font-family:system-ui,sans-serif;display:grid;gap:16px;max-width:1200px;margin:0 auto';
  for (const item of tables) {
    if (item.title) {
      const h = document.createElement('h3');
      h.style.cssText = 'margin:8px 0 4px;font-size:15px;color:#444';
      h.textContent = item.title;
      container.appendChild(h);
    }
    container.appendChild(item.el);
  }
  return container;
}

export const Grid = () => {
  const { element } = mountTable({ columns: productColumns, data: productRows(400) });
  return element;
};
Grid.storyName = 'Grid (sort / filter / edit)';

export const Toolbar = () => {
  const { element } = mountTable({ columns: productColumns, data: productRows(60) });
  return element;
};
Toolbar.storyName = 'Toolbar';

export const CardView = () => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'max-width:640px;margin:24px auto;';
  const { element } = mountTable({
    columns: productColumns,
    data: productRows(12),
    responsive: true,
    pageSize: 4,
  });
  wrap.appendChild(element);
  return wrap;
};
CardView.storyName = 'Card view (responsive < 768px)';

export const PivotView = () => {
  const { element, table } = mountTable({ columns: productColumns, data: productRows(400) });
  table.pivot({
    rows: ['category'],
    columns: ['city'],
    values: [{ field: 'price', aggregation: 'sum' }],
  });
  return element;
};
PivotView.storyName = 'Pivot view';

export const ContextMenu = () => {
  const { element } = mountTable({
    columns: productColumns,
    data: productRows(30),
    contextMenu: {
      items: [
        {
          id: 'highlight',
          label: 'Mark row',
          run: (ctx) => {
            console.log('marked row', ctx.row);
          },
        },
      ],
    },
  });
  return element;
};
ContextMenu.storyName = 'Context menu';

export const Themes = () => {
  const light = mountTable({ columns: productColumns, data: productRows(8), theme: 'light' });
  const dark = mountTable({ columns: productColumns, data: productRows(8), theme: 'dark' });
  const corporate = mountTable({
    columns: productColumns,
    data: productRows(8),
    theme: 'corporate',
  });
  return page([
    { title: 'light', el: light.element },
    { title: 'dark', el: dark.element },
    { title: 'corporate', el: corporate.element },
  ]);
};
Themes.storyName = 'Themes';

export const Validation = () => {
  const columns: Column[] = [
    { field: 'sku', title: 'SKU', type: 'string', validators: { required: true } },
    { field: 'qty', title: 'Qty', type: 'number', validators: { min: 1, max: 10000 } },
    { field: 'price', title: 'Price', type: 'number', validators: { min: 0 } },
  ];
  const rows: DataRow[] = [
    { sku: 'SKU-001', qty: 5, price: 19.99 },
    { sku: 'SKU-002', qty: -3, price: 9.5 },
  ];
  const { element } = mountTable({ columns, data: rows, editable: true });
  return element;
};

export const Tree = () => {
  const columns: Column[] = [
    { field: 'name', title: 'Name', type: 'string' },
    { field: 'value', title: 'Value', type: 'number' },
  ];
  const rows: DataRow[] = [
    {
      id: 'a',
      name: 'Category A',
      value: 100,
      children: [
        {
          id: 'a1',
          name: 'Product A1',
          value: 40,
          children: [{ id: 'a1x', name: 'Variant A1-X', value: 12 }],
        },
        { id: 'a2', name: 'Product A2', value: 60 },
      ],
    },
    {
      id: 'b',
      name: 'Category B',
      value: 200,
      children: [{ id: 'b1', name: 'Product B1', value: 200 }],
    },
  ];
  const { element, table } = mountTable({ columns, data: rows, tree: true });
  table.expandNode('a');
  table.expandNode('a1');
  return element;
};
Tree.storyName = 'Tree data';

export const Grouping = () => {
  const { element, table } = mountTable({
    columns: productColumns,
    data: productRows(120),
    aggregations: { price: 'sum', stock: 'avg' },
  });
  table.groupBy('category');
  return element;
};
Grouping.storyName = 'Grouping + aggregates';
