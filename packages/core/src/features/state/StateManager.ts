import type { SmartTable } from '../../core/SmartTable';
import { SmartTableError, ERROR_CODES } from '../../core/errors';
import type { SortState } from '../../types/column';
import type { StructuredFilter } from '../../types/filter';
import type { TableMode } from '../../types/modes';
import type { ThemeInput } from '../../types/theme';

/** Column state captured in a grid snapshot. */
export interface GridStateColumn {
  field: string;
  visible: boolean;
  width?: string | number;
}

/** Serializable snapshot of the table's entire state. */
export interface GridState {
  version: 1;
  mode: TableMode;
  theme: string;
  columns: GridStateColumn[];
  sort: SortState;
  query: string;
  filters: StructuredFilter[];
  selection: string[];
  page: number;
  pageSize: number;
  grouping: { field: string | null; collapsed: string[] };
  tree: { expanded: string[] };
  scrollTop: number;
}

const STATE_VERSION = 1 as const;

function isGridState(value: unknown): value is GridState {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as GridState;
  return (
    candidate.version === STATE_VERSION &&
    (candidate.mode === 'readonly' || candidate.mode === 'editable') &&
    typeof candidate.theme === 'string' &&
    Array.isArray(candidate.columns) &&
    candidate.sort !== null &&
    typeof candidate.sort === 'object' &&
    Array.isArray(candidate.filters) &&
    Array.isArray(candidate.selection) &&
    typeof candidate.page === 'number' &&
    typeof candidate.pageSize === 'number' &&
    candidate.grouping !== null &&
    typeof candidate.grouping === 'object' &&
    candidate.tree !== null &&
    typeof candidate.tree === 'object' &&
    typeof candidate.scrollTop === 'number'
  );
}

/**
 * Captures and restores the table's full state: columns, sort, filters,
 * selection, pagination, theme, mode, grouping, tree expansion and the
 * viewport's scroll position. The renderer is never touched directly — state
 * flows through the public API so every listener (and any future binding)
 * stays in sync.
 */
export class StateManager {
  constructor(private readonly table: SmartTable) {}

  /** Snapshot of the current state. */
  export(): GridState {
    const columns = this.table.getColumns().map((column) => ({
      field: column.field,
      visible: column.visible,
      ...(column.width !== undefined ? { width: column.width } : {}),
    }));
    const group = this.table.getGroupState();
    const tree = this.table.getTreeState();
    return {
      version: STATE_VERSION,
      mode: this.table.getMode(),
      theme: this.table.getTheme(),
      columns,
      sort: this.table.getSortState(),
      query: this.table.getFilterState().query,
      filters: this.table.getStructuredFilters().map((f) => ({ ...f, operands: [...f.operands] })),
      selection: this.table.getSelectedRowIds(),
      page: this.table.getCurrentPage(),
      pageSize: this.table.getPageSize(),
      grouping: { field: group.field, collapsed: [...group.collapsed] },
      tree: { expanded: [...tree.expanded] },
      scrollTop: this.readScrollTop(),
    };
  }

  /** Applies a previously exported snapshot. Throws `INVALID_STATE` for bad input. */
  import(snapshot: GridState): void {
    if (!isGridState(snapshot)) {
      throw new SmartTableError(
        ERROR_CODES.INVALID_STATE,
        'Invalid grid state: expected the object returned by exportState().'
      );
    }
    this.table.setColumnsState(snapshot.columns);
    this.table.setMode(snapshot.mode);
    this.table.setTheme(snapshot.theme as ThemeInput);
    this.table.clearFilter();
    if (snapshot.query) this.table.filter(snapshot.query);
    for (const filter of snapshot.filters) {
      if (this.table.getColumn(filter.field)) {
        this.table.where(filter.field, filter.operator as never, ...filter.operands);
      }
    }
    if (snapshot.sort.field && snapshot.sort.direction) {
      this.table.sort(snapshot.sort.field, snapshot.sort.direction);
    } else {
      this.table.clearSort();
    }
    this.table.setPageSize(snapshot.pageSize);
    this.table.goToPage(snapshot.page);
    this.table.clearSelection();
    for (const rowId of snapshot.selection) {
      const row = this.table.getRow(rowId);
      if (row) this.table.selectRow(row);
    }
    const group = this.table.getGroupState();
    if (group.field) {
      const collapsed = new Set(snapshot.grouping.collapsed);
      const diff = group.collapsed;
      for (const key of diff) if (!collapsed.has(key)) this.table.toggleGroup(key);
      for (const key of collapsed) if (!diff.includes(key)) this.table.toggleGroup(key);
    } else if (snapshot.grouping.field) {
      this.table.groupBy(snapshot.grouping.field);
      for (const key of snapshot.grouping.collapsed) this.table.toggleGroup(key);
    }
    for (const rowId of snapshot.tree.expanded) {
      if (!this.table.isNodeExpanded(rowId)) this.table.toggleNode(rowId);
    }
    this.writeScrollTop(snapshot.scrollTop);
  }

  /** Restores the default state (columns visible, no sort/filter/selection). */
  reset(): void {
    this.table.clearFilter();
    this.table.clearSort();
    this.table.clearSelection();
    this.table.ungroup();
    this.table.setColumnsState(
      this.table.getColumns().map((column) => ({ field: column.field, visible: true }))
    );
    this.table.goToPage(1);
    this.writeScrollTop(0);
  }

  private readScrollTop(): number {
    const renderer = this.table.getRenderer() as { getScrollTop?: () => number } | null | undefined;
    return typeof renderer?.getScrollTop === 'function' ? renderer.getScrollTop() : 0;
  }

  private writeScrollTop(top: number): void {
    const renderer = this.table.getRenderer() as
      { setScrollTop?: (value: number) => void } | null | undefined;
    if (typeof renderer?.setScrollTop === 'function') renderer.setScrollTop(top);
  }
}
