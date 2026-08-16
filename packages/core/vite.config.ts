import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

/**
 * Copies the standalone stylesheet into `dist` after the library build so
 * consumers can import it via `smart-table-js/styles.css`.
 */
function copyStyles(): Plugin {
  return {
    name: 'smart-table-copy-styles',
    apply: 'build',
    closeBundle() {
      const source = resolve(rootDir, 'src', 'styles', 'smart-table.css');
      const destination = resolve(rootDir, 'dist', 'smart-table.css');
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(source, destination);
    },
  };
}

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      entryRoot: 'src',
      include: ['src/**/*.ts'],
    }),
    copyStyles(),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'SmartTableJS',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    sourcemap: true,
    minify: false,
  },
});
