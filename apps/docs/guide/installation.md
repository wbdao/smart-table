# Installation

## Package layout

| Package                                         | Description                                       |
| ----------------------------------------------- | ------------------------------------------------- |
| [`@smart-table/core`](https://www.npmjs.com)    | The headless engine + vanilla DOM renderer.       |
| [`@smart-table/react`](https://www.npmjs.com)   | React 18+ component and `useSmartTable()` hook.   |
| [`@smart-table/vue`](https://www.npmjs.com)     | Vue 3 component and `useSmartTable()` composable. |
| [`@smart-table/angular`](https://www.npmjs.com) | Standalone Angular 17+ component.                 |

Requirements: **Node ≥ 18**. All packages ship ESM + CJS and TypeScript declarations.

## Core

```bash
npm install @smart-table/core
```

Import the styles once (next to your global CSS):

```ts
import '@smart-table/core/styles.css';
```

## React

```bash
npm install @smart-table/react @smart-table/core
```

`react >= 18` is a peer dependency. Import the component styles via the core stylesheet.

## Vue

```bash
npm install @smart-table/vue @smart-table/core
```

`vue >= 3.3` is a peer dependency.

## Angular

```bash
npm install @smart-table/angular @smart-table/core
```

The `smart-table` element is a **standalone** component — no `NgModule` required. Add `SmartTableComponent` to your standalone component's `imports` and the stylesheet to `angular.json`:

```json
{ "styles": ["node_modules/@smart-table/core/dist/smart-table.css"] }
```

## From source (monorepo)

```bash
pnpm install
pnpm --filter @smart-table/core build
```

All packages live in a single pnpm workspaces monorepo; keep only the packages you need by filtering.

> [!NOTE]
> The adapters are intentionally thin. If your framework is missing, drive `@smart-table/core` directly — the event bus, methods and `mount()` are all you need.
