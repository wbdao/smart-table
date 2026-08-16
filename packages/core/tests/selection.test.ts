import { describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
];

const rows = [
  { id: 1, name: 'Laptop' },
  { id: 2, name: 'Mouse' },
  { id: 3, name: 'Monitor' },
];

describe('SmartTable — selection', () => {
  it('selects rows by object, id and index', () => {
    const table = new SmartTable({ columns, data: rows });
    expect(table.selectRow(rows[0]!)).toBe(rows[0]!);
    expect(table.selectRow('2')).toBe(rows[1]!);
    expect(table.selectRow(2)).toBe(rows[2]!);
    expect(table.getSelection()).toEqual(rows);
    expect(table.getSelectedRowIds()).toEqual(['1', '2', '3']);
    expect(table.getSelectionCount()).toBe(3);
  });

  it('returns null and emits nothing for unknown targets', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('selectionChanged', handler);
    expect(table.selectRow('nope')).toBeNull();
    expect(table.selectRow(99)).toBeNull();
    expect(table.unselectRow('nope')).toBeNull();
    expect(handler).not.toHaveBeenCalled();
  });

  it('emits selectionChanged on select/unselect/clear with row payloads', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('selectionChanged', handler);
    table.selectRow('1');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith({ rows: [rows[0]], rowIds: ['1'] });
    table.unselectRow('1');
    expect(handler).toHaveBeenLastCalledWith({ rows: [], rowIds: [] });
    table.clearSelection();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('is idempotent: selecting an already-selected row does not emit', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('selectionChanged', handler);
    table.selectRow('1');
    table.selectRow('1');
    table.unselectRow('1');
    table.unselectRow('1');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('works in readonly mode (selection is not a mutation)', () => {
    const table = new SmartTable({ columns, data: rows, editable: false });
    expect(table.selectRow('1')?.name).toBe('Laptop');
    expect(table.getSelectedRowIds()).toEqual(['1']);
  });

  it('survives sorting and filtering (reference-based)', () => {
    const table = new SmartTable({ columns, data: rows });
    table.selectRow('1');
    table.selectRow('3');
    table.sort('name', 'asc');
    table.filter('monitor');
    expect(table.getSelection()).toEqual([rows[0], rows[2]]);
    expect(table.getSelectedRowIds()).toEqual(['1', '3']);
  });

  it('prunes removed rows and emits selectionChanged', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('selectionChanged', handler);
    table.selectRow('1');
    table.selectRow('2');
    table.removeRow('1');
    expect(handler).toHaveBeenCalledTimes(3);
    expect(table.getSelectedRowIds()).toEqual(['2']);
  });

  it('clears the selection and emits when the dataset is replaced', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('selectionChanged', handler);
    table.selectRow('1');
    table.setData([{ id: 9, name: 'Webcam' }]);
    expect(table.getSelectedRowIds()).toEqual([]);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not emit selectionChanged when setData clears an empty selection', () => {
    const table = new SmartTable({ columns, data: rows });
    const handler = vi.fn();
    table.on('selectionChanged', handler);
    table.setData([]);
    expect(handler).not.toHaveBeenCalled();
  });
});
