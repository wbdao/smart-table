# DevTools overlay

`@smart-table/devtools` mounts a small floating overlay that shows a live view of a table's internal state: pagination, sorting, filters, selection, grouping, virtualization and a stream of the events the table emits. It is a development aid and should not be shipped to production.

## Install

```bash
pnpm add @smart-table/devtools
# npm install @smart-table/devtools
```

## Quick start

```ts
import { SmartTable } from '@smart-table/core';
import { attachDevTools } from '@smart-table/devtools';

const table = new SmartTable({ columns, data, container: mountEl });
const devtools = attachDevTools(table);
```

The overlay mounts into the table's `container` when set, otherwise into `document.body`.

## Options

```ts
attachDevTools(table, {
  mount, // HTMLElement — override the mount target
  maxEvents, // number — event stream ring-buffer size (default 100)
  title, // string  — overlay title (defaults to table id)
});
```

## Controller

```ts
devtools.show(); // show the overlay
devtools.hide(); // hide without detaching
devtools.toggle(); // flip visibility
devtools.update(); // force-refresh from live state
devtools.getSnapshot(); // read the current state snapshot
devtools.destroy(); // remove the panel and unsubscribe
```

`attachDevTools(table)` is idempotent — repeated calls return the same controller. `detachDevTools(table)` removes and cleans up.

## Combining with telemetry

When [`@smart-table/telemetry`](/guide/tooling/telemetry) is attached to the same table, the overlay adds a section with render timing averages and event totals:

```ts
import { attachTelemetry } from '@smart-table/telemetry';
import { attachDevTools } from '@smart-table/devtools';

attachTelemetry(table);
attachDevTools(table);
```

## Notes

- The panel is plain DOM (styled with an injected stylesheet) and does not touch the table's public API beyond reading state and subscribing to events.
- `destroy()` unsubscribes from the event bus, so long-lived tables do not leak listeners.
