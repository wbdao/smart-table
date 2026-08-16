import { describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { normalizeBreakpoints, DEFAULT_BREAKPOINTS } from '../src/core/breakpoints';
import { ERROR_CODES } from '../src/core/errors';
import type { Column } from '../src/types';

const columns: Column[] = [{ field: 'name', title: 'Name' }];

describe('SmartTable — responsive breakpoints', () => {
  it('defaults to disabled with the standard thresholds', () => {
    const table = new SmartTable({ columns });
    expect(table.responsive).toBe(false);
    expect(table.getBreakpoints()).toEqual({ mobile: 768, desktop: 1024 });
  });

  it('enables responsive with default thresholds via responsive: true', () => {
    const table = new SmartTable({ columns, responsive: true });
    expect(table.responsive).toBe(true);
    expect(table.getBreakpoints()).toEqual(DEFAULT_BREAKPOINTS);
  });

  it('accepts partial overrides and fills in defaults', () => {
    const table = new SmartTable({ columns, responsive: { mobile: 500 } });
    expect(table.responsive).toBe(true);
    expect(table.getBreakpoints()).toEqual({ mobile: 500, desktop: 1024 });
  });

  it('getBreakpoints returns a copy (no external mutation)', () => {
    const table = new SmartTable({ columns, responsive: { mobile: 500, desktop: 900 } });
    const first = table.getBreakpoints();
    first.mobile = 999;
    expect(table.getBreakpoints().mobile).toBe(500);
  });

  it('rejects non-positive thresholds', () => {
    expect(() => normalizeBreakpoints({ mobile: -1 })).toThrowError(
      ERROR_CODES.INVALID_BREAKPOINTS
    );
    expect(() => normalizeBreakpoints({ mobile: 0 })).toThrowError(ERROR_CODES.INVALID_BREAKPOINTS);
    expect(() => new SmartTable({ columns, responsive: { desktop: NaN } })).toThrowError(
      ERROR_CODES.INVALID_BREAKPOINTS
    );
  });

  it('rejects desktop <= mobile', () => {
    expect(() => normalizeBreakpoints({ mobile: 900, desktop: 900 })).toThrowError(
      ERROR_CODES.INVALID_BREAKPOINTS
    );
    expect(
      () => new SmartTable({ columns, responsive: { mobile: 1024, desktop: 800 } })
    ).toThrowError(ERROR_CODES.INVALID_BREAKPOINTS);
  });
});

describe('SmartTable — data accessors', () => {
  it('getRowByIndex resolves rows in dataset order', () => {
    const rows = [{ name: 'a' }, { name: 'b' }];
    const table = new SmartTable({ columns, data: rows });
    expect(table.getRowByIndex(0)).toBe(rows[0]);
    expect(table.getRowByIndex(5)).toBeUndefined();
  });

  it('getRow resolves object, id and index targets', () => {
    const rows = [{ name: 'a' }, { name: 'b' }];
    const table = new SmartTable({ columns, data: rows });
    const added = table.addRow({ name: 'c' });
    expect(table.getRow(rows[0]!)).toBe(rows[0]!);
    expect(table.getRow(added)).toBe(added);
  });
});

describe('SmartTable — dataChanged', () => {
  it('emits dataChanged for setData', () => {
    const table = new SmartTable({ columns, data: [{ name: 'a' }] });
    const handler = vi.fn();
    table.on('dataChanged', handler);
    table.setData([{ name: 'b' }]);
    expect(handler).toHaveBeenCalledWith({ operation: 'setData' });
  });

  it('emits dataChanged for addRow with row metadata', () => {
    const table = new SmartTable({ columns });
    const handler = vi.fn();
    table.on('dataChanged', handler);
    const row = table.addRow({ name: 'x' });
    expect(handler).toHaveBeenCalledWith({
      operation: 'addRow',
      row,
      rowId: table.getRowId(row),
      rowIndex: 0,
    });
  });

  it('emits dataChanged for removeRow', () => {
    const table = new SmartTable({ columns, data: [{ id: 1, name: 'a' }] });
    const handler = vi.fn();
    table.on('dataChanged', handler);
    const removed = table.removeRow('1');
    expect(handler).toHaveBeenCalledWith({
      operation: 'removeRow',
      row: removed,
      rowId: '1',
      rowIndex: 0,
    });
  });

  it('emits dataChanged for updateCell only when the value changes', () => {
    const table = new SmartTable({ columns, data: [{ id: 1, name: 'a' }] });
    const handler = vi.fn();
    table.on('dataChanged', handler);
    table.updateCell('1', 'name', 'b');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'updateCell',
        field: 'name',
        oldValue: 'a',
        newValue: 'b',
      })
    );
    table.updateCell('1', 'name', 'b');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
