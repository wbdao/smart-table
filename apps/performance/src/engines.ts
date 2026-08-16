import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'tabulator-tables/dist/css/tabulator_simple.min.css';
import 'gridjs/dist/theme/mermaid.min.css';

import { SmartTable, type Column, type DataRow } from '@smart-table/core';
import { createGrid, type ColDef } from 'ag-grid-community';
import { Tabulator } from 'tabulator-tables';
import { Grid } from 'gridjs';

type GCell = string | number | boolean;

export interface BenchResult {
  engine: string;
  mountMs: number;
  sortMs: number;
  filterMs: number;
  viewCount: number;
  filteredCount: number;
}

interface EngineHandle {
  viewCount(): number;
  filteredCount(): number;
  setSort(field: string): void;
  setFilter(field: string, threshold: number): void;
  destroy(): void;
}

export interface BenchEngine {
  readonly id: string;
  readonly label: string;
  mount(container: HTMLElement, columns: Column[], rows: DataRow[]): Promise<EngineHandle>;
}

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Let asynchronous grids settle before/after an operation. */
async function settle(extra = 0): Promise<void> {
  await nextFrame();
  await sleep(extra);
}

function freshContainer(host: HTMLElement): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'perf-cell';
  host.appendChild(cell);
  return cell;
}

// ---------------------------------------------------------------- SmartTable

const smartTableEngine: BenchEngine = {
  id: 'smart-table',
  label: 'SmartTableJS',
  async mount(container, columns, rows) {
    const table = new SmartTable({ columns, data: rows, theme: 'light', pageSize: 0 });
    table.mount(container);
    return {
      viewCount: () => table.getViewCount(),
      filteredCount: () => table.getViewCount(),
      setSort: (field) => table.sort(field, 'desc'),
      setFilter: (field, threshold) => table.where(field, 'greaterThan', threshold),
      destroy: () => table.destroy(),
    };
  },
};

// ---------------------------------------------------------------- AG Grid

const agGridEngine: BenchEngine = {
  id: 'ag-grid',
  label: 'AG Grid',
  async mount(container, columns, rows) {
    container.classList.add('ag-theme-quartz');
    const colDefs: ColDef[] = columns.map((c) => ({
      field: c.field,
      headerName: c.title ?? c.field,
      width: 120,
    }));
    const api = createGrid(container, {
      columnDefs: colDefs,
      rowData: rows as unknown[],
      rowHeight: 30,
      suppressCellFocus: true,
    });
    await settle(80);
    return {
      viewCount: () => api.getDisplayedRowCount(),
      filteredCount: () => api.getDisplayedRowCount(),
      setSort: (field) => {
        api.applyColumnState({ state: [{ colId: field, sort: 'desc' }] });
        void settle(40);
      },
      setFilter: (field, threshold) => {
        api.setFilterModel({
          [field]: { filterType: 'number', type: 'greaterThan', filter: threshold },
        });
        void settle(40);
      },
      destroy: () => api.destroy(),
    };
  },
};

// ---------------------------------------------------------------- Tabulator

const tabulatorEngine: BenchEngine = {
  id: 'tabulator',
  label: 'Tabulator',
  async mount(container, columns, rows) {
    let ready = false;
    const tab = new Tabulator(container, {
      columns: columns.map((c) => ({ title: c.title ?? c.field, field: c.field })),
      data: rows as unknown[],
      layout: 'fitColumns',
      height: 480,
      renderVerticalBuffer: 0,
    });
    tab.on('tableBuilt', () => {
      ready = true;
    });
    await sleep(120);
    void ready;
    return {
      viewCount: () => tab.getData('active').length,
      filteredCount: () => tab.getData('active').length,
      setSort: (field) => {
        tab.setSort([{ column: field, dir: 'desc' }]);
      },
      setFilter: (field, threshold) => {
        tab.setFilter(field, '>', threshold);
      },
      destroy: () => tab.destroy(),
    };
  },
};

// ---------------------------------------------------------------- Grid.js

const gridJsEngine: BenchEngine = {
  id: 'gridjs',
  label: 'Grid.js',
  async mount(container, columns, rows) {
    const data = rows.map((r) => columns.map((c) => r[c.field] as GCell));
    const grid = new Grid({
      columns: columns.map((c) => ({
        id: c.field,
        name: c.title ?? c.field,
        sort: { enabled: true },
      })),
      data,
      sort: true,
      search: true,
      pagination: false,
      height: '480px',
      width: '100%',
    });
    grid.render(container);
    await sleep(120);
    return {
      viewCount: () => container.querySelectorAll('tbody tr').length,
      filteredCount: () => container.querySelectorAll('tbody tr').length,
      setSort: (field) => {
        const th = Array.from(container.querySelectorAll<HTMLElement>('th')).find((el) =>
          el.textContent?.trim().startsWith(field.toUpperCase())
        );
        th?.click();
      },
      setFilter: (_field, threshold) => {
        const input =
          container.querySelector<HTMLInputElement>('input.gridjs-input') ??
          container.querySelector<HTMLInputElement>('input[type="search"]');
        if (input) {
          input.value = String(threshold).slice(0, 2);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      destroy: () => grid.destroy(),
    };
  },
};

// ---------------------------------------------------------------- harness

export const ENGINES: BenchEngine[] = [
  smartTableEngine,
  agGridEngine,
  tabulatorEngine,
  gridJsEngine,
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Runs mount/sort/filter probes repeatedly per engine, isolating each run in a
 * fresh container so nothing leaks between iterations.
 */
export async function runBenchmark(
  host: HTMLElement,
  columns: Column[],
  rows: DataRow[],
  iterations = 3
): Promise<BenchResult[]> {
  const { field, threshold } = { field: 'price', threshold: 750 };
  const results: BenchResult[] = [];

  for (const engine of ENGINES) {
    const mount: number[] = [];
    const sort: number[] = [];
    const filter: number[] = [];
    let viewCount = 0;
    let filteredCount = 0;

    for (let i = 0; i < iterations; i += 1) {
      const container = freshContainer(host);

      let t0 = performance.now();
      const handle = await engine.mount(container, columns, rows);
      await settle();
      mount.push(performance.now() - t0);

      t0 = performance.now();
      handle.setSort(field);
      await settle();
      sort.push(performance.now() - t0);

      t0 = performance.now();
      handle.setFilter(field, threshold);
      await settle();
      filter.push(performance.now() - t0);

      viewCount = handle.viewCount();
      filteredCount = handle.filteredCount();
      handle.destroy();
      container.remove();
    }

    results.push({
      engine: engine.label,
      mountMs: Math.round(median(mount)),
      sortMs: Math.round(median(sort)),
      filterMs: Math.round(median(filter)),
      viewCount,
      filteredCount,
    });
  }

  return results;
}
