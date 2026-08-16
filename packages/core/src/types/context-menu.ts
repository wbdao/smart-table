import type { DataRow } from './column';
import type { SmartTable } from '../core/SmartTable';

/** Where the right-click happened. */
export type ContextMenuTarget = 'header' | 'cell' | 'row';

/** Immutable info about the element that was right-clicked. */
export interface ContextMenuContext {
  table: SmartTable;
  target: ContextMenuTarget;
  /** The column field for `header`/`cell`, `null` for `row`. */
  field: string | null;
  /** The row for `cell`/`row`, `null` for `header`. */
  row: DataRow | null;
}

/** Built-in context-menu action ids. */
export type ContextMenuAction =
  | 'sort-asc'
  | 'sort-desc'
  | 'clear-sort'
  | 'hide-column'
  | 'reset-width'
  | 'copy-cell'
  | 'copy-row'
  | 'edit-cell'
  | 'delete-row';

/** A user-defined menu entry. */
export interface ContextMenuItem {
  /** Unique id (built-in ids reuse `ContextMenuAction`). */
  id: string;
  /** Human-readable label shown in the menu. */
  label: string;
  /** Only show for these targets. Defaults to every target. */
  target?: ContextMenuTarget | ContextMenuTarget[];
  /** Hide/disable the item when not applicable. */
  enabled?: boolean | ((context: ContextMenuContext) => boolean);
  /** Invoked with the context when the item is chosen. */
  run: (context: ContextMenuContext) => void;
}

/** Options for the built-in right-click context menu. */
export interface ContextMenuOptions {
  /** Enable the built-in menu. Default `true`. */
  enabled?: boolean;
  /** Extra items appended to the built-in items (filtered by `target`). */
  items?: ContextMenuItem[];
}
