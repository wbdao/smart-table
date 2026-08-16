// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { DataManager } from '../src/core/DataManager';
import { ERROR_CODES } from '../src/core/errors';
import { DOMRenderer } from '../src/ui/DOMRenderer';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
];

function makeRows(count = 25) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    price: (i + 1) * 10,
  }));
}

function makeTable(pageSize = 0) {
  const table = new SmartTable({ columns, data: makeRows() });
  if (pageSize > 0) table.setPageSize(pageSize);
  return table;
}

function mountRenderer(table: SmartTable) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const renderer = new DOMRenderer(table, { target: host, toolbar: false });
  renderer.mount();
  return { host, renderer };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('DataManager pagination', () => {
  it('is disabled by default and returns every row', () => {
    const dm = new DataManager(columns);
    dm.setData(makeRows(5));
    expect(dm.getPageSize()).toBe(0);
    expect(dm.getTotalPages()).toBe(1);
    expect(dm.getCurrentPage()).toBe(1);
    expect(dm.getRows()).toHaveLength(5);
  });

  it('slices rows into pages', () => {
    const dm = new DataManager(columns);
    dm.setData(makeRows(25));
    dm.setPageSize(10);
    expect(dm.getTotalPages()).toBe(3);
    expect(dm.getCurrentPage()).toBe(1);
    expect(dm.getRows().map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    dm.nextPage();
    expect(dm.getRows().map((r) => r.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    dm.nextPage();
    expect(dm.getRows().map((r) => r.id)).toEqual([21, 22, 23, 24, 25]);
  });

  it('clamps the current page after setPageSize and setCurrentPage', () => {
    const dm = new DataManager(columns);
    dm.setData(makeRows(25));
    dm.setPageSize(10);
    dm.setCurrentPage(3);
    expect(dm.getCurrentPage()).toBe(3);
    dm.setCurrentPage(99);
    expect(dm.getCurrentPage()).toBe(3);
    dm.setPageSize(100);
    expect(dm.getCurrentPage()).toBe(1);
    expect(dm.getRows()).toHaveLength(25);
  });

  it('rejects negative and non-integer page sizes', () => {
    const dm = new DataManager(columns);
    dm.setData(makeRows(10));
    expect(() => dm.setPageSize(-1)).toThrow(ERROR_CODES.INVALID_PAGE_SIZE);
    expect(() => dm.setPageSize(2.5)).toThrow(ERROR_CODES.INVALID_PAGE_SIZE);
    expect(dm.getPageSize()).toBe(0);
  });

  it('pagination applies after filtering and sorting', () => {
    const dm = new DataManager(columns);
    dm.setData(makeRows(25));
    dm.setPageSize(5);
    dm.sort('name', 'desc');
    const sortedFirstPage = dm.getRows();
    expect(sortedFirstPage).toHaveLength(5);
    expect(sortedFirstPage[0]?.name).toBe('Item 25');
    expect(sortedFirstPage[4]?.name).toBe('Item 21');
    dm.clearSort();
    dm.filter('Item 1');
    dm.setCurrentPage(1);
    expect(dm.getFilteredCount()).toBe(11);
    expect(dm.getTotalPages()).toBe(3);
    expect(dm.getRows().map((r) => r.id)).toEqual([1, 10, 11, 12, 13]);
  });

  it('resets to page 1 when data is replaced', () => {
    const dm = new DataManager(columns);
    dm.setData(makeRows(25));
    dm.setPageSize(10);
    dm.setCurrentPage(2);
    dm.setData(makeRows(5));
    expect(dm.getCurrentPage()).toBe(1);
  });

  it('prevPage does not go below page 1', () => {
    const dm = new DataManager(columns);
    dm.setData(makeRows(25));
    dm.setPageSize(10);
    expect(dm.prevPage()).toBe(false);
    expect(dm.getCurrentPage()).toBe(1);
  });
});

describe('SmartTable pagination', () => {
  it('enables pagination via options.pageSize', () => {
    const table = new SmartTable({ columns, data: makeRows(12), pageSize: 5 });
    expect(table.getPageSize()).toBe(5);
    expect(table.getTotalPages()).toBe(3);
    expect(table.getRows()).toHaveLength(5);
  });

  it('supports goToPage, nextPage and prevPage', () => {
    const table = makeTable(10);
    expect(table.getCurrentPage()).toBe(1);
    expect(table.canGoPrev()).toBe(false);
    expect(table.goToPage(3)).toBe(3);
    expect(table.canGoNext()).toBe(false);
    expect(table.canGoPrev()).toBe(true);
    expect(table.prevPage()).toBe(true);
    expect(table.getCurrentPage()).toBe(2);
    expect(table.nextPage()).toBe(true);
    expect(table.getCurrentPage()).toBe(3);
    expect(table.nextPage()).toBe(false);
  });

  it('clamps goToPage into range', () => {
    const table = makeTable(10);
    expect(table.goToPage(99)).toBe(3);
    expect(table.goToPage(-5)).toBe(1);
  });

  it('emits pageChanged on navigation and setPageSize', () => {
    const table = makeTable(10);
    const listener = vi.fn();
    table.on('pageChanged', listener);
    table.nextPage();
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      page: 2,
      pageSize: 10,
      totalPages: 3,
      rowCount: 10,
      totalCount: 25,
    });
    table.prevPage();
    expect(listener).toHaveBeenCalledTimes(2);
    table.setPageSize(25);
    expect(listener.mock.calls[2]?.[0]).toMatchObject({ page: 1, totalPages: 1 });
  });

  it('does not emit pageChanged when navigation is a no-op', () => {
    const table = makeTable(10);
    const listener = vi.fn();
    table.on('pageChanged', listener);
    expect(table.prevPage()).toBe(false);
    table.goToPage(3);
    listener.mockClear();
    expect(table.nextPage()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('resets to page 1 when a filter is applied', () => {
    const table = makeTable(10);
    table.goToPage(2);
    table.filter('Item 1');
    expect(table.getCurrentPage()).toBe(1);
    expect(table.getTotalPages()).toBe(2);
    expect(table.getFilteredCount()).toBe(11);
  });

  it('clears history-free view on setData and resets the page', () => {
    const table = makeTable(10);
    table.goToPage(2);
    table.setData(makeRows(5));
    expect(table.getCurrentPage()).toBe(1);
    expect(table.getTotalPages()).toBe(1);
  });

  it('clamps the page after deleting rows', () => {
    const table = makeTable(10);
    table.goToPage(3);
    for (let i = 25; i > 20; i--) table.removeRow(String(i));
    expect(table.getCurrentPage()).toBe(2);
    expect(table.getRows().map((r) => r.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('throws INVALID_PAGE_SIZE for bad sizes via the table API', () => {
    const table = makeTable();
    expect(() => table.setPageSize(-1)).toThrow(ERROR_CODES.INVALID_PAGE_SIZE);
  });

  it('updateCell on a hidden-page row still works', () => {
    const table = makeTable(10);
    table.updateCell('25', 'price', 999);
    expect(table.getRow('25')?.price).toBe(999);
    expect(table.getRows().map((r) => r.id)).not.toContain(25);
  });
});

describe('pagination UI', () => {
  it('renders only the active page rows', () => {
    const table = makeTable(5);
    const { host } = mountRenderer(table);
    expect(host.querySelectorAll('tbody tr.st-row')).toHaveLength(5);
    expect(host.querySelector('tbody tr.st-row td[data-field="id"]')?.textContent).toBe('1');
  });

  it('re-renders when the page changes', () => {
    const table = makeTable(5);
    const { host } = mountRenderer(table);
    table.nextPage();
    expect(host.querySelectorAll('tbody tr.st-row')).toHaveLength(5);
    expect(host.querySelector('tbody tr.st-row td[data-field="id"]')?.textContent).toBe('6');
  });

  it('toolbar pagination control navigates pages', () => {
    const table = makeTable(10);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const renderer = new DOMRenderer(table, {
      target: host,
      toolbar: true,
      toolbarControls: ['pagination'],
    });
    renderer.mount();
    const info = host.querySelector<HTMLSpanElement>('.st-pager-info');
    const prev = host.querySelector<HTMLButtonElement>('.st-pager-prev');
    const next = host.querySelector<HTMLButtonElement>('.st-pager-next');
    expect(info?.textContent).toBe('Page 1 / 3');
    expect(prev?.disabled).toBe(true);
    next?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(info?.textContent).toBe('Page 2 / 3');
    expect(prev?.disabled).toBe(false);
    prev?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(info?.textContent).toBe('Page 1 / 3');
    renderer.unmount();
  });
});
