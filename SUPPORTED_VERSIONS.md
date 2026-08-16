# Supported Versions

Support policy for every package in the SmartTableJS monorepo.

## Release cadence

- Pre-1.0 (`0.x`): bug and security fixes ship in the latest `0.x` release.
  Minor versions may carry breaking changes — read the changelog before
  upgrading (`CHANGELOG.md` per package via changesets).
- 1.x (planned): `latest` gets bug/security fixes; the previous minor gets
  security fixes only for 6 months; older lines are end-of-life.

## Packages

| Package                      | Status       | Min. supported | Notes                      |
| ---------------------------- | ------------ | -------------- | -------------------------- |
| `@smart-table/core`          | active       | latest `0.x`   | headless engine + renderer |
| `@smart-table/react`         | active       | latest `0.x`   | React 18+ peer             |
| `@smart-table/vue`           | active       | latest `0.x`   | Vue 3 peer                 |
| `@smart-table/angular`       | active       | latest `0.x`   | Angular 17+ peer           |
| `@smart-table/web`           | active       | latest `0.x`   | vanilla/Web Components     |
| `@smart-table/telemetry`     | beta         | latest `0.x`   | Phase 7                    |
| `@smart-table/devtools`      | beta         | latest `0.x`   | Phase 7                    |
| `@smart-table/ag-compat`     | beta         | latest `0.x`   | Phase 7                    |
| `@smart-table/tanstack`      | beta         | latest `0.x`   | Phase 7                    |
| `@smart-table/collaboration` | experimental | as released    | abstractions only          |
| `@smart-table/charts`        | experimental | as released    | abstractions only          |
| `@smart-table/security`      | experimental | as released    | abstractions only          |

> `experimental` packages make **no compatibility guarantees** until they
> reach `0.1.0` stable status.

## Environment matrix

| Runtime    | Supported                                                      |
| ---------- | -------------------------------------------------------------- |
| Node.js    | >= 18 (SSR, jsdom, tooling)                                    |
| Browsers   | Latest evergreen (Chrome, Firefox, Safari, Edge) + Firefox ESR |
| TypeScript | >= 5.0 (strict mode)                                           |

We do not support IE11.

## Security response targets

See [SECURITY.md](SECURITY.md). Security fixes are backported to the latest
release of each supported line.

## Reporting

Verify your version is supported before filing an issue. Bugs on
end-of-life versions are closed with a pointer to upgrade guidance.
