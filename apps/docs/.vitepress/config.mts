import { defineConfig } from 'vitepress';

const version = '0.1.0';

export default defineConfig({
  lang: 'en-US',
  title: 'SmartTableJS',
  description:
    'A fast, headless, extensible data-grid for the web — with React, Vue and Angular bindings.',
  head: [
    ['meta', { name: 'theme-color', content: '#4f46e5' }],
    ['link', { rel: 'icon', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'API', link: '/api/options', activeMatch: '/api/' },
      { text: `v${version}`, link: 'https://github.com/smart-table-js/smart-table' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Features', link: '/guide/features' },
            { text: 'Plugin marketplace', link: '/guide/plugins-marketplace' },
            { text: 'Framework integrations', link: '/guide/integrations/react' },
            { text: 'FAQ', link: '/guide/faq' },
          ],
        },
        {
          text: 'Integrations',
          collapsed: true,
          items: [
            { text: 'React', link: '/guide/integrations/react' },
            { text: 'Vue', link: '/guide/integrations/vue' },
            { text: 'Angular', link: '/guide/integrations/angular' },
            { text: 'Web Components', link: '/guide/integrations/web-components' },
            { text: 'AG Grid migration', link: '/guide/integrations/ag-grid' },
            { text: 'TanStack Query & Router', link: '/guide/integrations/tanstack' },
          ],
        },
        {
          text: 'Tooling',
          collapsed: true,
          items: [
            { text: 'DevTools overlay', link: '/guide/tooling/devtools' },
            { text: 'Telemetry', link: '/guide/tooling/telemetry' },
          ],
        },
        {
          text: 'Foundations',
          collapsed: true,
          items: [
            { text: 'Collaboration', link: '/guide/extensions/collaboration' },
            { text: 'Charts', link: '/guide/extensions/charts' },
            { text: 'Security', link: '/guide/extensions/security' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Options', link: '/api/options' },
            { text: 'Events', link: '/api/events' },
            { text: 'Methods', link: '/api/methods' },
            { text: 'Versioning & stability', link: '/api/stability' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Search docs', buttonAriaLabel: 'Search docs' },
        },
      },
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/smart-table-js/smart-table' }],
    footer: {
      message: 'Released under the MIT License.',
      copyright: `Copyright © 2026 SmartTableJS`,
    },
  },

  vite: {
    resolve: {
      alias: {
        '@smart-table/core': new URL('../../packages/core/src/index.ts', import.meta.url).pathname,
      },
    },
  },
});
