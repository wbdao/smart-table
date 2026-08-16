# Contributing to SmartTableJS

Thanks for building the data-grid with us. Read the [code of
conduct](CODE_OF_CONDUCT.md) first — everyone is expected to follow it.

## Prerequisites

- Node.js 18+
- pnpm 11+ (`corepack enable` recommended)

## Getting started

```bash
pnpm install          # install the whole monorepo
pnpm typecheck        # all packages
pnpm lint             # ESLint (root config)
pnpm test             # all unit/component tests
pnpm build            # builds every package and app
pnpm bench            # core benchmark suite
pnpm format           # prettier --write .
```

## Workspace layout

```
packages/core        # headless engine + DOM renderer + styles
packages/react|vue|angular|web   # framework adapters + web component
packages/telemetry   # observability (Phase 7)
packages/devtools    # debug overlay (Phase 7)
packages/ag-compat   # AG Grid migration layer (Phase 7)
packages/tanstack    # TanStack Query/Router utilities (Phase 7)
packages/collaboration|charts|security   # foundation abstractions (Phase 7)
apps/docs            # VitePress documentation
apps/www             # public marketing website
apps/playground      # interactive demo
apps/storybook       # component stories
apps/performance     # comparative performance lab
```

## Development workflow

1. Branch from `main`: `git checkout -b feat/my-change`.
2. Make focused changes. Keep scope small — **extend, never rewrite** stable
   APIs (see `API_STABILITY.md` once published).
3. Add or update tests. New foundation packages target ≥ 90% coverage.
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` for what you touched:
   `pnpm --filter @smart-table/core test`.
5. Add a changeset for every user-visible change:
   `pnpm changeset`.
6. Push and open a PR with the template filled in.

## Conventions

- TypeScript strict everywhere (`tsconfig.base.json`).
- Naming: camelCase functions/values, PascalCase classes, `kebab-case` for
  custom-element attributes/events and CSS classes.
- Public APIs: use the `SmartTablePlugin` contract for extensions; never import
  from `@smart-table/core` internals outside the core package. Each package
  re-exports only what consumers and plugins may use.
- DOM code goes through `ui/` primitives; engines stay headless (no `DOM`
  references) so they work in SSR/jsdom.
- Events follow the `camelCase` core names and kebab-case custom-element names
  (`sortChanged` → `sort-changed`).

## Commits & changesets

- Prefer [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- A changeset is required when a package's public behavior changes. Changesets
  drive the automated release pipeline (`.github/workflows/release.yml`).

## Tests & benchmarks

- Unit tests run under Vitest (node env by default; add
  `/** @vitest-environment jsdom */` for DOM tests).
- Benchmark changes are checked with `pnpm bench`; avoid regressing the
  published numbers in `PERFORMANCE_REPORT.md`.

## Docs

- Guides: `apps/docs/guide/**` (VitePress). New pages go into the sidebar in
  `apps/docs/.vitepress/config.mts`.
- Phase tracking: `docs/PHASE_*.md`, `ROADMAP.md`.

## Issue & discussion etiquette

- Use the issue templates (bug / feature / question). Link a reproduction for
  bugs.
- Questions and proposals belong in GitHub Discussions — see
  `docs/COMMUNITY.md` for category guidelines.
- Check `SUPPORTED_VERSIONS.md` before reporting: bugs on EOL versions are
  not fixed.

## Code review

Maintainers review for: correctness, test coverage, API stability, bundle
size, performance, accessibility and documentation. Two approving reviews are
required for release-relevant changes.
