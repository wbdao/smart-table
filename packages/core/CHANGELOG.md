# @smart-table/core

## 0.9.0-beta

Version 0.9.0-beta is a deliberate alignment release representing completion of Phases 1–7 and is not the result of incremental semver progression from 0.1.x.

### Minor Changes

- Release the Phase 5 ecosystem: React, Vue and Angular adapters over the headless core, an additive plugin registry (`definePlugin` / `PluginRegistry`), plus docs, playground, Storybook and performance tooling.

- feat: first-party plugin marketplace — `definePlugin`, `PluginRegistry`/`createPluginRegistry`, plus `eventLogPlugin` and `summaryFooterPlugin` example plugins ready for `table.use()`.

### Patch Changes

- feat(phase-7): beta release & enterprise foundations — governance docs, `apps/www` marketing site, AG Grid compatibility (`ag-compat`), TanStack Query/Router integration (`tanstack`), observability (`telemetry`, `devtools`), and contract-first foundations for collaboration, charts and security. `core` receives `@internal` marks on virtualization internals only (no runtime change).
