import type { DataRow } from '../../types/column';
import { SmartTableError, ERROR_CODES } from '../../core/errors';

/** Built-in aggregation operations. */
export type AggregationOp = 'sum' | 'avg' | 'count' | 'min' | 'max';

export const AGGREGATION_OPS: readonly AggregationOp[] = ['sum', 'avg', 'count', 'min', 'max'];

/** Aggregation config: column field -> operation (or custom function). */
export type AggregateConfig = Record<
  string,
  AggregationOp | ((rows: DataRow[]) => number | string)
>;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** Aggregates a single field over a row set with a built-in operation. */
export function aggregate(rows: DataRow[], field: string, op: AggregationOp): number | string {
  let count = 0;
  let sum = 0;
  let min: number | null = null;
  let max: number | null = null;
  for (const row of rows) {
    const value = toNumber(row[field]);
    if (value === null) continue;
    count += 1;
    sum += value;
    if (min === null || value < min) min = value;
    if (max === null || value > max) max = value;
  }
  switch (op) {
    case 'count':
      return count;
    case 'sum':
      return sum;
    case 'avg':
      return count === 0 ? 0 : sum / count;
    case 'min':
      return min ?? 0;
    case 'max':
      return max ?? 0;
  }
}

/** Validates that every config value is a known operation or a function. */
export function isValidAggregateConfig(config: unknown): boolean {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) return false;
  return Object.values(config).every(
    (value) =>
      typeof value === 'function' ||
      (typeof value === 'string' && AGGREGATION_OPS.includes(value as AggregationOp))
  );
}

/**
 * Computes every aggregation in the config over a row set. Custom functions
 * receive the rows and return a number or string.
 */
export function aggregateRows(
  rows: DataRow[],
  config: AggregateConfig
): Record<string, number | string> {
  const result: Record<string, number | string> = {};
  for (const [field, op] of Object.entries(config)) {
    if (typeof op === 'function') {
      result[field] = op(rows);
      continue;
    }
    result[field] = aggregate(rows, field, op);
  }
  return result;
}

/** Throws `INVALID_AGGREGATION` when the config is malformed. */
export function assertValidAggregateConfig(config: unknown): asserts config is AggregateConfig {
  if (!isValidAggregateConfig(config)) {
    throw new SmartTableError(
      ERROR_CODES.INVALID_AGGREGATION,
      'Invalid aggregation config: expected Record<field, "sum" | "avg" | "count" | "min" | "max" | fn>.'
    );
  }
}
