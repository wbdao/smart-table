import type { SmartTable } from '@smart-table/core';
import type { ChartConfig, ChartKind, SeriesSpec } from './types';

export interface SeriesOptions {
  /** Column used to build the category labels. */
  x: string;
  /** One spec per drawn series. */
  series: SeriesSpec[];
  /** Chart type (default `'bar'`). */
  kind?: ChartKind;
}

const AGGREGATIONS: Record<NonNullable<SeriesSpec['aggregate']>, (values: number[]) => number> = {
  sum: (v) => v.reduce((a, b) => a + b, 0),
  avg: (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0),
  min: (v) => (v.length ? Math.min(...v) : 0),
  max: (v) => (v.length ? Math.max(...v) : 0),
  count: (v) => v.length,
};

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Groups rows by the `x` field and aggregates every series column. */
export function deriveSeries(table: SmartTable, options: SeriesOptions): ChartConfig {
  const { x, series } = options;
  const kind = options.kind ?? 'bar';

  const labels: string[] = [];
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of table.getData() as Array<Record<string, unknown>>) {
    const label = String(row[x] ?? '');
    if (!groups.has(label)) {
      groups.set(label, []);
      labels.push(label);
    }
    groups.get(label)!.push(row);
  }

  const resolved = series.map((spec) => {
    const name = spec.label ?? spec.field;
    const aggregate =
      spec.aggregate ?? (labels.some((l) => groups.get(l)!.length > 1) ? 'sum' : undefined);
    const data = labels.map((label) => {
      const values = groups.get(label)!.map((row) => numberValue(row[spec.field]));
      return aggregate ? AGGREGATIONS[aggregate](values) : (values[0] ?? 0);
    });
    return { name, data };
  });

  return { kind, labels, series: resolved };
}
