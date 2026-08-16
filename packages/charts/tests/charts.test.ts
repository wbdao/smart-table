/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { SmartTable, type DataRow } from '@smart-table/core';
import { createTableChart, deriveSeries, registerChartLibrary, chartLibrary } from '../src/index';
import type { ChartBridge, ChartConfig } from '../src/index';

const columns = [
  { field: 'name', header: 'Name' },
  { field: 'region', header: 'Region' },
  { field: 'revenue', header: 'Revenue' },
];

const rows: DataRow[] = [
  { name: 'Alpha', region: 'EU', revenue: 100 },
  { name: 'Beta', region: 'EU', revenue: 60 },
  { name: 'Gamma', region: 'US', revenue: 40 },
];

function makeTable(): SmartTable {
  return new SmartTable({ columns, data: rows.map((r) => ({ ...r })) });
}

function spyBridge() {
  const created: ChartConfig[] = [];
  const updated: ChartConfig[] = [];
  const destroyed: unknown[] = [];
  let instance = 0;
  const bridge: ChartBridge = {
    create(el, config) {
      created.push(config);
      return { id: ++instance, el };
    },
    update(inst, config) {
      updated.push(config);
    },
    destroy(inst) {
      destroyed.push(inst);
    },
  };
  return { bridge, created, updated, destroyed };
}

describe('deriveSeries', () => {
  it('builds labels and one series per spec', () => {
    const config = deriveSeries(makeTable(), { x: 'name', series: [{ field: 'revenue' }] });
    expect(config.labels).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(config.series).toHaveLength(1);
    expect(config.series[0]!.name).toBe('revenue');
    expect(config.series[0]!.data).toEqual([100, 60, 40]);
    expect(config.kind).toBe('bar');
  });

  it('defaults to sum aggregation when a label repeats', () => {
    const config = deriveSeries(makeTable(), { x: 'region', series: [{ field: 'revenue' }] });
    expect(config.labels).toEqual(['EU', 'US']);
    expect(config.series[0]!.data).toEqual([160, 40]);
  });

  it('respects explicit aggregations', () => {
    const config = deriveSeries(makeTable(), {
      x: 'region',
      series: [{ field: 'revenue', aggregate: 'avg' }],
    });
    expect(config.series[0]!.data).toEqual([80, 40]);
  });
});

describe('createTableChart', () => {
  it('creates a chart through a registered library', () => {
    const { bridge, created, destroyed } = spyBridge();
    registerChartLibrary('chart.js', bridge);
    const table = makeTable();
    const chart = createTableChart(table, {
      library: 'chart.js',
      x: 'name',
      series: [{ field: 'revenue' }],
    });
    expect(created).toHaveLength(1);
    expect(created[0]!.labels).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(chart.config().series[0]!.data).toEqual([100, 60, 40]);
    expect(chart.handle.library).toBe('chart.js');
    expect(table.getContainer()).toBeNull();
    chart.destroy();
    expect(destroyed).toHaveLength(1);
  });

  it('accepts an inline bridge without registration', () => {
    const { bridge, created } = spyBridge();
    const chart = createTableChart(makeTable(), {
      library: bridge,
      x: 'region',
      series: [{ field: 'revenue' }],
    });
    expect(created[0]!.series[0]!.data).toEqual([160, 40]);
    expect(chart.handle.library).toBe('inline');
    chart.destroy();
  });

  it('throws for an unknown library name', () => {
    expect(() =>
      createTableChart(makeTable(), { library: 'nope', x: 'name', series: [{ field: 'revenue' }] })
    ).toThrow(/no chart library "nope"/);
  });

  it('auto-updates on dataChanged', () => {
    const { bridge, updated } = spyBridge();
    const table = makeTable();
    const chart = createTableChart(table, {
      library: bridge,
      x: 'name',
      series: [{ field: 'revenue' }],
    });
    table.setData([{ name: 'Zeta', region: 'APAC', revenue: 999 }]);
    expect(updated).toHaveLength(1);
    expect(updated[0]!.labels).toEqual(['Zeta']);
    expect(updated[0]!.series[0]!.data).toEqual([999]);
    chart.destroy();
  });

  it('applies a transform before rendering', () => {
    const { bridge, created } = spyBridge();
    const chart = createTableChart(makeTable(), {
      library: bridge,
      x: 'name',
      series: [{ field: 'revenue' }],
      kind: 'pie',
      transform: (c) => ({ ...c, kind: 'doughnut' as const }),
    });
    expect(created[0]!.kind).toBe('doughnut');
    chart.destroy();
  });

  it('stops listening and tears down on destroy', () => {
    const { bridge, updated, destroyed } = spyBridge();
    const table = makeTable();
    const chart = createTableChart(makeTable(), {
      library: bridge,
      x: 'name',
      series: [{ field: 'revenue' }],
    });
    chart.destroy();
    table.setData([{ name: 'Only', region: 'X', revenue: 1 }]);
    expect(updated).toHaveLength(0);
    expect(destroyed).toHaveLength(1);
  });

  it('chartLibrary helper builds a named bridge pair', () => {
    const { bridge } = spyBridge();
    const lib = chartLibrary('echarts', bridge);
    expect(lib.name).toBe('echarts');
    expect(lib.bridge).toBe(bridge);
  });
});
