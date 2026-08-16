import { createElement, clearChildren } from './dom';
import type { SmartTable } from '../core/SmartTable';

export interface PivotViewOptions {
  table: SmartTable;
}

const joinValues = (values: string[]): string => values.join(' / ');
const joinLabels = (field: string, op: string): string => `${op}(${field})`;

/**
 * Read-only pivot grid. Consumes the headless {@link PivotResult} produced by
 * `table.pivot(config)` and renders it as a table:
 *
 * - the corner cell describes the aggregation (e.g. `sum(sales)`)
 * - one column header per pivot column combination
 * - one row header per pivot row combination
 * - the value at every intersection
 *
 * Like the other views, it only displays state; it never computes it. The
 * parent renderer decides when it appears (DOMRenderer swaps it in while a
 * pivot result is active).
 */
export class PivotView {
  readonly element: HTMLElement;

  private readonly table: SmartTable;
  private readonly tableEl: HTMLTableElement;

  constructor(options: PivotViewOptions) {
    this.table = options.table;
    this.element = createElement('div', {
      className: 'st-scroll st-pivot',
      attrs: { role: 'region', 'aria-label': 'Pivot table' },
    });
    this.tableEl = createElement('table', { className: 'st-table', attrs: { role: 'grid' } });
    this.element.appendChild(this.tableEl);
    this.render();
  }

  /** Rebuilds the pivot grid from the active pivot result. */
  render(): void {
    const result = this.table.getPivotResult();
    clearChildren(this.tableEl);
    if (!result) return;

    const thead = document.createElement('thead');
    const headRow = createElement('tr', { attrs: { role: 'row' } });
    const values = result.config.values;
    const cornerLabel =
      values.length > 0
        ? joinLabels(values[0]?.field ?? '', values[0]?.aggregation ?? 'count')
        : '';
    headRow.appendChild(
      createElement('th', {
        className: 'st-cell st-pivot-corner',
        attrs: { scope: 'col', role: 'columnheader' },
        text: cornerLabel,
      })
    );
    for (const columnKey of result.getColumnKeys()) {
      headRow.appendChild(
        createElement('th', {
          className: 'st-cell st-pivot-colhead',
          attrs: { scope: 'col', role: 'columnheader' },
          text: joinValues(columnKey),
        })
      );
    }
    thead.appendChild(headRow);
    this.tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of result.rows()) {
      const tr = createElement('tr', { attrs: { role: 'row' } });
      tr.appendChild(
        createElement('th', {
          className: 'st-cell st-pivot-rowhead',
          attrs: { scope: 'row', role: 'rowheader' },
          text: joinValues(row.rowKey),
        })
      );
      for (const cell of row.cells) {
        tr.appendChild(
          createElement('td', {
            className: 'st-cell',
            attrs: { role: 'gridcell' },
            text: String(cell.value),
          })
        );
      }
      tbody.appendChild(tr);
    }
    this.tableEl.appendChild(tbody);
  }

  /** No-op for parity with the other views (pivot is read-only). */
  destroy(): void {}
}
