import type { DataRow } from '../types/column';

/** Undoable "cell value changed" operation. */
export interface CellEditHistoryEntry {
  type: 'cellEdit';
  rowId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/** Undoable "row added" operation. */
export interface RowAddHistoryEntry {
  type: 'rowAdd';
  rowId: string;
  /** The normalized row object stored in the table. */
  row: DataRow;
  /** Dataset index the row was added at. */
  index: number;
}

/** Undoable "row removed" operation. */
export interface RowDeleteHistoryEntry {
  type: 'rowDelete';
  rowId: string;
  /** The removed row object (restored on undo). */
  row: DataRow;
  /** Dataset index the row was removed from. */
  index: number;
}

/** Any operation the history can undo/redo. */
export type HistoryEntry = CellEditHistoryEntry | RowAddHistoryEntry | RowDeleteHistoryEntry;

/** Snapshot of the undo/redo state, mirrored by the `historyChanged` event. */
export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

/**
 * A bounded undo/redo stack.
 *
 * Pushing a new entry clears the redo stack (standard behavior). The
 * `limit` bounds the undo stack; `0` disables recording entirely. The
 * manager is purely structural — it does not know how to apply entries,
 * it only stores them. {@link SmartTable} owns the application logic.
 */
export class HistoryManager {
  private readonly limit: number;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  constructor(limit = 100) {
    this.limit = limit;
  }

  /** Records a new operation. Clears the redo stack. */
  push(entry: HistoryEntry): void {
    if (this.limit <= 0) return;
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  peekUndo(): HistoryEntry | undefined {
    return this.undoStack[this.undoStack.length - 1];
  }

  peekRedo(): HistoryEntry | undefined {
    return this.redoStack[this.redoStack.length - 1];
  }

  popUndo(): HistoryEntry | undefined {
    return this.undoStack.pop();
  }

  popRedo(): HistoryEntry | undefined {
    return this.redoStack.pop();
  }

  pushRedo(entry: HistoryEntry): void {
    this.redoStack.push(entry);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  /** Drops every recorded operation. */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getState(): HistoryState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.getUndoCount(),
      redoCount: this.getRedoCount(),
    };
  }
}
