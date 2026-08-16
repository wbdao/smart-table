/**
 * Spreadsheet-like keyboard navigation for the table grid.
 *
 * Cells expose `role="gridcell"` and `tabindex`. The navigator owns the active
 * cell position (row/column indexes into the *current view*), moves focus with
 * the arrow keys / Home / End / Tab, and triggers in-cell editing with Enter.
 * It ignores keystrokes while an `<input>` is focused so the edit sessions
 * keep control of their own keys.
 */

export interface GridNavigationOptions {
  /** Element that receives the `keydown` listener (the scroll area). */
  root: HTMLElement;
  /** Current number of rows in the view. */
  rowCount: () => number;
  /** Current number of columns in the view. */
  columnCount: () => number;
  /** Resolves a cell element by view indexes, or `null`. */
  getCell: (rowIndex: number, columnIndex: number) => HTMLElement | null;
  /** Whether in-cell editing is currently allowed. */
  isEditable: () => boolean;
  /** Focuses a cell (moves the active highlight). */
  activate: (cell: HTMLElement) => void;
  /** Starts in-cell editing on a cell. */
  edit: (cell: HTMLElement) => void;
}

export interface GridNavigator {
  /** Moves the active cell (clamped to the grid bounds). */
  focus: (row: number, column: number, opts?: { edit?: boolean }) => void;
  /** Current active position, or `null` before any focus. */
  getActive: () => { row: number; column: number } | null;
  /** Re-applies focus classes after a re-render replaced the cells. */
  refresh: () => void;
  /** Removes the keydown listener. */
  destroy: () => void;
}

export function attachGridNavigation(options: GridNavigationOptions): GridNavigator {
  let activeRow = 0;
  let activeCol = 0;
  let hasActive = false;

  const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), max);

  const moveTo = (row: number, column: number, edit: boolean): void => {
    if (options.rowCount() === 0) return;
    activeRow = clamp(row, options.rowCount() - 1);
    activeCol = clamp(column, options.columnCount() - 1);
    hasActive = true;
    const cell = options.getCell(activeRow, activeCol);
    if (!cell) return;
    if (edit) options.edit(cell);
    else options.activate(cell);
  };

  const focus = (row: number, column: number, opts: { edit?: boolean } = {}): void => {
    moveTo(row, column, opts.edit ?? false);
  };

  const refresh = (): void => {
    if (!hasActive) return;
    const cell = options.getCell(activeRow, activeCol);
    if (cell) options.activate(cell);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
    ) {
      return;
    }
    if (!options.root.contains(document.activeElement)) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveTo(activeRow + 1, activeCol, false);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveTo(activeRow - 1, activeCol, false);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        moveTo(activeRow, activeCol - 1, false);
        break;
      case 'ArrowRight':
        event.preventDefault();
        moveTo(activeRow, activeCol + 1, false);
        break;
      case 'Home':
        event.preventDefault();
        moveTo(activeRow, 0, false);
        break;
      case 'End':
        event.preventDefault();
        moveTo(activeRow, options.columnCount() - 1, false);
        break;
      case 'Tab':
        event.preventDefault();
        moveTo(activeRow, event.shiftKey ? activeCol - 1 : activeCol + 1, false);
        break;
      case 'Enter':
        if (!options.isEditable()) return;
        event.preventDefault();
        {
          const cell = options.getCell(activeRow, activeCol);
          if (cell) options.edit(cell);
        }
        break;
      default:
        break;
    }
  };

  options.root.addEventListener('keydown', onKeydown);

  return {
    focus,
    getActive: () => (hasActive ? { row: activeRow, column: activeCol } : null),
    refresh,
    destroy: () => options.root.removeEventListener('keydown', onKeydown),
  };
}
