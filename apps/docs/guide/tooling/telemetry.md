# Telemetry

`@smart-table/telemetry` collects observable metrics for a table instance — event activity, render/update timing, virtualization, pivot and grouping statistics plus a browser memory snapshot when available.

## Install

```bash
pnpm add @smart-table/telemetry
# npm install @smart-table/telemetry
```

## Quick start

```ts
import { SmartTable } from '@smart-table/core';
import { attachTelemetry } from '@smart-table/telemetry';

const table = new SmartTable({ columns, data, container: mountEl });
attachTelemetry(table);
```

Calling `attachTelemetry` augments the instance with `getMetrics()`, `enableTelemetry()` and `disableTelemetry()`. Collection starts immediately.

## Reading metrics

```ts
const m = table.getMetrics();
// {
//   since,                          // ms since the collector attached
//   mount: { mounted, mountMs },    // first DOM mutation timing
//   render: { lastMs, averageMs, samples },
//   update: { updates, lastMs },
//   memory: { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } | null,
//   events: { total, byEvent, recent },
//   virtualization: { lastViewport, scrolls },
//   pivot: { computations, lastComputeMs, lastConfig },
//   grouping: { groupings, lastGroupMs, field },
// }
```

Mount and render timing are derived from a `MutationObserver` on the table's container, so tables should be constructed with the `container` option (as with mounts in the framework adapters). To pause work, call `disableTelemetry()`; `enableTelemetry()` resumes it. `detachTelemetry(table)` removes the instance.

## TypeScript

The package augments `@smart-table/core` so `getMetrics`, `enableTelemetry` and `disableTelemetry` are typed on `SmartTable` once telemetry is imported:

```ts
import '@smart-table/telemetry';
```

## Notes

- The memory section mirrors `performance.memory`, which only some Chromium-based browsers expose; otherwise it is `null`.
- Telemetry is deliberately read-only: it only subscribes to the event bus and observes DOM — it never mutates table state.
