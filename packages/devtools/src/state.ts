import { DEFAULT_EVENTS, type SmartTable } from '@smart-table/core';

/** One recorded event in the devtools stream. */
export interface DevEventRecord {
  event: string;
  /** ms relative to the collector attach time. */
  at: number;
}

/** A live snapshot of a table's high-level state. */
export interface DevToolsSnapshot {
  page: number;
  pageSize: number;
  totalPages: number;
  rows: number;
  viewCount: number;
  filteredCount: number;
  selectionCount: number;
  mode: string;
  sortField: string | null;
  sortDirection: string;
  query: string;
  columnFilterCount: number;
  hasActiveFilter: boolean;
  groupField: string | null;
  groupCount: number;
  virtualScroll: boolean;
  viewport: {
    startIndex: number;
    endIndex: number;
  } | null;
  renderer: boolean;
  /** Total events observed since attach. */
  eventTotal: number;
  /** Tally per event name. */
  eventTally: Record<string, number>;
  /** Most recent events (oldest-first, capped). */
  eventStream: DevEventRecord[];
}

export interface DevToolsStateOptions {
  /** Ring-buffer size for the event stream. */
  maxEvents?: number;
}

interface ViewportSample {
  startIndex: number;
  endIndex: number;
}

/** Collects table state and event activity for the devtools panel. */
export class DevToolsState {
  readonly table: SmartTable;
  readonly maxEvents: number;
  private readonly tally: Record<string, number> = {};
  private readonly stream: DevEventRecord[] = [];
  private readonly unsubscribers: Array<() => void> = [];
  private readonly startedAt = performance.now();
  private attached = false;
  private ticking = false;
  private viewport: ViewportSample | null = null;

  snapshot: DevToolsSnapshot;

  constructor(table: SmartTable, options: DevToolsStateOptions = {}) {
    this.table = table;
    this.maxEvents = options.maxEvents ?? 100;
    this.snapshot = this.collect();
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    for (const event of DEFAULT_EVENTS) {
      this.unsubscribers.push(
        this.table.on(event, (payload: unknown) => this.handleEvent(event, payload))
      );
    }
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    for (const off of this.unsubscribers.splice(0)) off();
  }

  private handleEvent(event: string, payload: unknown): void {
    if (event === 'viewportChanged' && payload) {
      const v = payload as ViewportSample;
      if (typeof v.startIndex === 'number' && typeof v.endIndex === 'number') {
        this.viewport = { startIndex: v.startIndex, endIndex: v.endIndex };
      }
    }
    this.tally[event] = (this.tally[event] ?? 0) + 1;
    this.stream.push({ event, at: performance.now() - this.startedAt });
    if (this.stream.length > this.maxEvents) {
      this.stream.splice(0, this.stream.length - this.maxEvents);
    }
    if (this.ticking) return;
    this.ticking = true;
    try {
      this.snapshot = this.collect();
    } finally {
      this.ticking = false;
    }
  }

  /** Reads the full snapshot synchronously from the table's public API. */
  private collect(): DevToolsSnapshot {
    const t = this.table;
    const sort = t.getSortState();
    const filter = t.getFilterState();
    const group = t.getGroupState();
    const virtual = t.getVirtualScrollOptions();
    return {
      page: t.getCurrentPage(),
      pageSize: t.getPageSize(),
      totalPages: t.getTotalPages(),
      rows: t.getRowCount(),
      viewCount: t.getViewCount(),
      filteredCount: t.getFilteredCount(),
      selectionCount: t.getSelectionCount(),
      mode: t.getMode(),
      sortField: sort.field,
      sortDirection: sort.direction ?? 'none',
      query: filter.query,
      columnFilterCount: filter.columnFilterCount,
      hasActiveFilter: filter.hasActiveFilter,
      groupField: group.field,
      groupCount: group.groups.length,
      virtualScroll: virtual !== null,
      viewport: this.viewport,
      renderer: t.getRenderer() !== null,
      eventTotal: Object.values(this.tally).reduce((a, b) => a + b, 0),
      eventTally: { ...this.tally },
      eventStream: [...this.stream].slice(-this.maxEvents),
    };
  }
}
