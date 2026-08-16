# Plugin marketplace

`@smart-table/core` ships a **plugin marketplace**: an in-memory catalog of
first-party plugins plus a first-class `table.use(plugin)` API for installing
and uninstalling them. Plugins extend tables without touching core — sorting,
filtering, and rendering stay untouched.

## Quick start

```ts
import { summaryFooterPlugin, eventLogPlugin } from '@smart-table/core';

table.use(summaryFooterPlugin({ fields: { price: 'sum' }, label: 'View' }));
table.use(eventLogPlugin({ onEvent: (e) => track(e.event) }));

table.unuse('event-log'); // teardown + removal, no-op if absent
```

Installing the same plugin twice is a no-op (plugins are deduped by name).

## The plugin contract

A plugin is a plain object:

```ts
interface SmartTablePlugin {
  name: string; // unique, required
  version?: string; // semver for the plugin itself
  description?: string; // marketplace blurb
  meta?: Readonly<Record<string, unknown>>; // tags, author, provenance
  install(table: SmartTable): void; // subscribe / render / mutate
  uninstall?(table: SmartTable): void; // teardown (cleanup on unuse/destroy)
}
```

`install` receives the live `SmartTable` instance. Use `table.on(event, cb)`
to subscribe — it returns an unsubscribe function — and remember to remove any
DOM you created inside `uninstall`. Plugins must be able to install on a
headless table (see the graceful guard in `summaryFooterPlugin`).

## First-party plugins

### `eventLogPlugin({ onEvent?, events? })`

Records every table event in memory for debugging, analytics, and adapter
smoke tests.

```ts
const log = eventLogPlugin();
table.use(log);

log.getEntries(); // [{ event: 'sortChanged', payload: {...}, at: 123 }]
log.clear();
```

- `events?` overrides the default event set (`DEFAULT_EVENTS`, ~39 names).
- `onEvent?` is called synchronously per recorded entry.

### `summaryFooterPlugin({ fields?, label?, className? })`

Paints a footer (`div.st-plugin-summary`, `aria-live="polite"`) below the
table container with the row count and per-numeric-column summaries. It
re-renders on `dataChanged`, `filterChanged`, `sortChanged`, and `pageChanged`,
and removes its element on uninstall.

```ts
table.use(summaryFooterPlugin({ fields: { price: 'sum', stock: 'avg' }, label: 'View' }));
```

- `fields?` maps field → `'sum' | 'avg' | 'min' | 'max' | 'count'`.
  Defaults to `sum` on every numeric column.
- `refresh()` forces a re-render (`summaryFooterPlugin` augments the
  return type with this handle).

The reusable `summarizeRows(rows, fields)` helper is exported for your own UIs.

## Writing a custom plugin

```ts
import type { SmartTablePlugin } from '@smart-table/core';

export function rowCounterPlugin(): SmartTablePlugin {
  let off: (() => void) | null = null;
  return {
    name: 'row-counter',
    version: '1.0.0',
    description: 'Logs the visible row count whenever data changes.',
    meta: { tags: ['debug'] },
    install(target) {
      off = target.on('dataChanged', () => console.log(target.getRows().length));
    },
    uninstall() {
      off?.();
      off = null;
    },
  };
}
```

## Registering plugins in the catalog

`definePlugin(options)` returns an installable `SmartTablePlugin` and registers
it in `createPluginRegistry()`, an in-memory catalog you can query metadata
from — useful for plugin pickers and marketplace UIs.

```ts
import { definePlugin, createPluginRegistry } from '@smart-table/core';

const plugin = definePlugin({ ..., install(table) { ... } });

const registry = createPluginRegistry();
registry.register(plugin);
registry.has('row-counter'); // true
registry.list();             // metadata only, never instances
registry.installOn(table);   // installs every registered plugin
registry.uninstallFrom(table); // uninstalls every active registered plugin
```
