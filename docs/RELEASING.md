# Release strategy — v0.9.0-beta

How SmartTableJS versioned and published releases, including the move to the
public beta milestone.

## Versioning model

- **Packages** follow SemVer with prerelease suffixes:
  - current dev line: `0.x.x-alpha/beta` (e.g. `0.1.0-0`)
  - public beta milestone: **`v0.9.0-beta`**
  - v1.0.0: API freeze release.
- **Changesets** drive every version: contributors add a changeset, maintainers
  run `pnpm changeset version` (bumps + generates `CHANGELOG.md`), then
  `pnpm release` (`changeset publish`).
- Missing git history today blocks `changeset status` (red checkbox) — solve by
  initializing git properly before the first beta cut.

## Release channels & dist-tags

| Channel               | dist-tag | When                                           |
| --------------------- | -------- | ---------------------------------------------- |
| Pre-1.0 dev snapshots | `beta`   | `v0.x` prereleases from `main` on merge        |
| Public beta           | `beta`   | the `v0.9.0-beta` cut                          |
| Stable                | `latest` | scheduled after beta validation (v1.0.0 later) |

```bash
# after tagging v0.9.0-beta-0
pnpm release --tag beta
```

## v0.9.0-beta milestone gate

All of the following must pass to cut the beta:

- [ ] Phase 7.1 governance files merged (issues/PR templates, community docs).
- [ ] `apps/www` live with SEO + metadata.
- [ ] Compatibility + foundation packages published:
      `ag-compat`, `tanstack`, `telemetry`, `devtools`, `collaboration`,
      `charts`, `security`.
- [ ] `API_STABILITY.md` published (stable/experimental/internal).
- [ ] `PERFORMANCE_REPORT.md` published.
- [ ] `RELEASE_CHECKLIST.md` green for beta scope (security review, a11y spot
      audit, adapter verification).
- [ ] Full gates green: `pnpm typecheck && pnpm lint && pnpm test &&
pnpm build && pnpm bench`.

## Deprecation policy (pre-1.0)

- Public APIs may change between `0.x` minors **with** a deprecation note and
  a migration path in the changelog.
- `experimental` packages change freely — they are marked as such in
  `SUPPORTED_VERSIONS.md`.
- Anything marked `@internal` or `@deprecated` in `API_STABILITY.md` is not
  part of the stability contract.

## Backports & hotfixes

- Only the latest release line receives fixes.
- Hotfixes: PR to `main`, changeset with `patch` bump, cut an immediate
  release. No long-lived release branches before v1.0.

## Automation

`.github/workflows/release.yml` publishes on tag push from `main` using
`changesets/action`. Registry: npm. Access:

- `@smart-table/core|react|vue|angular|web` — `public`, stable surface.
- Phase 7 packages — `public`, marked beta/experimental in
  `SUPPORTED_VERSIONS.md`.

## Ownership

- Maintainers approve all version bumps.
- Changelogs are generated from changeset summaries (never hand-edited after
  release).
- Ping `@smart-table-js/maintainers` in the release PR for review.
