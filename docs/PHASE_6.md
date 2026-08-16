# Phase 6 — Plugin marketplace + Web Components

Converts the interim registry from Phase 5 into a first-party plugin system for
`@smart-table/core` and ships a new framework-free `@smart-table/web` package.

## Progress

### 6.1 Plugin marketplace (core)

- [x] `types/plugin.ts`: `SmartTablePlugin` extended with `description?` and
      `meta?`; the install contract (`install`/`uninstall`) was already shipped
      as `table.use(plugin)` / `table.unuse(name)` in Phase 5.
- [x] `plugins/registry.ts`: marketplace catalog — `definePlugin(options)`,
      `PluginRegistry` (`register`/`unregister`/`has`/`list`/`installOn`/
      `install(table,name)`/`uninstallFrom`), `createPluginRegistry()`.
      Catalog stores metadata only; no plugin code runs until `installOn()`.
- [x] `plugins/event-log.ts`: `eventLogPlugin({ onEvent?, events? })`,
      `DEFAULT_EVENTS` (39 names), `EventLogEntry { event, payload, at }`,
      `getEntries()` / `clear()`; unsubscribes on uninstall.
- [x] `plugins/summary-footer.ts`: `summaryFooterPlugin({ fields?, label?, className? })`
      → `div.st-plugin-summary` (`aria-live`), re-renders on
      data/filter/sort/page changes; `summarizeRows()` helper; graceful on
      headless tables.
- [x] `index.ts`: old registry exports removed; new catalog + plugin exports.
- [x] Tests: `tests/plugins.test.ts` (6 scena) + `tests/plugin-examples.test.ts`
      (9 via jsdom) — all passing.

### 6.2 Web Components package

- [x] `packages/web` scaffolded: `package.json` (ESM+CJS+dts, peer core),
      `tsconfig.json`, `vite.config.ts` (dts replace pattern), `vitest.config.ts`
      (jsdom, core alias), `src/env.d.ts` (`*.css?inline`).
- [x] `src/element.ts`: `SmartTableElement` — shadow root with inlined core CSS;
      props `columns`/`data`/`options`; attributes `theme`/`page-size`/`editable`/
      `virtual-scroll`/`responsive`/`context-menu`/`group-field`/`table-id`;
      `data` setter → `setData()` (no remount); kebab-cased CustomEvents for all
      `DEFAULT_EVENTS` plus a one-shot `ready` event; `use()`/`unuse()` plugins;
      `defineSmartTableElement(tag)` (per-tag subclass, idempotent, SSR-safe).
- [x] `src/index.ts`: exports + self-registration guard.
- [x] Tests: `tests/element.test.ts` (9) — registering, mounting, event
      forwarding, data updates, attribute rebuilds, teardown, plugin teardown.
- [x] Examples: `packages/web/examples/index.html` + `main.ts` (controls, event
      log, `summaryFooterPlugin`).
- [x] Storybook: `apps/storybook/stories/web.stories.ts` (3 stories) + `env.d.ts`
      for the `?.css?inline` module.

### 6.3 Release prep

- [x] `.changeset/phase6-plugin-marketplace.md` (minor: core + web).
- [x] `docs/PHASE_6.md` (this file).

## Docs

See `apps/docs/guide/plugins-marketplace.md` and
`apps/docs/guide/integrations/web-components.md` (wired into the VitePress
sidebar).

## Gates

- [x] `pnpm -r typecheck`
- [x] `pnpm -r test`
- [x] `pnpm -r build`
- [x] `pnpm -r lint`
- [x] `pnpm format:check`
- [x] `pnpm bench` (unchanged — core untouched by marketplace)

## Notes

- Web-component spec forbids reusing a constructor with two tag names →
  `defineSmartTableElement` creates a subclass per tag.
- `pnpm changeset status` can't run yet: the repo has no git history (`HEAD
diverged from main`). It will work after `git init` + first commit.
