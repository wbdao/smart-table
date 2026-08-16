import type { SmartTable } from '@smart-table/core';
import {
  SmartTable as SmartTableImpl,
  type Column,
  type DataRow,
  type FilterOperator,
  type SmartTableOptions,
} from '@smart-table/core';
import type { AgColumnDef, AgFilterModelEntry, AgGridOptions } from './ag-types';

/** A structured migration notice (never thrown; always collected). */
export interface ConversionWarning {
  code:
    | 'max-width-ignored'
    | 'missing-field'
    | 'value-getter'
    | 'unsupported-filter'
    | 'unsupported-or-group';
  detail: string;
}

/** Initial sort to re-apply after `new SmartTable`. */
interface PendingSort {
  field: string;
  direction: 'asc' | 'desc';
}

/** Pending structured filters to apply after construction. */
interface PendingFilter {
  field: string;
  operator: FilterOperator;
  operands: (string | number | boolean | Date | null)[];
}

/** Result of a conversion. */
export interface ConvertedConfig {
  options: SmartTableOptions;
  sort: PendingSort[];
  filters: PendingFilter[];
  warnings: ConversionWarning[];
}

/** Result of `createAgCompatibleTable`. */
export interface AgCompatResult {
  table: SmartTable;
  warnings: ConversionWarning[];
}

const AG_OPERATOR_MAP: Record<string, FilterOperator> = {
  equals: 'equals',
  contains: 'contains',
  startsWith: 'startsWith',
  endsWith: 'endsWith',
  lessThan: 'lessThan',
  greaterThan: 'greaterThan',
  inRange: 'between',
};

function note(
  warnings: ConversionWarning[],
  code: ConversionWarning['code'],
  detail: string
): void {
  warnings.push({ code, detail });
}

/** Flattens AG column groups into their leaf columns (in order). */
export function flattenAgColumns(defs: AgColumnDef[]): AgColumnDef[] {
  const leaves: AgColumnDef[] = [];
  for (const def of defs) {
    if (def.children?.length) {
      leaves.push(...flattenAgColumns(def.children));
    } else {
      leaves.push(def);
    }
  }
  return leaves;
}

function inferType(filter: AgColumnDef['filter']): Column['type'] | undefined {
  if (filter === 'agNumberColumnFilter') return 'number';
  if (filter === 'agTextColumnFilter') return 'string';
  if (filter === 'agBooleanColumnFilter') return 'boolean';
  if (filter && typeof filter === 'object') {
    if (filter.filter === 'number') return 'number';
    if (filter.filter === 'boolean') return 'boolean';
    if (filter.filter === 'text') return 'string';
  }
  return undefined;
}

function mapColumn(
  def: AgColumnDef,
  defaults: AgGridOptions['defaultColDef'],
  warnings: ConversionWarning[]
): Column | null {
  const field = def.field ?? def.colId;
  if (!field) {
    note(warnings, 'missing-field', 'A column without field/colId was skipped.');
    return null;
  }
  if (def.maxWidth !== undefined) {
    note(
      warnings,
      'max-width-ignored',
      `Column "${field}" defines maxWidth, which SmartTableJS ignores.`
    );
  }
  return {
    field,
    title: def.headerName ?? field,
    type: inferType(def.filter),
    sortable: def.sortable ?? defaults?.sortable ?? true,
    visible: !def.hide,
    width: def.width ?? defaults?.width,
    minWidth: def.minWidth ?? defaults?.minWidth,
  };
}

/** Maps a single AG filter entry to a SmartTable structured filter. */
export function mapFilterEntry(
  field: string,
  entry: AgFilterModelEntry,
  warnings: ConversionWarning[]
): PendingFilter[] {
  if (entry.filters?.length) {
    if (entry.operator === 'OR') {
      note(
        warnings,
        'unsupported-or-group',
        `Filter on "${field}" uses an OR group, which is not supported yet — skipped.`
      );
      return [];
    }
    const out: PendingFilter[] = [];
    for (const sub of entry.filters) {
      out.push(...mapFilterEntry(field, sub, warnings));
    }
    return out;
  }

  if (entry.values) {
    const operands = entry.values.filter((v) => v !== null && v !== undefined);
    if (operands.length === 0) return [];
    return [{ field, operator: 'inList', operands }];
  }

  const type = entry.type;
  if (!type) return [];
  const operator = AG_OPERATOR_MAP[type];
  if (!operator) {
    note(
      warnings,
      'unsupported-filter',
      `AG filter type "${type}" on "${field}" has no equivalent — skipped.`
    );
    return [];
  }

  if (type === 'inRange') {
    const from = entry.filter ?? null;
    const to = entry.filterTo ?? null;
    if (from === null || to === null) {
      note(
        warnings,
        'unsupported-filter',
        `inRange filter on "${field}" is missing an operand — skipped.`
      );
      return [];
    }
    return [{ field, operator, operands: [from, to] }];
  }

  if (type === 'notEqual') {
    note(
      warnings,
      'unsupported-filter',
      `AG filter type "notEqual" on "${field}" has no equivalent — skipped.`
    );
    return [];
  }

  return [{ field, operator, operands: [entry.filter == null ? null : entry.filter] }];
}

/**
 * Pure mapping: AG Grid config -> SmartTable options (+ pending sort/filter).
 * No table is created and nothing is applied.
 */
export function convertAgGridOptions(ag: AgGridOptions): ConvertedConfig {
  const warnings: ConversionWarning[] = [];
  const sort: PendingSort[] = [];
  const filters: PendingFilter[] = [];

  const leaves = flattenAgColumns(ag.columnDefs ?? []);
  const columns: Column[] = [];
  for (const def of leaves) {
    const column = mapColumn(def, ag.defaultColDef, warnings);
    if (!column) continue;
    columns.push(column);
    if (def.sort === 'asc' || def.sort === 'desc') {
      sort.push({ field: column.field, direction: def.sort });
    }
  }

  const autoHeight = ag.domLayout === 'autoHeight' || ag.domLayout === 'print';

  for (const [field, entry] of Object.entries(ag.filterModel ?? {})) {
    filters.push(...mapFilterEntry(field, entry, warnings));
  }

  return {
    options: {
      columns,
      data: (ag.rowData ?? []) as DataRow[],
      pageSize: ag.pagination ? (ag.paginationPageSize ?? 100) : 0,
      virtualScroll: autoHeight ? false : true,
    },
    sort,
    filters,
    warnings,
  };
}

/**
 * Migration factory: builds a live SmartTableJS instance from AG Grid config,
 * applying initial sorts and supported filter models automatically.
 *
 * ```ts
 * const { table, warnings } = createAgCompatibleTable({
 *   columnDefs, rowData, pagination: true, paginationPageSize: 25,
 * });
 * table.mount('#app');
 * ```
 */
export function createAgCompatibleTable(ag: AgGridOptions): AgCompatResult {
  const converted = convertAgGridOptions(ag);
  const table = new SmartTableImpl(converted.options);

  for (const s of converted.sort) {
    table.sort(s.field, s.direction);
  }
  for (const f of converted.filters) {
    table.where(f.field, f.operator, ...f.operands);
  }

  return { table, warnings: converted.warnings };
}
