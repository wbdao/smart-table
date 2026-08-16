import type { DataRow } from '../../types/column';
import { SmartTableError, ERROR_CODES } from '../../core/errors';
import { aggregate, AGGREGATION_OPS, type AggregationOp } from '../aggregation/aggregations';

export interface PivotValue {
  /** Column field to aggregate. */
  field: string;
  aggregation: AggregationOp;
}

export interface PivotConfig {
  /** Fields whose values become row dimensions. */
  rows: string[];
  /** Fields whose values become column dimensions. */
  columns: string[];
  /** Aggregations to compute at each intersection. */
  values: PivotValue[];
}

/** A single cell in a pivot grid. */
export interface PivotCell {
  columnKey: string[];
  value: number | string;
}

/** A single pivot row: its dimension key plus one cell per column combination. */
export interface PivotRow {
  rowKey: string[];
  cells: PivotCell[];
}

/** Validates a pivot config shape (fields must exist in `columns`). */
export function assertValidPivotConfig(
  config: PivotConfig,
  availableFields: ReadonlySet<string>
): void {
  const valid =
    config !== null &&
    typeof config === 'object' &&
    Array.isArray(config.rows) &&
    Array.isArray(config.columns) &&
    Array.isArray(config.values) &&
    (config.rows.length > 0 || config.columns.length > 0) &&
    config.values.length > 0 &&
    config.rows.every((field) => availableFields.has(field)) &&
    config.columns.every((field) => availableFields.has(field)) &&
    config.values.every(
      (v) =>
        v !== null &&
        typeof v === 'object' &&
        typeof v.field === 'string' &&
        AGGREGATION_OPS.includes(v.aggregation) &&
        availableFields.has(v.field)
    );
  if (!valid) {
    throw new SmartTableError(
      ERROR_CODES.INVALID_PIVOT_CONFIG,
      'Invalid pivot config: expected { rows, columns, values } with known fields and aggregation operations.'
    );
  }
}

const joinKey = (a: string[], b: string[]): string => `${a.join('\u0001')}|${b.join('\u0001')}`;

/**
 * Headless Excel-like pivot engine. Groups rows by the `rows` + `columns`
 * dimension combinations and computes the configured aggregations at every
 * intersection. Pure and DOM-free — the renderer consumes {@link PivotResult}.
 */
export class PivotEngine {
  /** Computes a pivot result over a row set. */
  static compute(rows: DataRow[], config: PivotConfig): PivotResult {
    return new PivotEngine(rows, config).compute();
  }

  private readonly buckets = new Map<string, DataRow[]>();
  private readonly rowKeys: string[][] = [];
  private readonly columnKeys: string[][] = [];
  private readonly rowSeen = new Set<string>();
  private readonly columnSeen = new Set<string>();

  private constructor(
    private readonly rows: DataRow[],
    private readonly config: PivotConfig
  ) {}

  compute(): PivotResult {
    const { rows, columns } = this.config;
    for (const row of this.rows) {
      const rowKey = rows.map((f) => String(row[f] ?? ''));
      const columnKey = columns.map((f) => String(row[f] ?? ''));
      const rowId = rowKey.join('\u0001');
      const columnId = columnKey.join('\u0001');
      if (!this.rowSeen.has(rowId)) {
        this.rowSeen.add(rowId);
        this.rowKeys.push(rowKey);
      }
      if (!this.columnSeen.has(columnId)) {
        this.columnSeen.add(columnId);
        this.columnKeys.push(columnKey);
      }
      const bucketKey = joinKey(rowKey, columnKey);
      const bucket = this.buckets.get(bucketKey);
      if (bucket) bucket.push(row);
      else this.buckets.set(bucketKey, [row]);
    }
    return new PivotResult(this.config, this.rowKeys, this.columnKeys, this.buckets);
  }
}

/** The computed pivot grid. Immutable-ish accessor view over the result. */
export class PivotResult {
  constructor(
    readonly config: PivotConfig,
    readonly rowKeys: string[][],
    readonly columnKeys: string[][],
    private readonly buckets: Map<string, DataRow[]>
  ) {}

  /** Unique row dimension combinations, in first-appearance order. */
  getRowKeys(): string[][] {
    return this.rowKeys.map((k) => [...k]);
  }

  /** Unique column dimension combinations, in first-appearance order. */
  getColumnKeys(): string[][] {
    return this.columnKeys.map((k) => [...k]);
  }

  /**
   * The aggregated value for a row/column intersection and a value field.
   * Returns `undefined` when no rows matched the combination.
   */
  getValue(
    rowKey: string[],
    columnKey: string[],
    field: string,
    aggregation: AggregationOp
  ): number | string | undefined {
    const bucket = this.buckets.get(joinKey(rowKey, columnKey));
    if (!bucket || bucket.length === 0) return undefined;
    return aggregate(bucket, field, aggregation);
  }

  /** Serializes the grid into an array of rows with their cells. */
  rows(): PivotRow[] {
    return this.rowKeys.map((rowKey) => ({
      rowKey: [...rowKey],
      cells: this.columnKeys.map((columnKey) => ({
        columnKey: [...columnKey],
        value:
          this.getValue(
            rowKey,
            columnKey,
            this.config.values[0]?.field ?? '',
            this.config.values[0]?.aggregation ?? 'count'
          ) ?? 0,
      })),
    }));
  }

  /** A plain-object snapshot (safe for JSON serialization / state export). */
  toJSON(): {
    config: PivotConfig;
    rowKeys: string[][];
    columnKeys: string[][];
    cells: Array<{ rowKey: string[]; columnKey: string[]; value: number | string }>;
  } {
    const cells: Array<{ rowKey: string[]; columnKey: string[]; value: number | string }> = [];
    for (const rowKey of this.rowKeys) {
      for (const columnKey of this.columnKeys) {
        const value = this.getValue(
          rowKey,
          columnKey,
          this.config.values[0]?.field ?? '',
          this.config.values[0]?.aggregation ?? 'count'
        );
        cells.push({ rowKey: [...rowKey], columnKey: [...columnKey], value: value ?? 0 });
      }
    }
    return {
      config: this.config,
      rowKeys: this.getRowKeys(),
      columnKeys: this.getColumnKeys(),
      cells,
    };
  }
}
