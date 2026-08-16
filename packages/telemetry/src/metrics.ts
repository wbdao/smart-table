import { DEFAULT_EVENTS, type SmartTable } from '@smart-table/core';

/** Browser memory snapshot (mirrors `performance.memory` when available). */
export interface MemorySnapshot {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/** Virtualization stats from `viewportChanged` payloads. */
export interface ViewportSample {
  start: number;
  end: number;
  total: number;
}

/** Aggregated observable metrics for one table instance. */
export interface TableMetrics {
  /** ms since the collector attached. */
  since: number;
  mount: {
    mounted: boolean;
    mountMs: number | null;
  };
  render: {
    lastMs: number | null;
    averageMs: number | null;
    samples: number;
  };
  update: {
    updates: number;
    lastMs: number | null;
  };
  memory: MemorySnapshot | null;
  events: {
    total: number;
    byEvent: Record<string, number>;
    recent: Array<{ event: string; at: number; ms: number }>;
  };
  virtualization: {
    lastViewport: ViewportSample | null;
    scrolls: number;
  };
  pivot: {
    computations: number;
    lastComputeMs: number | null;
    lastConfig: unknown;
  };
  grouping: {
    groupings: number;
    lastGroupMs: number | null;
    field: string | null;
  };
}

interface PendingTiming {
  startedAt: number;
  pivot?: boolean;
  grouping?: boolean;
}

const EVENTS_THAT_TIMING = new Set<string>([
  'dataChanged',
  'filterChanged',
  'sortChanged',
  'pageChanged',
  'layoutChanged',
  'aggregationChanged',
]);

const RECENT_CAP = 200;

function createEmptyMetrics(since: number): TableMetrics {
  return {
    since,
    mount: { mounted: false, mountMs: null },
    render: { lastMs: null, averageMs: null, samples: 0 },
    update: { updates: 0, lastMs: null },
    memory: null,
    events: { total: 0, byEvent: {}, recent: [] },
    virtualization: { lastViewport: null, scrolls: 0 },
    pivot: { computations: 0, lastComputeMs: null, lastConfig: null },
    grouping: { groupings: 0, lastGroupMs: null, field: null },
  };
}

interface MemoryLike {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

function sampleMemory(): MemorySnapshot | null {
  const mem = (performance as unknown as { memory?: MemoryLike }).memory;
  if (!mem) return null;
  return {
    usedJSHeapSize: mem.usedJSHeapSize ?? 0,
    totalJSHeapSize: mem.totalJSHeapSize ?? 0,
    jsHeapSizeLimit: mem.jsHeapSizeLimit ?? 0,
  };
}

/**
 * Collects observable metrics for a SmartTableJS instance. Instrumentation is
 * intentionally additive: it subscribes to the public event bus and watches
 * container mutations — the engine itself is untouched.
 */
export class MetricsCollector {
  private readonly table: SmartTable;
  private readonly metrics: TableMetrics;
  private readonly startedAt = performance.now();
  private readonly offs: Array<() => void> = [];
  private observer: MutationObserver | null = null;
  private pending: PendingTiming | null = null;
  private enabled = true;

  constructor(table: SmartTable) {
    this.table = table;
    this.metrics = createEmptyMetrics(this.startedAt);
  }

  attach(): void {
    for (const event of DEFAULT_EVENTS) {
      this.offs.push(
        this.table.on(event as never, () => {
          this.observeEvent(event);
        })
      );
    }
    // Specialized payloads we derive metrics from.
    this.offs.push(
      this.table.on('viewportChanged' as never, (payload: unknown) =>
        this.observeViewport(payload)
      ),
      this.table.on('pivotChanged' as never, (payload: unknown) => {
        this.metrics.pivot.computations += 1;
        this.metrics.pivot.lastConfig = (payload as { config?: unknown } | null)?.config ?? null;
        this.startTiming({ pivot: true });
      }),
      this.table.on('groupChanged' as never, (payload: unknown) => {
        this.metrics.grouping.groupings += 1;
        this.metrics.grouping.field = (payload as { field?: string | null } | null)?.field ?? null;
        this.startTiming({ grouping: true });
      })
    );

    this.ensureObserver();
  }

  /** Lazily observes the container as soon as one exists (attach/mount order-free). */
  private ensureObserver(): void {
    if (this.observer) return;
    const container = this.table.getContainer();
    if (container && typeof MutationObserver !== 'undefined') {
      this.observer = new MutationObserver(() => this.onMutations());
      this.observer.observe(container, { childList: true, subtree: true, characterData: true });
    }
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.observer?.disconnect();
    this.observer = null;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
    this.pending = null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  reset(): void {
    const since = performance.now();
    Object.assign(this.metrics, createEmptyMetrics(since));
  }

  getMetrics(): TableMetrics {
    this.metrics.memory = sampleMemory();
    return {
      since: this.metrics.since,
      mount: { ...this.metrics.mount },
      render: { ...this.metrics.render },
      update: { ...this.metrics.update },
      memory: this.metrics.memory,
      events: {
        total: this.metrics.events.total,
        byEvent: { ...this.metrics.events.byEvent },
        recent: [...this.metrics.events.recent],
      },
      virtualization: {
        lastViewport: this.metrics.virtualization.lastViewport
          ? { ...this.metrics.virtualization.lastViewport }
          : null,
        scrolls: this.metrics.virtualization.scrolls,
      },
      pivot: { ...this.metrics.pivot },
      grouping: { ...this.metrics.grouping },
    };
  }

  private observeEvent(event: string): void {
    if (!this.enabled) return;
    this.ensureObserver();
    this.metrics.events.total += 1;
    this.metrics.events.byEvent[event] = (this.metrics.events.byEvent[event] ?? 0) + 1;
    if (this.metrics.events.recent.length >= RECENT_CAP) {
      this.metrics.events.recent.shift();
    }
    this.metrics.events.recent.push({ event, at: performance.now(), ms: performance.now() });
    if (EVENTS_THAT_TIMING.has(event)) {
      this.startTiming({});
    }
  }

  private observeViewport(payload: unknown): void {
    if (!this.enabled) return;
    const p = payload as { startIndex?: number; endIndex?: number; scrollTop?: number } | null;
    if (!p || typeof p.startIndex !== 'number') return;
    this.metrics.virtualization.scrolls += 1;
    this.metrics.virtualization.lastViewport = {
      start: p.startIndex,
      end: p.endIndex ?? p.startIndex,
      total: this.table.getFilteredCount(),
    };
  }

  private startTiming(flags: { pivot?: boolean; grouping?: boolean }): void {
    if (!this.enabled || this.pending) return;
    this.pending = { startedAt: performance.now(), ...flags };
  }

  private onMutations(): void {
    const now = performance.now();

    // Mount time: first container mutation after attach, independent of timing.
    if (this.enabled && this.metrics.mount.mountMs === null) {
      this.metrics.mount.mountMs = now - this.startedAt;
      this.metrics.mount.mounted = true;
    }

    if (!this.enabled || !this.pending) return;
    const delta = now - this.pending.startedAt;

    this.metrics.render.samples += 1;
    this.metrics.render.lastMs = delta;
    this.metrics.render.averageMs =
      this.metrics.render.averageMs === null
        ? delta
        : (this.metrics.render.averageMs * (this.metrics.render.samples - 1) + delta) /
          this.metrics.render.samples;
    this.metrics.update.updates += 1;
    this.metrics.update.lastMs = delta;

    if (this.pending.pivot) this.metrics.pivot.lastComputeMs = delta;
    if (this.pending.grouping) this.metrics.grouping.lastGroupMs = delta;

    this.pending = null;
  }
}
