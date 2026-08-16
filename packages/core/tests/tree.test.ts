// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { flattenTree } from '../src/features/tree/TreeEngine';
import type { Column, DataRow } from '../src/types';
import type { ViewRow } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'string' },
  { field: 'name', title: 'Name', type: 'string' },
];

const treeData: DataRow[] = [
  {
    id: 'a',
    name: 'A',
    children: [
      { id: 'a1', name: 'A1', children: [{ id: 'a1x', name: 'A1X' }] },
      { id: 'a2', name: 'A2' },
    ],
  },
  { id: 'b', name: 'B', children: [{ id: 'b1', name: 'B1' }] },
];

const viewRows = (rows: DataRow[]): ViewRow[] =>
  rows.map((row) => ({ type: 'row', id: String(row.id), row }));

afterEach(() => {
  document.body.replaceChildren();
});

describe('flattenTree (pure)', () => {
  it('flattens depth-first pre-order with depth metadata', () => {
    const { viewRows: out } = flattenTree(viewRows(treeData), { expanded: new Set(['a']) });
    expect(out.map((v) => v.id)).toEqual(['a', 'a1', 'a2', 'b']);
    expect(out.map((v) => (v.type === 'row' ? v.tree?.depth : undefined))).toEqual([0, 1, 1, 0]);
    const second = out[1] as Extract<ViewRow, { type: 'row' }>;
    expect(second.tree).toMatchObject({ hasChildren: true, expanded: false });
  });

  it('omits collapsed subtrees entirely', () => {
    const { viewRows: out } = flattenTree(viewRows(treeData));
    expect(out.map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('reports parent ids and supports lazy expandability', () => {
    const { parentIds } = flattenTree(viewRows(treeData), { expanded: new Set(['a']) });
    expect(parentIds).toEqual(['a', 'a1', 'b']);

    const lazyRow = [{ type: 'row' as const, id: 'x', row: { id: 'x' } }];
    const lazy = flattenTree(lazyRow, { lazy: true });
    const first = lazy.viewRows[0] as Extract<ViewRow, { type: 'row' }>;
    expect(first.tree).toMatchObject({ hasChildren: true, expanded: false });
  });

  it('honors a custom children key', () => {
    const custom = [{ id: 'p', kids: [{ id: 'c' }] }];
    const { viewRows: out } = flattenTree(viewRows(custom as DataRow[]), {
      childrenKey: 'kids',
      expanded: new Set(['p']),
    });
    expect(out.map((v) => v.id)).toEqual(['p', 'c']);
  });
});

describe('SmartTable tree mode', () => {
  it('starts collapsed and reports the tree state', () => {
    const table = new SmartTable({ columns, data: treeData, tree: true });
    expect(table.isTreeEnabled()).toBe(true);
    expect(table.getTreeState().expanded).toEqual([]);
    expect(table.getRows()).toHaveLength(2);
  });

  it('expands and collapses nodes with events', async () => {
    const table = new SmartTable({ columns, data: treeData, tree: true });
    const expanded = vi.fn();
    const collapsed = vi.fn();
    table.on('nodeExpanded', expanded);
    table.on('nodeCollapsed', collapsed);

    expect(await table.expandNode('a')).toBe(true);
    expect(table.isNodeExpanded('a')).toBe(true);
    expect(table.getRows()).toHaveLength(4);
    expect(expanded.mock.calls[0]![0]).toMatchObject({ rowId: 'a', depth: 0, childCount: 2 });

    expect(table.collapseNode('a')).toBe(true);
    expect(table.getRows()).toHaveLength(2);
    expect(collapsed.mock.calls[0]![0]).toMatchObject({ rowId: 'a', depth: 0 });

    expect(await table.expandNode('missing')).toBe(false);
  });

  it('toggleNode expands and collapses', async () => {
    const table = new SmartTable({ columns, data: treeData, tree: true });
    expect(table.toggleNode('a')).toBe(true);
    await vi.waitFor(() => expect(table.isNodeExpanded('a')).toBe(true));
    expect(table.getRows()).toHaveLength(4);
    expect(table.toggleNode('a')).toBe(false);
    expect(table.getRows()).toHaveLength(2);
  });

  it('resolves lazy children before expanding', async () => {
    const lazy = vi.fn(async () => [{ id: 'c1', name: 'C1' }]);
    const table = new SmartTable({
      columns,
      data: [{ id: 'c', name: 'C' }],
      tree: { lazyChildren: lazy },
    });
    expect(await table.expandNode('c')).toBe(true);
    expect(lazy).toHaveBeenCalledTimes(1);
    expect(table.isNodeExpanded('c')).toBe(true);
    expect(table.getRows().map((r) => r.id)).toEqual(['c', 'c1']);
  });

  it('collapses a node when another is expanded (independent tracking)', async () => {
    const table = new SmartTable({ columns, data: treeData, tree: true });
    await table.expandNode('a');
    await table.expandNode('b');
    expect(table.isNodeExpanded('a')).toBe(true);
    expect(table.isNodeExpanded('b')).toBe(true);
    expect(table.getRows()).toHaveLength(5);
    table.collapseNode('a');
    expect(table.getRows()).toHaveLength(3);
  });
});
