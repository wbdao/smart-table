import type { DataRow } from '../../types/column';
import type { DataSourceParams, DataSourceRequestFilters } from './params';
import type { SmartTable } from '../../core/SmartTable';

/** A page of rows returned by a remote data source. */
export interface DataSourceResult {
  rows: DataRow[];
  /** Total rows matching the current params (across every page). */
  total: number;
}

/**
 * Remote data source signature. Receives pagination / sort / filter params and
 * must return the page plus the total row count. Sorting, filtering and
 * pagination are delegated to the server; the returned rows replace the local
 * dataset.
 */
export type DataSource = (params: DataSourceParams) => Promise<DataSourceResult> | DataSourceResult;

export interface ServerControllerOptions {
  /** The table the controller drives. */
  table: SmartTable;
  dataSource: DataSource;
  /** Start page. Default `1`. */
  initialPage?: number;
  /** Debounce for interactive param changes (sort/filter). Default `120`. */
  debounceMs?: number;
}

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_DEBOUNCE = 120;

/**
 * Orchestrates remote data loading for {@link SmartTable}. Intercepts
 * pagination / sort / filter changes, turns them into `DataSourceParams` and
 * commits the resolved page into the table. Late responses are discarded so a
 * quick sort + filter only ever commits the newest request.
 */
export class ServerController {
  private readonly table: SmartTable;
  private readonly dataSource: DataSource;
  private readonly debounceMs: number;

  private params: DataSourceParams;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private inflight: Promise<void> | null = null;
  private loadingMore = false;

  constructor(options: ServerControllerOptions) {
    this.table = options.table;
    this.dataSource = options.dataSource;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE;
    const pageSize = this.table.getPageSize() > 0 ? this.table.getPageSize() : DEFAULT_PAGE_SIZE;
    this.params = {
      page: options.initialPage ?? 1,
      pageSize,
      sort: { field: null, direction: null },
      filters: { query: '', structured: [] },
    };
  }

  /** The params the controller would send right now. */
  getParams(): DataSourceParams {
    return {
      ...this.params,
      sort: { ...this.params.sort },
      filters: this.params.filters,
    };
  }

  /** Whether a request is currently in flight. */
  isLoading(): boolean {
    return this.inflight !== null;
  }

  /**
   * Applies partial param changes (page / pageSize / sort / filters) and
   * schedules a debounced fetch. Sorting or filtering resets the page to 1.
   */
  request(changes: Partial<DataSourceParams>): void {
    if (changes.sort !== undefined) {
      this.params.sort = { ...changes.sort };
      if (changes.page === undefined) this.params.page = 1;
    }
    if (changes.filters !== undefined) {
      this.params.filters = changes.filters;
      if (changes.page === undefined) this.params.page = 1;
    }
    if (changes.page !== undefined) this.params.page = changes.page;
    if (changes.pageSize !== undefined) this.params.pageSize = changes.pageSize;
    this.schedule();
  }

  /** Fetches the current params immediately (skips the debounce). */
  reload(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.fetch('replace');
  }

  /**
   * Infinite scroll: requests the next page and appends it to the existing
   * rows. Returns whether a request was started.
   */
  loadMore(): boolean {
    if (this.loadingMore) return false;
    if (this.table.getRowCount() >= this.table.getRemoteTotal()) return false;
    this.params.page += 1;
    this.loadingMore = true;
    this.emitLoadMore();
    void this.fetch('append');
    return true;
  }

  /** Resolves once the current request (if any) settles. Useful in tests. */
  flush(): Promise<void> {
    return this.inflight ?? Promise.resolve();
  }

  /** Re-reads the table's current sort/filter state into the params. */
  refreshParams(): void {
    const state = this.table.getSortState();
    this.params.sort = state;
    this.params.filters = this.readFilters();
  }

  destroy(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.seq += 1;
  }

  // ------------------------------------------------------------- internals

  private readFilters(): DataSourceRequestFilters {
    const query = this.table.getFilterState().query;
    const structured = this.table.getStructuredFilters().map((f) => ({
      field: f.field,
      operator: f.operator,
      operands: f.operands as unknown[],
    }));
    return { query, structured };
  }

  private schedule(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.fetch('replace');
    }, this.debounceMs);
  }

  private emitLoadMore(): void {
    this.table.events.emit('loadMoreRequested', {
      page: this.params.page,
      loadedCount: this.table.getRowCount(),
      totalCount: this.table.getRemoteTotal(),
    });
  }

  private async fetch(mode: 'replace' | 'append'): Promise<void> {
    const seq = ++this.seq;
    const params = this.getParams();
    this.table.events.emit('dataLoading', { params });
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const task = (async () => {
      try {
        const result = await this.dataSource(params);
        if (seq !== this.seq) return;
        const durationMs = Math.max(
          0,
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started
        );
        this.table.applyServerPage(result.rows, result.total, mode);
        this.table.events.emit('dataLoaded', {
          rows: result.rows,
          total: result.total,
          page: params.page,
          pageSize: params.pageSize,
          durationMs,
          mode,
        });
      } catch (error) {
        if (seq !== this.seq) return;
        this.table.events.emit('dataLoadFailed', { params, error });
      } finally {
        if (seq === this.seq) this.loadingMore = false;
      }
    })();
    this.inflight = task;
    await task;
    this.inflight = null;
  }
}
