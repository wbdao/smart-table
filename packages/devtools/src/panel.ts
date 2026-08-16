import type { SmartTable } from '@smart-table/core';
import type { DevToolsSnapshot, DevToolsState } from './state';

const STYLE_ID = '__smart_table_devtools_style__';

const PANEL_CSS = `
.sdt-root{position:absolute;top:8px;right:8px;z-index:9999;box-sizing:border-box;width:320px;max-height:min(70%,560px);overflow:auto;font:12px/1.5 ui-sans-serif,system-ui,"Segoe UI",sans-serif;color:var(--sdt-fg,#e8eaef);background:var(--sdt-bg,#14161c);border:1px solid var(--sdt-border,#2a2e3a);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.sdt-root::before{content:"SmartTable DevTools";display:block;position:sticky;top:0;padding:6px 10px;font-weight:600;font-size:11px;letter-spacing:.06em;color:var(--sdt-mut,#8b93a7);background:var(--sdt-bg,#14161c);border-bottom:1px solid var(--sdt-border,#2a2e3a)}
.sdt-root[data-hidden="true"]{display:none}
.sdt-section{padding:6px 10px;border-bottom:1px solid var(--sdt-border,#242835)}
.sdt-section:last-child{border-bottom:none}
.sdt-section h4{margin:2px 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--sdt-mut,#8b93a7)}
.sdt-grid{display:grid;grid-template-columns:auto 1fr;gap:2px 10px}
.sdt-grid dt{color:var(--sdt-mut,#8b93a7)}
.sdt-grid dd{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:right;white-space:nowrap}
.sdt-badges{display:flex;flex-wrap:wrap;gap:4px}
.sdt-badge{padding:1px 6px;border-radius:999px;background:var(--sdt-chip,#232736);color:var(--sdt-chip-fg,#aeb6c8);font-size:10px}
.sdt-badge b{color:var(--sdt-fg,#e8eaef)}
.sdt-stream{max-height:120px;overflow:auto}
.sdt-root{color-scheme:light dark}
`;

function ensureStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
}

export interface PanelOptions {
  mount?: HTMLElement;
  title?: string;
}

export interface DevToolsPanel {
  readonly el: HTMLElement;
  get hidden(): boolean;
  show(): void;
  hide(): void;
  toggle(): void;
  update(): void;
  destroy(): void;
}

function hiddenAttribute(el: HTMLElement, value: boolean): void {
  el.setAttribute('data-hidden', String(value));
  el.hidden = value;
}

/** Builds the floating overlay panel bound to a {@link DevToolsState}. */
export function createDevToolsPanel(
  table: SmartTable,
  state: DevToolsState,
  options: PanelOptions = {}
): DevToolsPanel {
  ensureStyle();
  const mount = options.mount ?? table.getContainer() ?? document.body;
  const root = document.createElement('div');
  root.className = 'sdt-root';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', options.title ?? `SmartTable DevTools — ${table.id}`);
  hiddenAttribute(root, false);

  const metrics = table as SmartTable & {
    getMetrics?: () => {
      render: { averageMs: number | null; samples: number };
      events: { total: number };
    };
  };

  function render(): void {
    const s: DevToolsSnapshot = state.snapshot;
    const top = Object.entries(s.eventTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => `<span class="sdt-badge">${name} <b>${count}</b></span>`)
      .join('');
    const stream = s.eventStream
      .slice(-12)
      .map((r) => `<span class="sdt-badge">${r.event} <b>${r.at.toFixed(0)}ms</b></span>`)
      .join('');

    const metricsRow = metrics.getMetrics
      ? () => {
          const m = metrics.getMetrics!();
          return `<dl class="sdt-grid">
              <dt>render avg</dt><dd>${m.render.averageMs?.toFixed(2) ?? '—'}ms</dd>
              <dt>render samples</dt><dd>${m.render.samples}</dd>
              <dt>events total</dt><dd>${m.events.total}</dd>
            </dl>`;
        }
      : () =>
          '<p style="margin:0">Telemetry not attached — import and call <code>attachTelemetry(table)</code>.</p>';

    root.innerHTML = `
      <div class="sdt-section">
        <dl class="sdt-grid">
          <dt>page</dt><dd>${s.page} / ${s.totalPages}</dd>
          <dt>pageSize</dt><dd>${s.pageSize}</dd>
          <dt>rows</dt><dd>${s.rows}</dd>
          <dt>view</dt><dd>${s.viewCount} / ${s.filteredCount}</dd>
          <dt>selection</dt><dd>${s.selectionCount}</dd>
          <dt>mode</dt><dd>${s.mode}</dd>
          <dt>renderer</dt><dd>${s.renderer ? 'mounted' : 'none'}</dd>
        </dl>
        <div class="sdt-badges">
          <span class="sdt-badge">sort <b>${s.sortField ? `${s.sortField}:${s.sortDirection}` : 'none'}</b></span>
          <span class="sdt-badge">filter <b>${s.hasActiveFilter ? `${s.columnFilterCount} col(s)` : 'off'}</b></span>
          <span class="sdt-badge">group <b>${s.groupField ? `${s.groupField} (${s.groupCount})` : 'off'}</b></span>
          <span class="sdt-badge">virtual <b>${s.virtualScroll ? (s.viewport ? `${s.viewport.startIndex}-${s.viewport.endIndex}` : 'on') : 'off'}</b></span>
        </div>
      </div>
      <div class="sdt-section">
        <h4>Telemetry</h4>
        ${metricsRow()}
      </div>
      <div class="sdt-section">
        <h4>Top events</h4>
        <div class="sdt-badges">${top || '<span class="sdt-badge">no events yet</span>'}</div>
      </div>
      <div class="sdt-section">
        <h4>Recent stream</h4>
        <div class="sdt-badges sdt-stream">${stream || '<span class="sdt-badge">—</span>'}</div>
      </div>`;
  }

  root.addEventListener('dblclick', () => hide());
  mount.appendChild(root);
  render();

  function show(): void {
    hiddenAttribute(root, false);
  }
  function hide(): void {
    hiddenAttribute(root, true);
  }
  function toggle(): void {
    hiddenAttribute(root, !root.hidden);
  }
  function destroy(): void {
    root.remove();
  }

  return {
    get el() {
      return root;
    },
    get hidden() {
      return root.hidden;
    },
    show,
    hide,
    toggle,
    update: render,
    destroy,
  };
}
