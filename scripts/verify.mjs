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
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { launch } from './browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const shots = join(root, 'screenshots');
const axeSource = readFileSync(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');

/*
 * The production response headers, read from vercel.json rather than restated
 * here, so the whole verification runs under the policy the site actually ships
 * — a Content-Security-Policy that blocks something is then a failing check
 * rather than a surprise after deploy.
 */
const vercelConfig = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const siteHeaders = Object.fromEntries(
  (vercelConfig.headers ?? [])
    .filter((rule) => rule.source === '/(.*)')
    .flatMap((rule) => rule.headers)
    .map((h) => [h.key, h.value]),
);
const csp = siteHeaders['Content-Security-Policy'] ?? '';
const cspDirective = (name) => {
  const found = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  return found ? found.slice(name.length).trim().split(/\s+/).filter(Boolean) : [];
};

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
        res.writeHead(200, {
          'Content-Type': MIME[extname(candidate)] ?? 'application/octet-stream',
          ...siteHeaders,
        });
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
/*
 * The header's nav pill is a neutral wash rather than a brand tint, so it reads
 * the same over the hero and over plain page. A translucent jet over the page
 * composites to exactly the same colour as mixing it in, so this reuses mix().
 */
PALETTE.navPill = mix(PALETTE.jet, PALETTE.floral, 12);

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
  { name: 'nav link on the header pill', fg: PALETTE.eerie, bg: PALETTE.navPill, min: 4.5 },
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
  /*
   * Evaluated rather than added as a <script> tag: the pages are served under
   * the production Content-Security-Policy, which refuses inline scripts, and
   * refusing an injected one is the policy working. Evaluating over the
   * DevTools protocol runs the auditor without punching a hole in the policy
   * the audit is meant to run under.
   */
  await tab.evaluate(axeSource);
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

console.log('\n── Print ────────────────────────────────────────────────');
{
  /*
   * These are documents people print. Content is hidden ahead of being revealed
   * on scroll, and print does not scroll — so without a print rule for it, a
   * page printed before the reader has scrolled through comes out blank where
   * most of the text should be. Silent, and severe on a page a caseworker is
   * handing to someone, so it is checked rather than remembered.
   */
  for (const page of PAGES.filter((p) => p.path !== '/')) {
    const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await tab.goto(`${origin}${page.path}`, { waitUntil: 'networkidle' });
    await tab.emulateMedia({ media: 'print' });
    await tab.waitForTimeout(200);
    const state = await tab.evaluate(() => {
      const revealed = [...document.querySelectorAll('[data-reveal]')];
      const header = document.querySelector('.site-header');
      const lockup = document.querySelector('.site-header__lockup');
      return {
        blank: revealed.filter((el) => getComputedStyle(el).opacity === '0').length,
        total: revealed.length,
        sticky: header ? getComputedStyle(header).position === 'sticky' : false,
        lockup: lockup ? getComputedStyle(lockup).display !== 'none' : false,
        text: document.body.innerText.replace(/\s+/g, ' ').trim().length,
      };
    });
    const ok = state.blank === 0 && !state.sticky && state.lockup && state.text > 400;
    console.log(
      `  ${ok ? '✓' : '✗'} ${page.path} — ${state.total - state.blank}/${state.total} blocks print, ` +
        `${state.text} chars, header unstuck: ${!state.sticky}, lockup kept: ${state.lockup}`,
    );
    if (!ok) failures.push(`${page.path} does not print correctly (${state.blank} blank block(s))`);
    await tab.close();
  }
}

console.log('\n── Security headers ─────────────────────────────────────');
{
  /*
   * The policy is only worth having if it is the one the browser gets, so this
   * checks the shipped vercel.json rather than an idea of it, and then loads
   * every page under it and listens for the browser actually refusing
   * something. A CSP that quietly blocks the site is the failure mode this
   * exists to catch.
   */
  const scriptSrc = cspDirective('script-src');
  const unsafe = scriptSrc.filter((v) => v === "'unsafe-inline'" || v === "'unsafe-eval'");
  const scriptOk = scriptSrc.includes("'self'") && unsafe.length === 0;
  console.log(
    `  ${scriptOk ? '✓' : '✗'} script-src is 'self' plus hashes, no unsafe-inline/eval` +
      (unsafe.length ? ` — found ${unsafe.join(', ')}` : ''),
  );
  if (!scriptOk) failures.push(`script-src is weak: ${scriptSrc.join(' ')}`);

  /* Every inline script the build emits must be covered by a pinned hash. */
  const inlineHashes = new Map();
  for (const page of PAGES) {
    const file = join(dist, page.path === '/' ? 'index.html' : `${page.path}/index.html`);
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      const hash = `'sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}'`;
      if (!inlineHashes.has(hash)) inlineHashes.set(hash, []);
      inlineHashes.get(hash).push(page.path);
    }
  }
  const missing = [...inlineHashes.keys()].filter((h) => !scriptSrc.includes(h));
  console.log(
    `  ${missing.length === 0 ? '✓' : '✗'} ${inlineHashes.size} inline script(s) in the build, all pinned in vercel.json`,
  );
  for (const hash of missing) {
    console.log(`      unpinned (${inlineHashes.get(hash).join(', ')}): ${hash}`);
    failures.push(`inline script not pinned in the CSP: ${hash}`);
  }
  /* A hash left behind after a script changed is dead weight and hides drift. */
  const stale = scriptSrc.filter((v) => v.startsWith("'sha256-") && !inlineHashes.has(v));
  console.log(`  ${stale.length === 0 ? '✓' : '✗'} no stale hashes left in the policy`);
  if (stale.length) failures.push(`stale CSP hash(es): ${stale.join(', ')}`);

  for (const key of ['X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options',
                     'Strict-Transport-Security', 'Permissions-Policy']) {
    const present = Boolean(siteHeaders[key]);
    console.log(`  ${present ? '✓' : '✗'} ${key}`);
    if (!present) failures.push(`missing security header: ${key}`);
  }

  /* Now the real test: does anything on the page actually get refused? */
  for (const page of PAGES) {
    const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await tab.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        window.__cspViolations.push(`${event.effectiveDirective} blocked ${String(event.blockedURI).slice(0, 60)}`);
      });
    });
    await tab.goto(`${origin}${page.path}`, { waitUntil: 'networkidle' });
    await tab.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
    await tab.waitForTimeout(350);
    const violations = await tab.evaluate(() => window.__cspViolations ?? []);
    const unique = [...new Set(violations)];
    console.log(`  ${unique.length === 0 ? '✓' : '✗'} ${page.path} — ${unique.length} CSP violation(s) in the browser`);
    for (const v of unique) console.log(`      ${v}`);
    if (unique.length) failures.push(`${page.path} triggers CSP violations: ${unique.join('; ')}`);
    await tab.close();
  }
}

console.log('\n── No coral surfaces (About) ────────────────────────────');
{
  /*
   * The About page carries no coral or pink surface: not the hero wash, not the
   * closing panel, not the nav pill in the bar above it. Coral stays a line —
   * the spine's dots and rail, the venn circles, the current-page underline —
   * which are drawn as pseudo-element backgrounds and SVG fills, neither of
   * which this reads. Only real elements' own background-colour is checked.
   *
   * Warm-red is separated from Cyber Yellow by the gap between the green and
   * blue channels: pink and coral keep them level (255,90,90 / 255,218,218),
   * yellow drives them far apart (255,211,51). Floral White and the footer
   * band sit inside the tolerance, as they should — they are warm neutrals.
   */
  for (const path of ['/zh/about', '/en/about']) {
    const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await tab.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
    const offenders = await tab.evaluate(() =>
      [...document.querySelectorAll('*')]
        .map((el) => {
          const bg = getComputedStyle(el).backgroundColor;
          const m = bg.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
          if (!m) return null;
          const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
          const alpha = m[4] === undefined ? 1 : Number(m[4]);
          const box = el.getBoundingClientRect();
          const warmRed = r - g > 12 && Math.abs(g - b) < 25;
          if (!warmRed || alpha < 0.05 || box.width * box.height < 400) return null;
          return `${el.tagName.toLowerCase()}.${el.className || '(none)'} → ${bg}`;
        })
        .filter(Boolean),
    );
    const ok = offenders.length === 0;
    console.log(`  ${ok ? '✓' : '✗'} ${path} — ${offenders.length} coral/pink surface(s)`);
    for (const o of offenders) console.log(`      ${o}`);
    if (!ok) failures.push(`${path} has coral/pink surfaces: ${offenders.join('; ')}`);
    await tab.close();
  }
}

console.log('\n── Reading spine (About) ────────────────────────────────');
{
  /*
   * The approach section's rail fills through a clip-path driven by a custom
   * property — the same shape of interpolating calc that silently collapsed the
   * header lockup. So this asserts the three states that matter: empty before
   * the section, filling through it, complete after; the dots level with the
   * text they mark; and the whole spine drawn when nothing is scripting it.
   */
  for (const path of ['/zh/about', '/en/about']) {
    const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await tab.goto(`${origin}${path}`, { waitUntil: 'networkidle' });

    const readProgress = () =>
      tab.evaluate(() => {
        const rail = document.querySelector('.approach');
        return {
          progress: Number(rail.style.getPropertyValue('--read-progress') || 0),
          reached: [...document.querySelectorAll('.approach__step')].filter((s) =>
            s.classList.contains('is-reached'),
          ).length,
        };
      });

    const railTop = await tab.evaluate(
      () => document.querySelector('.approach').getBoundingClientRect().top + window.scrollY,
    );
    const railHeight = await tab.evaluate(
      () => document.querySelector('.approach').getBoundingClientRect().height,
    );

    await tab.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await tab.waitForTimeout(120);
    const before = await readProgress();

    await tab.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), railTop - 200);
    await tab.waitForTimeout(120);
    const during = await readProgress();

    await tab.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), railTop + railHeight);
    await tab.waitForTimeout(120);
    const after = await readProgress();

    /* Every dot level with the first line of the paragraph it marks. */
    const drift = await tab.evaluate(() => {
      const steps = [...document.querySelectorAll('.approach__step')];
      return steps.map((step) => {
        const dot = getComputedStyle(step, '::before');
        const box = step.getBoundingClientRect();
        const dotCentre =
          box.top + parseFloat(dot.insetBlockStart) + parseFloat(dot.height) / 2;
        const range = document.createRange();
        range.setStart(step.firstChild, 0);
        range.setEnd(step.firstChild, Math.min(3, step.firstChild.length));
        const line = range.getBoundingClientRect();
        return Math.abs(dotCentre - (line.top + line.height / 2));
      });
    });
    const worstDrift = Math.max(...drift);

    const fills = before.progress === 0 && during.progress > 0 && after.progress === 1;
    const dotsFollow = before.reached === 0 && after.reached === drift.length;
    const aligned = worstDrift <= 4;
    const ok = fills && dotsFollow && aligned && drift.length >= 2;

    console.log(
      `  ${ok ? '✓' : '✗'} ${path} — ${drift.length} steps, progress ` +
        `${before.progress}→${during.progress.toFixed(2)}→${after.progress}, ` +
        `dots ${before.reached}→${after.reached}, drift ${worstDrift.toFixed(1)}px`,
    );
    if (!ok) {
      failures.push(
        `${path} reading spine: fills=${fills} dots=${dotsFollow} aligned=${aligned} (${worstDrift.toFixed(1)}px)`,
      );
    }
    await tab.close();
  }

  /* Without scripting the spine has to be drawn complete, not left empty. */
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const tab = await plain.newPage();
  await tab.goto(`${origin}/zh/about`, { waitUntil: 'load' });
  const settled = await tab.evaluate(() => {
    const dot = getComputedStyle(document.querySelector('.approach__step'), '::before');
    return {
      clip: getComputedStyle(document.querySelector('.approach'), '::after').clipPath,
      filled: dot.backgroundColor !== 'rgba(0, 0, 0, 0)' && dot.backgroundColor !== 'transparent',
    };
  });
  const plainOk = settled.clip === 'none' && settled.filled;
  console.log(`  ${plainOk ? '✓' : '✗'} spine drawn complete without scripting (clip ${settled.clip})`);
  if (!plainOk) failures.push('reading spine is not drawn complete without JavaScript');
  await plain.close();
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
