# Framework integrations

The adapters wrap `@smart-table/core` and expose the same behaviour as declarative components. They are SSR-safe: nothing touches the DOM during render, the table is created and mounted in a lifecycle hook, and destroyed on unmount.

## React

Package: [`@smart-table/react`](https://www.npmjs.com)

```tsx
import { useState } from 'react';
import { SmartTable, useSmartTable } from '@smart-table/react';

function App() {
  const [rows, setRows] = useState(data);

  return (
    <SmartTable
      columns={columns}
      data={rows}
      onChange={(t) => setRows(t.getData())} // controlled mode
      theme="dark"
      pageSize={20}
      virtualScroll
      onReady={(t) => console.log(t.getRowCount())}
    />
  );
}
```

Props are the core `SmartTableOptions` plus:

| Prop               | Type                            | Purpose                                           |
| ------------------ | ------------------------------- | ------------------------------------------------- |
| `columns` / `data` | `Column[]` / `DataRow[]`        | Required data inputs.                             |
| `onReady`          | `(table) => void`               | Imperative access after mount.                    |
| `onChange`         | `(table) => void`               | Fires on data-affecting events (controlled mode). |
| `eventHandlers`    | `Partial<{ [K]: (p) => void }>` | Subscribe to specific core events.                |

### The `useSmartTable()` hook

```tsx
function App() {
  const { table, containerRef, setData } = useSmartTable({ columns, data });
  return <div ref={containerRef} />;
}
```

## Vue

Package: [`@smart-table/vue`](https://www.npmjs.com)

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SmartTable, useSmartTable } from '@smart-table/vue';

const data = ref(initialRows);
function onReady(t: unknown) {
  /* t.getRowCount() */
}
</script>

<template>
  <SmartTable
    :columns="columns"
    :data="data"
    :page-size="20"
    virtual-scroll
    @update:data="data = $event"
    @ready="onReady"
    @sort-changed="onSort"
  />
</template>
```

All core options are props (`kebab-case` in templates). Events map one-to-one: `@sort-changed`, `@cell-edit`, `@page-changed`, …. `@update:data` gives you `v-model:data` controlled mode.

### The `useSmartTable()` composable

```vue
<script setup lang="ts">
const { table, host, setData } = useSmartTable({ columns, data: rows });
</script>
<template><div ref="host" /></template>
```

## Angular

Package: [`@smart-table/angular`](https://www.npmjs.com)

```ts
import { Component } from '@angular/core';
import { SmartTableComponent } from '@smart-table/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SmartTableComponent],
  template: `
    <smart-table
      [columns]="columns"
      [data]="rows"
      [pageSize]="20"
      (ready)="onReady($event)"
      (dataChange)="rows = $event"
      (sortChanged)="onSort($event)"
    />
  `,
})
export class AppComponent {}
```

Inputs mirror the core options (`[pageSize]`, `[theme]`, `[virtualScroll]`, `[dataSource]`, …). Outputs mirror the core events (`sortChanged`, `cellEdit`, `pageChanged`, …) plus `ready` and `dataChange` for controlled mode.

The adapter delegates to a framework-agnostic `SmartTableController`, making it usable outside Angular templates too.
