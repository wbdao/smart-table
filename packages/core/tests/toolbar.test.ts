// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { Toolbar } from '../src/ui/Toolbar';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
];

const rows = [
  { id: 1, name: 'Laptop' },
  { id: 2, name: 'Mouse' },
  { id: 3, name: 'Monitor' },
];

function mountToolbar(table: SmartTable, options = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const toolbar = new Toolbar({ table, searchDelay: 0, ...options });
  host.appendChild(toolbar.element);
  return { host, toolbar };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('Toolbar', () => {
  it('renders the default controls', () => {
    const table = new SmartTable({ columns });
    const { toolbar, host } = mountToolbar(table);
    expect(host.querySelector('input.st-toolbar-search')).not.toBeNull();
    expect(host.querySelectorAll('button.st-toolbar-btn')).toHaveLength(5);
    toolbar.destroy();
  });

  it('search filters the table and emits toolbar:search', async () => {
    const table = new SmartTable({ columns, data: rows });
    const { toolbar, host } = mountToolbar(table);
    const handler = vi.fn();
    table.on('toolbar:search', handler);
    const input = host.querySelector('input.st-toolbar-search') as HTMLInputElement;
    input.value = 'monitor';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(table.getViewCount()).toBe(1);
    expect(handler).toHaveBeenCalledWith({ query: 'monitor' });
    toolbar.destroy();
  });

  it('copy emits toolbar:copy and copied', async () => {
    const table = new SmartTable({ columns, data: rows });
    const { toolbar, host } = mountToolbar(table);
    const toolbarHandler = vi.fn();
    const copiedHandler = vi.fn();
    table.on('toolbar:copy', toolbarHandler);
    table.on('copied', copiedHandler);
    const button = Array.from(host.querySelectorAll('button')).find(
      (b) => b.dataset.stControl === 'copy'
    ) as HTMLButtonElement;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toolbarHandler).toHaveBeenCalledWith({ format: 'text' });
    expect(copiedHandler).toHaveBeenCalledTimes(1);
    toolbar.destroy();
  });

  it('clone emits toolbar:clone and cloned with an independent table', async () => {
    const table = new SmartTable({ columns, data: rows });
    const { toolbar, host } = mountToolbar(table);
    const handler = vi.fn();
    table.on('toolbar:clone', handler);
    const button = Array.from(host.querySelectorAll('button')).find(
      (b) => b.dataset.stControl === 'clone'
    ) as HTMLButtonElement;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const payload = handler.mock.calls[0]?.[0];
    expect(payload.clone).not.toBe(table);
    expect(payload.clone.getRowCount()).toBe(3);
    toolbar.destroy();
  });

  it('add row appends a row and emits toolbar:add', () => {
    const table = new SmartTable({ columns, data: rows });
    const { toolbar, host } = mountToolbar(table);
    const handler = vi.fn();
    table.on('toolbar:add', handler);
    const button = Array.from(host.querySelectorAll('button')).find(
      (b) => b.dataset.stControl === 'add'
    ) as HTMLButtonElement;
    button.click();
    expect(table.getRowCount()).toBe(4);
    const payload = handler.mock.calls[0]?.[0];
    expect(payload.rowId).toMatch(/^row-\d+$/);
    expect(payload.rowIndex).toBe(3);
    toolbar.destroy();
  });

  it('add row is disabled in readonly mode', () => {
    const table = new SmartTable({ columns, data: rows, editable: false });
    const { toolbar, host } = mountToolbar(table);
    const button = Array.from(host.querySelectorAll('button')).find(
      (b) => b.dataset.stControl === 'add'
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    toolbar.destroy();
  });

  it('mode button toggles the mode and emits toolbar:mode', () => {
    const table = new SmartTable({ columns });
    const { toolbar, host } = mountToolbar(table);
    const handler = vi.fn();
    table.on('toolbar:mode', handler);
    const button = Array.from(host.querySelectorAll('button')).find(
      (b) => b.dataset.stControl === 'mode'
    ) as HTMLButtonElement;
    expect(button.textContent).toBe('Read only');
    button.click();
    expect(table.getMode()).toBe('readonly');
    expect(handler).toHaveBeenCalledWith({ mode: 'readonly' });
    button.click();
    expect(table.getMode()).toBe('editable');
    toolbar.destroy();
  });

  it('respects a custom controls list', () => {
    const table = new SmartTable({ columns });
    const { toolbar, host } = mountToolbar(table, { controls: ['search', 'copy'] });
    expect(host.querySelectorAll('button.st-toolbar-btn')).toHaveLength(1);
    toolbar.destroy();
  });

  it('columns control opens a picker and hides/shows columns', () => {
    const table = new SmartTable({ columns, data: rows });
    const { toolbar, host } = mountToolbar(table);
    const button = Array.from(host.querySelectorAll('button')).find(
      (b) => b.dataset.stControl === 'columns'
    ) as HTMLButtonElement;
    const picker = host.querySelector('.st-column-picker') as HTMLElement;
    expect(picker.hidden).toBe(true);
    button.click();
    expect(picker.hidden).toBe(false);
    expect(picker.querySelectorAll('.st-column-toggle')).toHaveLength(2);
    const nameToggle = picker.querySelector('input[data-field="name"]') as HTMLInputElement;
    nameToggle.click();
    expect(table.isColumnVisible('name')).toBe(false);
    expect(table.getVisibleColumns().map((c) => c.field)).toEqual(['id']);
    const nameToggleAgain = picker.querySelector('input[data-field="name"]') as HTMLInputElement;
    nameToggleAgain.click();
    expect(table.isColumnVisible('name')).toBe(true);
    button.click();
    expect(picker.hidden).toBe(true);
    toolbar.destroy();
  });

  it('columns picker closes on Escape', () => {
    const table = new SmartTable({ columns });
    const { toolbar, host } = mountToolbar(table);
    const button = Array.from(host.querySelectorAll('button')).find(
      (b) => b.dataset.stControl === 'columns'
    ) as HTMLButtonElement;
    button.click();
    const picker = host.querySelector('.st-column-picker') as HTMLElement;
    expect(picker.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(picker.hidden).toBe(true);
    toolbar.destroy();
  });
});
