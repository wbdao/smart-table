import { createElement, clearChildren } from './dom';
import type { SmartTable } from '../core/SmartTable';
import { FilterBuilder } from '../filters/FilterBuilder';

/** Built-in toolbar controls. `mode` toggles editable/readonly. */
export type ToolbarControl =
  | 'search'
  | 'copy'
  | 'clone'
  | 'add'
  | 'mode'
  | 'columns'
  | 'pagination'
  | 'filters'
  | 'layouts'
  | 'export';

export interface ToolbarOptions {
  table: SmartTable;
  /** Controls to render, in order. Defaults to all built-in controls. */
  controls?: readonly ToolbarControl[];
  /** Debounce delay for the search input in ms. Default `200`. */
  searchDelay?: number;
  /** Extra class names applied to the toolbar element. */
  className?: string;
}

const CONTROL_LABELS: Record<ToolbarControl, string> = {
  search: 'Search',
  copy: 'Copy',
  clone: 'Clone',
  add: 'Add row',
  mode: 'Edit',
  columns: 'Columns',
  pagination: 'Pagination',
  filters: 'Filters',
  layouts: 'Layouts',
  export: 'Export',
};

/**
 * The built-in toolbar. Each control performs its action through the public
 * {@link SmartTable} API (`filter`, `copy`, `clone`, `addRow`, `setMode`) and
 * then emits the corresponding `toolbar:*` event for observability.
 *
 * - `search`   -> `table.filter()` + `toolbar:search`
 * - `copy`     -> `table.copy()`   + `toolbar:copy`
 * - `clone`    -> `table.clone()`  + `toolbar:clone`
 * - `add`      -> `table.addRow()` + `toolbar:add`  (disabled in readonly)
 * - `mode`     -> `table.setMode()`+ `toolbar:mode`
 * - `columns`  -> toggles a picker that hides/shows columns via the table API
 */
export class Toolbar {
  readonly element: HTMLElement;

  private readonly table: SmartTable;
  private readonly controls: readonly ToolbarControl[];
  private readonly searchDelay: number;
  private readonly unsubscribers: Array<() => void> = [];
  private searchInput: HTMLInputElement | null = null;
  private modeButton: HTMLButtonElement | null = null;
  private columnButton: HTMLButtonElement | null = null;
  private columnPicker: HTMLDivElement | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private pager: HTMLDivElement | null = null;
  private pagerInfo: HTMLSpanElement | null = null;
  private filterButton: HTMLButtonElement | null = null;
  private filterBuilder: FilterBuilder | null = null;
  private layoutButton: HTMLButtonElement | null = null;
  private layoutPanel: HTMLDivElement | null = null;
  private layoutNameInput: HTMLInputElement | null = null;
  private layoutList: HTMLDivElement | null = null;
  private exportButton: HTMLButtonElement | null = null;
  private exportMenu: HTMLDivElement | null = null;

  constructor(options: ToolbarOptions) {
    this.table = options.table;
    this.controls = options.controls ?? ['search', 'copy', 'clone', 'add', 'mode', 'columns'];
    this.searchDelay = options.searchDelay ?? 200;
    const className = options.className ? `st-toolbar ${options.className}` : 'st-toolbar';
    this.element = createElement('div', {
      className,
      attrs: { role: 'toolbar', 'aria-label': 'Table toolbar' },
    });
    this.render();
    this.bind();
  }

  /** Rebuilds the control row. */
  private render(): void {
    if (this.controls.includes('search')) {
      this.searchInput = createElement('input', {
        className: 'st-toolbar-search',
        attrs: { type: 'search', placeholder: 'Search…', 'aria-label': 'Search rows' },
      });
      this.element.appendChild(this.searchInput);
    }
    for (const control of this.controls) {
      if (control === 'search') continue;
      const button = createElement('button', {
        className: 'st-toolbar-btn',
        attrs: { type: 'button', 'data-st-control': control },
      });
      button.textContent = control === 'mode' ? this.modeLabel() : CONTROL_LABELS[control];
      this.element.appendChild(button);
      if (control === 'mode') this.modeButton = button;
      if (control === 'columns') {
        this.columnButton = button;
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-haspopup', 'menu');
      }
      if (control === 'filters') {
        this.filterButton = button;
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-haspopup', 'dialog');
      }
      if (control === 'layouts') {
        this.layoutButton = button;
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-haspopup', 'menu');
      }
      if (control === 'export') {
        this.exportButton = button;
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-haspopup', 'menu');
      }
    }
    this.renderColumnsPicker();
    this.renderFilterBuilder();
    this.renderLayoutsPanel();
    this.renderExportMenu();
    this.renderPager();
    this.refresh();
  }

  /** Renders the (initially hidden) saved-layouts popover. */
  private renderLayoutsPanel(): void {
    if (!this.controls.includes('layouts')) return;
    const panel = createElement('div', {
      className: 'st-layout-panel',
      attrs: { hidden: '', role: 'menu', 'aria-label': 'Saved layouts' },
    });
    const saveRow = createElement('div', { className: 'st-layout-save' });
    this.layoutNameInput = createElement('input', {
      className: 'st-layout-name',
      attrs: { type: 'text', placeholder: 'Layout name…', 'aria-label': 'Layout name' },
    });
    const saveButton = createElement('button', {
      className: 'st-toolbar-btn st-layout-save-btn',
      attrs: { type: 'button' },
    });
    saveButton.textContent = 'Save';
    saveRow.append(this.layoutNameInput, saveButton);
    this.layoutList = createElement('div', { className: 'st-layout-list' });
    panel.append(saveRow, this.layoutList);
    this.element.appendChild(panel);
    this.layoutPanel = panel;

    saveButton.addEventListener('click', () => {
      const label = this.layoutNameInput?.value.trim();
      this.table.saveLayout(label || undefined);
      if (this.layoutNameInput) this.layoutNameInput.value = '';
      this.renderLayoutList();
    });
    this.layoutList.addEventListener('click', (event) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
        '[data-st-layout]'
      );
      const id = button?.dataset.stLayout;
      if (!id) return;
      const remove = button.classList.contains('st-layout-delete');
      if (remove) {
        this.table.deleteLayout(id);
      } else {
        this.table.loadLayout(id);
      }
      this.renderLayoutList();
    });
  }

  private renderLayoutList(): void {
    if (!this.layoutList) return;
    clearChildren(this.layoutList);
    const layouts = this.table.getLayouts();
    if (layouts.length === 0) {
      const empty = createElement('div', { className: 'st-filter-empty' });
      empty.textContent = 'No saved layouts';
      this.layoutList.appendChild(empty);
      return;
    }
    for (const layout of layouts) {
      const item = createElement('div', { className: 'st-layout-item' });
      const load = createElement('button', {
        className: 'st-layout-load',
        attrs: {
          type: 'button',
          'data-st-layout': layout.id,
          'aria-label': `Load layout ${layout.label ?? layout.id}`,
        },
      });
      load.textContent = layout.label ?? layout.id;
      const remove = createElement('button', {
        className: 'st-layout-delete',
        attrs: {
          type: 'button',
          'data-st-layout': layout.id,
          'aria-label': `Delete layout ${layout.label ?? layout.id}`,
        },
      });
      remove.textContent = '×';
      item.append(load, remove);
      this.layoutList.appendChild(item);
    }
  }

  private toggleLayoutsPanel(): void {
    if (!this.layoutPanel || !this.layoutButton) return;
    const willOpen = this.layoutPanel.hidden;
    this.layoutPanel.hidden = !willOpen;
    this.layoutButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) this.renderLayoutList();
  }

  private closeLayoutsPanel(): void {
    if (!this.layoutPanel) return;
    this.layoutPanel.hidden = true;
    this.layoutButton?.setAttribute('aria-expanded', 'false');
  }

  /** Renders the (initially hidden) filter builder popover. */
  private renderFilterBuilder(): void {
    if (!this.controls.includes('filters')) return;
    this.filterBuilder = new FilterBuilder(this.table);
    this.element.appendChild(this.filterBuilder.element);
  }

  private toggleFilterBuilder(): void {
    if (!this.filterBuilder || !this.filterButton) return;
    const willOpen = this.filterBuilder.element.hidden;
    this.filterBuilder.element.hidden = !willOpen;
    this.filterButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) this.filterBuilder.render();
  }

  private closeFilterBuilder(): void {
    if (!this.filterBuilder) return;
    this.filterBuilder.element.hidden = true;
    this.filterButton?.setAttribute('aria-expanded', 'false');
  }

  /** Renders the export dropdown (CSV / JSON download buttons). */
  private renderExportMenu(): void {
    if (!this.controls.includes('export')) return;
    const menu = createElement('div', {
      className: 'st-export-panel',
      attrs: { hidden: '', role: 'menu', 'aria-label': 'Export options' },
    });
    for (const format of ['csv', 'json'] as const) {
      const button = createElement('button', {
        className: 'st-toolbar-btn st-export-option',
        attrs: { type: 'button', 'data-st-export': format, role: 'menuitem' },
      });
      button.textContent = format === 'csv' ? 'Export CSV…' : 'Export JSON…';
      menu.appendChild(button);
    }
    menu.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const rawFormat = target?.closest<HTMLButtonElement>('[data-st-export]')?.dataset.stExport;
      if (rawFormat !== 'csv' && rawFormat !== 'json') return;
      this.closeExportMenu();
      if (rawFormat === 'csv') this.table.exportCSV();
      else this.table.exportJSON();
      this.table.events.emit('toolbar:export', { format: rawFormat });
    });
    this.element.appendChild(menu);
    this.exportMenu = menu;
  }

  private toggleExportMenu(): void {
    if (!this.exportMenu || !this.exportButton) return;
    const willOpen = this.exportMenu.hidden;
    this.exportMenu.hidden = !willOpen;
    this.exportButton.setAttribute('aria-expanded', String(willOpen));
  }

  private closeExportMenu(): void {
    if (!this.exportMenu) return;
    this.exportMenu.hidden = true;
    this.exportButton?.setAttribute('aria-expanded', 'false');
  }

  /** Renders the pagination controls (only when pagination is enabled). */
  private renderPager(): void {
    if (!this.controls.includes('pagination')) return;
    const pager = createElement('div', {
      className: 'st-pagination',
      attrs: { role: 'navigation', 'aria-label': 'Pagination' },
    });
    const prev = createElement('button', {
      className: 'st-toolbar-btn st-pager-prev',
      attrs: { type: 'button', 'data-st-pager': 'prev', 'aria-label': 'Previous page' },
    });
    prev.textContent = '‹';
    const info = createElement('span', { className: 'st-pager-info' });
    const next = createElement('button', {
      className: 'st-toolbar-btn st-pager-next',
      attrs: { type: 'button', 'data-st-pager': 'next', 'aria-label': 'Next page' },
    });
    next.textContent = '›';
    pager.append(prev, info, next);
    this.element.appendChild(pager);
    this.pager = pager;
    this.pagerInfo = info;
  }

  private updatePager(): void {
    if (!this.pager || !this.pagerInfo) return;
    const page = this.table.getCurrentPage();
    const total = this.table.getTotalPages();
    this.pagerInfo.textContent = `Page ${page} / ${total}`;
    const prev = this.pager.querySelector<HTMLButtonElement>('.st-pager-prev');
    const next = this.pager.querySelector<HTMLButtonElement>('.st-pager-next');
    if (prev) prev.disabled = !this.table.canGoPrev();
    if (next) next.disabled = !this.table.canGoNext();
  }

  /** Renders the (initially hidden) column visibility picker. */
  private renderColumnsPicker(): void {
    if (!this.controls.includes('columns')) return;
    const picker = createElement('div', {
      className: 'st-column-picker',
      attrs: { hidden: '', role: 'menu', 'aria-label': 'Column visibility' },
    });
    this.renderColumnList(picker);
    this.element.appendChild(picker);
    this.columnPicker = picker;
  }

  private renderColumnList(picker: HTMLElement): void {
    clearChildren(picker);
    for (const column of this.table.getColumns()) {
      const label = createElement('label', { className: 'st-column-picker-item' });
      const checkbox = createElement('input', {
        className: 'st-column-toggle',
        attrs: { type: 'checkbox', 'data-field': column.field },
      });
      checkbox.checked = column.visible;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(column.title));
      picker.appendChild(label);
    }
  }

  private toggleColumnsPicker(): void {
    if (!this.columnPicker || !this.columnButton) return;
    const willOpen = this.columnPicker.hidden;
    this.columnPicker.hidden = !willOpen;
    this.columnButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) this.renderColumnList(this.columnPicker);
  }

  private closeColumnsPicker(): void {
    if (!this.columnPicker) return;
    this.columnPicker.hidden = true;
    this.columnButton?.setAttribute('aria-expanded', 'false');
  }

  private modeLabel(): string {
    return this.table.isEditable() ? 'Read only' : 'Edit';
  }

  private bind(): void {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.onSearchInput());
    }
    this.element.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>('[data-st-control]');
      if (button && this.element.contains(button)) {
        void this.dispatch(button.dataset.stControl as ToolbarControl);
        return;
      }
      const pagerButton = target?.closest<HTMLButtonElement>('[data-st-pager]');
      if (pagerButton && this.element.contains(pagerButton)) {
        this.dispatchPager(pagerButton.dataset.stPager as 'prev' | 'next');
      }
    });
    if (this.columnPicker) {
      this.columnPicker.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement | null;
        if (!target?.classList.contains('st-column-toggle')) return;
        const field = target.dataset.field;
        if (field) this.table.toggleColumn(field);
      });
    }
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onDocumentKeydown);
    this.unsubscribers.push(
      this.table.on('modeChanged', () => this.refresh()),
      this.table.on('pageChanged', () => this.updatePager()),
      this.table.on('columnVisibilityChanged', () => {
        if (this.columnPicker && !this.columnPicker.hidden)
          this.renderColumnList(this.columnPicker);
        this.filterBuilder?.render();
      }),
      this.table.on('filterChanged', () => {
        if (this.filterBuilder && !this.filterBuilder.element.hidden) this.filterBuilder.render();
      })
    );
  }

  private dispatchPager(action: 'prev' | 'next'): void {
    if (action === 'prev') {
      if (!this.table.prevPage()) return;
    } else if (!this.table.nextPage()) {
      return;
    }
    this.updatePager();
    this.table.events.emit('toolbar:page', {
      page: this.table.getCurrentPage(),
      pageSize: this.table.getPageSize(),
    });
  }

  private onDocumentClick = (event: MouseEvent): void => {
    const target = event.target as Node | null;
    if (
      this.columnPicker &&
      !this.columnPicker.hidden &&
      !this.columnButton?.contains(target) &&
      !this.columnPicker.contains(target)
    ) {
      this.closeColumnsPicker();
    }
    if (
      this.filterBuilder &&
      !this.filterBuilder.element.hidden &&
      !this.filterButton?.contains(target) &&
      !this.filterBuilder.element.contains(target)
    ) {
      this.closeFilterBuilder();
    }
    if (
      this.layoutPanel &&
      !this.layoutPanel.hidden &&
      !this.layoutButton?.contains(target) &&
      !this.layoutPanel.contains(target)
    ) {
      this.closeLayoutsPanel();
    }
    if (
      this.exportMenu &&
      !this.exportMenu.hidden &&
      !this.exportButton?.contains(target) &&
      !this.exportMenu.contains(target)
    ) {
      this.closeExportMenu();
    }
  };

  private onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.closeColumnsPicker();
      this.closeFilterBuilder();
      this.closeLayoutsPanel();
      this.closeExportMenu();
    }
  };

  private onSearchInput(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      if (!this.searchInput) return;
      const query = this.searchInput.value;
      this.table.filter(query);
      this.table.events.emit('toolbar:search', { query });
    }, this.searchDelay);
  }

  private async dispatch(control: ToolbarControl): Promise<void> {
    switch (control) {
      case 'copy': {
        try {
          await this.table.copy();
        } catch {
          // Clipboard failures are already tolerated by the core.
        }
        this.table.events.emit('toolbar:copy', { format: 'text' });
        break;
      }
      case 'clone': {
        const clone = this.table.clone();
        this.table.events.emit('toolbar:clone', { clone });
        break;
      }
      case 'add': {
        const row = this.table.addRow({});
        const rowId = this.table.getRowId(row) ?? '';
        const rowIndex = this.table.getRowIndex(row);
        this.table.events.emit('toolbar:add', { row, rowId, rowIndex });
        break;
      }
      case 'mode': {
        const mode = this.table.isEditable() ? 'readonly' : 'editable';
        this.table.setMode(mode);
        this.table.events.emit('toolbar:mode', { mode });
        break;
      }
      case 'columns': {
        this.toggleColumnsPicker();
        break;
      }
      case 'filters': {
        this.toggleFilterBuilder();
        break;
      }
      case 'layouts': {
        this.toggleLayoutsPanel();
        break;
      }
      case 'export': {
        this.toggleExportMenu();
        break;
      }
      default:
        break;
    }
  }

  /** Updates mode-dependent control state (labels, disabled flags). */
  refresh(): void {
    const editable = this.table.isEditable();
    for (const button of this.element.querySelectorAll<HTMLButtonElement>(
      '[data-st-control="add"]'
    )) {
      button.disabled = !editable;
    }
    if (this.modeButton) this.modeButton.textContent = this.modeLabel();
    this.updatePager();
  }

  /** Removes listeners and pending timers. */
  destroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onDocumentKeydown);
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers.length = 0;
  }
}
