// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Canonical origin. On Vercel this is filled in automatically for the production
 * deployment; locally (and until a custom domain is attached) it falls back to the
 * placeholder below. It only affects canonical URLs, Open Graph tags and the sitemap,
 * so a wrong value here never breaks the site itself.
 *
 * When the real domain is ready, replace the fallback string.
 */
const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'https://homeswithoutdivisions.hk';

export default defineConfig({
  site,
  trailingSlash: 'never',
  build: {
    // /zh/about/index.html, served by Vercel at /zh/about
    format: 'directory',
  },
  // Language routing is handled explicitly by the [lang] dynamic routes in
  // src/pages, rather than by Astro's i18n middleware. Two languages, two mirrored
  // trees, no hidden redirects — see src/lib/i18n.ts.
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'zh',
        locales: {
          zh: 'zh-Hant-HK',
          en: 'en-GB',
        },
      },
    }),
  ],
});
