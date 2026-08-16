# PHASE 5 — Ecosystem: Framework Adapters, Docs, Playground & Release Tooling

Status: **complete** (pnpm monorepo, `@smart-table/react`, `@smart-table/vue`,
`@smart-table/angular`, VitePress docs, playground, Storybook, performance lab,
changesets + GitHub Actions CI/CD, plugin-registry foundation — all gates green).

Phase 5 wraps the headless core (Phases 1–4) in an ecosystem: first-class
framework bindings, a documented site, an interactive playground, browsable
component stories, a benchmark lab, and the release machinery to publish it
all. The core surface did **not** regress — the 387 Phase 1–4 tests still pass
unchanged; the only core addition is a small, additive plugin registry
(+7 tests).

---

## 1. Monorepo layout

Migrated from a single package to a pnpm workspace (`pnpm-workspace.yaml`),
`packageManager: pnpm@11.21.0`.

| Path               | Package                    | Published |
| ------------------ | -------------------------- | --------- |
| `packages/core`    | `@smart-table/core`        | npm       |
| `packages/react`   | `@smart-table/react`       | npm       |
| `packages/vue`     | `@smart-table/vue`         | npm       |
| `packages/angular` | `@smart-table/angular`     | npm       |
| `apps/docs`        | `@smart-table/docs`        | static    |
| `apps/playground`  | `@smart-table/playground`  | static    |
| `apps/storybook`   | `@smart-table/storybook`   | static    |
| `apps/performance` | `@smart-table/performance` | static    |

Root scripts: `pnpm typecheck | lint | test | build | bench`, plus
`docs:dev/build`, `playground:dev/build`, `storybook`/`storybook:build`,
`performance:dev`, `changeset`, `version`, `release`. All adapters consume the
core **sources** via Vite aliases (`@smart-table/core` → `../../packages/core/src`)
in dev and `workspace:*` in production builds, so docs/playground always run the
latest code with zero build steps.

No renderer know-how leaked into the adapters: `DOMRenderer` is registered by
importing the core. Mount targets stay plain elements.

---

## 2. Framework adapters

All three expose a thin, typed layer over the headless core: props/inputs mirror
`SmartTableOptions`, change events re-emit the core event map (`sortChanged`,
`filterChanged`, `pageChanged`, `selectionChanged`, `cellEdit`, …), and a
framework-idiomatic imperative handle (ref / controller) exposes the full table
API for escape hatches.

### 2.1 `@smart-table/react`

- `<SmartTable columns data />` — controlled component that owns a
  `SmartTable` instance (mounted in `useEffect`, torn down on unmount).
- `useSmartTable({ columns, data, options?, eventHandlers? })` — headless hook
  returning `{ table, containerRef, setData }` for custom layouts.
- `onReady(table)`, `onChange(event)` plus per-event callbacks
  (`onSortChanged`, `onFilterChanged`, …).
- Packages ESM + CJS + `.d.ts`; 8 vitest tests under jsdom.

### 2.2 `@smart-table/vue`

- `<SmartTable v-model:data :columns="…" />` — `defineComponent` typed through
  `SmartTableOptions`, emits `ready` + every change event.
- `useSmartTable({ columns, data })` — composable returning
  `{ table, host, setData, setOptions }`.
- 7 tests with `@vue/test-utils`; browser dev example included.

### 2.3 `@smart-table/angular`

- Standalone `SmartTableComponent` (`<smart-table …>`, imports work without an
  `NgModule`), inputs mirror options, outputs mirror events, `writeValue`
  via a `SmartTableController` host-agnostic controller (framework-free, reused
  by other hosts if needed).
- Angular peer deps are type-only imports (`verbatimModuleSyntax`).
- 6 tests; reference `main.ts` (outside the build) + README.

---

## 3. Docs site (`apps/docs`, VitePress)

A full static documentation site wired as a workspace app:

- Landing page with hero + feature grid; light/dark theme following
  `prefers-color-scheme`; built-in search.
- Guides: getting started, installation, the feature tour (editing, sorting,
  filtering, virtualization, server data, grouping, tree, pivot), and dedicated
  React/Vue/Angular integration pages.
- API reference rendered from the live type surface (options, events, methods).
- `pnpm docs:build` emits a static site with zero failures.

---

## 4. Playground (`apps/playground`, Vite + TS)

Interactive lab for poking at the API without leaving the browser:

- Datasets: products (1k/50k/100k), employees, tree data; deterministic PRNG.
- Controls: theme, page size, editability, virtual scroll, responsive,
  context menu, tree, aggregates, group-by.
- State round-trip: export/import the full `GridState` (localStorage
  persistence between reloads).

---

## 5. Storybook (`apps/storybook`, v8)

Browsable stories for the renderer: Grid, Toolbar, Card view, Pivot view,
Context menu, Themes, Validation, Tree, Grouping — each using the live core
sources via the shared Vite alias pattern (the stylesheet alias must precede the
package alias in the `alias` array).

---

## 6. Performance lab (`apps/performance`)

Head-to-head micro-benchmarks against **AG Grid**, **Tabulator** and **Grid.js**
on an identical 7-column product dataset (1k / 10k / 50k rows):

- Each engine mounts in an isolated container; probes: **mount**, **sort**
  (`price` desc), **filter** (`price > 750`); median of 3 runs, bar-chart
  relative to the fastest engine.
- SmartTableJS sorts via `table.sort()`, filters via `table.where()` — the
  other engines use their native APIs (`applyColumnState`,
  `tab.setFilter`, header clicks).

---

## 7. Plugin marketplace foundation

`packages/core/src/plugins/registry.ts` (additive; nothing in Phases 1–4 was
touched):

- `definePlugin()` + `SmartTablePlugin` (`setup`/optional `teardown`,
  metadata for a future marketplace listing).
- `PluginRegistry` — dedupe by id, `installAll(context)` /
  `teardownAll(context)` tracked per context, idempotent teardown.
- `PluginContext` — read-only table facade + event bus + options snapshot; the
  integrator decides exactly what to expose. 7 new tests.

---

## 8. Release tooling

- **Changesets**: `.changeset/config.json` (public access, `main` base),
  `pnpm changeset` to add entries, `pnpm release` publishes. Private apps are
  ignored.
- **CI** (`.github/workflows/ci.yml`): on push/PR — install, lint, typecheck,
  test, build packages, build playground/docs/storybook, run benchmarks.
  Node 20 + pnpm via `pnpm/action-setup@v4`.
- **Release** (`.github/workflows/release.yml`): on `.changeset/` push to
  `main`, `changesets/action` opens the versioning PR and, on merge, publishes
  the four npm packages using `NPM_TOKEN` and creates a GitHub release.
- All four publishable packages carry `publishConfig.access: public`.

---

## 9. Quality gates

Current state after this phase (run from the repo root):

- `pnpm typecheck` — strict `tsc --noEmit` across all 8 workspace packages.
- `pnpm lint` — ESLint 9 flat config, whole repo.
- `pnpm test` — core (394 tests / 29 suites, incl. the 7 plugin-registry
  tests) + adapter suites (React 8, Vue 7, Angular 6).
- `pnpm build` — ESM + CJS + `.d.ts` for the four packages; static builds for
  the four apps.
- `pnpm bench` — `vitest bench` Phase 1–4 suite (unchanged, still passes).
- `pnpm format:check` — Prettier.

---

## 10. Notable decisions to revisit

| Decision                          | Rationale                                    | Revisit when                  |
| --------------------------------- | -------------------------------------------- | ----------------------------- |
| Adapters dual-bundle ESM+CJS      | Max compatibility, dts via `vite-plugin-dts` | Package CJS deprecation       |
| Docs/playground alias core source | Zero-build feedback loop                     | Splitting adapter releases    |
| Perf lab in-app DOM timing        | Honest end-to-end numbers                    | Headless byte-exact benches   |
| Changesets publishes from `main`  | Simple, standard flow                        | Multi-branch release trains   |
| Plugin registry standalone        | Foundation without coupling to table         | First-party `table.use()` API |
| Node 20 only in CI                | LTS stability                                | EOL / offical Node 24 runners |

---

## 11. Roadmap

- **Phase 6** — Plugin marketplace (registry-driven features with
  `table.use()`), Web Components (`<smart-table>` element), SSR-friendly
  export of the adapters, and CI-driven deployment of docs/playground/storybook
  (GitHub Pages or similar).
