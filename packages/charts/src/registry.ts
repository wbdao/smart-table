import type { ChartBridge } from './types';

const registry = new Map<string, ChartBridge>();

/** Registers a named chart bridge (Chart.js, ECharts, ApexCharts, …). */
export function registerChartLibrary(name: string, bridge: ChartBridge): void {
  registry.set(name, bridge);
}

/** Looks up a previously registered bridge, or `undefined`. */
export function getChartLibrary(name: string): ChartBridge | undefined {
  return registry.get(name);
}
