import type { DataRow } from './column';

/**
 * Metadata attached to a data row inside a grouped view.
 */
export interface GroupedViewMeta {
  /** The group this row belongs to (the group key). */
  groupKey: string;
}

/**
 * Metadata attached to a data row inside a tree view.
 */
export interface TreeViewMeta {
  /** Whether the row has children (a `children` array or lazy children). */
  hasChildren: boolean;
  /** Whether the row's children are currently shown. */
  expanded: boolean;
  /** Zero-based depth (0 = root level). */
  depth: number;
}

/**
 * A single rendered unit of the table's view. Either a real data row or a
 * synthetic group header. Group headers carry `row: null` and are never
 * selectable / editable.
 */
export type ViewRow =
  | {
      type: 'row';
      /** Stable id of the underlying data row. */
      id: string;
      row: DataRow;
      /** Group the row belongs to (present when grouping is active). */
      groupKey?: string;
      /** Tree metadata (present when tree mode is active). */
      tree?: TreeViewMeta;
    }
  | {
      type: 'group';
      /** Synthetic id: `group:<key>`. */
      id: string;
      row: null;
      group: GroupViewHeader;
    };

/**
 * The synthetic header row rendered for a collapsed/expanded group.
 */
export interface GroupViewHeader {
  /** The raw group key (cell value). */
  key: string;
  /** Human-readable label (formatted with the column's formatter). */
  label: string;
  /** Index of the first data row of the group (in the flat view). */
  startIndex: number;
  /** Index just past the last data row of the group. */
  endIndex: number;
  /** Number of data rows in the group. */
  rowCount: number;
  /** Whether the group is collapsed (only the header is shown). */
  collapsed: boolean;
  /** Aggregate values for the group, when aggregations are configured. */
  aggregates?: Record<string, number | string>;
}
