import type { Column, DataRow } from '../types/column';
import type { CopyFormat } from '../types/modes';

/**
 * Returns the display string for a cell. `null`/`undefined` render as an
 * empty string; `Date` values use ISO 8601.
 */
export function getCellText(column: Column, row: DataRow): string {
  const value = row[column.field];
  if (value === null || value === undefined) return '';
  if (column.formatter) {
    const formatted = column.formatter(value, row);
    if (formatted !== null && formatted !== undefined) return String(formatted);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * Serializes rows into one of the supported copy formats.
 *
 * - `'text'`  -> tab-separated grid (header row + visible columns).
 * - `'csv'`   -> RFC-4180-ish CSV with proper quoting, `\r\n` line endings.
 * - `'json'`  -> pretty-printed raw data (no header).
 */
export function serializeRows(columns: Column[], rows: DataRow[], format: CopyFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(rows, null, 2);
    case 'csv':
      return buildGrid(columns, rows)
        .map((line) => line.map(escapeCsvCell).join(','))
        .join('\r\n');
    case 'text':
      return buildGrid(columns, rows)
        .map((line) => line.join('\t'))
        .join('\n');
  }
}

function buildGrid(columns: Column[], rows: DataRow[]): string[][] {
  const visible = columns.filter((c) => c.visible !== false);
  return [
    visible.map((c) => c.title ?? c.field),
    ...rows.map((row) => visible.map((c) => getCellText(c, row))),
  ];
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
