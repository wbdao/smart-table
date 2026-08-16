import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/html-vite',
    options: {},
  },
  async viteFinal(config) {
    const { resolve } = await import('node:path');
    config.resolve ??= {};
    config.resolve.alias = [
      {
        find: '@smart-table/core/styles.css',
        replacement: resolve(__dirname, '../../../packages/core/src/styles/smart-table.css'),
      },
      {
        find: '@smart-table/core',
        replacement: resolve(__dirname, '../../../packages/core/src/index.ts'),
      },
      ...(Array.isArray(config.resolve.alias)
        ? config.resolve.alias
        : Object.entries(config.resolve.alias ?? {})),
    ];
    return config;
  },
};

export default config;
