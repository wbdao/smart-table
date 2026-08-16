// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { ERROR_CODES } from '../src/core/errors';
import { DOMRenderer } from '../src/ui/DOMRenderer';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number', width: 80 },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'inStock', title: 'In Stock', type: 'boolean' },
];

function makeRows(): Array<{ id: number; name: string; inStock: boolean }> {
  return [
    { id: 1, name: 'Laptop', inStock: true },
    { id: 2, name: 'Mouse', inStock: false },
    { id: 3, name: 'Monitor', inStock: true },
  ];
}

function mountRenderer(table: SmartTable, options: Record<string, unknown> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const renderer = new DOMRenderer(table, { target: host, toolbar: false, ...options });
  renderer.mount();
  return { host, renderer };
}

function getCell(host: HTMLElement, rowId: string, field: string): HTMLElement | null {
  return host.querySelector(`tr[data-row-id="${rowId}"] td[data-field="${field}"]`);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('DOMRenderer — mount lifecycle', () => {
  it('renders toolbar (when enabled) and table rows', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const renderer = new DOMRenderer(table, { target: host });
    renderer.mount();
    expect(host.querySelector('.st-toolbar')).not.toBeNull();
    expect(host.querySelectorAll('tr.st-row')).toHaveLength(3);
    expect(host.querySelector('.st-root')).not.toBeNull();
    renderer.unmount();
  });

  it('table.mount() uses the registered default renderer', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const table = new SmartTable({ columns, data: makeRows(), container: host });
    const renderer = table.mount();
    expect(renderer.isMounted()).toBe(true);
    expect(host.querySelector('.st-root')).not.toBeNull();
    table.unmount();
    expect(host.querySelector('.st-root')).toBeNull();
    expect(renderer.isMounted()).toBe(false);
  });

  it('mount throws NO_CONTAINER without a target', () => {
    const table = new SmartTable({ columns });
    expect(() => table.mount()).toThrowError(ERROR_CODES.NO_CONTAINER);
  });

  it('unmount removes DOM and leaves the table usable', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host, renderer } = mountRenderer(table);
    renderer.unmount();
    expect(host.querySelector('.st-root')).toBeNull();
    table.addRow({ id: 4, name: 'Webcam', inStock: false });
    expect(table.getRowCount()).toBe(4);
  });

  it('tablet viewport renders a table with the sticky-header scroll area', () => {
    const table = new SmartTable({ columns, data: makeRows(), responsive: true });
    const { host } = mountRenderer(table, { widthProvider: () => 800 });
    expect(host.querySelector('table.st-table')).not.toBeNull();
    expect(host.querySelector('.st-scroll')).not.toBeNull();
    expect(host.querySelector('.st-scroll')?.classList.contains('st-scroll-no-sticky')).toBe(false);
  });
});

describe('DOMRenderer — rendering and patching', () => {
  it('renders cell text and alignment classes', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    expect(getCell(host, '1', 'name')?.textContent).toBe('Laptop');
    expect(getCell(host, '1', 'id')?.classList.contains('st-cell-number')).toBe(true);
  });

  it('patches a single cell in place (no full re-render)', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const tbody = host.querySelector('table tbody');
    table.updateCell('1', 'name', 'Updated');
    expect(host.querySelector('table tbody')).toBe(tbody);
    expect(getCell(host, '1', 'name')?.textContent).toBe('Updated');
  });

  it('syncs rows on filter and sort changes', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    table.filter('monitor');
    expect(host.querySelectorAll('tr.st-row')).toHaveLength(1);
    expect(getCell(host, '3', 'name')?.textContent).toBe('Monitor');
    table.clearFilter();
    table.sort('name', 'asc');
    const first = host.querySelector('tr.st-row td[data-field="name"]');
    expect(first?.textContent).toBe('Laptop');
  });

  it('renders an empty state when there are no rows', () => {
    const table = new SmartTable({ columns });
    const { host } = mountRenderer(table);
    expect(host.querySelector('.st-empty-cell')?.textContent).toBe('No rows to display');
  });

  it('adds and removes rows via the table API', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    table.addRow({ id: 4, name: 'Webcam', inStock: false });
    expect(host.querySelectorAll('tr.st-row')).toHaveLength(4);
    table.removeRow('2');
    expect(host.querySelectorAll('tr.st-row')).toHaveLength(3);
    expect(host.querySelector('tr[data-row-id="2"]')).toBeNull();
  });
});

describe('DOMRenderer — selection UI', () => {
  it('select-all checkbox selects and clears the visible rows', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const selectAll = host.querySelector('input.st-select-all') as HTMLInputElement;
    selectAll.click();
    expect(table.getSelectionCount()).toBe(3);
    selectAll.click();
    expect(table.getSelectionCount()).toBe(0);
  });

  it('row checkbox selects a single row', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const rowCheck = host.querySelectorAll('input.st-select-row')[0] as HTMLInputElement;
    rowCheck.click();
    expect(table.getSelectedRowIds()).toEqual(['1']);
    expect(host.querySelector('tr[data-row-id="1"]')?.classList.contains('st-selected')).toBe(true);
  });

  it('clicking a cell selects its row; ctrl+click toggles', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    getCell(host, '1', 'name')?.click();
    expect(table.getSelectedRowIds()).toEqual(['1']);
    getCell(host, '2', 'name')?.dispatchEvent(
      new MouseEvent('click', { ctrlKey: true, bubbles: true })
    );
    expect(table.getSelectedRowIds()).toEqual(['1', '2']);
  });

  it('select-all reflects partial selection via indeterminate', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const selectAll = host.querySelector('input.st-select-all') as HTMLInputElement;
    table.selectRow('1');
    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll.checked).toBe(false);
  });

  it('external selection changes are reflected in the DOM', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    table.selectRow('2');
    expect(host.querySelector('tr[data-row-id="2"]')?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('DOMRenderer — sorting', () => {
  it('cycles asc -> desc -> none on header clicks', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const th = host.querySelector('th[data-field="name"]') as HTMLElement;
    th.click();
    expect(table.getSortState()).toEqual({ field: 'name', direction: 'asc' });
    expect(th.classList.contains('st-sort-asc')).toBe(true);
    th.click();
    expect(table.getSortState()).toEqual({ field: 'name', direction: 'desc' });
    th.click();
    expect(table.getSortState()).toEqual({ field: null, direction: null });
  });

  it('non-sortable columns are not click-sortable', () => {
    const localColumns: Column[] = [
      { field: 'name', title: 'Name', sortable: false },
      { field: 'price', title: 'Price' },
    ];
    const table = new SmartTable({ columns: localColumns, data: [{ name: 'a', price: 1 }] });
    const { host } = mountRenderer(table);
    const nameTh = host.querySelector('th[data-field="name"]') as HTMLElement;
    expect(nameTh.classList.contains('st-sortable')).toBe(false);
    nameTh.click();
    expect(table.getSortState().field).toBeNull();
  });
});

describe('DOMRenderer — editing', () => {
  it('dblclick opens an input; Enter commits through the table API', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const cell = getCell(host, '1', 'name');
    cell?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.st-cell-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = 'Webcam';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(table.getRows()[0]?.name).toBe('Webcam');
    expect(getCell(host, '1', 'name')?.textContent).toBe('Webcam');
  });

  it('Escape cancels the edit and restores the cell', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const cell = getCell(host, '1', 'name');
    cell?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.st-cell-input') as HTMLInputElement;
    input.value = 'Changed';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(table.getRows()[0]?.name).toBe('Laptop');
    expect(getCell(host, '1', 'name')?.textContent).toBe('Laptop');
  });

  it('number cells parse numeric input on commit', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const cell = getCell(host, '1', 'id');
    cell?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.st-cell-input') as HTMLInputElement;
    expect(input.type).toBe('number');
    input.value = '42';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(table.getRows()[0]?.id).toBe(42);
  });

  it('boolean cells toggle directly through the table API', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const checkbox = getCell(host, '1', 'inStock')?.querySelector(
      'input.st-boolean'
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    checkbox.click();
    expect(table.getRows()[0]?.inStock).toBe(false);
  });

  it('does not allow editing in readonly mode', () => {
    const table = new SmartTable({ columns, data: makeRows(), editable: false });
    const { host } = mountRenderer(table);
    getCell(host, '1', 'name')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.querySelector('input.st-cell-input')).toBeNull();
  });
});

describe('DOMRenderer — row actions', () => {
  it('renders Edit/Delete in editable mode and deletes on click', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    expect(host.querySelectorAll('[data-st-row-action="edit"]')).toHaveLength(3);
    const deleteBtn = host.querySelector(
      'tr[data-row-id="2"] [data-st-row-action="delete"]'
    ) as HTMLButtonElement;
    deleteBtn.click();
    expect(table.getRowCount()).toBe(2);
    expect(host.querySelector('tr[data-row-id="2"]')).toBeNull();
  });

  it('hides the actions column in readonly mode', () => {
    const table = new SmartTable({ columns, data: makeRows(), editable: false });
    const { host } = mountRenderer(table);
    expect(host.querySelectorAll('[data-st-row-action]')).toHaveLength(0);
    expect(host.querySelectorAll('th.st-th-actions')).toHaveLength(0);
  });

  it('switching to readonly hides actions without a full render loop', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    table.setMode('readonly');
    expect(host.querySelectorAll('[data-st-row-action]')).toHaveLength(0);
    table.setMode('editable');
    expect(host.querySelectorAll('[data-st-row-action]')).toHaveLength(6);
  });
});

describe('DOMRenderer — keyboard navigation', () => {
  it('arrow keys move the active cell between rows', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const cell = getCell(host, '1', 'name') as HTMLElement;
    cell.click();
    const scroll = host.querySelector('.st-scroll') as HTMLElement;
    scroll.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const active = host.querySelector('td.st-active') as HTMLElement;
    expect(active).not.toBeNull();
    expect(active.closest('tr')?.dataset.rowId).toBe('2');
  });

  it('Enter starts editing the active cell', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const cell = getCell(host, '1', 'name') as HTMLElement;
    cell.click();
    const scroll = host.querySelector('.st-scroll') as HTMLElement;
    scroll.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(host.querySelector('input.st-cell-input')).not.toBeNull();
  });
});

describe('DOMRenderer — responsive viewport', () => {
  it('renders cards on mobile and swaps back to a table on resize', () => {
    const table = new SmartTable({ columns, data: makeRows(), responsive: true });
    let width = 400;
    const { host, renderer } = mountRenderer(table, { widthProvider: () => width });
    expect(host.querySelector('.st-cards')).not.toBeNull();
    expect(host.querySelector('.st-card')).not.toBeNull();
    expect(host.querySelector('table.st-table')).toBeNull();
    width = 1200;
    window.dispatchEvent(new Event('resize'));
    expect(host.querySelector('table.st-table')).not.toBeNull();
    expect(host.querySelector('.st-cards')).toBeNull();
    renderer.unmount();
  });

  it('cards reflect selection and editing', () => {
    const table = new SmartTable({ columns, data: makeRows(), responsive: true });
    const { host } = mountRenderer(table, { widthProvider: () => 400 });
    const card = host.querySelector('.st-card') as HTMLElement;
    card.click();
    expect(table.getSelectedRowIds()).toEqual(['1']);
    expect(card.classList.contains('st-selected')).toBe(true);
    const value = card.querySelector('[data-field-value="name"]') as HTMLElement;
    value.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.st-cell-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = 'Webcam';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(table.getRows()[0]?.name).toBe('Webcam');
  });

  it('card actions delete rows', () => {
    const table = new SmartTable({ columns, data: makeRows(), responsive: true });
    const { host } = mountRenderer(table, { widthProvider: () => 400 });
    const deleteBtn = host.querySelector(
      '.st-card [data-st-row-action="delete"]'
    ) as HTMLButtonElement;
    deleteBtn.click();
    expect(table.getRowCount()).toBe(2);
  });
});
