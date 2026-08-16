# Changesets

Versioning and release automation for the publishable packages in this monorepo.

## How to create a changeset

```bash
pnpm changeset
```

Select the packages that changed, the bump type (patch / minor / major) and a
summary. A new markdown file lands in `.changeset/` and is consumed by the
release workflow.

## How releases happen

- A `changesets` CI bot opens/updates a "Version Packages" PR when changesets
  are present on `main`.
- Merging that PR runs the `.github/workflows/release.yml` workflow, which:
  1. builds and runs the gates,
  2. bumps versions + writes CHANGELOG entries,
  3. publishes `@smart-table/core`, `@smart-table/react`, `@smart-table/vue`
     and `@smart-table/angular` to npm,
  4. creates a GitHub release with the changelog.

Private packages (`@smart-table/docs`, playground, storybook, performance) are
explicitly ignored and never published.

## Publishing

`pnpm publish` requires an `NPM_TOKEN` with `publish` scope in the repository
secrets (used by the release workflow).
