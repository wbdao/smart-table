# Vue

See the [framework integrations overview](/guide/integrations/react).

Package: [`@smart-table/vue`](https://www.npmjs.com)

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SmartTable } from '@smart-table/vue';
import { useSmartTable } from '@smart-table/vue';

const data = ref(initialRows);
</script>

<template>
  <SmartTable :columns="columns" :data="data" :page-size="20" @update:data="data = $event" />
</template>
```

Events map one-to-one onto core events (`@sort-changed`, `@cell-edit`, `@page-changed`, …). `@update:data` enables `v-model:data` controlled mode.

### Composable

```vue
<script setup lang="ts">
const { table, host, setData } = useSmartTable({ columns, data: rows });
</script>

<template>
  <div ref="host" />
</template>
```
