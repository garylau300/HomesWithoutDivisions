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
  vite: {
    build: {
      /*
       * Keep client scripts in their own files rather than letting Astro inline
       * small ones into every page. Two reasons, in order of importance:
       *
       *   1. Inline scripts are what force `script-src 'unsafe-inline'`, which
       *      is the one directive worth not having. External files are covered
       *      by 'self', so the only inline scripts left are the two `is:inline`
       *      bootstraps, whose hashes are pinned in vercel.json.
       *   2. They then cache once and are shared across pages, instead of being
       *      re-sent inside the HTML of every page.
       *
       * Returning undefined for anything else keeps Vite's own default (inline
       * under 4 kB), so this only changes how scripts are emitted.
       */
      assetsInlineLimit: (filePath) => (filePath.endsWith('.js') ? false : undefined),
    },
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
