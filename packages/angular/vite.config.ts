import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      entryRoot: 'src',
      include: ['src/**/*.ts'],
      beforeWriteFile: (filePath, content) => ({
        filePath,
        content: content.replace(/(\.\.\/)+core\/src\/index\.ts/g, '@smart-table/core'),
      }),
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'SmartTableAngular',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: ['@angular/core', '@smart-table/core'],
    },
  },
});
