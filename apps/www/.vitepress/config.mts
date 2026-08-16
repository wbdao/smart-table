import { defineConfig } from 'vitepress';

// Replace with the canonical production URLs before going live.
const SITE_URL = 'https://smart-table.dev/';
const DOCS_URL = 'https://smart-table.dev/docs/';
const GITHUB_URL = 'https://github.com/smart-table-js/smart-table';
const DESCRIPTION =
  'The open-source, framework-agnostic data grid for the web — fast virtual scrolling, server data, grouping, pivot, tree and a plugin marketplace. Works with Vanilla JS, React, Vue, Angular and Web Components.';

export default defineConfig({
  lang: 'en-US',
  title: 'SmartTableJS',
  titleTemplate: '%s · SmartTableJS',
  description: DESCRIPTION,
  appearance: true, // dark mode toggle
  cleanUrls: true,
  lastUpdated: false,
  head: [
    ['link', { rel: 'icon', href: '/logo.svg' }],
    ['link', { rel: 'canonical', href: SITE_URL }],
    ['meta', { name: 'theme-color', content: '#4f46e5' }],

    // Open Graph
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'SmartTableJS' }],
    ['meta', { property: 'og:title', content: 'SmartTableJS' }],
    ['meta', { property: 'og:description', content: DESCRIPTION }],
    ['meta', { property: 'og:url', content: SITE_URL }],
    ['meta', { property: 'og:image', content: SITE_URL + 'logo.svg' }],

    // Twitter
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'SmartTableJS' }],
    ['meta', { name: 'twitter:description', content: DESCRIPTION }],
    ['meta', { name: 'twitter:image', content: SITE_URL + 'logo.svg' }],

    // Structured data (JSON-LD)
    [
      'script',
      { type: 'application/ld+json' },
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SmartTableJS',
        description: DESCRIPTION,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        url: SITE_URL,
        license: 'https://opensource.org/licenses/MIT',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        sameAs: [GITHUB_URL],
      }),
    ],
  ],

  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Features', link: '/features' },
      { text: 'Performance', link: '/performance' },
      { text: 'Frameworks', link: '/frameworks' },
      { text: 'Pricing', link: '/pricing' },
      { text: 'Roadmap', link: '/roadmap' },
      { text: 'Community', link: '/community' },
      { text: 'Blog', link: '/blog' },
      { text: 'Docs', link: DOCS_URL },
      { text: 'GitHub', link: GITHUB_URL },
    ],
    socialLinks: [{ icon: 'github', link: GITHUB_URL }],
    footer: {
      message: 'Open source · MIT licensed.',
      copyright: `Copyright © 2026 SmartTableJS`,
    },
    search: { provider: 'local' },
  },

  vite: {
    resolve: {
      alias: {
        '@smart-table/core': new URL('../../packages/core/src/index.ts', import.meta.url).pathname,
      },
    },
  },
});
