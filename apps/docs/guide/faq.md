# FAQ

## How does SmartTableJS handle 100k+ rows?

Three layers work together:

1. **State-first data pipeline** — filtering/sorting/paging operate on plain arrays and reuse cached views (benchmarks: 100k sort ≈ 45 ms).
2. **Virtual scrolling** — only the visible rows plus an overscan buffer are in the DOM.
3. **Incremental DOM patching** — a single cell edit updates one `<td>` in place; there is no full re-render.

## Is the core really headless?

Yes. `@smart-table/core` manages data, state and the event bus. The built-in DOM renderer is registered automatically on import, but `SmartTable.registerRenderer(factory)` lets you plug in a custom renderer (this is how the framework adapters could evolve).

## What do the adapters add?

Nothing but the glue. `<SmartTable />` for React, a `<SmartTable>` component for Vue and a `<smart-table>` standalone component for Angular all mount the same core into a `div` and forward options/events. Controlled mode (`onChange` / `@update:data` / `(dataChange)`) keeps your state authoritative.

## Can I edit in the table?

Yes — inline cell editing is on by default in `editable` mode. Disable it with `editable={false}` / `:mode="'readonly'"`. Validators run per column on commit.

## Server-side data?

Pass a `dataSource` function. SmartTableJS forwards pagination/sort/filter as typed parameters, commits the newest response and **discards late responses** to stay consistent.

## How do I persist the user's layout?

Layouts (column order, width, visibility) are auto-saved to `localStorage` by default. Provide a custom `layoutStorage` adapter to back it with your own storage, and use `saveLayout`/`loadLayout`.

## Why is there no complex dependency graph?

`@smart-table/core` ships with zero runtime dependencies. The adapters only require their framework as a peer.

## Where are the types?

Every package ships `.d.ts` + source maps. Event payloads are strongly typed via `SmartEventMap` / `SmartTableEvents`.

## Who maintains it?

Still sorting out governance — see the GitHub repo for the roadmap.
