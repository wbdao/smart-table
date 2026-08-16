/** Machine-readable error codes for every documented failure mode. */
export const ERROR_CODES = {
  INVALID_COLUMNS: 'INVALID_COLUMNS',
  UNKNOWN_COLUMN: 'UNKNOWN_COLUMN',
  INVALID_COLUMN_WIDTH: 'INVALID_COLUMN_WIDTH',
  INVALID_HISTORY_SIZE: 'INVALID_HISTORY_SIZE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_PAGE_SIZE: 'INVALID_PAGE_SIZE',
  INVALID_FILTER_OPERATOR: 'INVALID_FILTER_OPERATOR',
  NOT_SORTABLE: 'NOT_SORTABLE',
  INVALID_SORT_DIRECTION: 'INVALID_SORT_DIRECTION',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_MODE: 'INVALID_MODE',
  INVALID_THEME: 'INVALID_THEME',
  INVALID_BREAKPOINTS: 'INVALID_BREAKPOINTS',
  READONLY_MODE: 'READONLY_MODE',
  ROW_NOT_FOUND: 'ROW_NOT_FOUND',
  INVALID_PLUGIN: 'INVALID_PLUGIN',
  PLUGIN_ALREADY_REGISTERED: 'PLUGIN_ALREADY_REGISTERED',
  TABLE_DESTROYED: 'TABLE_DESTROYED',
  NO_RENDERER: 'NO_RENDERER',
  NO_CONTAINER: 'NO_CONTAINER',
  INVALID_DATA_SOURCE: 'INVALID_DATA_SOURCE',
  INVALID_VIRTUAL_SCROLL: 'INVALID_VIRTUAL_SCROLL',
  INVALID_AGGREGATION: 'INVALID_AGGREGATION',
  INVALID_PIVOT_CONFIG: 'INVALID_PIVOT_CONFIG',
  INVALID_STATE: 'INVALID_STATE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Typed error thrown by SmartTableJS. Use `error.code` to branch on the
 * failure instead of parsing messages; the code is also embedded in the
 * message (`[CODE] message`) for quick debugging.
 */
export class SmartTableError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'SmartTableError';
    this.code = code;
  }
}
