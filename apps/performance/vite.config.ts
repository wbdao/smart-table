import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@smart-table/core/styles.css',
        replacement: resolve(__dirname, '../../packages/core/src/styles/smart-table.css'),
      },
      {
        find: '@smart-table/core',
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    ],
  },
  base: './',
  optimizeDeps: {
    include: ['ag-grid-community', 'tabulator-tables', 'gridjs'],
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
