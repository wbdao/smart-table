/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { eventLogPlugin, type EventLogEntry } from '../src/plugins/event-log';
import { summarizeRows, summaryFooterPlugin } from '../src/plugins/summary-footer';

const COLUMNS = [
  { field: 'name', type: 'string' as const },
  { field: 'price', type: 'number' as const },
];
const ROWS = [
  { name: 'Laptop', price: 1200 },
  { name: 'Mouse', price: 25 },
];

describe('summarizeRows', () => {
  it('computes sums, averages, min, max and counts', () => {
    const result = summarizeRows(ROWS, { price: 'sum' });
    expect(result.price).toBe('1,225');

    expect(summarizeRows(ROWS, { price: 'avg' }).price).toBe('612.5');
    expect(summarizeRows(ROWS, { price: 'min' }).price).toBe('25');
    expect(summarizeRows(ROWS, { price: 'max' }).price).toBe('1,200');
    expect(summarizeRows(ROWS, { price: 'count' }).price).toBe('2');
  });

  it('renders a dash for fields with no numeric values', () => {
    expect(summarizeRows([{ name: 'X' }], { price: 'sum' }).price).toBe('—');
  });
});

describe('eventLogPlugin', () => {
  it('records events and forwards them to a callback', () => {
    const seen: EventLogEntry[] = [];
    const table = new SmartTable({ columns: COLUMNS, data: ROWS });
    const log = eventLogPlugin({ onEvent: (entry) => seen.push(entry) });
    table.use(log);

    table.sort('price', 'desc');

    const entries = log.getEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.event === 'sortChanged')).toBe(true);
    expect(seen.length).toBe(entries.length);
  });

  it('stops recording after uninstall and clears its history', () => {
    const table = new SmartTable({ columns: COLUMNS, data: ROWS });
    const log = eventLogPlugin();
    table.use(log);

    table.sort('price', 'desc');
    const before = log.getEntries().length;
    expect(before).toBeGreaterThan(0);

    table.unuse('event-log');
    table.sort('name', 'asc');
    expect(log.getEntries()).toEqual([]);
  });

  it('clear() empties recorded entries while keeping the subscription', () => {
    const table = new SmartTable({ columns: COLUMNS, data: ROWS });
    const log = eventLogPlugin();
    table.use(log);
    table.sort('name', 'asc');
    expect(log.getEntries().length).toBeGreaterThan(0);

    log.clear();
    expect(log.getEntries()).toEqual([]);
    table.sort('price', 'asc');
    expect(log.getEntries().some((entry) => entry.event === 'sortChanged')).toBe(true);
  });
});

describe('summaryFooterPlugin', () => {
  it('paints counts and sums into the container and updates on filter changes', () => {
    const container = document.createElement('div');
    const table = new SmartTable({ columns: COLUMNS, data: ROWS, container });
    table.use(summaryFooterPlugin({ fields: { price: 'sum' } }));

    const footer = container.querySelector<HTMLElement>('.st-plugin-summary');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('2 rows');
    expect(footer?.textContent).toContain('price: 1,225');

    table.filter('laptop');
    expect(footer?.textContent).toContain('1 rows');
    expect(footer?.textContent).toContain('price: 1,200');
  });

  it('derives numeric fields when none are configured', () => {
    const container = document.createElement('div');
    const table = new SmartTable({ columns: COLUMNS, data: ROWS, container });
    table.use(summaryFooterPlugin());
    const footer = container.querySelector<HTMLElement>('.st-plugin-summary');
    expect(footer?.textContent).toContain('price: 1,225');
  });

  it('removes its footer on uninstall', () => {
    const container = document.createElement('div');
    const table = new SmartTable({ columns: COLUMNS, data: ROWS, container });
    table.use(summaryFooterPlugin({ fields: { price: 'sum' } }));
    expect(container.querySelector('.st-plugin-summary')).not.toBeNull();

    table.unuse('summary-footer');
    expect(container.querySelector('.st-plugin-summary')).toBeNull();
  });

  it('installs gracefully on a headless table (no container)', () => {
    const table = new SmartTable({ columns: COLUMNS, data: ROWS });
    const onEvent = vi.fn();
    table.use(eventLogPlugin());
    expect(() => table.use(summaryFooterPlugin())).not.toThrow();
    table.sort('price', 'desc');
    expect(onEvent).toBeDefined();
  });
});
