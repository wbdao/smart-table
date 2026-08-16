import type { StructuredFilter } from './filter';
import type { SortState } from './column';

/** Width + visibility of one column, as persisted in a layout. */
export interface LayoutColumnState {
  field: string;
  visible: boolean;
  width?: string | number;
}

/** A snapshot of the table's column/sort/filter state. */
export interface SavedLayout {
  /** Stable id used to save/load/delete the layout. */
  id: string;
  /** Optional human-readable name shown in the layout picker. */
  label?: string;
  /** Column order with visibility + width per field. */
  columns: LayoutColumnState[];
  /** Current sort, or `null` when unsorted. */
  sort: SortState | null;
  /** Global search query. */
  query: string;
  /** Active structured filters. */
  filters: StructuredFilter[];
  /** Unix timestamp (ms) when the layout was saved. */
  savedAt: number;
}

/**
 * Minimal key/value storage used by the layout system. Implementations must
 * be synchronous; the default writes through `localStorage`.
 */
export interface LayoutStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
