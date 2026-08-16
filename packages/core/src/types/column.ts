import type { ColumnAlign, ColumnType, SortDirection } from './modes';

/**
 * A single cell value.
 * Dates are stored as `Date` instances, ISO strings or numeric timestamps.
 */
export type CellValue = string | number | boolean | Date | null | undefined;

/**
 * A flat data row. Field values are intentionally `unknown` so that a single
 * row type works for every column type without losing type-safety at the edges.
 */
export type DataRow = Record<string, unknown>;

/**
 * Per-column validation rules. `custom` receives the raw value plus the full
 * row and returns `true` on success or an error message string.
 */
export interface ColumnValidators {
  /** The cell must not be `null`, `undefined`, empty or an empty array. */
  required?: boolean;
  /** Numeric values must be `>= min` (dates are compared by timestamp). */
  min?: number;
  /** Numeric values must be `<= max`. */
  max?: number;
  /** String values must be at least this many characters long. */
  minLength?: number;
  /** String values must be at most this many characters long. */
  maxLength?: number;
  /** String values must match this pattern (string or `RegExp`). */
  pattern?: string | RegExp;
  /** Fully custom validation. Return `true` to accept or a message to reject. */
  custom?: (value: unknown, row: DataRow) => string | true;
}

/** User-facing column definition (everything optional except `field`). */
export interface Column {
  /** Unique key used to read/write the value on a row. */
  field: string;
  /** Header label. Defaults to `field`. */
  title?: string;
  /** Value type used to pick the sort comparator. Defaults to `'string'`. */
  type?: ColumnType;
  /** Whether the column participates in sorting. Defaults to `true`. */
  sortable?: boolean;
  /** Whether the column participates in global search. Defaults to `true`. */
  filterable?: boolean;
  /** Whether cells of this column can be edited. Defaults to `true`. */
  editable?: boolean;
  /** Whether the column is rendered / serialized. Defaults to `true`. */
  visible?: boolean;
  /** Validation rules. Invalid values are blocked on save. */
  validators?: ColumnValidators;
  /** CSS width for the column header / cell. */
  width?: string | number;
  /** Minimum pixel width enforced when resizing. Defaults to `60`. */
  minWidth?: number;
  /** Text alignment of the header and cells. Defaults to `'left'`. */
  align?: ColumnAlign;
  /** Extra class name applied to every cell of this column. */
  className?: string;
  /** Extra class name applied to the header cell. */
  headerClassName?: string;
  /** Formats a cell value for display and serialization. */
  formatter?: (value: unknown, row: DataRow) => string;
}

/** Column after defaults have been applied by {@link DataManager}. */
export interface NormalizedColumn {
  field: string;
  title: string;
  type: ColumnType;
  sortable: boolean;
  filterable: boolean;
  editable: boolean;
  visible: boolean;
  align: ColumnAlign;
  width?: string | number;
  minWidth: number;
  validators?: ColumnValidators;
  className?: string;
  headerClassName?: string;
  formatter?: (value: unknown, row: DataRow) => string;
}

/** Immutable snapshot of the current sort state. */
export interface SortState {
  field: string | null;
  direction: SortDirection | null;
}
