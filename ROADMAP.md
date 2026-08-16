# SmartTableJS Roadmap

Framework-agnostic, high-performance data-grid for TypeScript & JavaScript —
vanilla, React, Vue, Angular and Web Components.

- **Current milestone:** Phase 8 — `v1.0.0` stabilization and final release.
- **Next version:** `v0.9.0-beta` (public beta).
- **Target:** `v1.0.0` (API freeze, enterprise-ready).

## Status

| Phase   | Theme                                                            | Status      |
| ------- | ---------------------------------------------------------------- | ----------- |
| Phase 1 | Core architecture                                                | done        |
| Phase 2 | UI layer, editing, selection, themes, responsive                 | done        |
| Phase 3 | Professional grid features                                       | done        |
| Phase 4 | Virtualization, server data, grouping, aggregations, tree, pivot | done        |
| Phase 5 | Monorepo, React/Vue/Angular, docs, playground, storybook, CI/CD  | done        |
| Phase 6 | Plugin marketplace, Web Components                               | done        |
| Phase 7 | Beta release, adoption, enterprise integrations                  | done        |
| Phase 8 | `v1.0.0` release — API freeze, enterprise hardening              | not started |

## Versioning strategy

- Pre-1.0 history lives in `docs/PHASE_*.md`.
- All published packages move together to **`v0.9.0-beta`** as the milestone
  gate passes (see `docs/RELEASING.md`).
- `v0.9.0-beta` is a **prerelease** (dist-tag `beta`). SemVer governs:
  `0.x` minor bumps may introduce breakage with clear migration notes.
- `v1.0.0` is the API-freeze release; after it, breaking changes only in
  major versions.

## Phase 7 — Beta release & enterprise foundations

| Milestone | Deliverables                                                                      |
| --------- | --------------------------------------------------------------------------------- |
| [x] 7.1   | Beta release prep — governance files, issue/PR templates, `v0.9.0-beta` strategy  |
| [x] 7.2   | Public website (`apps/www`) — SEO, OG, structured data, dark mode, responsive     |
| [x] 7.3   | `@smart-table/ag-compat` — AG Grid migration adapter + guide                      |
| [x] 7.4   | `@smart-table/tanstack` — TanStack Query / Router integration utilities           |
| [x] 7.5   | `@smart-table/telemetry` — `getMetrics()`, `enableTelemetry()/disableTelemetry()` |
| [x] 7.6   | `@smart-table/devtools` — developer overlay (state/events/perf/…)                 |
| [x] 7.7   | `@smart-table/collaboration` — transport/sync/conflict abstractions (no impl)     |
| [x] 7.8   | `@smart-table/charts` — Chart.js / ECharts / ApexCharts abstraction layer         |
| [x] 7.9   | `@smart-table/security` — roles/permissions/policies architecture                 |
| [x] 7.10  | API stability review → `API_STABILITY.md` + v1 migration strategy                 |
| [x] 7.11  | Performance certification → `PERFORMANCE_REPORT.md`                               |
| [x] 7.12  | v1.0 readiness → `RELEASE_CHECKLIST.md`                                           |

Details and success criteria: [`docs/PHASE_7.md`](docs/PHASE_7.md).

## v1.0 Definition of Done

- Public API classified and frozen (`API_STABILITY.md`).
- Migration guide for every adapter + AG Grid compatibility layer.
- Accessibility audit passed (WCAG 2.2 AA target).
- Performance certification published (`PERFORMANCE_REPORT.md`).
- Security review passed; vulnerability reporting live (`SECURITY.md`).
- Plugin compatibility verified against stable + experimental API sets.
- Framework adapters verified: React 18+, Vue 3, Angular 17+, Web Components.
- Coverage ≥ 90% on new foundations (telemetry, devtools, adapters, security).
- `RELEASE_CHECKLIST.md` fully green.

## After v1.0 (backlog, not committed)

- Real-time collaboration implementations (WebSocket / SignalR / Yjs / CRDT).
- Charts adapter implementations (Chart.js, ECharts, ApexCharts).
- Server-side rendering helper packages and Framework data-loading kits.
- i18n bundle, accessibility plugin pack, enterprise theming.
