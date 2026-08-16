# Phase 8.1 — Git & version alignment (implementation plan)

Status: **plan, not yet executed.** Phase 8.1 brings the monorepo to a single
publishable baseline (`v0.9.0-beta`) on real git history so every downstream
8.x deliverable (changelogs, `changeset status`, publish dry-run, release
simulation) is unblocked. No public API changes are made.

---

## 1. Repository audit report

| Area                          | Finding                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| Workspace                     | pnpm 11.21.0; `packages/*`, `apps/*`, `examples/*`               |
| Publishable packages          | 12 (`@smart-table/*` under `packages/`), all `access: public`, `files: ["dist"]` |
| Private apps                  | 5 (`docs`, `performance`, `playground`, `storybook`, `www`) — correctly ignored by changesets |
| `examples/`                   | Only `README.md` (no workspace packages) — no publishable surface |
| Changelogs                    | None exist anywhere                                              |
| `.npmrc`                      | None (registry/auth default; publish relies on `NPM_TOKEN` + `access: public`) |
| Scripts                       | `scripts/measure-perf.mjs` (perf harness)                        |
| Quality gates                 | Green at Phase 7 close: typecheck, lint, test, build, bench, format:check, docs:build, www:build |
| Root `package.json`           | `private: true`, version `0.0.0` — not publishable, no change    |

## 2. Git readiness report

- **Git is NOT initialized** (`.git` absent). Confirmed.
- Consequences today: `pnpm changeset status` fails; `changesets/action`
  `fetch-depth: 0` has no history to resolve; per-package `CHANGELOG.md`
  generation and the v1.0 roll-up changelog are impossible; release simulation
  and `npm publish --dry-run` diffs have no baseline.
- `.gitignore` is present and adequate: ignores `node_modules/`, `dist/`,
  `coverage/`, `storybook-static/`, `*.tsbuildinfo`, env files. `pnpm-lock.yaml`
  is not ignored (correct — it must be committed).
- Global git identity exists (`wbdao` / `abdulla15982@gmail.com`); repo-local
  identity will be set to the project convention during execution.

**Action:** `git init -b main`, baseline commit of the current verified tree,
then a second commit carrying the 8.1 alignment (below) once gates re-pass.

## 3. Changesets audit report

- `.changeset/config.json`: `access: public`, `baseBranch: main`,
  `updateInternalDependencies: patch`, `commit: false`, **`fixed: []`** (empty),
  `linked: []`, `ignore` lists the 5 private apps. Correct except the missing
  `fixed` group.
- Pending (never-consumed) changesets — 3 files:

  | File | Bumps |
  | ---- | ----- |
  | `phase5-ecosystem-release.md` | core, react, vue, angular → **minor** |
  | `phase6-plugin-marketplace.md` | core, web → **minor** |
  | `phase7-beta-release.md` | 7 foundation packages → **minor**; core → **patch** |

- If consumed by `changeset version` today they would emit `0.2.0`-family
  versions from the `0.1.0` base — **not** `0.9.0-beta`. Changesets cannot
  produce a `0.9.x` jump from `0.1.x`. The milestone label must therefore be a
  deliberate, reviewed alignment (standard monorepo "milestone cut").
- No `CHANGELOG.md` files exist; the 3 summaries would otherwise be lost.

## 4. Package version inventory & drift

| Package                 | Current     | Target      | Peer `@smart-table/core` |
| ----------------------- | ----------- | ----------- | ------------------------ |
| `@smart-table/core`     | `0.1.0`     | `0.9.0-beta`| —                        |
| `@smart-table/react`    | `0.1.0`     | `0.9.0-beta`| `>=0.1.0`                |
| `@smart-table/vue`      | `0.1.0`     | `0.9.0-beta`| `>=0.1.0`                |
| `@smart-table/angular`  | `0.1.0`     | `0.9.0-beta`| `>=0.1.0`                |
| `@smart-table/web`      | `0.1.0`     | `0.9.0-beta`| `>=0.1.0`                |
| `@smart-table/ag-compat`| `0.1.0-beta`| `0.9.0-beta`| `>=0.1.0`                |
| `@smart-table/tanstack` | `0.1.0-beta`| `0.9.0-beta`| `>=0.1.0`                |
| `@smart-table/telemetry`| `0.1.0-beta`| `0.9.0-beta`| `>=0.1.0`                |
| `@smart-table/devtools` | `0.1.0-beta`| `0.9.0-beta`| `>=0.1.0`                |
| `@smart-table/collaboration` | `0.1.0-beta` | `0.9.0-beta` | `>=0.1.0`            |
| `@smart-table/charts`   | `0.1.0-beta`| `0.9.0-beta`| `>=0.1.0`                |
| `@smart-table/security` | `0.1.0-beta`| `0.9.0-beta`| `>=0.1.0`                |

**Drift:** three distinct version families (`0.1.0`, `0.1.0-beta`, `0.0.0`
root/private apps). All 12 publishable packages must converge on `0.9.0-beta`
so the beta cut, dist-tag, and later `1.0.0` cut move as one unit.

Internal deps are safe: cross-package `devDependencies` use `workspace:*`
(rewritten by changesets at publish); only the `peerDependencies` ranges need
an intent update.

## 5. Recommended fixed-group configuration

Add to `.changeset/config.json`:

```json
"fixed": [
  [
    "@smart-table/core",
    "@smart-table/react",
    "@smart-table/vue",
    "@smart-table/angular",
    "@smart-table/web",
    "@smart-table/ag-compat",
    "@smart-table/tanstack",
    "@smart-table/telemetry",
    "@smart-table/devtools",
    "@smart-table/collaboration",
    "@smart-table/charts",
    "@smart-table/security"
  ]
]
```

Effects: any future changeset bump moves **all 12 packages to the same version**
(drift becomes impossible); ignored private apps stay excluded. This is the
mechanism that guarantees the `v1.0.0` cut (8.10) is uniform.

**Prerelease mode (recommended).** Immediately after alignment run
`pnpm changeset pre enter beta` (creates `.changeset/pre.json`). Subsequent
beta snapshots then version as `0.9.0-beta.0`, `0.9.0-beta.1`, … instead of
jumping numerically, and `changeset pre exit` before the v1.0.0 cut keeps the
path to `1.0.0` clean. Milestone labels (`0.9.0-beta`, `1.0.0`) remain explicit
cut points set at release time; changesets governs the increments between them.

## 6. Required configuration changes (exact files)

| # | File | Change |
| - | ---- | ------ |
| 1 | `.changeset/config.json` | Add the `fixed` group from §5 |
| 2 | `packages/{core,react,vue,angular,web,ag-compat,tanstack,telemetry,devtools,collaboration,charts,security}/package.json` (12 files) | `version` → `0.9.0-beta` |
| 3 | Same 11 files (all except `core`) | `peerDependencies["@smart-table/core"]` → `>=0.9.0-beta` |
| 4 | `pnpm-lock.yaml` | Regenerate via `pnpm install`; commit |
| 5 | `packages/*/CHANGELOG.md` (12 new files) | `0.9.0-beta` entry, folded **verbatim** from the 3 phase summaries |
| 6 | `.changeset/phase5-ecosystem-release.md`, `phase6-plugin-marketplace.md`, `phase7-beta-release.md` | Delete after folding (§7) |
| 7 | `.changeset/pre.json` | Created by `changeset pre enter beta` |
| 8 | `docs/RELEASING.md` | Remove the "Missing git history" blocker; document git init + fixed group + prerelease mode |
| 9 | `docs/PHASE_8_1_PLAN.md` (this file) + `ROADMAP.md` | Record the cut; ROADMAP: note 8.1 delivered (Phase 8 table) |

No `src/` changes → **no public API modification** (verifiable via
`git diff` on the alignment commit).

## 7. Execution sequence

1. `git init -b main`; verify `git status --porcelain` shows only expected files
   (no `node_modules/`, `dist/`, `coverage/`).
2. Baseline commit: current verified Phase 7 tree.
3. Apply §6 edits: versions, peer ranges, changesets `fixed`, pre-mode.
4. `pnpm install` → regenerate `pnpm-lock.yaml`.
5. Write the 12 `CHANGELOG.md` entries; delete the 3 stale changesets.
6. Full gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`,
   `pnpm bench`, `pnpm format:check`, `pnpm docs:build`, `pnpm www:build`.
7. `pnpm changeset status` → clean (validates git + config).
8. `pnpm install --frozen-lockfile` → resolves (validates lockfile sync).
9. Commit alignment; leave tree clean. Do **not** publish (8.4/8.10).

## 8. Risks & mitigations

| Risk | Likelihood | Mitigation |
| ---- | ---------- | ---------- |
| Manual alignment diverges from changesets math (can't reach `0.9.0-beta` from `0.1.0`) | Certain | Milestone labels are explicit cut points; pre-mode + fixed group govern increments between cuts |
| Wrong pre-release suffix (`0.9.0-beta.0` vs `beta-0`) | Medium | Pre-mode uses `-beta.N`; dist-tag is `beta` either way; documented in `docs/RELEASING.md` |
| Lockfile/version mismatch breaks `--frozen-lockfile` | Low | Regenerate lockfile in step 4; verify in step 8 |
| Unwanted files staged on first commit | Low | `.gitignore` already covers; verify with `git status --porcelain` |
| Losing Phase 5/6/7 release history | Low | Summaries folded verbatim into `CHANGELOG.md`; full narrative stays in `docs/PHASE_{5,6,7}.md` |
| `fixed` group accidentally includes ignored/private packages | Low | Group lists exactly the 12 publishable packages; apps stay in `ignore` |
| New contributors confused by `0.9.0-beta` | Low | `ROADMAP.md`/`SUPPORTED_VERSIONS.md` already frame the beta milestone; alignment documented in `docs/RELEASING.md` |

## 9. Definition of Done — Phase 8.1

- [ ] Git repo initialized on `main`; baseline + alignment commits exist; tree clean
- [ ] All 12 publishable packages at `0.9.0-beta` (no other `@smart-table/*` version remains)
- [ ] `.changeset/config.json` contains the 12-package `fixed` group
- [ ] Cross-package `peerDependencies["@smart-table/core"]` aligned to `>=0.9.0-beta`
- [ ] `pnpm-lock.yaml` regenerated; `pnpm install --frozen-lockfile` resolves
- [ ] `CHANGELOG.md` created for all 12 packages with folded Phase 5/6/7 entries
- [ ] 3 stale changesets deleted; `.changeset/pre.json` active in `beta` pre-mode
- [ ] `pnpm changeset status` clean against git history
- [ ] All gates green: typecheck · lint · test · build · bench · format:check · docs:build · www:build
- [ ] Zero `src/` changes — public API untouched
- [ ] `docs/RELEASING.md` reflects git init, fixed group, prerelease mode
- [ ] Path to `v1.0.0` documented (pre-exit + alignment cut at 8.10)

## 10. Path to v1.0.0 (kept clean by this milestone)

- During 8.x: every change adds a changeset; `changeset version` emits uniform
  `0.9.0-beta.N` for all 12 packages (fixed group + pre-mode).
- 8.10: `pnpm changeset pre exit`, run the full gate set, then cut `v1.0.0` as
  the explicit final alignment (same pattern as this milestone), publish with
  provenance, dist-tag `latest`.

## 11. Out of scope for 8.1

- Publishing, tagging, or `npm publish` (8.4 dry-run, 8.10 real release).
- API classification / freeze decisions (8.2).
- CI gate hardening, coverage, a11y, security, docs/migration content (8.3–8.9).
