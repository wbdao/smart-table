import type { ViewRow } from '../../types/view';

export interface TreeFlattenOptions {
  /** Key holding each node's children array. Default `'children'`. */
  childrenKey?: string;
  /** Row ids whose children are currently visible. */
  expanded?: ReadonlySet<string>;
  /**
   * Whether a node without an existing children array is still expandable
   * (lazy loading). When `true`, such nodes render an expander.
   */
  lazy?: boolean;
}

export interface TreeFlattenResult {
  viewRows: ViewRow[];
  /** Ids of the nodes that have children and were included. */
  parentIds: string[];
}

/**
 * Flattens a tree of rows (via a `children` key) into the renderable view.
 * Depth-first pre-order: a parent precedes its children, and collapsed
 * subtrees are omitted entirely. Node ids come from the `id` field of each
 * row entry; expansion is tracked by those ids.
 */
export function flattenTree(rows: ViewRow[], options: TreeFlattenOptions = {}): TreeFlattenResult {
  const childrenKey = options.childrenKey ?? 'children';
  const expanded = options.expanded ?? new Set<string>();
  const viewRows: ViewRow[] = [];
  const parentIds: string[] = [];

  const childrenOf = (row: Record<string, unknown>): unknown[] | undefined => {
    const children = row[childrenKey];
    return Array.isArray(children) ? children : undefined;
  };

  const visit = (entries: Array<Extract<ViewRow, { type: 'row' }>>, depth: number): void => {
    for (const entry of entries) {
      const node = entry.row;
      const children = childrenOf(node);
      const hasChildren =
        (children?.length ?? 0) > 0 || (options.lazy === true && children === undefined);
      const isExpanded = entry.id !== '' && expanded.has(entry.id);
      if (hasChildren && entry.id !== '') parentIds.push(entry.id);
      viewRows.push({
        type: 'row',
        id: entry.id,
        row: node,
        tree: {
          hasChildren,
          expanded: isExpanded,
          depth,
        },
      });
      if (children && children.length > 0 && isExpanded) {
        visit(
          children.map((child) => {
            const childRow = child as Record<string, unknown>;
            const raw = childRow['id'];
            const id =
              raw !== null &&
              raw !== undefined &&
              (typeof raw === 'string' || typeof raw === 'number')
                ? String(raw)
                : '';
            return { type: 'row' as const, id, row: childRow };
          }),
          depth + 1
        );
      }
    }
  };

  visit(
    rows.filter((entry) => entry.type === 'row'),
    0
  );
  return { viewRows, parentIds };
}
