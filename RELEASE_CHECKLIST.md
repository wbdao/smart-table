# Release checklist

Used for every `v0.9.0-beta` snapshot and the `v1.0.0` release. See
[`docs/RELEASING.md`](docs/RELEASING.md) for the tagging strategy and
[`SUPPORTED_VERSIONS.md`](SUPPORTED_VERSIONS.md) for the support matrix.

## 1. Quality gates (all must pass)

- [ ] `pnpm install` — lockfile resolves, no missing workspace links
- [ ] `pnpm typecheck` — strict `tsc --noEmit` across the workspace
- [ ] `pnpm lint` — ESLint clean
- [ ] `pnpm test` — every package's Vitest suite green
- [ ] `pnpm build` — ESM + CJS + `.d.ts` for all publishable packages
- [ ] `pnpm bench` — `@smart-table/core` 100k-row benchmark green
- [ ] `pnpm format:check` — Prettier clean (offending files run `format`)

## 2. Release artifacts

- [ ] `.changeset/*` entry written for every behavior change (or
      `changeset` run with scope selection)
- [ ] Version bumps applied and inter-package `peerDependencies` coherent
- [ ] Package files verified: `files: ["dist"]`, export maps intact
- [ ] `changeset status` clean (requires git history)
- [ ] Dist tags chosen: `v0.9.0-beta.*` → `beta`, `v1.x` → `latest`
- [ ] `npm publish --tag <tag>` for each package in workspace order
      (core and adapters first; assistant packages after)

## 3. Docs & website

- [ ] `apps/docs` covers every changed/added public API
- [ ] `apps/www` feature pages match the release notes
- [ ] `API_STABILITY.md` classification updated to match shipped surface
- [ ] ROADMAP status block marked complete for the released phase

## 4. Post-release verification

- [ ] Fresh-project smoke test: `npm i @smart-table/core` + basic table render
- [ ] Adapter smoke tests: React / Vue / Angular / Web Components install+render
- [ ] Assistant packages: `ag-compat` migration example, `tanstack` routing demo,
      `telemetry` + `devtools` in a dev page
- [ ] `beta`/`latest` dist-tag check on each published package

## 5. v1.0 milestone-specific

- [ ] Every **Experimental** area targeted for 1.0 re-classified **Stable**
- [ ] `PERFORMANCE_REPORT.md` targets re-confirmed on a reference machine
- [ ] Deprecation window completed for anything removed (none active today)
- [ ] `v1.0.0` changelog written from the roll-up of all phase changesets
