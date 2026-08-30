/**
 * Verification pass over the built site.
 *
 *   npm run build && node scripts/verify.mjs
 *
 * Checks, in order:
 *   1. axe-core accessibility audit on every page
 *   2. WCAG contrast of the colour pairs the design system actually uses
 *   3. the download picker works with JavaScript disabled
 *   4. screenshots at mobile and desktop widths, for review
 *
 * Exits non-zero if anything fails, so it can gate a deploy.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { launch } from './browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const shots = join(root, 'screenshots');
const axeSource = readFileSync(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');

const PAGES = [
  { path: '/zh', name: 'zh-home' },
  { path: '/en', name: 'en-home' },
  { path: '/zh/about', name: 'zh-about' },
  { path: '/en/about', name: 'en-about' },
  { path: '/', name: 'root-chooser' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.json': 'application/json',
};

/** Serves dist/ the way Vercel does: clean URLs, directory index fallback. */
function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const candidates = [
      join(dist, url.pathname),
      join(dist, url.pathname, 'index.html'),
      join(dist, `${url.pathname}.html`),
    ];
    for (const candidate of candidates) {
      try {
        const body = readFileSync(candidate);
        res.writeHead(200, { 'Content-Type': MIME[extname(candidate)] ?? 'application/octet-stream' });
        res.end(body);
        return;
      } catch {
        /* try the next candidate */
      }
    }
    res.writeHead(404).end('not found');
  });
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

/* ---------------------------------------------------------------- contrast */

const srgb = (channel) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255)
  );
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Mirrors CSS `color-mix(in srgb, a pct%, b)` so derived surfaces stay in step. */
const mix = (a, b, pct) => {
  const ch = (hex, i) => (parseInt(hex.slice(1), 16) >> (16 - i * 8)) & 255;
  const out = [0, 1, 2].map((i) => Math.round((ch(a, i) * pct + ch(b, i) * (100 - pct)) / 100));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const PALETTE = {
  coral: '#FF5A5A',
  palePink: '#FFDADA',
  keppel: '#4DB6A6',
  opal: '#C6D8D3',
  yellow: '#FFD333',
  floral: '#FFFBF5',
  eerie: '#222222',
  jet: '#333333',
  white: '#FFFFFF',
};

/* --footer-bg in tokens.css: a neutral beige-grey band, not a brand colour. */
PALETTE.footer = mix(PALETTE.jet, PALETTE.floral, 7);
/* The card headers use the pairing colours lifted halfway to Floral White. */
PALETTE.opalTint = mix(PALETTE.opal, PALETTE.floral, 50);
PALETTE.pinkTint = mix(PALETTE.palePink, PALETTE.floral, 50);

/**
 * Every foreground/background pair the site renders where the contrast has to
 * hold. The rule this enforces: text on a brand colour is always Eerie Black,
 * never white — white is 3.0:1 on Coral and 2.4:1 on Keppel, both failing.
 */
const PAIRS = [
  { name: 'body text on page', fg: PALETTE.eerie, bg: PALETTE.floral, min: 4.5 },
  { name: 'muted text on page', fg: PALETTE.jet, bg: PALETTE.floral, min: 4.5 },
  { name: 'body text on card', fg: PALETTE.eerie, bg: PALETTE.white, min: 4.5 },
  { name: 'muted text on card', fg: PALETTE.jet, bg: PALETTE.white, min: 4.5 },
  { name: 'text on the footer band', fg: PALETTE.eerie, bg: PALETTE.footer, min: 4.5 },
  { name: 'muted text on the footer band', fg: PALETTE.jet, bg: PALETTE.footer, min: 4.5 },
  { name: 'text on the light pink card head', fg: PALETTE.eerie, bg: PALETTE.pinkTint, min: 4.5 },
  { name: 'muted text on the light pink card head', fg: PALETTE.jet, bg: PALETTE.pinkTint, min: 4.5 },
  { name: 'text on the light mint card head', fg: PALETTE.eerie, bg: PALETTE.opalTint, min: 4.5 },
  { name: 'muted text on the light mint card head', fg: PALETTE.jet, bg: PALETTE.opalTint, min: 4.5 },
  { name: 'text on Cyber Yellow', fg: PALETTE.eerie, bg: PALETTE.yellow, min: 4.5 },
  { name: 'text on Coral', fg: PALETTE.eerie, bg: PALETTE.coral, min: 4.5 },
  { name: 'text on Keppel', fg: PALETTE.eerie, bg: PALETTE.keppel, min: 4.5 },
  { name: 'button label on Eerie Black', fg: PALETTE.floral, bg: PALETTE.eerie, min: 4.5 },
  { name: 'tick marks on card (Eerie Black)', fg: PALETTE.eerie, bg: PALETTE.white, min: 3 },
  { name: 'number ring border on card head', fg: PALETTE.eerie, bg: PALETTE.white, min: 3 },
  { name: 'focus ring on page', fg: PALETTE.eerie, bg: PALETTE.floral, min: 3 },
  { name: 'focus ring on Pale Pink', fg: PALETTE.eerie, bg: PALETTE.palePink, min: 3 },
  { name: 'focus ring on the footer band', fg: PALETTE.eerie, bg: PALETTE.footer, min: 3 },
  { name: 'focus ring on Opal', fg: PALETTE.eerie, bg: PALETTE.opal, min: 3 },
];

/**
 * Purely decorative fills: the arch on each card, the pillar rules, the venn
 * circles, the hero washes. These are the style guide's own approved pairings
 * (Coral on Pale Pink, Keppel on Opal, Cyber Yellow on Floral White) and they
 * are all well under 3:1 by design — a warm, low-contrast brand.
 *
 * WCAG 1.4.11 applies to graphics *required to understand the content*. None of
 * these are: every card states its pillar and title in Eerie Black text, and
 * carries a numeral that matches the list, so nothing is conveyed by colour
 * alone. They are reported here rather than enforced, so that the numbers stay
 * visible and a future change that starts leaning on one of these colours to
 * carry meaning is an obvious problem rather than a silent one.
 */
const DECORATIVE = [
  { name: 'Coral arch on Pale Pink', fg: PALETTE.coral, bg: PALETTE.palePink },
  { name: 'Keppel arch on Opal', fg: PALETTE.keppel, bg: PALETTE.opal },
  { name: 'Cyber Yellow arch on Floral White', fg: PALETTE.yellow, bg: PALETTE.floral },
];

function checkContrast() {
  const failures = [];
  for (const pair of PAIRS) {
    const value = ratio(pair.fg, pair.bg);
    const ok = value >= pair.min;
    console.log(`  ${ok ? '✓' : '✗'} ${pair.name}: ${value.toFixed(2)}:1 (needs ${pair.min}:1)`);
    if (!ok) failures.push(`${pair.name} is ${value.toFixed(2)}:1, needs ${pair.min}:1`);
  }
  console.log('  — decorative fills, reported only (see the note in this script):');
  for (const pair of DECORATIVE) {
    console.log(`      ${pair.name}: ${ratio(pair.fg, pair.bg).toFixed(2)}:1`);
  }
  return failures;
}

/* -------------------------------------------------------------------- main */

const { server, port } = await serve();
const origin = `http://localhost:${port}`;
const browser = await launch();
const failures = [];

console.log('\n── Contrast ─────────────────────────────────────────────');
failures.push(...checkContrast());

console.log('\n── Accessibility (axe-core) ─────────────────────────────');
for (const page of PAGES) {
  /*
   * Reduced motion is emulated so the audit sees the settled page. Without it
   * the entrance animations are mid-flight when axe runs and it reports the
   * transient opacity: 0 as a contrast failure — a race, not a real defect.
   */
  const tab = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  await tab.goto(`${origin}${page.path}`, { waitUntil: 'networkidle' });
  // The root URL redirects to a language; wait for that to land.
  await tab.waitForLoadState('networkidle');
  await tab.addScriptTag({ content: axeSource });
  const results = await tab.evaluate(async () =>
    // @ts-expect-error axe is injected above
    await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    }),
  );
  const violations = results.violations ?? [];
  console.log(`  ${violations.length === 0 ? '✓' : '✗'} ${page.path} — ${violations.length} violation(s)`);
  for (const violation of violations) {
    console.log(`      [${violation.impact}] ${violation.id}: ${violation.help}`);
    for (const node of violation.nodes.slice(0, 3)) {
      console.log(`        ${node.html.slice(0, 140)}`);
    }
    failures.push(`${page.path}: ${violation.id}`);
  }
  await tab.close();
}

console.log('\n── Download picker without JavaScript ───────────────────');
{
  const context = await browser.newContext({ javaScriptEnabled: false });
  const tab = await context.newPage();
  await tab.goto(`${origin}/zh`, { waitUntil: 'load' });

  // Scoped to one card: each picker has its own independent radio groups.
  const picker = tab.locator('.picker[data-deliverable="pocket-tenancy-clinic"]');
  const preselected = await tab.locator('#pocket-tenancy-clinic-lang-zh').isChecked();
  const shown = await picker.locator('[data-combo]:visible').count();
  const before = await picker.locator('[data-combo]:visible').getAttribute('data-combo');

  // Switch format to DOCX by clicking its label, still without scripting.
  await tab.locator('label[for="pocket-tenancy-clinic-format-docx"]').click();
  const afterFormat = await picker.locator('[data-combo]:visible').getAttribute('data-combo');

  // Switch language to English too.
  await tab.locator('label[for="pocket-tenancy-clinic-lang-en"]').click();
  const afterLanguage = await picker.locator('[data-combo]:visible').getAttribute('data-combo');

  // The other cards must be untouched by all of that.
  const neighbour = await tab
    .locator('.picker[data-deliverable="schedule-of-condition"] [data-combo]:visible')
    .getAttribute('data-combo');

  const ok =
    preselected &&
    shown === 1 &&
    before === 'zh-pdf' &&
    afterFormat === 'zh-docx' &&
    afterLanguage === 'en-docx' &&
    neighbour === 'zh-pdf';
  console.log(
    `  ${ok ? '✓' : '✗'} one combination at a time, both controls switch it, cards stay independent ` +
      `(${before} → ${afterFormat} → ${afterLanguage}; neighbour still ${neighbour})`,
  );
  if (!ok) failures.push('download picker does not work without JavaScript');

  /*
   * The header logo's size is interpolated from a scroll variable that only
   * JavaScript sets. Without it the lockup must settle at its small size rather
   * than stay stuck at the large one.
   */
  const logoHeight = await tab
    .locator('.site-header__lockup')
    .evaluate((el) => el.getBoundingClientRect().height);
  const logoOk = logoHeight > 0 && logoHeight < 48;
  console.log(`  ${logoOk ? '✓' : '✗'} header logo settles small without scripting (${logoHeight.toFixed(1)}px)`);
  if (!logoOk) failures.push(`header logo is ${logoHeight.toFixed(1)}px without JavaScript`);

  const langHref = await tab.locator('.lang-toggle__option').nth(1).getAttribute('href');
  console.log(`  ${langHref === '/en' ? '✓' : '✗'} language toggle is a plain link (${langHref})`);
  if (langHref !== '/en') failures.push('language toggle is not a link without JavaScript');

  await context.close();
}

console.log('\n── Reduced motion ───────────────────────────────────────');
{
  const tab = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await tab.goto(`${origin}/zh`, { waitUntil: 'networkidle' });
  const durations = await tab.evaluate(() =>
    ['.hero__motto', '.hero__blob--mint', '.hero__arch', '.house-icon__heart-stroke', '.house-icon__division']
      .map((selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const style = getComputedStyle(el);
        return {
          selector,
          animation: style.animationDuration,
          transition: style.transitionDuration,
        };
      })
      .filter(Boolean),
  );
  /** Chrome reports the collapsed 0.01ms as "1e-05s", so parse rather than match. */
  const seconds = (value) => {
    const [, number, unit] = /^([\d.e+-]+)(ms|s)$/.exec(value.split(',')[0].trim()) ?? [];
    return number === undefined ? Number.NaN : Number(number) / (unit === 'ms' ? 1000 : 1);
  };

  for (const entry of durations) {
    // The global reduced-motion block collapses every animation to 0.01ms.
    const stopped = seconds(entry.animation) < 0.05;
    console.log(`  ${stopped ? '✓' : '✗'} ${entry.selector} animation: ${entry.animation}`);
    if (!stopped) failures.push(`${entry.selector} still animates under prefers-reduced-motion`);
  }
  // And nothing may be left invisible by a reveal that never fires.
  const hidden = await tab.evaluate(
    () =>
      [...document.querySelectorAll('[data-reveal]')].filter(
        (el) => Number(getComputedStyle(el).opacity) < 1,
      ).length,
  );
  console.log(`  ${hidden === 0 ? '✓' : '✗'} ${hidden} revealed element(s) left hidden`);
  if (hidden !== 0) failures.push(`${hidden} elements stay invisible under reduced motion`);
  await tab.close();
}

console.log('\n── Keyboard ─────────────────────────────────────────────');
{
  const tab = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await tab.goto(`${origin}/zh`, { waitUntil: 'networkidle' });

  const seen = [];
  let ringless = null;
  for (let i = 0; i < 24; i += 1) {
    await tab.keyboard.press('Tab');
    // Let the style recalc settle: read too early and the ring is still 0px.
    await tab.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const info = await tab.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      // A radio's focus ring is drawn on its label, which is what is visible.
      const painted =
        el.tagName === 'INPUT' && el.type === 'radio'
          ? document.querySelector(`label[for="${el.id}"]`)
          : el;
      const style = painted ? getComputedStyle(painted) : null;
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        label: (el.textContent || '').trim().slice(0, 24),
        outline: style ? `${style.outlineStyle} ${style.outlineWidth}` : 'none',
      };
    });
    if (!info) break;
    seen.push(info);
    if (info.outline.startsWith('none') || info.outline.endsWith('0px')) ringless ??= info;
  }

  const reachedToggle = seen.some((s) => s.label === '中文' || s.label === 'English');
  const reachedPicker = seen.some((s) => s.id?.includes('-lang-') || s.id?.includes('-format-'));
  const reachedSkip = seen[0]?.label.includes('跳至');

  console.log(`  ${reachedSkip ? '✓' : '✗'} first stop is the skip link`);
  console.log(`  ${reachedToggle ? '✓' : '✗'} language toggle is reachable by Tab`);
  console.log(`  ${reachedPicker ? '✓' : '✗'} download picker controls are reachable by Tab`);
  console.log(`  ${!ringless ? '✓' : '✗'} every stop paints a focus ring`);
  if (ringless) console.log(`      no ring on: <${ringless.tag}> ${ringless.id ?? ringless.label}`);

  if (!reachedSkip) failures.push('skip link is not the first tab stop');
  if (!reachedToggle) failures.push('language toggle is not keyboard reachable');
  if (!reachedPicker) failures.push('download picker is not keyboard reachable');
  if (ringless) failures.push(`no focus ring on <${ringless.tag}> ${ringless.id ?? ringless.label}`);
  await tab.close();
}

console.log('\n── Header lockup ────────────────────────────────────────');
{
  /*
   * Both states matter. The scroll-linked size is an interpolating calc, and a
   * clamp() substituted into it once resolved invalid and collapsed the lockup
   * to 0px — but only after scrolling, which a top-of-page check never sees.
   */
  const NATURAL = 660 / 128;
  const tab = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  for (const width of [320, 390, 600, 768, 1024, 1440]) {
    await tab.setViewportSize({ width, height: 800 });
    await tab.goto(`${origin}/zh`, { waitUntil: 'networkidle' });
    const read = () =>
      tab.evaluate(() => {
        const img = document.querySelector('.site-header__lockup');
        const box = img.getBoundingClientRect();
        return { w: box.width, h: box.height, shown: getComputedStyle(img).display !== 'none' };
      });
    const top = await read();
    await tab.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
    await tab.waitForTimeout(220);
    const scrolled = await read();

    const skew = (s) => (s.h > 0 ? Math.abs((s.w / s.h - NATURAL) / NATURAL) * 100 : 999);
    const ok =
      top.shown && scrolled.shown && top.h > 20 && scrolled.h > 20 &&
      skew(top) < 1 && skew(scrolled) < 1;
    console.log(
      `  ${ok ? '✓' : '✗'} ${String(width).padStart(4)}px — top ${top.h.toFixed(0)}px, ` +
        `scrolled ${scrolled.h.toFixed(0)}px, aspect within ${Math.max(skew(top), skew(scrolled)).toFixed(1)}%`,
    );
    if (!ok) failures.push(`header lockup wrong at ${width}px (top ${top.h}px, scrolled ${scrolled.h}px)`);
  }
  await tab.close();
}

console.log('\n── Document structure ───────────────────────────────────');
for (const page of PAGES.filter((p) => p.path !== '/')) {
  const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await tab.goto(`${origin}${page.path}`, { waitUntil: 'networkidle' });
  const info = await tab.evaluate(() => {
    const h1s = [...document.querySelectorAll('h1')];
    return {
      count: h1s.length,
      // The landing page's h1 is the lockup, so its text comes from the alt.
      text: h1s.map((h) => (h.textContent.trim() || h.querySelector('img')?.alt || '')).join(' | '),
    };
  });
  const ok = info.count === 1 && info.text.length > 0;
  console.log(`  ${ok ? '✓' : '✗'} ${page.path} — ${info.count} h1: "${info.text}"`);
  if (!ok) failures.push(`${page.path} has ${info.count} h1 (need exactly one, with text)`);
  await tab.close();
}

console.log('\n── Screenshots ──────────────────────────────────────────');
mkdirSync(shots, { recursive: true });
for (const page of PAGES) {
  for (const [label, width] of [
    ['mobile', 390],
    ['desktop', 1440],
  ]) {
    const tab = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
    await tab.goto(`${origin}${page.path}`, { waitUntil: 'networkidle' });
    // Let the entrance animations settle before capturing.
    await tab.waitForTimeout(2200);
    await tab.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await tab.waitForTimeout(900);
    await tab.evaluate(() => window.scrollTo(0, 0));
    await tab.waitForTimeout(500);
    const file = join(shots, `${page.name}-${label}.png`);
    await tab.screenshot({ path: file, fullPage: true });
    console.log(`  wrote screenshots/${page.name}-${label}.png`);
    await tab.close();
  }
}

await browser.close();
server.close();

console.log('\n─────────────────────────────────────────────────────────');
if (failures.length) {
  console.error(`✗ ${failures.length} problem(s):`);
  for (const failure of failures) console.error(`   - ${failure}`);
  process.exit(1);
}
console.log('✓ All checks passed.');
