import { useState } from 'react';
import { createRoot } from 'react-dom/client';
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

function App() {
  const [data, setData] = useState<DataRow[]>(seed);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [pageSize, setPageSize] = useState(20);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>@smart-table/react example</h1>
      <label style={{ marginRight: 24 }}>
        Theme:{' '}
        <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label>
        Rows per page:{' '}
        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </label>
      <SmartTable
        columns={columns}
        data={data}
        theme={theme}
        pageSize={pageSize}
        virtualScroll
        responsive
        editable
        onChange={(t) => setData(t.getData())}
        onReady={(t) => {
          (window as unknown as { st?: unknown }).st = t;
        }}
      />
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
