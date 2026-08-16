# Framework support

One core, many wrappers. Every binding maps the same options, events and
semantics — no per-framework feature drift.

## Vanilla JS / TypeScript

```ts
import { SmartTable } from '@smart-table/core';
import '@smart-table/core/styles.css';

const table = new SmartTable({
  container: '#app',
  columns,
  data,
});
```

## React 18+

```tsx
import { SmartTable } from '@smart-table/react';

<SmartTable columns={columns} data={rows} onSortChanged={...} />;
```

## Vue 3

```vue
<script setup>
import { ref } from 'vue';
import { SmartTable } from '@smart-table/vue';

const rows = ref(data);
</script>

<template>
  <SmartTable v-model:data="rows" :columns="columns" />
</template>
```

## Angular 17+ (standalone)

```ts
import { SmartTableComponent } from '@smart-table/angular';

<smart-table [columns]="columns" [data]="rows" (sortChanged)="..."></smart-table>;
```

## Web Components (any framework)

```html
<smart-table id="orders" theme="dark" page-size="25" editable></smart-table>

<script type="module">
  import '@smart-table/web';
  const el = document.querySelector('#orders');
  el.columns = [...];
  el.data = [...];
</script>
```

## Ecosystem integrations (Phase 7)

| Ecosystem | Package                  | Purpose                                         |
| --------- | ------------------------ | ----------------------------------------------- |
| AG Grid   | `@smart-table/ag-compat` | migrate columnDefs/rowData with a mapping layer |
| TanStack  | `@smart-table/tanstack`  | Query data sources + Router state sync          |
| Telemetry | `@smart-table/telemetry` | metrics, enable/disable                         |
| DevTools  | `@smart-table/devtools`  | debug overlay                                   |

Migration guides: [AG Grid → SmartTableJS](https://smart-table.dev/docs/guide/integrations/ag-grid).
