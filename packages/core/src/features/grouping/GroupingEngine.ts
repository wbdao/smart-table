import type { NormalizedColumn } from '../../types/column';
import type { GroupViewHeader, ViewRow } from '../../types/view';
import { getCellText } from '../../utils/serialize';
import { aggregateRows, type AggregateConfig } from '../aggregation/aggregations';

/** Summary builder: receives a group's data rows and returns aggregate values. */
export type GroupSummarizer = (
  rows: Array<Record<string, unknown>>
) => Record<string, number | string>;

export interface GroupingEngineOptions {
  /** The column whose values become group keys. */
  column: NormalizedColumn;
  /** Group keys that are collapsed (only the header is rendered). */
  collapsed?: ReadonlySet<string>;
  /** Optional per-group aggregate summaries. */
  summarizer?: GroupSummarizer;
}

export interface GroupingResult {
  /** Flat view rows: group headers interleaved with their data rows. */
  viewRows: ViewRow[];
  /** One header per group, in group order. */
  groups: GroupViewHeader[];
}

/**
 * Groups flat view rows (all `type: 'row'`) by a column's value and flattens
 * them into the renderable view. Collapsed groups contribute only their header
 * row. Group order follows first appearance; `summarizer` (when set) produces
 * the group aggregates. Row ids are preserved.
 */
export function groupRows(rows: ViewRow[], options: GroupingEngineOptions): GroupingResult {
  const { column, collapsed } = options;

  const buckets = new Map<string, Array<Extract<ViewRow, { type: 'row' }>>>();
  for (const entry of rows) {
    if (entry.type !== 'row') continue;
    const key = String(entry.row[column.field] ?? '');
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  const viewRows: ViewRow[] = [];
  const headers: GroupViewHeader[] = [];
  let index = 0;
  for (const [key, entries] of buckets) {
    const first = entries[0];
    const startIndex = index;
    const isCollapsed = collapsed?.has(key) ?? false;
    const rowCount = entries.length;
    const aggregates = options.summarizer
      ? options.summarizer(entries.map((entry) => entry.row))
      : undefined;
    const header: GroupViewHeader = {
      key,
      label: first !== undefined ? getCellText(column, first.row) : key,
      startIndex,
      endIndex: isCollapsed ? startIndex + 1 : startIndex + rowCount + 1,
      rowCount,
      collapsed: isCollapsed,
      aggregates,
    };
    headers.push(header);
    viewRows.push({
      type: 'group',
      id: `group:${key}`,
      row: null,
      group: header,
    });
    index += 1;
    if (!isCollapsed) {
      for (const entry of entries) {
        viewRows.push({
          type: 'row',
          id: entry.id,
          row: entry.row,
          groupKey: key,
        });
      }
      index += rowCount;
    }
  }
  return { viewRows, groups: headers };
}

/**
 * Convenience: groups rows and attaches per-group aggregates from an
 * `AggregateConfig`. Used by the data layer.
 */
export function groupRowsWithAggregates(
  rows: ViewRow[],
  column: NormalizedColumn,
  collapsed: ReadonlySet<string>,
  aggregateConfig?: AggregateConfig
): GroupingResult {
  return groupRows(rows, {
    column,
    collapsed,
    summarizer:
      aggregateConfig && Object.keys(aggregateConfig).length > 0
        ? (groupRowsList) => aggregateRows(groupRowsList, aggregateConfig)
        : undefined,
  });
}
