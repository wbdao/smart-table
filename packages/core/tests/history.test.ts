// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { HistoryManager } from '../src/history/HistoryManager';
import { ERROR_CODES } from '../src/core/errors';
import { DOMRenderer } from '../src/ui/DOMRenderer';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
];

function makeRows() {
  return [
    { id: 1, name: 'Laptop', price: 1200 },
    { id: 2, name: 'Mouse', price: 25 },
    { id: 3, name: 'Monitor', price: 300 },
  ];
}

function mountRenderer(table: SmartTable) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const renderer = new DOMRenderer(table, { target: host, toolbar: false });
  renderer.mount();
  return { host, renderer };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('HistoryManager', () => {
  it('stores entries up to the limit and clears the redo stack on push', () => {
    const history = new HistoryManager(2);
    history.push({ type: 'cellEdit', rowId: '1', field: 'name', oldValue: 'a', newValue: 'b' });
    history.push({ type: 'cellEdit', rowId: '2', field: 'name', oldValue: 'b', newValue: 'c' });
    history.push({ type: 'cellEdit', rowId: '3', field: 'name', oldValue: 'c', newValue: 'd' });
    expect(history.getUndoCount()).toBe(2);
    expect(history.getRedoCount()).toBe(0);
    const undo = history.popUndo();
    expect(undo?.rowId).toBe('3');
    history.pushRedo(undo as never);
    expect(history.canRedo()).toBe(true);
    history.push({ type: 'cellEdit', rowId: '4', field: 'name', oldValue: 'x', newValue: 'y' });
    expect(history.canRedo()).toBe(false);
  });

  it('limit 0 disables recording', () => {
    const history = new HistoryManager(0);
    history.push({ type: 'cellEdit', rowId: '1', field: 'name', oldValue: 'a', newValue: 'b' });
    expect(history.canUndo()).toBe(false);
  });
});

describe('SmartTable history — cell edits', () => {
  it('undoes and redoes a cell edit', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    table.updateCell('1', 'name', 'Gaming Laptop');
    expect(table.getRow('1')?.name).toBe('Gaming Laptop');
    expect(table.canUndo()).toBe(true);
    expect(table.undo()).toBe(true);
    expect(table.getRow('1')?.name).toBe('Laptop');
    expect(table.canRedo()).toBe(true);
    expect(table.redo()).toBe(true);
    expect(table.getRow('1')?.name).toBe('Gaming Laptop');
  });

  it('emits historyChanged with canUndo/canRedo after mutations', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const handler = vi.fn();
    table.on('historyChanged', handler);
    table.updateCell('1', 'name', 'X');
    expect(handler).toHaveBeenLastCalledWith({
      canUndo: true,
      canRedo: false,
      undoCount: 1,
      redoCount: 0,
    });
    table.undo();
    expect(handler).toHaveBeenLastCalledWith({
      canUndo: false,
      canRedo: true,
      undoCount: 0,
      redoCount: 1,
    });
    table.redo();
    expect(table.canUndo()).toBe(true);
  });

  it('undo patches the rendered cell in place', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host, renderer } = mountRenderer(table);
    table.updateCell('1', 'name', 'Gaming Laptop');
    expect(host.querySelector('tr[data-row-id="1"] td[data-field="name"]')?.textContent).toBe(
      'Gaming Laptop'
    );
    table.undo();
    expect(host.querySelector('tr[data-row-id="1"] td[data-field="name"]')?.textContent).toBe(
      'Laptop'
    );
    table.redo();
    expect(host.querySelector('tr[data-row-id="1"] td[data-field="name"]')?.textContent).toBe(
      'Gaming Laptop'
    );
    renderer.unmount();
  });

  it('a new edit after undo clears the redo stack', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    table.updateCell('1', 'name', 'X');
    table.undo();
    expect(table.canRedo()).toBe(true);
    table.updateCell('2', 'name', 'Y');
    expect(table.canRedo()).toBe(false);
  });

  it('undo does nothing when the stack is empty', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    expect(table.undo()).toBe(false);
    expect(table.redo()).toBe(false);
  });
});

describe('SmartTable history — rows', () => {
  it('undoes a row add and redoes it back with the same id', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const added = table.addRow({ id: 9, name: 'Webcam', price: 50 });
    const rowId = table.getRowId(added) as string;
    expect(table.getRowCount()).toBe(4);
    expect(table.undo()).toBe(true);
    expect(table.getRowCount()).toBe(3);
    expect(table.getRowById(rowId)).toBeUndefined();
    expect(table.redo()).toBe(true);
    expect(table.getRowCount()).toBe(4);
    expect(table.getRowById(rowId)?.name).toBe('Webcam');
  });

  it('undoes a row delete and restores the exact row object', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const removed = table.getRow('2');
    expect(removed).toBeDefined();
    const rowId = table.getRowId(removed as Record<string, unknown>) as string;
    table.removeRow('2');
    expect(table.getRowCount()).toBe(2);
    expect(table.undo()).toBe(true);
    expect(table.getRowCount()).toBe(3);
    expect(table.getRow('2')?.name).toBe('Mouse');
    expect(table.getRowById(rowId)).toBe(removed);
    expect(table.redo()).toBe(true);
    expect(table.getRowCount()).toBe(2);
    expect(table.getRowById(rowId)).toBeUndefined();
  });

  it('add/delete operations re-render the table view', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const { host, renderer } = mountRenderer(table);
    table.removeRow('3');
    expect(host.querySelectorAll('tr.st-row')).toHaveLength(2);
    table.undo();
    expect(host.querySelectorAll('tr.st-row')).toHaveLength(3);
    expect(host.querySelector('tr[data-row-id="3"] td[data-field="name"]')?.textContent).toBe(
      'Monitor'
    );
    renderer.unmount();
  });

  it('removed rows are restored into the selection identity', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    const row = table.getRow('2') as Record<string, unknown>;
    table.selectRow(row);
    table.removeRow('2');
    expect(table.getSelectionCount()).toBe(0);
    table.undo();
    table.selectRow(row);
    expect(table.getSelectedRowIds()).toHaveLength(1);
  });
});

describe('SmartTable history — bounds and lifecycle', () => {
  it('respects a custom history size', () => {
    const table = new SmartTable({ columns, data: makeRows(), historySize: 2 });
    table.updateCell('1', 'name', 'a');
    table.updateCell('2', 'name', 'b');
    table.updateCell('3', 'name', 'c');
    expect(table.getUndoCount()).toBe(2);
    expect(table.getRow('1')?.name).toBe('a');
    expect(table.undo()).toBe(true);
    expect(table.getRow('3')?.name).toBe('Monitor');
    expect(table.undo()).toBe(true);
    expect(table.getRow('2')?.name).toBe('Mouse');
  });

  it('historySize 0 disables recording', () => {
    const table = new SmartTable({ columns, data: makeRows(), historySize: 0 });
    table.updateCell('1', 'name', 'a');
    table.removeRow('1');
    expect(table.canUndo()).toBe(false);
    expect(table.undo()).toBe(false);
  });

  it('throws for an invalid history size', () => {
    expect(() => new SmartTable({ columns, data: makeRows(), historySize: -1 })).toThrowError(
      ERROR_CODES.INVALID_HISTORY_SIZE
    );
    expect(() => new SmartTable({ columns, data: makeRows(), historySize: 1.5 })).toThrowError(
      ERROR_CODES.INVALID_HISTORY_SIZE
    );
  });

  it('setData clears the history', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    table.updateCell('1', 'name', 'a');
    expect(table.canUndo()).toBe(true);
    table.setData([{ id: 5, name: 'New', price: 1 }]);
    expect(table.canUndo()).toBe(false);
    expect(table.getRowCount()).toBe(1);
  });

  it('clearHistory drops operations and emits historyChanged', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    table.updateCell('1', 'name', 'a');
    const handler = vi.fn();
    table.on('historyChanged', handler);
    table.clearHistory();
    expect(table.canUndo()).toBe(false);
    expect(handler).toHaveBeenCalledWith({
      canUndo: false,
      canRedo: false,
      undoCount: 0,
      redoCount: 0,
    });
  });

  it('clone starts with an empty history', () => {
    const table = new SmartTable({ columns, data: makeRows() });
    table.updateCell('1', 'name', 'a');
    const clone = table.clone();
    expect(clone.canUndo()).toBe(false);
    expect(clone.getRow('1')?.name).toBe('a');
  });
});
