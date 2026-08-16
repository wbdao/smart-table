---
layout: home
hero:
  name: SmartTableJS
  text: The data grid for the modern web
  tagline: A fast, headless, extensible grid in vanilla TypeScript with React, Vue, Angular and Web Components bindings, a plugin marketplace, and 100k-row virtual scrolling.
  actions:
    - theme: brand
      text: Try the playground
      link: https://smart-table.dev/playground/
    - theme: alt
      text: Read the docs
      link: https://smart-table.dev/docs/
    - theme: alt
      text: View on GitHub
      link: https://github.com/smart-table-js/smart-table
  image:
    src: /logo.svg
    alt: SmartTableJS
features:
  - icon: ⚡
    title: 100k+ rows, virtual scrolling
    details: Windowed rendering keeps jank off the main thread — construct, sort, filter and paginate 100k rows in milliseconds.
  - icon: 🧩
    title: Framework-agnostic
    details: One headless core. First-class React, Vue, Angular and Web Components bindings with zero renderer leakage.
  - icon: 🧰
    title: Plugin marketplace
    details: table.use() first-party plugins — event log, summary footers and a registrable catalog for your own extensions.
  - icon: 🌳
    title: Enterprise data engine
    details: Server data sources, infinite scroll, grouping, aggregations, tree data and a headless pivot engine built in.
  - icon: 🎨
    title: Themes & responsive
    details: Light, dark and corporate themes with card view on small screens. Accessible, keyboard-first by design.
  - icon: 🚀
    title: Production story
    details: Type-safe, tree-shakeable ESM+CJS with types, CI, benchmarks, changelogs and an automated changesets release pipeline.
---

## Why SmartTableJS?

Most grids make you choose: performance, framework bindings, or flexibility.
SmartTableJS refuses to trade. The core is a pure TypeScript engine — usable in
any runtime, testable in Node — while rendered adapters plug into your favorite
framework without leaking internals into your components.

- **Headless core** — data, filtering, sorting, grouping, aggregation, pivot,
  tree and virtualization live in `@smart-table/core`, independent of the DOM.
- **Plugin architecture** — extend behavior through `table.use()` and the
  marketplace registry instead of forking internals.
- **Accessible by default** — semantic grid markup, ARIA roles, keyboard
  navigation and focus management built into the renderer.
- **Enterprise-ready** — secure by design, observable telemetry, and migration
  adapters that smooth the move from the incumbent grids.

Start with the [getting started guide](https://smart-table.dev/docs/guide/getting-started).
