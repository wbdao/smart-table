# PHASE 2 — DOM Renderer

Status: **complete** (themes, responsive breakpoints, selection, Toolbar,
TableView, CardView, DOMRenderer, styles, jsdom test suites).

This document explains the architecture decisions behind the Phase 2 UI layer.
It builds directly on the headless core from [PHASE_1.md](PHASE_1.md) — the core
still never touches the DOM; the renderer is the only thing that does.

---

## 1. Architecture decisions

### 1.1 The core stays headless; renderers stay thin

Phase 1's guarantee is preserved: `SmartTable` only touches the DOM when
applying theme CSS variables onto its container (or `document.documentElement`),
and never otherwise. Every piece of user-visible behavior in Phase 2 — sorting,
filtering, selection, editing, mode — is driven through the **public core API**
(`sort`, `filter`, `selectRow`, `updateCell`, `setMode`) and reacted to via the
**event bus** (`sortChanged`, `filterChanged`, `selectionChanged`, `cellEdit`,
`modeChanged`, `dataChanged`). A React or Vue renderer would be the same work as
`DOMRenderer`, just wired to that framework's reactivity model.

### 1.2 `table.mount(target)` via a registered renderer factory

`SmartTable` gained a static `registerRenderer(factory)` slot plus `mount()` /
`unmount()`. `DOMRenderer` registers itself at module load (bottom of
`ui/DOMRenderer.ts`), so importing the package entry (`src/index.ts`) enables:

```ts
const table = new SmartTable({ columns, data, container: '#app' });
table.mount(); // builds the DOMRenderer into #app
```

The factory indirection means framework bindings can later register a React /
Vue renderer as the default without changing the core. `mount()` throws
`NO_RENDERER` when no factory is registered and `NO_CONTAINER` when no target
resolves.

### 1.3 Renderer state is a cache, not the source of truth

`DOMRenderer` holds a `DOMRendererState` (current viewport, active edit target,
cached selection ids) purely to avoid redundant work. The data (rows, selection
set, mode, sort/filter state) always lives in `SmartTable`. Every event handler
in `bindEvents()` reads fresh state from the table and patches the DOM
incrementally:

| Event              | Patch                                                                |
| ------------------ | -------------------------------------------------------------------- |
| `cellEdit`         | `view.updateCell(rowId, field)` — mutates one `<td>` in place        |
| `dataChanged`      | `view.syncRows()` — rebuilds only the `<tbody>` (header/scroll kept) |
| `selectionChanged` | `view.setSelection(ids)` — toggles classes + checkboxes              |
| `modeChanged`      | `view.setMode(mode)` — shows/hides the actions column                |
| `sortChanged`      | `view.setSort(...)` + `view.syncRows()`                              |
| `filterChanged`    | `view.syncRows()`                                                    |

A single cell edit therefore never re-renders the grid (verified by test: the
`<tbody>` element identity is preserved after `updateCell`).

### 1.4 One grid, two layouts: TableView and CardView

The responsive breakpoints (`mobile` 768, `desktop` 1024, configurable via
`responsive?: boolean | { mobile, desktop }`) pick the viewport:

- `desktop` / `tablet` → `TableView`: a real `<table>` with a sticky header,
  sortable columns (asc / desc / none), a selection column (select-all +
  per-row checkboxes), editable cells and an actions column.
- `mobile` → `CardView`: rows become cards with label/value pairs, the same
  selection / editing behavior and the same actions.

Both views expose a uniform interface — `render`, `syncRows`, `updateCell`,
`setSelection`, `setMode`, `setSort` (a no-op on cards), `destroy` — so
`DOMRenderer` can swap views without branching. Width is read from the target's
`clientWidth` (with a `widthProvider` hook for tests and embedded use) and
observed via `window.resize` + `ResizeObserver`.

### 1.5 Event delegation everywhere

`TableView` and `CardView` attach exactly one `click` / `dblclick` / `change`
listener to their root and resolve the target with `closest()`. This keeps
memory flat for large tables and makes disposal trivial (`AbortController` +
`removeEventListener`). Data cells carry `data-field`, selection cells
`data-st-selection`, boolean cells `data-st-boolean`, editable cells
`data-st-editable`; actions are `data-st-row-action="edit|delete"`.

### 1.6 Editing is a local, typed session

`ui/editing.ts` replaces a cell with an `<input>` (text / number / date) or an
always-on checkbox for booleans. Enter/blur commit, Escape cancels; invalid
number/date input cancels instead of committing. `onCommit` routes the parsed
value back through `table.updateCell`, so readonly mode is enforced by the core,
not the UI. Only the cell's own keydown/blur listeners are used — starting a
second edit first cancels the active one.

### 1.7 The toolbar is plain DOM + events

`ui/Toolbar.ts` renders search (debounced → `table.filter` + `toolbar:search`),
copy (`table.copy` + `toolbar:copy`), clone (`table.clone` + `toolbar:clone`),
add row (`table.addRow({})` + `toolbar:add`, disabled in readonly) and a mode
toggle (`setMode` + `toolbar:mode`). Controls are opt-out via
`toolbarControls`; the toolbar is optional (`toolbar: false`).

### 1.8 Theming is CSS variables, and the core stays in control

`core/themes.ts` holds three built-in themes (`light`, `dark`, `corporate`)
plus `applyThemeVariables`. `setTheme()` accepts a built-in name **or** a custom
`{ name, variables }` object, validates it, applies the variables onto the
container (or `document.documentElement`) under `data-st-theme`, and emits
`themeChanged`. `src/styles/smart-table.css` defines the component styles from
those variables, with hard-coded fallbacks so the table is usable without a
theme. The CSS is copied into `dist/smart-table.css` at build time and exposed
as `smart-table-js/styles.css`; the JS entries are marked `sideEffects` so the
renderer registration runs on import.

### 1.9 Selection is reference-based and survives everything

`selectRow` / `unselectRow` / `clearSelection` operate on a `Set<DataRow>`.
Selection is allowed in readonly mode (it is not a mutation), survives sort /
filter, is pruned when rows are removed or the dataset is replaced (emitting
`selectionChanged`), and maps to ids via the existing `WeakMap`. Cell click
selects a row; Ctrl/Cmd+click toggles.

### 1.10 Data change events for renderer diffs

New `dataChanged` events (`setData`, `addRow`, `removeRow`, `updateCell`) give
renderers a single hook to sync row bodies. `updateCell` emits only when the
value actually changed (plus the granular `cellEdit` for per-cell patches).
`getRow()` / `getRowByIndex()` / `getRowId()` / `getRowIndex()` round out the
lookup API so UI code never guesses ids.

---

## 2. Folder structure (additions since Phase 1)

```
src/
  core/
    themes.ts        built-in themes, applyThemeVariables, theme resolution
    breakpoints.ts   DEFAULT_BREAKPOINTS + normalizeBreakpoints (validated)
    SmartTable.ts    + mount/unmount, registerRenderer, selection, setTheme,
                     dataChanged, getRow*/getBreakpoints, container option
  ui/
    Renderer.ts      abstract Renderer base + RendererFactory type
    DOMRenderer.ts   orchestrator; registers itself as the default factory
    TableView.ts     desktop grid (sticky, sort, selection, actions, patch)
    CardView.ts      mobile card layout
    Toolbar.ts       search / copy / clone / add / mode controls
    editing.ts       startCellEdit + createBooleanControl
    navigation.ts    attachGridNavigation (arrows / Home / End / Tab / Enter)
    dom.ts           createElement / resolveElement / delegate / …
    Themes.ts        theme re-export for UI consumers
  styles/
    smart-table.css  component styles driven by --st-* variables
  index.ts           public entry — imports the UI, registers DOMRenderer
tests/
  themes.test.ts     jsdom: attribute + variables, custom themes, validation
  toolbar.test.ts    jsdom: controls, search/copy/clone/add/mode events
  renderer.test.ts   jsdom: DOMRenderer lifecycle, patching, selection, sort,
                     editing, actions, keyboard nav, responsive swap
examples/vanilla/    Phase 2 demo (mount(), theme buttons, event log)
```

---

## 3. Public API (Phase 2 additions)

```ts
import { SmartTable } from 'smart-table-js';
import 'smart-table-js/styles.css';

const table = new SmartTable({
  columns,
  data,
  container: '#app', // element or CSS selector
  responsive: true, // or { mobile: 600, desktop: 1000 }
  theme: 'dark', // or a custom { name, variables }
});
```

### Rendering

```ts
table.mount(target?);   // element | CSS selector | container option
table.unmount();        // removes DOM + unsubscribes
table.getRenderer();    // the active Renderer
SmartTable.registerRenderer(factory); // swap the default factory
```

### Selection

```ts
table.selectRow(row | id | index);
table.unselectRow(target);
table.clearSelection();
table.getSelection(); // rows in dataset order
table.getSelectedRowIds();
table.getSelectionCount();
```

### Themes

```ts
table.getTheme(); // name of the active theme
table.getThemeVariables(); // resolved variable map
table.setTheme('corporate');
table.setTheme({ name: 'ocean', variables: { '--st-accent': '#0ea5e9' } });
```

### Data & responsive

```ts
table.getRow(target); // object | id | index
table.getRowByIndex(i);
table.getBreakpoints(); // { mobile, desktop }
table.on('dataChanged', (e) => e.operation); // setData|addRow|removeRow|updateCell
```

### New events

| Event              | Payload                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `selectionChanged` | `{ rows, rowIds }`                                                     |
| `dataChanged`      | `{ operation, row?, rowId?, rowIndex?, field?, oldValue?, newValue? }` |
| `themeChanged`     | `{ name, custom }`                                                     |
| `toolbar:search`   | `{ query }`                                                            |
| `toolbar:copy`     | `{ format }`                                                           |
| `toolbar:clone`    | `{ clone }`                                                            |
| `toolbar:add`      | `{ row, rowId, rowIndex }`                                             |
| `toolbar:mode`     | `{ mode }`                                                             |

### Renderer options

```ts
table.mount(); // or construct DOMRenderer directly:
const renderer = new DOMRenderer(table, {
  target, // element | selector
  toolbar: true, // show the toolbar
  toolbarControls, // ['search','copy','clone','add','mode']
  actions: true, // Edit/Delete column (editable mode)
  stickyHeader: true, // sticky <thead>
  widthProvider, // () => number for the responsive viewport
});
```

---

## 4. Design decisions worth revisiting

| Decision                                           | Rationale                                    | Revisit when                                |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| CardView uses only CSS (no canvas/virtualization)  | Simple, adequate for mobile MVP              | Large mobile datasets (virtual scroll)      |
| `dataChanged` fires per mutation                   | Single sync hook for renderers/plugins       | Batched mutations (addRow range, undo/redo) |
| Toolbar `add` inserts an empty row at the end      | Fastest, unambiguous                         | Configurable insertion index / row factory  |
| Theme variables applied to container or `<html>`   | Scoped theming with a global fallback        | Multiple tables with different themes       |
| `widthProvider` escapes to `window.innerWidth`     | Graceful degradation without a measured size | Measuring the scroll container instead      |
| Generated row ids (`row-1`) not previewed to users | Kept out of user data                        | Stable user-facing ids option               |

---

## 5. Quality gates

- `npm run typecheck` — strict `tsc --noEmit`
- `npm run lint` — ESLint 9 flat config
- `npm run test` — 158 tests; jsdom suites for themes / toolbar / renderer
- `npm run format:check` — Prettier
- `npm run build` — ESM + CJS + `.d.ts` + `dist/smart-table.css`

---

## 6. Roadmap

- **Phase 3** — Feature plugins: pagination, multi-column sort, column
  visibility/reordering, virtualization.
- **Phase 4** — Excel Import/Export, PDF export, Tree data, editing dialogs.
- **Phase 5** — Framework bindings (React, Vue, Angular) + integration docs.
