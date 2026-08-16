# Versioning & API stability

The full stability contract lives in [`API_STABILITY.md`](https://github.com/smart-table-js/smart-table/blob/main/API_STABILITY.md). In short:

- **Stable** APIs are guaranteed for `v1.0` and only change with a major release after a deprecation window.
- **Experimental** APIs may be adjusted during the `0.x` cycle and are always announced in the release notes.
- **Internal** APIs are `@internal`-marked and not part of the contract.

The core dataset/query/pagination/selection surface is already **Stable**; the newer assistant packages (`ag-compat`, `tanstack`, `telemetry`, `devtools`, `collaboration`, `charts`, `security`) are **Experimental** for the `0.9.0-beta` release and are being hardened toward `v1.0`.

Deprecations follow the mechanical process in `API_STABILITY.md#deprecations` — marked in JSDoc, replacement provided, removed only in the next major.
