import type { SmartTable } from '../core/SmartTable';
import type { DataRow } from '../types/column';
import type { SmartTablePlugin } from '../types/plugin';

/** Aggregation ops a summary footer can render per numeric column. */
export type SummaryOp = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface SummaryFooterOptions {
  /** field -> operation. When omitted, every numeric column gets `sum`. */
  fields?: Record<string, SummaryOp>;
  /** Optional prefix label shown before the values. */
  label?: string;
  /** Class applied to the footer element (default `st-plugin-summary`). */
  className?: string;
}

/** A {@link SmartTablePlugin} augmented with a manual refresh handle. */
export interface SummaryFooterPlugin extends SmartTablePlugin {
  refresh(): void;
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Per-field summary text over the current (filtered) view. */
export function summarizeRows(
  rows: DataRow[],
  fields: Record<string, SummaryOp>
): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const [field, op] of Object.entries(fields)) {
    const values = rows.map((row) => Number(row[field])).filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      parts[field] = '—';
      continue;
    }
    let result: number;
    switch (op) {
      case 'sum':
        result = values.reduce((acc, value) => acc + value, 0);
        break;
      case 'avg':
        result = values.reduce((acc, value) => acc + value, 0) / values.length;
        break;
      case 'min':
        result = Math.min(...values);
        break;
      case 'max':
        result = Math.max(...values);
        break;
      default:
        result = rows.length;
    }
    parts[field] = formatNumber(result);
  }
  return parts;
}

/**
 * Marketplace plugin that paints an updateable summary footer (counts and
 * per-numeric-column operations) directly below the table's container. It
 * re-renders whenever the view changes (data, filter, sort, page) and cleans
 * its element up on uninstall. When the table has no container (headless use)
 * the plugin installs gracefully and only refreshes nothing.
 *
 * ```ts
 * table.use(summaryFooterPlugin({ fields: { price: 'sum' }, label: 'View' }));
 * ```
 */
export function summaryFooterPlugin(options: SummaryFooterOptions = {}): SummaryFooterPlugin {
  const className = options.className ?? 'st-plugin-summary';
  let table: SmartTable | null = null;
  let footer: HTMLElement | null = null;
  let offs: Array<() => void> = [];

  function deriveFields(rows: DataRow[]): Record<string, 'sum'> {
    const sample = rows[0] ?? {};
    return Object.keys(sample)
      .filter((field) => typeof sample[field] === 'number')
      .reduce<Record<string, 'sum'>>((acc, field) => {
        acc[field] = 'sum';
        return acc;
      }, {});
  }

  function render(): void {
    const current = table;
    if (!current || !footer) return;
    const rows = current.getRows();
    const fields = options.fields ?? deriveFields(rows);
    const parts = Object.entries(summarizeRows(rows, fields)).map(
      ([field, value]) => `${field}: ${value}`
    );
    const prefix = options.label ? `${options.label} · ` : '';
    footer.textContent =
      `${prefix}${rows.length.toLocaleString()} rows` +
      (parts.length > 0 ? ` · ${parts.join(' · ')}` : '');
  }

  const plugin: SummaryFooterPlugin = {
    name: 'summary-footer',
    version: '1.0.0',
    description: 'Paints row counts and column summaries into a footer below the table.',
    meta: { author: 'SmartTableJS', tags: ['ui', 'aggregate', 'summary'] },
    install(target: SmartTable) {
      table = target;
      const container = target.getContainer();
      if (!container) return;
      footer = document.createElement('div');
      footer.className = className;
      footer.setAttribute('aria-live', 'polite');
      container.appendChild(footer);
      const names = ['dataChanged', 'filterChanged', 'sortChanged', 'pageChanged'] as const;
      offs = names.map((event) => target.on(event, () => render()));
      render();
    },
    uninstall() {
      for (const off of offs) off();
      offs = [];
      footer?.remove();
      footer = null;
      table = null;
    },
    refresh() {
      render();
    },
  };

  return plugin;
}
