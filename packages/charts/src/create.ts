import type { SmartTable } from '@smart-table/core';
import { getChartLibrary } from './registry';
import { deriveSeries, type SeriesOptions } from './series';
import type { ChartBridge, ChartConfig, ChartHandle } from './types';

export interface TableChartOptions extends SeriesOptions {
  /**
   * Registered library name (e.g. `'chart.js'`) or an inline
   * {@link ChartBridge}. Defaults to the registry lookup of the name, or
   * throws when no bridge can be resolved.
   */
  library?: string | ChartBridge;
  /** Element to mount into (defaults to `table.getContainer()` then `document.body`). */
  mount?: HTMLElement;
  /** Transforms the derived config before it reaches the bridge. */
  transform?: (config: ChartConfig) => ChartConfig;
  /** Re-derive and re-render on every `dataChanged` (default `true`). */
  autoUpdate?: boolean;
}

export interface TableChart {
  readonly handle: ChartHandle;
  config(): ChartConfig;
  update(): void;
  destroy(): void;
}

function resolveBridge(options: TableChartOptions): { name: string; bridge: ChartBridge } {
  const library = options.library;
  if (typeof library === 'object' && library !== null) {
    return { name: 'inline', bridge: library };
  }
  const name = (library as string | undefined) ?? 'inline';
  const bridge = getChartLibrary(name);
  if (!bridge) {
    throw new Error(
      `@smart-table/charts: no chart library "${name}" registered. ` +
        'Call registerChartLibrary(name, bridge) or pass an inline ChartBridge.'
    );
  }
  return { name, bridge };
}

/** Binds a table to a charting library and keeps the chart in sync. */
export function createTableChart(table: SmartTable, options: TableChartOptions): TableChart {
  const { name, bridge } = resolveBridge(options);
  const mount = options.mount ?? table.getContainer() ?? document.body;
  const el = document.createElement('div');
  el.style.width = '100%';
  el.style.height = '100%';
  mount.appendChild(el);

  const derive = () =>
    options.transform?.(deriveSeries(table, options)) ?? deriveSeries(table, options);

  let config = derive();
  const instance = bridge.create(el, config);
  let destroyed = false;
  let unsubscribe: (() => void) | null = null;

  if (options.autoUpdate !== false) {
    unsubscribe = table.on('dataChanged', () => {
      if (destroyed) return;
      config = derive();
      bridge.update(instance, config);
    });
  }

  return {
    get handle() {
      return {
        library: name,
        el,
        instance,
        config: () => config,
        update: () => {
          if (destroyed) return;
          config = derive();
          bridge.update(instance, config);
        },
        destroy: () => {
          if (destroyed) return;
          destroyed = true;
          unsubscribe?.();
          bridge.destroy(instance);
          el.remove();
        },
      };
    },
    config: () => config,
    update: () => {
      config = derive();
      bridge.update(instance, config);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      bridge.destroy(instance);
      el.remove();
    },
  };
}
