# Phase 8 — v1.0.0 release (API freeze & enterprise hardening)

Phase 7 is closed. Phase 8 turns the `v0.9.0-beta` milestone into a production
`v1.0.0`: freeze the public API, close the Definition-of-Done gaps, harden
accessibility/security/performance, and ship a real release with provenance,
changelogs, and migration guidance.

## Principles

1. **Freeze first, verify second.** The API classification decision (8.2) is
   the contract everything else is measured against. No new public surface is
   added after it without a major-version discussion.
2. **Nothing half-guaranteed.** Every `Experimental` area either graduates to
   `Stable` or is demoted to `Internal` before 1.0 (`API_STABILITY.md`).
3. **Release machinery first.** Git history + version alignment are
   prerequisites for changelogs, `changeset status`, and publishing. Without
   them every downstream verification is un-auditable.
4. **Gates are enforced in CI, not in a README.** Coverage thresholds, bench
   budgets, a11y checks, and dependency scans must fail the build when they
   regress.
5. **Compatibility with the stability policy.** Any rename/removal goes through
   the documented deprecation window; nothing is silently broken.

## v1.0 Definition of Done (from `ROADMAP.md`) → Phase 8 milestone

| DoD item                                            | Covered by            |
| --------------------------------------------------- | --------------------- |
| Public API classified and frozen                    | 8.2                   |
| Migration guide for every adapter + AG Grid layer   | 8.8                   |
| Accessibility audit passed (WCAG 2.2 AA)            | 8.5                   |
| Performance certification published                 | 8.9                   |
| Security review passed; reporting live              | 8.6                   |
| Plugin compatibility verified (stable + experimental)| 8.7                   |
| Adapters verified: React 18+, Vue 3, Angular 17+, Web | 8.7                 |
| Coverage ≥ 90% on new foundations                   | 8.4                   |
| `RELEASE_CHECKLIST.md` fully green                  | 8.1, 8.4, 8.10        |

## Milestones (execution order)

### 8.1 — Release foundations (git, versions, changelogs)

**Why first:** the repo has no git history, which blocks `changeset status`,
changelog generation, and the beta/v1.0 cuts. Versions are also misaligned
(`core`/adapters `0.1.0`, Phase 7 packages `0.1.0-beta`).

Tasks:

- Initialize git repo (`main` branch), keep `.gitignore`; first commit is the
  current verified tree so the release workflows run against real history.
- Align versions to the `v0.9.0-beta` milestone as a single cut, then move all
  packages to `v1.0.0` together at release:
  - add `fixed: ["@smart-table/core", "@smart-table/react", ...]` in
    `.changeset/config.json` so packages cannot drift;
  - keep assistant packages (`docs`, `playground`, `storybook`, `performance`,
    `www`) ignored.
- Run `pnpm changeset version` and validate `pnpm changeset status` is clean.
- Verify per-package `CHANGELOG.md` is generated and rolls up Phase 5/6/7
  changesets.
- Publish dry-run: `npm publish --dry-run` for each package in workspace order,
  checking `files`, export maps, and `publishConfig.access`.

Artifacts: git history, version-aligned lockfile, generated `CHANGELOG.md`,
validated release workflow on a `v0.9.0-beta` tag.

Acceptance: `changeset status` clean; every publishable package `--dry-run`
green; release workflow simulated (or run on `v0.9.0-beta`).

Risk: low–medium (versioning math + first real publish). Impact: high — unlocks
all release tooling. Blocks: 8.2, 8.8, 8.10.

### 8.2 — API freeze decision

**Why next:** the classification decisions dictate what 8.3–8.8 must ship.

Tasks:

- Resolve the `API_STABILITY.md` pending candidates:
  - `StateManager`/`GridState` naming → decide rename before freeze (implement
    in 8.3) or deprecate;
  - `serializeRows` / `getCellText` → tighten signatures or move to an
    `@smart-table/core/utils` internal scope.
- Finalize the plugin ABI: lock `SmartTablePlugin`, plugin registry, and the
  `Capability`-gated renderer option contract (the "may tighten before 1.0"
  items become fixed).
- Classify every Experimental area as **Stable** or **Internal** — no
  half-guarantees.
- Publish the frozen `API_STABILITY.md` (v1.0 revision) + a draft `0.x → 1.0`
  migration matrix (feeding 8.8).

Artifacts: updated `API_STABILITY.md`, list of final public symbols per
package, migration matrix.

Acceptance: reviewer sign-off that no unclassified public surface remains.

Risk: **highest** (renames touch adapters/plugins/docs). Impact: **highest** —
locks the contract. Blocks: 8.3, 8.7, 8.8.

### 8.3 — Foundation package stabilization

**Why here:** after classification, each Phase 7 package must actually meet its
stated level.

Tasks, per package (`ag-compat`, `tanstack`, `telemetry`, `devtools`,
`collaboration`, `charts`, `security`):

- Harden the public surface to the 8.2 decision (stable APIs finalized, exports
  that fail classification moved to `@internal` or removed).
- Export-map + `.d.ts` review (ESM/CJS/types entry points).
- Fill test gaps to reach ≥ 90% line coverage (measured by 8.4 gate).
- Update package docs (API reference page + guide) and add a changeset.

Artifacts: stabilized packages, per-package docs, changesets.

Acceptance: all foundation tests pass; coverage thresholds met; docs build green.

Risk: medium (API churn from 8.2). Impact: high (this is the shipped 1.0
surface). Depends on: 8.2. Blocks: 8.4 (thresholds), 8.7, 8.8.

### 8.4 — CI & quality-gate hardening

Tasks:

- **Coverage:** add `@vitest/coverage-v8`; enforce ≥ 90% line coverage on the
  Phase 7 foundation packages (and a maintained floor on `core`/adapters) via a
  new CI `coverage` job; add `coverage:ci` root script.
- **Bench budget:** turn `pnpm bench` into a gating budget against
  `PERFORMANCE_REPORT.md` baselines (configurable in `scripts/measure-perf.mjs`
  or a `bench.json`); CI fails on regression beyond tolerance.
- **A11y automation:** axe-core run in storybook CI + Vitest DOM a11y tests
  (feeds 8.5).
- **Node matrix:** run `quality`/`test` on Node 18, 20, 22.
- **Security:** `pnpm audit --prod` (or OSV-scanner) gate with triage allowlist
  (feeds 8.6).
- **Missing gates:** add `pnpm www:build` and `pnpm format:check` to CI; add a
  publish `--dry-run` job; re-include `apps/www` in coverage of relevant paths.
- **Post-release smoke:** script that installs the just-published packages from
  `npm` into a temp project and renders a table per adapter (feeds 8.10).

Artifacts: CI workflow updates, `bench.json` budget, coverage config, smoke
script.

Acceptance: new CI job matrix green; each gate fails on a deliberate regression.

Risk: low (tooling only). Impact: high — makes DoD items enforceable. Depends
on: 8.1, 8.3. Blocks: 8.9, 8.10.

### 8.5 — Accessibility audit (WCAG 2.2 AA)

Tasks:

- Automated: axe-core over storybook stories + representative docs/demo pages;
  keyboard-only navigation and focus-management tests per component
  (grid, toolbar, cell editor, context menu, selection).
- Manual audit checklist: contrast, focus order, ARIA roles/names, reduced
  motion, 200% zoom, screen-reader pass (NVDA/VoiceOver spot check).
- Fix findings in core renderers/adapters; changeset + migration note for any
  behavior change.
- Publish `A11Y_REPORT.md` (tooling, findings, residual risks).

Artifacts: `A11Y_REPORT.md`, a11y tests, a11y CI job.

Acceptance: axe zero violations on supported stories; report sign-off.

Risk: medium (may surface core focus/ARIA gaps late in the cycle — run early in
parallel with 8.6/8.7). Impact: high (DoD + enterprise blocker).

### 8.6 — Security hardening & review

Tasks:

- Renderer hardening tests: cell-content escaping/XSS, `innerHTML` audit of
  `DOMRenderer`/cell formatters, attribute-injection and prototype-pollution
  cases from plugin/adapter input (`SECURITY.md` scope).
- Input validation pass on `setData`, `updateCell`, structured filters, and
  plugin options.
- Dependency audit triage (from 8.4) with an allowlist policy.
- Replace placeholders: real security contact + `security.txt` on `apps/www`;
  enable GitHub Security Advisories.
- Publish `SECURITY_AUDIT.md` (scope, findings, mitigations, residual risk).

Artifacts: `SECURITY_AUDIT.md`, hardening tests, CI audit gate.

Acceptance: zero critical/high unmitigated findings; report sign-off.

Risk: medium. Impact: high (DoD + trust). Depends on: 8.4 (audit gate).

### 8.7 — Plugin & adapter compatibility verification

Tasks:

- Plugin compatibility suite: exercise `eventLogPlugin`, `summaryFooterPlugin`,
  and the plugin registry against the frozen stable + experimental API sets;
  fail on use of `@internal` symbols.
- Adapter cross-version matrix: React 18/19, Vue 3.x, Angular 17/18, Web
  Components — build + render smoke per version (CI matrix job).
- Fresh-install smoke: run the 8.4 smoke script against published artifacts
  (also covers `ag-compat` migration example and `tanstack` router demo).

Artifacts: compat test suite, adapter matrix CI job, smoke script output.

Acceptance: all matrix entries green; no stable-surface plugin uses internal
symbols.

Risk: low–medium (mostly verification). Impact: high (DoD). Depends on: 8.2, 8.3.

### 8.8 — v1.0 documentation & migration

Tasks:

- `Upgrading to v1.0` guide: `0.x → 1.0` migration matrix from 8.2, deprecation
  notes, per-adapter upgrade paths + AG Grid migration verification.
- API reference pages for every stable package (core + 7 foundations +
  adapters) — fill the API sidebar that currently only hosts `stability.md`.
- Roll-up `v1.0.0` changelog from all phase changesets (per
  `RELEASE_CHECKLIST.md` §5).
- `apps/www` release notes + feature-parity pass; docs sidebar refresh.

Artifacts: upgrade guide, full API reference, roll-up changelog, www parity.

Acceptance: every stable public symbol documented; docs build green.

Risk: low. Impact: high (release readiness). Depends on: 8.2, 8.3.

### 8.9 — Performance re-certification

Tasks:

- Re-run `scripts/measure-perf.mjs` on the reference machine (100k / 1M rows:
  construct, sort, filter, select, virtualize).
- Set CI bench budget in `bench.json` (8.4) from the measured baseline with
  tolerance.
- Update `PERFORMANCE_REPORT.md` to v1.0 revision.

Artifacts: updated `PERFORMANCE_REPORT.md`, `bench.json` budgets.

Acceptance: budgets met in CI on the release commit.

Risk: low. Impact: medium (DoD). Depends on: 8.4.

### 8.10 — v1.0.0 release

Tasks:

- Freeze `main`; run full gates (`typecheck` · `lint` · `test` · `build` ·
  `bench` · `format:check` · `docs:build` · `www:build`).
- Cut `v1.0.0`: changesets version, roll-up changelog, tag, publish with
  `id-token` provenance, dist-tag `latest`.
- Post-release: fresh-install + adapter smoke from npm (8.4 script), dist-tag
  audit, `beta`/`latest` verification.
- Finalize: mark Phase 8 done in `ROADMAP.md`, `SUPPORTED_VERSIONS.md` 1.x
  policy live, `RELEASE_CHECKLIST.md` green.

Artifacts: `v1.0.0` on npm, provenance, smoke verification.

Acceptance: `RELEASE_CHECKLIST.md` fully checked; published packages install
and render.

Risk: medium (first public release). Impact: **highest**.

## Dependency graph

```
8.1 (git/versions) ─► 8.2 (API freeze) ─► 8.3 (stabilize foundations)
                    │         └──────────────┬──────────────► 8.7 (compat)
                    └────────────────────────┴──────► 8.8 (docs)
8.1 ─► 8.4 (CI gates) ─► 8.9 (perf re-cert)
8.4 ─► 8.5 (a11y) ─┐
8.4 ─► 8.6 (security) ├──► 8.10 (release)
8.7/8.8/8.9 ──────────┘
```

## Priority matrix

| # | Milestone      | Impact | Risk | Effort | Release-readiness impact | Why this slot          |
| - | -------------- | ------ | ---- | ------ | ------------------------ | ---------------------- |
| 1 | 8.1 Foundations | high  | low–med | S | **enabler** (changelogs, publish) | unblocks everything    |
| 2 | 8.2 API freeze | highest | **high** | M | **freezes the contract** | decisions cascade      |
| 3 | 8.3 Stabilize  | high  | med  | L | ships the 1.0 surface    | depends on 8.2         |
| 4 | 8.4 CI gates   | high  | low  | M | makes DoD enforceable    | needs stable code       |
| 5 | 8.5 A11y       | high  | med  | M | DoD / enterprise blocker | parallel after 8.4     |
| 6 | 8.6 Security   | high  | med  | M | DoD / trust              | parallel after 8.4     |
| 7 | 8.7 Compat     | high  | low–med | M | DoD verification         | after 8.2/8.3          |
| 8 | 8.8 Docs       | high  | low  | L | release readiness         | after 8.2/8.3          |
| 9 | 8.9 Perf       | med   | low  | S | certification + budget    | after 8.4              |
| 10| 8.10 Release   | highest | med | S | ships v1.0.0              | last                   |

Recommended execution: **8.1 → 8.2 → 8.3** strictly sequential; **8.5 / 8.6 /
8.7** in parallel after 8.4; **8.8 / 8.9** in parallel; **8.10** last.

## Out of scope (backlog, not Phase 8)

- Real-time collaboration implementations (WebSocket / SignalR / Yjs / CRDT) —
  Phase 8 ships the abstractions already released, not servers.
- Chart library adapters (Chart.js / ECharts / ApexCharts) — abstraction layer
  only.
- SSR helper packages and framework data-loading kits.
- i18n bundle, accessibility plugin pack, enterprise theming.

## Gates

Phase 8 is only "done" when all of the following are green on `main`:

- [ ] `pnpm install` (frozen lockfile) resolves
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm test` green (all suites)
- [ ] `pnpm build` green (ESM + CJS + d.ts, all publishable packages)
- [ ] `pnpm bench` within budget (CI-enforced)
- [ ] `pnpm format:check` clean
- [ ] `pnpm docs:build` green
- [ ] `pnpm www:build` green
- [ ] Coverage ≥ 90% on foundations (CI-enforced)
- [ ] a11y + security CI jobs green
- [ ] `changeset status` clean on git history
- [ ] `RELEASE_CHECKLIST.md` fully checked
- [ ] `v1.0.0` published with provenance; smoke tests from npm green
