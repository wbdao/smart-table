# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Report privately via **GitHub Security Advisory**:
`https://github.com/smart-table-js/smart-table/security/advisories/new`
(or email `security@smart-table.dev` — placeholder, replace before launch).

Include:

- Package and version affected.
- Steps to reproduce (minimal snippet or repro repo).
- Impact and whether it is publicly known.

You will receive an acknowledgement within **48 hours**. We follow a 90-day
coordinated-disclosure window from confirmation to public fix and disclosure.

## What is in scope

- `@smart-table/*` packages and the `apps/*` and `packages/*` source in this
  monorepo.
- XSS / DOM-injection vectors via rendered cell content.
- Prototype pollution or remote-code-injection from plugin / adapter input.
- Supply-chain risk in the published registry artifacts.

## Out of scope

- Issues in third-party grid libraries we benchmark against (AG Grid,
  Tabulator, Grid.js) — report to their maintainers.
- Node/npm ecosystem vulnerabilities already covered by `pnpm audit` and fixed
  in the lockfile.

## Supported versions

Only the latest released version of each package receives security fixes.
Pre-1.0, fixes land in the current `0.x` line as patch releases. See
[SUPPORTED_VERSIONS.md](SUPPORTED_VERSIONS.md) for the matrix.

## Responsible disclosure

1. Report privately.
2. Maintainers triage, fix, and release a patched version.
3. After release, the advisory is disclosed publicly with attribution
   (unless the reporter requests anonymity).

Thank you for helping keep SmartTableJS — and its users — safe.
