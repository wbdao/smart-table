import '@smart-table/core/styles.css';
import './styles.css';
import { SmartTable, type AggregationOp, type GridState, type ThemeName } from '@smart-table/core';
import { DATASETS, DEFAULT_DATASET, type Dataset } from './datasets';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

interface PlaygroundState {
  datasetId: string;
  theme: ThemeName;
  editable: boolean;
  pageSize: number;
  virtualScroll: boolean;
  responsive: boolean;
  contextMenu: boolean;
  tree: boolean;
  groupField: string;
  aggregate: boolean;
}

const DEFAULT_STATE: PlaygroundState = {
  datasetId: DEFAULT_DATASET.id,
  theme: 'light',
  editable: true,
  pageSize: 0,
  virtualScroll: false,
  responsive: true,
  contextMenu: true,
  tree: false,
  groupField: '',
  aggregate: true,
};

function persistState(state: PlaygroundState): void {
  localStorage.setItem('smart-table-playground', JSON.stringify(state));
}

function restoreState(): PlaygroundState {
  try {
    const raw = localStorage.getItem('smart-table-playground');
    if (raw) return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<PlaygroundState>) };
  } catch {
    /* ignore corrupt state */
  }
  return { ...DEFAULT_STATE };
}

class Playground {
  private readonly state: PlaygroundState;
  private readonly tableHost: HTMLElement;
  private table: SmartTable | null = null;

  constructor() {
    this.state = restoreState();
    this.tableHost = $<HTMLElement>('#table-host');
    this.refreshDatasetOptions();
    this.bindControls();
    this.bindCode();
    this.rebuild();
  }

  private dataset(): Dataset {
    return DATASETS.find((d) => d.id === this.state.datasetId) ?? DEFAULT_DATASET;
  }

  private refreshDatasetOptions(): void {
    const select = $<HTMLSelectElement>('#dataset');
    select.innerHTML = '';
    for (const d of DATASETS) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.label;
      if (d.id === this.state.datasetId) opt.selected = true;
      select.appendChild(opt);
    }
  }

  private bindControls(): void {
    $<HTMLSelectElement>('#dataset').addEventListener('change', (e) => {
      this.state.datasetId = (e.target as HTMLSelectElement).value;
      this.refreshGroupOptions();
      this.rebuild();
    });
    $<HTMLSelectElement>('#theme').addEventListener('change', (e) => {
      this.state.theme = (e.target as HTMLSelectElement).value as ThemeName;
      this.rebuild();
    });
    $<HTMLInputElement>('#editable').addEventListener('change', (e) => {
      this.state.editable = (e.target as HTMLInputElement).checked;
      this.rebuild();
    });
    $<HTMLSelectElement>('#page-size').addEventListener('change', (e) => {
      this.state.pageSize = Number((e.target as HTMLSelectElement).value);
      this.rebuild();
    });
    for (const key of [
      'virtualScroll',
      'responsive',
      'contextMenu',
      'tree',
      'aggregate',
    ] as const) {
      $(`#${key}`).addEventListener('change', (e) => {
        this.state[key] = (e.target as HTMLInputElement).checked;
        this.rebuild();
      });
    }
    $<HTMLSelectElement>('#group-field').addEventListener('change', (e) => {
      this.state.groupField = (e.target as HTMLSelectElement).value;
      this.rebuild();
    });
    this.refreshGroupOptions();
  }

  private bindCode(): void {
    $<HTMLButtonElement>('#export-state').addEventListener('click', () => {
      const state = this.table?.exportState();
      const textarea = $<HTMLTextAreaElement>('#state-code');
      textarea.value = state ? JSON.stringify(state, null, 2) : '';
    });
    $<HTMLButtonElement>('#import-state').addEventListener('click', () => {
      const value = $<HTMLTextAreaElement>('#state-code').value.trim();
      if (!value) return;
      try {
        this.table?.importState(JSON.parse(value) as GridState);
      } catch (err) {
        alert(`Invalid state: ${(err as Error).message}`);
      }
    });
  }

  private refreshGroupOptions(): void {
    const select = $<HTMLSelectElement>('#group-field');
    select.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '(none)';
    select.appendChild(none);
    for (const col of this.dataset().columns.filter(
      (c) => c.type !== 'number' && c.type !== 'boolean'
    )) {
      const opt = document.createElement('option');
      opt.value = col.field;
      opt.textContent = `${col.title ?? col.field}`;
      if (col.field === this.state.groupField) opt.selected = true;
      select.appendChild(opt);
    }
  }

  private buildAggregations(): Record<string, AggregationOp> | undefined {
    if (!this.state.aggregate) return undefined;
    const numeric = this.dataset().columns.filter((c) => c.type === 'number');
    if (numeric.length === 0) return undefined;
    const acc: Record<string, AggregationOp> = {};
    for (const col of numeric.slice(0, 2)) acc[col.field] = 'sum';
    return acc;
  }

  private rebuild(): void {
    this.table?.unmount();
    this.table?.destroy();

    const dataset = this.dataset();
    const options = {
      columns: dataset.columns,
      data: dataset.rows,
      theme: this.state.theme,
      editable: this.state.editable,
      pageSize: this.state.pageSize,
      responsive: this.state.responsive,
      contextMenu: this.state.contextMenu,
      virtualScroll: this.state.virtualScroll,
      tree: this.state.tree,
      aggregations: this.buildAggregations(),
    };

    this.table = new SmartTable(options);
    this.table.mount(this.tableHost);
    if (this.state.groupField) this.table.groupBy(this.state.groupField);
    this.updateStats();
    persistState(this.state);
  }

  private updateStats(): void {
    const el = $<HTMLElement>('#stats');
    const t = this.table;
    if (!t) return;
    el.textContent =
      `${t.getRowCount().toLocaleString()} rows | ` +
      `${t.getViewCount().toLocaleString()} in view | ` +
      `page ${t.getCurrentPage()}/${Math.max(t.getTotalPages(), 1)}`;
  }
}

// Boot the app. `window.Playground` lets Vite HMR-experimenters rebuild safely.
export const playground = new Playground();
declare global {
  interface Window {
    Playground: typeof playground;
  }
}
window.Playground = playground;
