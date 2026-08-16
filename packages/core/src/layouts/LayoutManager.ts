import type { SavedLayout, LayoutStorage } from '../types/layout';
import type { SmartTable } from '../core/SmartTable';

/**
 * Default synchronous storage: `localStorage` when available, otherwise an
 * in-memory `Map` so layouts never crash in SSR / storage-less environments.
 */
export function createDefaultLayoutStorage(): LayoutStorage {
  if (typeof localStorage !== 'undefined') {
    return {
      get(key) {
        return localStorage.getItem(key);
      },
      set(key, value) {
        localStorage.setItem(key, value);
      },
      remove(key) {
        localStorage.removeItem(key);
      },
    };
  }
  const memory = new Map<string, string>();
  return {
    get(key) {
      return memory.get(key) ?? null;
    },
    set(key, value) {
      memory.set(key, value);
    },
    remove(key) {
      memory.delete(key);
    },
  };
}

/**
 * Persists, lists, loads and deletes {@link SavedLayout} snapshots through a
 * {@link LayoutStorage} adapter under a namespaced storage key.
 */
export class LayoutManager {
  private readonly storage: LayoutStorage;
  private readonly key: string;

  constructor(storage: LayoutStorage, namespace: string) {
    this.storage = storage;
    this.key = `smarttable.layouts.${namespace}`;
  }

  /** Every stored layout, in insertion order. */
  list(): SavedLayout[] {
    const raw = this.storage.get(this.key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is SavedLayout => isValidLayout(item));
    } catch {
      return [];
    }
  }

  /** Persists a layout, replacing any layout with the same id. */
  save(layout: SavedLayout): void {
    const layouts = this.list().filter((item) => item.id !== layout.id);
    layouts.push(layout);
    this.storage.set(this.key, JSON.stringify(layouts));
  }

  /** Reads a single layout by id, or `undefined`. */
  load(id: string): SavedLayout | undefined {
    return this.list().find((layout) => layout.id === id);
  }

  /** Deletes a layout. Returns whether one was removed. */
  delete(id: string): boolean {
    const layouts = this.list();
    const remaining = layouts.filter((layout) => layout.id !== id);
    if (remaining.length === layouts.length) return false;
    this.storage.set(this.key, JSON.stringify(remaining));
    return true;
  }

  /** Clears every layout. */
  clear(): void {
    this.storage.remove(this.key);
  }
}

function isValidLayout(value: unknown): value is SavedLayout {
  if (typeof value !== 'object' || value === null) return false;
  const layout = value as Partial<SavedLayout>;
  return (
    typeof layout.id === 'string' &&
    Array.isArray(layout.columns) &&
    (layout.sort === null || (typeof layout.sort === 'object' && layout.sort !== null)) &&
    typeof layout.query === 'string' &&
    Array.isArray(layout.filters) &&
    typeof layout.savedAt === 'number'
  );
}

/**
 * Captures the table's current column order/visibility/width, sort and
 * structured filters into a {@link SavedLayout}.
 */
export function captureLayout(table: SmartTable, id: string, label?: string): SavedLayout {
  return {
    id,
    label,
    columns: table.getColumns().map((column) => ({
      field: column.field,
      visible: column.visible,
      ...(column.width !== undefined ? { width: column.width } : {}),
    })),
    sort: table.getSortState(),
    query: table.getFilterState().query,
    filters: table.getStructuredFilters(),
    savedAt: Date.now(),
  };
}
