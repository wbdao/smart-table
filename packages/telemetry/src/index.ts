import type { SmartTable } from '@smart-table/core';
import { MetricsCollector, type TableMetrics } from './metrics';

export type { MemorySnapshot, TableMetrics, ViewportSample } from './metrics';

/** The telemetry surface exposed on the table instance. */
export interface SmartTableTelemetry {
  getMetrics(): TableMetrics;
  enableTelemetry(): void;
  disableTelemetry(): void;
}

/**
 * Module augmentation so `table.getMetrics()`, `table.enableTelemetry()` and
 * `table.disableTelemetry()` type-check after importing `@smart-table/telemetry`.
 */
declare module '@smart-table/core' {
  interface SmartTable {
    getMetrics(): TableMetrics;
    enableTelemetry(): void;
    disableTelemetry(): void;
  }
}

const collectors = new WeakMap<SmartTable, MetricsCollector>();
const attached = new WeakSet<SmartTable>();

/**
 * Attaches telemetry to a table instance and augments the instance methods:
 *
 * ```ts
 * import { attachTelemetry } from '@smart-table/telemetry';
 * import { SmartTable } from '@smart-table/core';
 *
 * const table = new SmartTable({ columns, data, container: '#app' });
 * attachTelemetry(table);
 *
 * table.enableTelemetry();
 * const metrics = table.getMetrics(); // TableMetrics
 * table.disableTelemetry();
 * ```
 */
export function attachTelemetry(table: SmartTable): SmartTableTelemetry {
  let collector = collectors.get(table);
  if (!collector) {
    collector = new MetricsCollector(table);
    collectors.set(table, collector);
  }
  const c = collector;
  if (!attached.has(table)) {
    attached.add(table);
    c.attach();
  }

  const api: SmartTableTelemetry = {
    getMetrics: () => c.getMetrics(),
    enableTelemetry: () => c.enable(),
    disableTelemetry: () => c.disable(),
  };
  Object.assign(table, api);
  return api;
}

/** Detaches telemetry: listeners are removed and instance methods cleared. */
export function detachTelemetry(table: SmartTable): void {
  if (!attached.has(table)) return;
  attached.delete(table);
  collectors.get(table)?.dispose();
  const record = table as unknown as Record<string, unknown>;
  delete record.getMetrics;
  delete record.enableTelemetry;
  delete record.disableTelemetry;
}

export default attachTelemetry;
