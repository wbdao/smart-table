import '@smart-table/core/styles.css';
import './styles.css';
import { makeProducts, PRODUCT_COLUMNS } from './dataset';
import { runBenchmark, type BenchResult } from './engines';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

const status = $<HTMLElement>('#status');
const sizeSelect = $<HTMLSelectElement>('#size');
const runButton = $<HTMLButtonElement>('#run');
const resultsHost = $<HTMLElement>('#results');
const gridHost = $<HTMLElement>('#hosts');

function renderResults(results: BenchResult[], rows: number): void {
  const bestMount = Math.min(...results.map((r) => r.mountMs));
  const bestSort = Math.min(...results.map((r) => r.sortMs));
  const bestFilter = Math.min(...results.map((r) => r.filterMs));

  const table = document.createElement('table');
  table.className = 'perf-table';
  const head = document.createElement('thead');
  head.innerHTML =
    '<tr><th>Engine</th><th>Mount (ms)</th><th>Sort (ms)</th><th>Filter (ms)</th><th>Rows mounted</th><th>Rows filtered</th></tr>';
  table.appendChild(head);
  const body = document.createElement('tbody');

  for (const r of results) {
    const tr = document.createElement('tr');
    const bar = (ms: number, best: number): string =>
      `<div class="bar"><i style="--w:${Math.max(4, Math.round((best / ms) * 100))}%"></i><b>${ms}</b></div>`;
    tr.innerHTML =
      `<td class="engine">${escapeHtml(r.engine)}</td>` +
      `<td>${bar(r.mountMs, bestMount)}</td>` +
      `<td>${bar(r.sortMs, bestSort)}</td>` +
      `<td>${bar(r.filterMs, bestFilter)}</td>` +
      `<td>${r.viewCount.toLocaleString()}</td>` +
      `<td>${r.filteredCount.toLocaleString()}</td>`;
    body.appendChild(tr);
  }
  table.appendChild(body);
  resultsHost.replaceChildren(table);

  const note = document.createElement('p');
  note.className = 'perf-note';
  note.textContent = `${rows.toLocaleString()} rows · ${PRODUCT_COLUMNS.length} columns · prices > 750 · bars scale to the fastest engine (lower is better).`;
  resultsHost.appendChild(note);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string
  );
}

async function run(): Promise<void> {
  runButton.disabled = true;
  status.textContent = 'generating dataset…';
  await new Promise((r) => setTimeout(r, 20));

  const rows = makeProducts(Number(sizeSelect.value));
  status.textContent = `${rows.length.toLocaleString()} rows ready — running 3 passes per engine…`;

  gridHost.replaceChildren();
  resultsHost.replaceChildren();

  try {
    const results = await runBenchmark(gridHost, PRODUCT_COLUMNS, rows, 3);
    renderResults(results, rows.length);
    status.textContent = 'done.';
  } catch (err) {
    status.textContent = `benchmark failed: ${(err as Error).message}`;
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener('click', run);
void run();

declare global {
  interface Window {
    perf: typeof run;
  }
}
window.perf = run;
