# Performance

Performance is a feature. The core pipeline is built to stay out of your way at
scale.

## Benchmark targets

| Rows    | Operate on | Notes                           |
| ------- | ---------- | ------------------------------- |
| 1,000   | data       | interactive, no perceptible lag |
| 10,000  | data       | typical enterprise screens      |
| 50,000  | data       | heavy admin tables              |
| 100,000 | data       | virtual scrolling required      |

Our automated Vitest bench suite (`pnpm bench`) measures construction, full-view
reads, filtering, sorting, pagination, aggregation, grouping and pivot on 100k
rows. A certified report is published in [`PERFORMANCE_REPORT.md`](https://github.com/smart-table-js/smart-table/blob/main/docs/PHASE_7.md)

## How it stays fast

- **Virtualization** — only visible rows are painted; the `RowPool` recycles
  nodes instead of re-creating them.
- **Headless engine** — data operations run without DOM work and are
  framework-neutral, so adapters carry almost no overhead.
- **Immutable view model** — filtered/sorted/paginated views are derived and
  cached, with change-only re-renders.
- **Typed operators** — comparisons avoid coercion overhead in hot loops.

## Compare it yourself

The monorepo ships a comparative performance lab (`apps/performance`) that runs
the same dataset through **SmartTableJS, AG Grid, Tabulator and Grid.js** and
reports mount / sort / filter medians. Run it locally:

```bash
pnpm performance:dev
```

> Benchmarks are environmental — run each engine on the same hardware and
> browser for fair comparisons.
