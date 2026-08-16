import { SmartTable, type SmartTableOptions } from '@smart-table/core';
import type { Column, DataRow, SmartEventMap } from '@smart-table/core';

/** Options accepted by the Angular adapter. `container` is owned by the adapter. */
export type AngularSmartTableOptions = Omit<SmartTableOptions, 'container'>;

/**
 * Framework-agnostic lifecycle wrapper around the headless core. The Angular
 * component delegates to this class, which keeps the instance, mounts it into
 * a caller-provided element, forwards events and destroys everything on
 * unmount. It is plain TypeScript so it can be unit-tested without an Angular
 * runtime.
 */
export class SmartTableController {
  private instance: SmartTable | null = null;
  private readonly options: AngularSmartTableOptions;

  constructor(
    private readonly host: HTMLElement,
    options: AngularSmartTableOptions
  ) {
    this.options = options;
  }

  /** Creates and mounts the table into the host element. Safe to call once. */
  mount(): SmartTable {
    if (this.instance) return this.instance;
    this.instance = new SmartTable(this.options);
    this.instance.mount(this.host);
    return this.instance;
  }

  /** The active table instance, if mounted. */
  getTable(): SmartTable | null {
    return this.instance;
  }

  /** Replaces the rows. No-op until `mount()` has been called. */
  setData(rows: DataRow[]): void {
    this.instance?.setData(rows);
  }

  /** Subscribes to a core event; returns an unsubscribe function. */
  on<K extends keyof SmartEventMap>(
    name: K,
    handler: (payload: SmartEventMap[K]) => void
  ): () => void {
    if (this.instance) return this.instance.on(name, handler);
    return () => undefined;
  }

  /** Unmounts the renderer and destroys the instance. */
  destroy(): void {
    this.instance?.unmount();
    this.instance?.destroy();
    this.instance = null;
  }

  /** Requires a column set before the table can be created. */
  static assertColumns(columns: Column[] | undefined): asserts columns is Column[] {
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error('[smart-table] "columns" is required.');
    }
  }
}
