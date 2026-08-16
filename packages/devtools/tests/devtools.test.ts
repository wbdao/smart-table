/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { SmartTable, type DataRow } from '@smart-table/core';
import { attachDevTools, detachDevTools } from '../src/index';

const columns: Array<{ field: string; header: string }> = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'age', header: 'Age' },
];

const rows: DataRow[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  name: `User ${String.fromCharCode(65 + (i % 26))}${i}`,
  age: 20 + (i % 40),
}));

let el: HTMLDivElement;

beforeEach(() => {
  el = document.createElement('div');
  document.body.appendChild(el);
});

function makeTable(options: { pageSize?: number } = {}): SmartTable {
  return new SmartTable({ columns, data: rows, container: el, pageSize: options.pageSize ?? 10 });
}

describe('attachDevTools', () => {
  it('mounts a panel into the table container and shows a snapshot', () => {
    const table = makeTable({ pageSize: 10 });
    const dev = attachDevTools(table);
    expect(el.querySelector('.sdt-root')).toBeTruthy();
    const snap = dev.getSnapshot();
    expect(snap.pageSize).toBe(10);
    expect(snap.rows).toBe(25);
    expect(snap.totalPages).toBe(3);
    expect(snap.page).toBe(1);
    expect(snap.mode).toBe('editable');
    expect(dev.panel.hidden).toBe(false);
    dev.destroy();
  });

  it('falls back to document.body when the table has no container', () => {
    const table = new SmartTable({ columns, data: rows });
    const dev = attachDevTools(table);
    expect(document.body.querySelector('.sdt-root')).toBeTruthy();
    dev.destroy();
    expect(document.body.querySelector('.sdt-root')).toBeNull();
  });

  it('is idempotent: repeated attach returns the same controller', () => {
    const table = makeTable();
    const a = attachDevTools(table);
    const b = attachDevTools(table);
    expect(a).toBe(b);
    expect(document.body.querySelectorAll('.sdt-root').length).toBe(1);
    a.destroy();
  });

  it('tracks events: dataChanged and event tally', () => {
    const table = makeTable();
    const dev = attachDevTools(table);
    const before = dev.getSnapshot().eventTotal;
    table.setData(rows.slice(0, 5));
    const snap = dev.getSnapshot();
    expect(snap.eventTotal).toBeGreaterThan(before);
    expect(snap.eventTally['dataChanged'] ?? 0).toBeGreaterThan(0);
    expect(snap.rows).toBe(5);
    dev.destroy();
  });

  it('reflects selection, sort and filter state', () => {
    const table = makeTable();
    const dev = attachDevTools(table);
    table.selectRow(1);
    table.sort('name', 'asc');
    table.where('name', 'contains', 'a');
    const snap = dev.getSnapshot();
    expect(snap.selectionCount).toBe(1);
    expect(snap.sortField).toBe('name');
    expect(snap.sortDirection).toBe('asc');
    expect(snap.hasActiveFilter).toBe(true);
    expect(snap.columnFilterCount).toBeGreaterThan(0);
    expect(snap.filteredCount).toBeLessThan(25);
    dev.destroy();
  });

  it('records viewport changes emitted by the table bus', () => {
    const table = makeTable();
    const dev = attachDevTools(table);
    table.events.emit('viewportChanged', {
      startIndex: 0,
      endIndex: 9,
      scrollTop: 120,
      viewportHeight: 300,
      firstVisibleRow: null,
      lastVisibleRow: null,
    });
    const snap = dev.getSnapshot();
    expect(snap.viewport).toEqual({ startIndex: 0, endIndex: 9 });
    dev.destroy();
  });

  it('caps the event stream at maxEvents', () => {
    const table = makeTable();
    const dev = attachDevTools(table, { maxEvents: 5 });
    table.events.emit('sortChanged', { field: 'name', direction: 'asc', column: null });
    table.events.emit('sortChanged', { field: 'name', direction: 'desc', column: null });
    table.events.emit('sortChanged', { field: 'age', direction: 'asc', column: null });
    table.events.emit('sortChanged', { field: 'age', direction: 'desc', column: null });
    table.events.emit('sortChanged', { field: 'id', direction: 'asc', column: null });
    table.events.emit('sortChanged', { field: 'id', direction: 'desc', column: null });
    expect(dev.getSnapshot().eventStream.length).toBeLessThanOrEqual(5);
    dev.destroy();
  });

  it('destroy removes the panel and detaches listeners', () => {
    const table = makeTable();
    const dev = attachDevTools(table);
    dev.destroy();
    expect(el.querySelector('.sdt-root')).toBeNull();
    const before = dev.getSnapshot().eventTotal;
    table.setData(rows.slice(0, 3));
    expect(dev.getSnapshot().eventTotal).toBe(before);
  });

  it('detachDevTools cleans up and show/hide/toggle work', () => {
    const table = makeTable();
    const dev = attachDevTools(table);
    dev.hide();
    expect(dev.panel.hidden).toBe(true);
    dev.toggle();
    expect(dev.panel.hidden).toBe(false);
    dev.toggle();
    expect(dev.panel.hidden).toBe(true);
    dev.show();
    expect(dev.panel.hidden).toBe(false);
    detachDevTools(table);
    expect(el.querySelector('.sdt-root')).toBeNull();
    expect(attachDevTools(table).panel.hidden).toBe(false);
    detachDevTools(table);
  });
});
