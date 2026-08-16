/**
 * Phase 2 demo — the full DOM renderer.
 * `table.mount()` builds the built-in renderer: a toolbar (search, copy,
 * clone, add row, mode toggle), sortable columns, row selection, in-cell
 * editing and a responsive card layout on small screens.
 */
import { SmartTable } from '../../src';
import type { Column, DataRow } from '../../src';
import '../../src/styles/smart-table.css';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number', width: 80 },
  { field: 'name', title: 'Product', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'inStock', title: 'In Stock', type: 'boolean' },
];

const data: DataRow[] = [
  { id: 1, name: 'Laptop', price: 1200, inStock: true },
  { id: 2, name: 'Mouse', price: 25, inStock: false },
  { id: 3, name: 'Keyboard', price: 80, inStock: true },
  { id: 4, name: 'Monitor', price: 300, inStock: true },
  { id: 5, name: 'Webcam', price: 45, inStock: false },
];

const output = document.getElementById('output');

function log(message: string): void {
  if (!output) return;
  const pre = document.createElement('pre');
  pre.textContent = message;
  output.appendChild(pre);
  output.scrollTop = output.scrollHeight;
}

const table = new SmartTable({
  columns,
  data,
  container: '#table',
  theme: 'light',
  responsive: true,
});

table.on('sortChanged', (e) =>
  log(`event sortChanged        -> ${e.field ?? 'none'} ${e.direction ?? ''}`)
);
table.on('filterChanged', (e) =>
  log(`event filterChanged      -> "${e.query}" (${e.rowCount}/${e.totalCount} rows)`)
);
table.on('selectionChanged', (e) => log(`event selectionChanged   -> [${e.rowIds.join(', ')}]`));
table.on('modeChanged', (e) => log(`event modeChanged        -> ${e.previousMode} => ${e.mode}`));
table.on('rowAdded', (e) => log(`event rowAdded           -> id=${e.rowId} @ index ${e.rowIndex}`));
table.on('rowDeleted', (e) =>
  log(`event rowDeleted         -> id=${e.rowId} @ index ${e.rowIndex}`)
);
table.on('cellEdit', (e) =>
  log(
    `event cellEdit           -> ${e.field}: ${JSON.stringify(e.oldValue)} => ${JSON.stringify(e.newValue)}`
  )
);
table.on('themeChanged', (e) =>
  log(`event themeChanged       -> "${e.name}" (custom: ${e.custom})`)
);
table.on('copied', (e) => log(`event copied             -> ${e.format} (${e.rowCount} rows)`));
table.on('cloned', (e) => log(`event cloned             -> includeData=${e.includeData}`));
table.on('toolbar:search', (e) => log(`event toolbar:search     -> "${e.query}"`));
table.on('toolbar:add', (e) => log(`event toolbar:add        -> rowId=${e.rowId}`));
table.on('toolbar:mode', (e) => log(`event toolbar:mode       -> ${e.mode}`));

const renderer = table.mount();
log(`mounted ${renderer.constructor.name} — resize the window to switch views`);

document.getElementById('theme-light')?.addEventListener('click', () => table.setTheme('light'));
document.getElementById('theme-dark')?.addEventListener('click', () => table.setTheme('dark'));
document
  .getElementById('theme-corporate')
  ?.addEventListener('click', () => table.setTheme('corporate'));
document.getElementById('theme-custom')?.addEventListener('click', () =>
  table.setTheme({
    name: 'ocean',
    variables: {
      '--st-accent': '#0ea5e9',
      '--st-accent-contrast': '#ffffff',
      '--st-header-bg': '#0c4a6e',
      '--st-header-text': '#e0f2fe',
      '--st-border': '#7dd3fc',
      '--st-odd-row-bg': '#f0f9ff',
    },
  })
);
document
  .getElementById('add-row')
  ?.addEventListener('click', () =>
    table.addRow({ id: Date.now(), name: 'New product', price: 0, inStock: true })
  );

log(`id      = ${table.id}`);
log(`mode    = ${table.getMode()}`);
log(`theme   = ${table.getTheme()}`);
log(`rows    = ${table.getRowCount()}`);
log('Ready — interact with the table above.');
