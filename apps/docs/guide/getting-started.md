# Getting started

SmartTableJS is a headless data-grid engine with official bindings for **React**, **Vue** and **Angular**. This guide gets you from zero to a working, sortable, editable table.

## The core idea

`@smart-table/core` is a plain TypeScript class — it owns **data**, **state** and **events**, and knows nothing about your UI. You mount a renderer into a DOM element to show it:

```ts
import { SmartTable } from '@smart-table/core';
import '@smart-table/core/styles.css';

const table = new SmartTable({
  columns: [
    { field: 'name', title: 'Name' },
    { field: 'price', title: 'Price', type: 'number' },
  ],
  data: [
    { id: 1, name: 'Laptop', price: 1200 },
    { id: 2, name: 'Mouse', price: 25 },
  ],
});

table.mount('#app');
```

That's it. Clicking a header sorts, the inline editor commits with validation, and every change is broadcast on the event bus.

## Using a framework binding

Prefer components? Each binding is a thin wrapper over the same core:

<div class="grid-3">

:::: code-group
::: code-group-item React

```tsx
import { SmartTable } from '@smart-table/react';

export function App() {
  return <SmartTable columns={columns} data={rows} onChange={(t) => setRows(t.getData())} />;
}
```

:::
::: code-group-item Vue

```vue
<script setup lang="ts">
import { SmartTable } from '@smart-table/vue';
</script>

<template>
  <SmartTable :columns="columns" :data="rows" @update:data="rows = $event" />
</template>
```

:::
::: code-group-item Angular

```ts
// @Component({ imports: [SmartTableComponent], ... })
// <smart-table [columns]="columns" [data]="rows" (dataChange)="rows = $event" />
import { SmartTableComponent } from '@smart-table/angular';
```

:::
::::

</div>

## Your first table

1. **Install** — see [Installation](/guide/installation).
2. **Define columns** — `field`, `title`, `type` (string | number | boolean | date).
3. **Pass data** — plain objects; ids are derived from `id` (or the first key column).
4. **Mount** — the DOM renderer takes care of the rest.

> [!TIP]
> Every built-in interaction is also available as a method: `table.sort()`, `table.filter()`, `table.groupBy()`, `table.pivot()`, `table.setTheme()`, and more — see the [API reference](/api/methods).

## Next steps

- Explore the [feature catalogue](/guide/features).
- Read the [API reference](/api/options).
- Check the [framework guides](/guide/integrations/react).
