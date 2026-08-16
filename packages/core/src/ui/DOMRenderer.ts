import { Renderer } from './Renderer';
import { Toolbar, type ToolbarControl } from './Toolbar';
import { TableView } from './TableView';
import { CardView } from './CardView';
import { PivotView } from './PivotView';
import { ContextMenu } from './ContextMenu';
import { createElement, clearChildren, resolveElement } from './dom';
import { SmartTableError, ERROR_CODES } from '../core/errors';
import { SmartTable } from '../core/SmartTable';
import { getCellText } from '../utils';
import type {
  ContextMenuContext,
  ContextMenuOptions,
  ContextMenuTarget,
} from '../types/context-menu';
import type { DataRow } from '../types/column';
import type {
  ContextMenuActionEvent,
  ContextMenuEvent,
  DataChangedEvent,
  SelectionChangedEvent,
  ModeChangedEvent,
} from '../types/events';

/** The three responsive viewport states. */
export type ViewMode = 'desktop' | 'tablet' | 'mobile';

/** Identifies the cell currently being edited. */
export interface CellReference {
  rowId: string;
  field: string;
}

/**
 * UI-only state owned by the renderer. Data (rows, selection set, mode) stays
 * in the {@link SmartTable} instance; this is just what the renderer needs to
 * avoid redundant work (current viewport, active edit target, cached selection
 * for fast class toggling).
 */
export interface DOMRendererState {
  viewport: ViewMode;
  editingCell?: CellReference;
  selectedRows: Set<string>;
}

export interface DOMRendererOptions {
  /** Mount target (element or CSS selector). Falls back to the table's `container` option. */
  target?: HTMLElement | string | null;
  /** Show the toolbar. Default `true`. */
  toolbar?: boolean;
  /** Show the Edit/Delete actions column (editable mode only). Default `true`. */
  actions?: boolean;
  /** Make the table header sticky. Default `true`. */
  stickyHeader?: boolean;
  /** Toolbar controls (defaults to all built-in controls). */
  toolbarControls?: readonly ToolbarControl[];
  /** Custom width provider for the responsive layout (tests / embedded use). */
  widthProvider?: () => number;
}

/**
 * The built-in Vanilla DOM renderer.
 *
 * Responsibilities:
 * - mount / unmount a `.st-root` shell containing toolbar + viewport
 * - choose the viewport (`mobile` -> {@link CardView}, `tablet`/`desktop` ->
 *   {@link TableView}) from the responsive breakpoints
 * - subscribe to the table's events and patch the DOM incrementally:
 *   a single `cellEdit` updates one `<td>` in place, never a full re-render
 *
 * The renderer owns only UI state; all data stays in the {@link SmartTable}.
 */
export class DOMRenderer extends Renderer {
  private readonly options: DOMRendererOptions;
  private readonly state: DOMRendererState = {
    viewport: 'desktop',
    selectedRows: new Set(),
  };
  private readonly unsubscribers: Array<() => void> = [];

  private root: HTMLElement | null = null;
  private target: HTMLElement | null = null;
  private viewportEl: HTMLElement | null = null;
  private view: TableView | CardView | null = null;
  private pivotView: PivotView | null = null;
  private toolbar: Toolbar | null = null;
  private contextMenu: ContextMenu | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mounted = false;

  constructor(table: SmartTable, options: DOMRendererOptions = {}) {
    super(table);
    this.options = options;
  }

  // ------------------------------------------------------------- lifecycle

  mount(target?: HTMLElement | string): void {
    if (this.mounted) return;
    const resolved =
      resolveElement(target) ?? resolveElement(this.options.target) ?? this.table.getContainer();
    if (!resolved) {
      throw new SmartTableError(
        ERROR_CODES.NO_CONTAINER,
        'No mount target. Pass an element/selector to mount() or set the "container" option.'
      );
    }
    this.target = resolved;
    this.root = createElement('div', {
      className: 'st-root',
      attrs: { role: 'region', 'aria-label': 'SmartTable' },
    });
    this.root.setAttribute('data-st-mode', this.table.getMode());
    this.target.appendChild(this.root);
    this.renderToolbar();
    this.viewportEl = createElement('div', { className: 'st-viewport' });
    this.root.appendChild(this.viewportEl);
    this.contextMenu = new ContextMenu(this.root);
    this.bindEvents();
    this.updateViewport();
    this.watchResize();
    this.mounted = true;
  }

  unmount(): void {
    if (!this.mounted) return;
    this.cleanup();
    this.root?.remove();
    this.root = null;
    this.viewportEl = null;
    this.mounted = false;
  }

  override isMounted(): boolean {
    return this.mounted;
  }

  /** Re-renders the current viewport from the table state. */
  refresh(): void {
    if (!this.mounted) return;
    this.updateViewport();
    if (this.pivotView) {
      this.pivotView.render();
    } else {
      this.view?.render();
    }
    this.toolbar?.refresh();
  }

  override render(): void {
    this.refresh();
  }

  // ------------------------------------------------------------- internals

  private renderToolbar(): void {
    if (!this.root || this.options.toolbar === false) return;
    this.toolbar = new Toolbar({
      table: this.table,
      controls: this.options.toolbarControls,
    });
    this.root.prepend(this.toolbar.element);
  }

  private renderCurrentView(): void {
    if (!this.viewportEl) return;
    this.view?.destroy();
    this.view = null;
    this.pivotView?.destroy();
    this.pivotView = null;
    clearChildren(this.viewportEl);
    const pivot = this.table.getPivotResult();
    if (pivot) {
      this.pivotView = new PivotView({ table: this.table });
      this.viewportEl.appendChild(this.pivotView.element);
      this.root?.setAttribute('data-st-viewport', 'pivot');
      return;
    }
    const actions = this.options.actions !== false;
    if (this.state.viewport === 'mobile') {
      this.view = new CardView({ table: this.table, actions });
    } else {
      this.view = new TableView({
        table: this.table,
        actions,
        stickyHeader: this.options.stickyHeader !== false,
      });
    }
    this.viewportEl.appendChild(this.view.element);
    this.root?.setAttribute('data-st-viewport', this.state.viewport);
  }

  /** Recomputes the viewport and swaps the view when the breakpoint changed. */
  private updateViewport(): void {
    const next = this.computeViewport();
    if (next === this.state.viewport && this.view) return;
    this.state.viewport = next;
    this.renderCurrentView();
  }

  private computeViewport(): ViewMode {
    if (!this.table.responsive) return 'desktop';
    const breakpoints = this.table.getBreakpoints();
    const width = this.getWidth();
    if (width < breakpoints.mobile) return 'mobile';
    if (width < breakpoints.desktop) return 'tablet';
    return 'desktop';
  }

  private getWidth(): number {
    if (this.options.widthProvider) return this.options.widthProvider();
    if (this.target && this.target.clientWidth > 0) return this.target.clientWidth;
    return typeof window !== 'undefined' ? window.innerWidth : 0;
  }

  /** Row-level patch: rebuilds only the row body (header + scroll kept). */
  private patchRow(): void {
    this.view?.syncRows();
  }

  /** Cell-level patch: updates a single cell in place. */
  private patchCell(rowId: string, field: string): void {
    this.view?.updateCell(rowId, field);
  }

  private bindEvents(): void {
    this.root?.addEventListener('contextmenu', this.onContextMenu);
    this.unsubscribers.push(() =>
      this.root?.removeEventListener('contextmenu', this.onContextMenu)
    );
    this.unsubscribers.push(
      this.table.on('dataChanged', (event: DataChangedEvent) => {
        if (event.operation === 'updateCell') return;
        this.patchRow();
      }),
      this.table.on('cellEdit', (event) => this.patchCell(event.rowId, event.field)),
      this.table.on('selectionChanged', (event: SelectionChangedEvent) => {
        this.state.selectedRows = new Set(event.rowIds);
        this.view?.setSelection(event.rowIds);
      }),
      this.table.on('modeChanged', (event: ModeChangedEvent) => {
        this.root?.setAttribute('data-st-mode', event.mode);
        this.view?.setMode(event.mode);
      }),
      this.table.on('sortChanged', (event) => {
        this.view?.setSort(event.field, event.direction);
        this.view?.syncRows();
      }),
      this.table.on('filterChanged', () => this.patchRow()),
      this.table.on('columnVisibilityChanged', () => {
        this.view?.render();
        this.toolbar?.refresh();
      }),
      this.table.on('columnResized', (event) => {
        if (this.view instanceof TableView) {
          this.view.applyColumnWidth(event.field, event.width);
        }
      }),
      this.table.on('columnReordered', () => this.view?.render()),
      this.table.on('validationFailed', (event) =>
        this.view?.showValidationErrors(event.rowId, event.field, event.messages)
      ),
      this.table.on('pageChanged', () => {
        this.view?.render();
        this.toolbar?.refresh();
      }),
      this.table.on('groupChanged', () => this.patchRow()),
      this.table.on('nodeExpanded', () => this.patchRow()),
      this.table.on('nodeCollapsed', () => this.patchRow()),
      this.table.on('aggregationChanged', () => this.patchRow()),
      this.table.on('dataLoaded', () => this.patchRow()),
      this.table.on('pivotChanged', () => {
        this.renderCurrentView();
        this.toolbar?.refresh();
      }),
      this.table.on('layoutChanged', () => {
        this.view?.render();
        this.toolbar?.refresh();
      })
    );
  }

  private watchResize(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize);
      this.unsubscribers.push(() => window.removeEventListener('resize', this.onResize));
    }
    if (typeof ResizeObserver !== 'undefined' && this.target) {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this.target);
    }
  }

  private onResize = (): void => {
    this.updateViewport();
  };

  // --------------------------------------------------------- context menu

  private onContextMenu = (event: MouseEvent): void => {
    const menu = this.contextMenu;
    const root = this.root;
    if (!menu || !root) return;
    const options = this.table.getContextMenuOptions();
    if (options.enabled === false) return;

    const target = event.target as Element | null;
    if (!target) return;
    const th = target.closest<HTMLElement>('th[data-field]');
    const td = th ? null : target.closest<HTMLElement>('td[data-field]');
    const cardValue = th || td ? null : target.closest<HTMLElement>('[data-field-value]');
    const tr = th || td || cardValue ? null : target.closest<HTMLElement>('tr.st-row');
    const card = th || td || cardValue || tr ? null : target.closest<HTMLElement>('.st-card');

    let menuTarget: ContextMenuTarget | null = null;
    let field: string | null = null;
    let rowId: string | null = null;
    if (th) {
      menuTarget = 'header';
      field = th.dataset.field ?? null;
    } else if (td) {
      menuTarget = 'cell';
      field = td.dataset.field ?? null;
      rowId = td.closest<HTMLElement>('tr.st-row')?.dataset.rowId ?? null;
    } else if (cardValue) {
      menuTarget = 'cell';
      field = cardValue.dataset.fieldValue ?? null;
      rowId = cardValue.closest<HTMLElement>('.st-card')?.dataset.rowId ?? null;
    } else if (tr) {
      menuTarget = 'row';
      rowId = tr.dataset.rowId ?? null;
    } else if (card) {
      menuTarget = 'row';
      rowId = card.dataset.rowId ?? null;
    }
    if (!menuTarget) return;

    event.preventDefault();
    menu.close();
    const row = rowId ? this.table.getRow(rowId) : undefined;
    const context: ContextMenuContext = {
      table: this.table,
      target: menuTarget,
      field,
      row: row ?? null,
    };
    const entries = this.buildMenuItems(context, options);
    if (entries.length === 0) return;

    const rect = root.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    menu.open(entries, x, y);

    const menuEvent: ContextMenuEvent = {
      target: menuTarget,
      field,
      row: row ?? null,
      x,
      y,
      items: entries.map((entry) => entry.id),
    };
    this.table.events.emit('contextMenu', menuEvent);
  };

  private buildMenuItems(
    context: ContextMenuContext,
    options: ContextMenuOptions
  ): Array<{ id: string; label: string; enabled: boolean; onSelect: () => void }> {
    const { table, target, field, row } = context;
    const column = field ? table.getColumn(field) : undefined;
    const entries: Array<{ id: string; label: string; enabled: boolean; onSelect: () => void }> =
      [];

    const add = (id: string, label: string, enabled: boolean, run: () => void): void => {
      entries.push({
        id,
        label,
        enabled,
        onSelect: () => {
          this.emitAction(id, context);
          run();
        },
      });
    };

    if (target === 'header' && column && field) {
      add('sort-asc', 'Sort ascending', column.sortable, () => table.sort(field, 'asc'));
      add('sort-desc', 'Sort descending', column.sortable, () => table.sort(field, 'desc'));
      add('clear-sort', 'Clear sort', table.getSortState().field === field, () =>
        table.clearSort()
      );
      add('hide-column', 'Hide column', true, () => table.hideColumn(field));
      add('reset-width', 'Reset column width', table.getColumnWidth(field) !== undefined, () =>
        table.resetColumnWidth(field)
      );
    }

    if (target === 'cell' && column && row && field) {
      add('copy-cell', 'Copy cell', true, () => this.copyText(getCellText(column, row)));
      add('copy-row', 'Copy row', true, () => this.copyText(this.serializeRow(row)));
      add('edit-cell', 'Edit cell', table.isEditable() && column.editable !== false, () =>
        this.view?.editCellAt(this.table.getRowId(row) ?? '', field)
      );
      add('delete-row', 'Delete row', table.isEditable(), () => table.removeRow(row));
    }

    if (target === 'row' && row) {
      add('copy-row', 'Copy row', true, () => this.copyText(this.serializeRow(row)));
      add('delete-row', 'Delete row', table.isEditable(), () => table.removeRow(row));
    }

    for (const item of options.items ?? []) {
      const matches =
        item.target === undefined ||
        item.target === target ||
        (Array.isArray(item.target) && item.target.includes(target));
      if (!matches) continue;
      const enabled =
        typeof item.enabled === 'function' ? item.enabled(context) : (item.enabled ?? true);
      entries.push({
        id: item.id,
        label: item.label,
        enabled,
        onSelect: () => {
          this.emitAction(item.id, context);
          item.run(context);
        },
      });
    }
    return entries;
  }

  private emitAction(action: string, context: ContextMenuContext): void {
    const event: ContextMenuActionEvent = {
      action,
      target: context.target,
      field: context.field,
      row: context.row,
    };
    this.table.events.emit('contextMenuAction', event);
  }

  private serializeRow(row: DataRow): string {
    return this.table
      .getVisibleColumns()
      .map((column) => getCellText(column, row))
      .join('\t');
  }

  private copyText(text: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  private cleanup(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers.length = 0;
    this.contextMenu?.close();
    this.view?.destroy();
    this.view = null;
    this.pivotView?.destroy();
    this.pivotView = null;
    this.toolbar?.destroy();
    this.toolbar = null;
  }
}

/**
 * Registers `DOMRenderer` as the default factory for `table.mount()`.
 * Importing this module (via the package entry) enables the ergonomic
 * `table.mount(target)` API out of the box.
 */
SmartTable.registerRenderer((table, target) => new DOMRenderer(table, { target }));
