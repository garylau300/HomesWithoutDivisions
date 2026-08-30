/**
 * Rasterises public/favicon.svg into the PNG sizes that some platforms still
 * require (Apple touch icon, and a legacy 32px favicon).
 *
 * Run with `node scripts/render-icons.mjs` after changing favicon.svg.
 * Uses the Chromium that Playwright already provides, so there is no image
 * library dependency.
 *
 * The Apple touch icon is composited on Floral White because iOS puts it on a
 * home screen where a transparent background would fall back to black. That is
 * a background behind the mark, not a recolouring of it.
 */
import { launch } from './browser.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/favicon.svg'), 'utf8');

const targets = [
  { file: 'public/apple-touch-icon.png', size: 180, pad: 0.14, background: '#FFFBF5' },
  { file: 'public/favicon-32.png', size: 32, pad: 0, background: 'transparent' },
  { file: 'public/og-image.png', width: 1200, height: 630, pad: 0, background: '#FFFBF5', lockup: true },
  // A right-sized copy of the lockup for the site header: the 2640px master is
  // 285 KB, far more than a 64px-tall logo needs.
  { file: 'public/brand/hwd-lockup-660.png', width: 660, height: 128, pad: 0, background: 'transparent', lockup: true, lockupWidth: '100%' },
];

const browser = await launch();

for (const t of targets) {
  const width = t.width ?? t.size;
  const height = t.height ?? t.size;
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  const body = t.lockup
    ? `<img src="data:image/png;base64,${readFileSync(join(root, 'public/brand/hwd-lockup.png')).toString('base64')}"
            style="width:${t.lockupWidth ?? '72%'};height:auto">`
    : svg.replace('<svg ', `<svg width="${Math.round(width * (1 - t.pad * 2))}" height="${Math.round(height * (1 - t.pad * 2))}" `);

  await page.setContent(
    `<body style="margin:0;width:${width}px;height:${height}px;display:flex;` +
      `align-items:center;justify-content:center;background:${t.background}">${body}</body>`,
  );
  mkdirSync(join(root, 'public'), { recursive: true });
  await page.screenshot({
    path: join(root, t.file),
    omitBackground: t.background === 'transparent',
  });
  await page.close();
  console.log(`wrote ${t.file} (${width}×${height})`);
}

await browser.close();
