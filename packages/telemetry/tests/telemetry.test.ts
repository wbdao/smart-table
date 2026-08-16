/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { SmartTable, type Column, type DataRow } from '@smart-table/core';
import { attachTelemetry, detachTelemetry } from '../src/index';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
];

const rows: DataRow[] = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `row ${(i % 5) + 1}`,
}));

function makeTable(): { table: SmartTable; el: HTMLDivElement } {
  const el = document.createElement('div');
  const table = new SmartTable({ columns, data: rows, container: el });
  return { table, el };
}

const tick = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('attachTelemetry', () => {
  it('counts events and records mount + render timing', async () => {
    const { table } = makeTable();
    attachTelemetry(table);
    table.mount();
    table.setData([{ id: 1, name: 'x' }]);
    await tick();

    const m = table.getMetrics();
    expect(m.events.total).toBeGreaterThan(0);
    expect(m.events.byEvent['dataChanged']).toBeGreaterThan(0);
    expect(m.mount.mounted).toBe(true);
    expect(typeof m.mount.mountMs).toBe('number');
    expect(m.render.samples).toBeGreaterThanOrEqual(1);
    expect(typeof m.render.lastMs).toBe('number');
    expect(m.update.updates).toBeGreaterThanOrEqual(1);
  });

  it('augments the instance with enable/disable/getMetrics', () => {
    const { table } = makeTable();
    attachTelemetry(table);
    expect(typeof table.getMetrics).toBe('function');
    expect(typeof table.enableTelemetry).toBe('function');
    expect(typeof table.disableTelemetry).toBe('function');
  });

  it('stays silent while disabled and resumes when enabled', async () => {
    const { table } = makeTable();
    const handle = attachTelemetry(table);
    table.mount();
    await tick();

    const frozen = handle.getMetrics().events.total;
    table.disableTelemetry();
    table.setData([{ id: 99, name: 'silent' }]);
    await tick();
    expect(handle.getMetrics().events.total).toBe(frozen);

    table.enableTelemetry();
    table.setData([{ id: 100, name: 'audible' }]);
    await tick();
    expect(handle.getMetrics().events.total).toBeGreaterThan(frozen);
  });

  it('is idempotent — attaching twice does not double count', async () => {
    const { table } = makeTable();
    attachTelemetry(table);
    attachTelemetry(table);
    table.mount();
    table.setData([{ id: 1, name: 'x' }]);
    await tick();
    expect(table.getMetrics().events.byEvent['dataChanged']).toBe(1);
  });

  it('captures grouping metrics from groupBy', async () => {
    const { table } = makeTable();
    attachTelemetry(table);
    table.mount();
    table.groupBy('name');
    await tick();

    const m = table.getMetrics();
    expect(m.grouping.groupings).toBeGreaterThan(0);
    expect(m.grouping.field).toBe('name');
  });

  it('reports memory (or null when the runtime lacks performance.memory)', () => {
    const { table } = makeTable();
    attachTelemetry(table);
    const m = table.getMetrics();
    expect(m.memory === null || typeof m.memory!.usedJSHeapSize === 'number').toBe(true);
  });

  it('detachTelemetry stops collection and clears instance methods', async () => {
    const { table } = makeTable();
    const handle = attachTelemetry(table);
    table.mount();
    await tick();

    const before = handle.getMetrics().events.total;
    detachTelemetry(table);
    expect((table as unknown as Record<string, unknown>).getMetrics).toBeUndefined();

    table.setData([{ id: 1, name: 'x' }]);
    await tick();
    expect(handle.getMetrics().events.total).toBe(before);
  });
});
