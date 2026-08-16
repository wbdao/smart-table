/**
 * Minimal AG Grid option/column types accepted by the compatibility layer.
 *
 * These intentionally mirror a *subset* of AG Grid's public types (structural
 * compatibility — your existing `ColDef`s compile unchanged). Unsupported AG
 * features are reported as `ConversionWarning`s instead of throwing.
 */

/** One or two operands carried by a simple filter model entry. */
export type AgFilterableValue = string | number | boolean | null | Date;

/** A single AG filter in the `filterModel` (text/number/date flavours). */
export interface AgFilterModelEntry {
  filterType?: string;
  type?: string;
  filter?: AgFilterableValue;
  filterTo?: AgFilterableValue;
  values?: AgFilterableValue[];
  /** Nested sub-filters for `AND`/`OR` combined models. */
  filters?: AgFilterModelEntry[];
  /** `'AND'` or `'OR'`. `OR` groups are reported but not mapped. */
  operator?: 'AND' | 'OR';
}

/** AG `filterModel`: column -> filter (or combined filter). */
export type AgFilterModel = Record<string, AgFilterModelEntry>;

/** Built-in AG filter flags we understand for type inference. */
export type AgBuiltInFilter =
  | boolean
  | 'agNumberColumnFilter'
  | 'agTextColumnFilter'
  | 'agBooleanColumnFilter'
  | AgColumnFilterDef;

/** Inline AG filter definition (only the parts that map cleanly). */
export interface AgColumnFilterDef {
  filter?: 'number' | 'text' | 'boolean';
}

/** AG `ColDef` subset supported by the mapping layer. */
export interface AgColumnDef {
  /** Value key on each row. Required for a leaf column. */
  field?: string;
  /** AG column id. Used as `field` fallback when mapFieldsToColIds is set. */
  colId?: string;
  /** Header label. Defaults to the field name. */
  headerName?: string;
  /** Column width (px). */
  width?: number;
  /** Minimum width (px). */
  minWidth?: number;
  /** Maximum width (px) — not supported; ignored with a warning. */
  maxWidth?: number;
  /** Hidden columns are skipped from rendering. */
  hide?: boolean;
  /** Sort participation. AG defaults to `true`. */
  sortable?: boolean;
  /** Defaults to `true` in AG; used to infer the column value type too. */
  filter?: AgBuiltInFilter;
  /** Initial sort applied after mount. */
  sort?: 'asc' | 'desc' | null;
  /** Not enforced by SmartTableJS; accepted for compatibility. */
  resizable?: boolean;
  /** Column group children, flattened into leaf columns. */
  children?: AgColumnDef[];
}

/** AG top-level options subset consumed by the migration layer. */
export interface AgGridOptions {
  /** Column definitions (flattened; groups become their leaf columns). */
  columnDefs?: AgColumnDef[];
  /** Initial rows. */
  rowData?: DataRowLike[];
  /** Defaults merged into every column (sortable/filter/width/minWidth). */
  defaultColDef?: Pick<AgColumnDef, 'sortable' | 'filter' | 'width' | 'minWidth'>;
  /** Turns SmartTableJS pagination on; page size from paginationPageSize. */
  pagination?: boolean;
  /** Rows per page when `pagination` is on. Defaults to 100. */
  paginationPageSize?: number;
  /** `multiple` enables row multi-select semantics. */
  rowSelection?: 'single' | 'multiple';
  /** `autoHeight` / `print` disable virtual scrolling (AG parity). */
  domLayout?: 'normal' | 'autoHeight' | 'print';
  /** Initial filter model applied as structured filters. */
  filterModel?: AgFilterModel;
  /** Accepted for compatibility; ignored. */
  animateRows?: boolean;
}

/** Structural stand-in for AG `any` row data (values map to `DataRow`). */
export type DataRowLike = Record<string, unknown>;
