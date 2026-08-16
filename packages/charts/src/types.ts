/**
 * Chart foundations: `@smart-table/charts` provides a vendor-agnostic
 * contract between a `SmartTable` and any charting library, plus helpers to
 * derive chart series from table data.
 *
 * No charting library is bundled. Consumers wire their own vendor (Chart.js,
 * ECharts, ApexCharts, …) through a tiny {@link ChartBridge}, either inline or
 * via the shared {@link registerChartLibrary} registry.
 */
export type ChartKind = 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'doughnut' | 'radar';

export interface SeriesSpec {
  /** Table column used as the series data source. */
  field: string;
  /** Optional display name (defaults to the column title or field). */
  label?: string;
  /**
   * Aggregation applied per label group when several rows share the same
   * label. Defaults to `'sum'` when more than one row maps to a label.
   */
  aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

/** Framework-agnostic configuration handed to the chart bridge. */
export interface ChartConfig {
  kind: ChartKind;
  labels: string[];
  series: Array<{ name: string; data: number[] }>;
}

/** The narrow, library-shaped surface every vendor adaptee must satisfy. */
export interface ChartBridge {
  /** Creates a chart in the target element; returns the vendor instance. */
  create(el: HTMLElement, config: ChartConfig): unknown;
  /** Re-renders an existing instance with a new config. */
  update(instance: unknown, config: ChartConfig): void;
  /** Tears the vendor instance down. */
  destroy(instance: unknown): void;
}

export interface ChartHandle {
  /** Registered library name (or `'inline'`). */
  library: string;
  /** The element the chart was mounted into. */
  el: HTMLElement;
  /** The vendor instance returned by the bridge. */
  instance: unknown;
  /** The latest chart configuration. */
  config(): ChartConfig;
  /** Re-derives and re-applies the configuration. */
  update(): void;
  destroy(): void;
}

/** Builds a {@link ChartLibrary} from a raw vendor bridge. */
export function chartLibrary(
  name: string,
  bridge: ChartBridge
): { name: string; bridge: ChartBridge } {
  return { name, bridge };
}
