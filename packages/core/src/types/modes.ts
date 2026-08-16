/**
 * Runtime value sets and their literal types.
 * Keeping these as `as const` tuples lets us validate input at runtime
 * while preserving compile-time literal types.
 */

export const TABLE_MODES = ['readonly', 'editable'] as const;
export type TableMode = (typeof TABLE_MODES)[number];

export const COPY_FORMATS = ['text', 'json', 'csv'] as const;
export type CopyFormat = (typeof COPY_FORMATS)[number];

export const COLUMN_TYPES = ['string', 'number', 'date', 'boolean'] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export const THEMES = ['light', 'dark', 'corporate'] as const;
export type ThemeName = (typeof THEMES)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const COLUMN_ALIGNS = ['left', 'center', 'right'] as const;
export type ColumnAlign = (typeof COLUMN_ALIGNS)[number];
