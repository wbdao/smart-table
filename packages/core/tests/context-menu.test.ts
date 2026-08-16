// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { DOMRenderer } from '../src/ui/DOMRenderer';
import type { Column, ContextMenuTarget } from '../src/types';

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

function mountRenderer(table: SmartTable) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const renderer = new DOMRenderer(table, { target: host, toolbar: false });
  renderer.mount();
  return { host, renderer };
}

function rightClick(el: Element | null, x = 100, y = 50): void {
  if (!el) throw new Error('target element missing');
  el.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y })
  );
}

function openMenuItems(host: HTMLElement): string[] {
  const items = Array.from(host.querySelectorAll<HTMLButtonElement>('.st-context-item'));
  return items.map((button) => button.dataset.stMenuItem ?? '');
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('context menu — header', () => {
  it('opens a menu on right-click with sort/hide/reset actions', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="name"]'));
    expect(host.querySelector('.st-context-menu')?.hasAttribute('hidden')).toBe(false);
    expect(openMenuItems(host)).toEqual([
      'sort-asc',
      'sort-desc',
      'clear-sort',
      'hide-column',
      'reset-width',
    ]);
  });

  it('disables sort actions for non-sortable columns', () => {
    const cols: Column[] = [{ field: 'id', title: 'ID', type: 'number', sortable: false }];
    const table = new SmartTable({ columns: cols, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="id"]'));
    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.st-context-item'));
    expect(buttons[0]?.disabled).toBe(true);
    expect(buttons[1]?.disabled).toBe(true);
  });

  it('sorts ascending when sort-asc is chosen', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="name"]'));
    host.querySelector<HTMLButtonElement>('[data-st-menu-item="sort-asc"]')?.click();
    expect(table.getSortState()).toEqual({ field: 'name', direction: 'asc' });
    expect(table.getRows()[0]?.name).toBe('Laptop');
  });

  it('hides the column when hide-column is chosen', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="inStock"]'));
    host.querySelector<HTMLButtonElement>('[data-st-menu-item="hide-column"]')?.click();
    expect(table.getVisibleColumns().map((c) => c.field)).not.toContain('inStock');
  });

  it('resets an explicit column width', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    table.setColumnWidth('name', 180);
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="name"]'));
    const reset = host.querySelector<HTMLButtonElement>('[data-st-menu-item="reset-width"]');
    expect(reset?.disabled).toBe(false);
    reset?.click();
    expect(table.getColumnWidth('name')).toBeUndefined();
  });

  it('disables reset-width when the column has no explicit width', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="name"]'));
    const reset = host.querySelector<HTMLButtonElement>('[data-st-menu-item="reset-width"]');
    expect(reset?.disabled).toBe(true);
  });
});

describe('context menu — cells and rows', () => {
  it('opens a cell menu with copy/edit/delete actions', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('tr[data-row-id="1"] td[data-field="name"]'));
    expect(openMenuItems(host)).toEqual(['copy-cell', 'copy-row', 'edit-cell', 'delete-row']);
  });

  it('deletes the row when delete-row is chosen', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('tr[data-row-id="2"] td[data-field="name"]'));
    host.querySelector<HTMLButtonElement>('[data-st-menu-item="delete-row"]')?.click();
    expect(table.getRowCount()).toBe(2);
    expect(table.getRow('2')).toBeUndefined();
  });

  it('starts in-cell editing when edit-cell is chosen', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('tr[data-row-id="1"] td[data-field="name"]'));
    host.querySelector<HTMLButtonElement>('[data-st-menu-item="edit-cell"]')?.click();
    const input = host.querySelector('tr[data-row-id="1"] td[data-field="name"] input');
    expect(input).not.toBeNull();
  });

  it('opens a row menu when right-clicking a row body', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('tr[data-row-id="1"]'));
    expect(openMenuItems(host)).toEqual(['copy-row', 'delete-row']);
  });

  it('does not offer edit/delete actions in readonly mode', () => {
    const table = new SmartTable({ columns, data: makeRows(), mode: 'readonly' });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('tr[data-row-id="1"] td[data-field="name"]'));
    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.st-context-item'));
    expect(buttons.find((b) => b.dataset.stMenuItem === 'edit-cell')?.disabled).toBe(true);
    expect(buttons.find((b) => b.dataset.stMenuItem === 'delete-row')?.disabled).toBe(true);
  });
});

describe('context menu — configuration and events', () => {
  it('does not open when contextMenu: false', () => {
    const table = new SmartTable({ columns, data: makeRows(), contextMenu: false });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="name"]'));
    expect(host.querySelector('.st-context-menu')?.hasAttribute('hidden')).toBe(true);
  });

  it('appends custom items and runs them with the context', () => {
    const runs: Array<{ target: ContextMenuTarget; field: string | null }> = [];
    const table = new SmartTable({
      columns,
      data: makeRows(),
      contextMenu: {
        items: [
          {
            id: 'custom-meta',
            label: 'Custom action',
            target: 'header',
            run: (context) => runs.push({ target: context.target, field: context.field }),
          },
        ],
      },
    });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="name"]'));
    expect(openMenuItems(host)).toContain('custom-meta');
    host.querySelector<HTMLButtonElement>('[data-st-menu-item="custom-meta"]')?.click();
    expect(runs).toEqual([{ target: 'header', field: 'name' }]);
  });

  it('filters custom items by target', () => {
    const table = new SmartTable({
      columns,
      data: makeRows(),
      contextMenu: {
        items: [{ id: 'only-cell', label: 'Cell only', target: 'cell', run: () => {} }],
      },
    });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="name"]'));
    expect(openMenuItems(host)).not.toContain('only-cell');
  });

  it('emits contextMenu when opening and contextMenuAction when choosing', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    const opened: Array<{ target: ContextMenuTarget; field: string | null; items: string[] }> = [];
    const chosen: Array<{ action: string; target: ContextMenuTarget }> = [];
    table.on('contextMenu', (event) =>
      opened.push({ target: event.target, field: event.field, items: event.items })
    );
    table.on('contextMenuAction', (event) =>
      chosen.push({ action: event.action, target: event.target })
    );
    rightClick(host.querySelector('th[data-field="name"]'));
    expect(opened[0]?.target).toBe('header');
    expect(opened[0]?.field).toBe('name');
    expect(opened[0]?.items).toContain('hide-column');
    host.querySelector<HTMLButtonElement>('[data-st-menu-item="hide-column"]')?.click();
    expect(chosen).toEqual([{ action: 'hide-column', target: 'header' }]);
  });

  it('closes the menu on Escape', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="name"]'));
    const menu = host.querySelector<HTMLElement>('.st-context-menu');
    expect(menu?.hasAttribute('hidden')).toBe(false);
    menu?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu?.hasAttribute('hidden')).toBe(true);
  });

  it('closes the menu on an outside click', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host } = mountRenderer(table);
    rightClick(host.querySelector('th[data-field="name"]'));
    const menu = host.querySelector<HTMLElement>('.st-context-menu');
    expect(menu?.hasAttribute('hidden')).toBe(false);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu?.hasAttribute('hidden')).toBe(true);
  });
});
