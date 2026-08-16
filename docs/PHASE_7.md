# Phase 7 — Beta release, adoption & enterprise foundations

Prepares the project for its first public beta (`v0.9.0-beta`): community
governance, a marketing site, compatibility and observability packages, and
architecture foundations for collaboration, charts and security. Everything is
additive; the `pnpm` gates (`typecheck`, `lint`, `test`, `build`, `bench`) stay
green.

## Progress

### 7.1 Beta release prep — governance

- [x] `ROADMAP.md` with phase status and the `v0.9.0-beta` strategy; `v1.0` definition of done.
- [x] `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORTED_VERSIONS.md` (active/beta/experimental matrix).
- [x] Issue templates (bug/feature/question + config), PR template, discussion templates.
- [x] `docs/COMMUNITY.md` and `docs/RELEASING.md` (dist-tags, milestone gate, deprecation policy).

### 7.2 Public website (`apps/www`)

- [x] VitePress marketing site: home hero + feature cards, feature/perf/frameworks/pricing/roadmap/community/blog pages.
- [x] SEO head (canonical, OG, Twitter, JSON-LD `SoftwareApplication`); dark mode via `appearance`; responsive CSS.
- [x] Root scripts `www:dev` / `www:build` / `www:preview`; `pnpm www:build` green.

### 7.3 `@smart-table/ag-compat`

- [x] `convertAgGridOptions()` maps column defs, `defaultColDef`, pagination, `domLayout`, and `filterModel` → `options`/`sort`/`filters` + `ConversionWarning`s.
- [x] `createAgCompatibleTable()` applies sort/filter for a near drop-in migration path.
- [x] Migration guide at `apps/docs/guide/integrations/ag-grid.md`; 13 tests.

### 7.4 `@smart-table/tanstack`

- [x] `queryDataSource()` caches remote loads through `@tanstack/query-core` (peer, optional) with `tableQueryKey`/`invalidateTableQueries`.
- [x] `createRouterStateSync()` mirrors page/sort/query to the URL and back (`RouterSyncMode`), with `applying` guard and sort→filter→page apply order.
- [x] Guide `apps/docs/guide/integrations/tanstack.md`; 11 tests.

### 7.5 `@smart-table/telemetry`

- [x] `MetricsCollector` + `attachTelemetry()` augmenting `SmartTable` with `getMetrics()/enableTelemetry()/disableTelemetry()`.
- [x] Render/update timing via a `MutationObserver` on the table container; event tally; virtual/pivot/group metrics; idempotent attach.
- [x] 7 tests, including mount timing.

### 7.6 `@smart-table/devtools`

- [x] `attachDevTools()` developer overlay: live page/sort/filter/selection/group/virtual state, event stream (ring capped), optional telemetry section.
- [x] `show/hide/toggle/update/getSnapshot/destroy`; mounts into table container (or body); idempotent; telemetry-aware.
- [x] Tooling docs; 9 tests.

### 7.7 `@smart-table/collaboration`

- [x] `TransportAdapter` / `SyncAdapter` / `ConflictResolver` contracts (`CollaborationMessage` typed).
- [x] `createCollaborationSession()` optimistic flow: local edits → `op`/`snapshot` messages, remote apply with echo guard, versioned conflict resolution.
- [x] Resolvers `lastWriteWins` / `remoteWins` / `localWins` / `resolveWith`; 10 tests. No production CRDT yet (documented as foundation).

### 7.8 `@smart-table/charts`

- [x] Vendor-agnostic `ChartBridge` (create/update/destroy) + `registerChartLibrary` / inline bridges.
- [x] `deriveSeries()` groups by an `x` column and aggregates per `SeriesSpec` (`sum/avg/min/max/count`); `createTableChart()` auto-syncs on `dataChanged`.
- [x] 10 tests.

### 7.9 `@smart-table/security`

- [x] `createSecurityPolicy()` declarative roles + permission inheritance + fail-closed unknown roles.
- [x] `createTableGuard()` gates `addRow`/`updateCell`/`removeRow` per permission; `PermissionDeniedError`.
- [x] 9 tests.

### 7.10 API stability review

- [x] [`API_STABILITY.md`](../API_STABILITY.md): `stable` / `experimental` / `internal` levels, per-area table, deprecation process, v1 migration strategy.
- [x] `@internal` marks on virtualization internals; stability page linked from the docs sidebar.

### 7.11 Performance certification

- [x] [`PERFORMANCE_REPORT.md`](../PERFORMANCE_REPORT.md) from `scripts/measure-perf.mjs` (1k/10k/50k/100k × construct/getRows/filter/sort/paginate/group/server).
- [x] 100k targets on the reference laptop: construct ~80 ms, sort ~24 ms, filter ~71 ms. `pnpm bench` remains the gate.

### 7.12 v1.0 readiness

- [x] [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md) — gates, artifacts, docs, post-publish verification.
- [x] Changeset `phase7-beta-release.md` covering all compatible packages.
- [x] ROADMAP Phase 7 rows checked.
- [x] Full workspace gates green.

## Architecture notes

- **Beta packaging**: every assistant package ships `0.1.0-beta` with a public
  export map (ESM + CJS + dts) and keeps `@smart-table/core` as a peer. The
  beta dist-tag keeps `latest` clean until v1.0.
- **Compatibility layers** read table state through the stable public API only
  (`sort/filter/where/getState…`), so they cannot break when internals change.
- **Observability** uses the typed event bus (`DEFAULT_EVENTS`) and a lazy
  `MutationObserver`, never mutating table state.
- **Foundations** (collaboration/charts/security) are contract-first: the
  vendor backends (Yjs, Chart.js/ECharts, RBAC stores) are intentionally not
  bundled; they plug in through the exported interfaces.
- **Stability** levels are explicit before v1.0 so adopters know what to rely on.
