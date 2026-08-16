import { createApp, ref } from 'vue';
import { SmartTable } from '../src/index';
import type { Column, DataRow } from '@smart-table/core';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'category', title: 'Category', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
  { field: 'stock', title: 'Stock', type: 'number' },
];

const seed: DataRow[] = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  category: ['Electronics', 'Books', 'Clothing', 'Toys'][i % 4],
  price: Math.round((10 + Math.random() * 990) * 100) / 100,
  stock: Math.round(Math.random() * 500),
}));

const App = {
  components: { SmartTable },
  setup() {
    const data = ref<DataRow[]>(seed);
    const theme = ref<'light' | 'dark'>('light');
    const pageSize = ref(20);
    const onReady = (t: unknown): void => {
      (window as unknown as { st?: unknown }).st = t;
    };
    return { columns, data, theme, pageSize, onReady };
  },
  template: `
    <div style="padding:24px;font-family:system-ui,sans-serif">
      <h1>@smart-table/vue example</h1>
      <label style="margin-right:24px">Theme:
        <select v-model="theme">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label>Rows per page:
        <select v-model.number="pageSize">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </label>
      <SmartTable
        :columns="columns"
        :data="data"
        :theme="theme"
        :page-size="pageSize"
        virtual-scroll
        responsive
        editable
        @ready="onReady"
        @update:data="(d) => (data = d)"
      />
    </div>`,
};

createApp(App).mount('#app');
