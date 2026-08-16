# Charts

`@smart-table/charts` is a vendor-agnostic foundation for visualizing table data. It defines a tiny bridge any charting library can satisfy (Chart.js, ECharts, ApexCharts, …), derives series from the table, and keeps the chart in sync with the dataset. No charting library is bundled.

## Install

```bash
pnpm add @smart-table/charts
npm install chart.js   # your charting library of choice
```

## Bridge

A `ChartBridge` has three methods:

```ts
interface ChartBridge {
  create(el: HTMLElement, config: ChartConfig): unknown;
  update(instance: unknown, config: ChartConfig): void;
  destroy(instance: unknown): void;
}
```

Register it once, or pass it inline. Example for Chart.js:

```ts
import { Chart } from 'chart.js';
import { registerChartLibrary } from '@smart-table/charts';

registerChartLibrary('chart.js', {
  create(el, config) {
    return new Chart(el, { type: config.kind, data: config });
  },
  update(instance, config) {
    instance.data = config;
    instance.update();
  },
  destroy(instance) {
    instance.destroy();
  },
});
```

## Using it

```ts
import { createTableChart } from '@smart-table/charts';

const chart = createTableChart(table, {
  library: 'chart.js',
  x: 'region', // category labels
  series: [{ field: 'revenue' }, { field: 'cost', aggregate: 'sum' }],
  kind: 'bar', // line | bar | area | scatter | pie | ...
});
```

`createTableChart` mounts a full-size element into the table container, derives `{ labels, series }` from `table.getData()`, and re-renders automatically on `dataChanged`.

### Options

```ts
createTableChart(table, {
  library, // registered name or inline ChartBridge
  x, // label column
  series, // [{ field, label?, aggregate? }]
  kind, // default 'bar'
  mount, // HTMLElement | defaults to table container / document.body
  transform, // (config) => config  — mutate before render
  autoUpdate, // default true
});
```

Series are grouped by the `x` column. When several rows share a label the values are aggregated per `SeriesSpec.aggregate` (`sum | avg | min | max | count`), defaulting to `sum`.

### Lifecycle

```ts
chart.config(); // current chart configuration
chart.update(); // re-derive + re-render
chart.destroy(); // unsubscribe + call bridge.destroy
```

> **Status:** foundation release — the adapter contract and series derivation are stable; richer built-in chart presets follow the v1.0 roadmap.
