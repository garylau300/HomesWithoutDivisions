# 家無分隔 · Homes Without Divisions

The website for **Homes Without Divisions**, a community legal empowerment
initiative by Pro Bono HK for tenants living in Hong Kong subdivided units.

> 家無分隔 — 推動基層住屋法律保障
> Advancing the next generation of equitable tenancy

Bilingual (Traditional Chinese and English), fully static, and built to grow
into the browsable web version of the Pocket Tenancy Clinic.

## What is here

| Route | |
|---|---|
| `/` | Sends the reader to a language; a plain chooser if JavaScript is off |
| `/zh`, `/en` | Landing page — the three resources, with download pickers |
| `/zh/about`, `/en/about` | Mission, the three pillars, the capability approach |

Every page exists at both `/zh/…` and `/en/…`, so the language toggle is a plain
link, each language is separately indexable, and neither needs JavaScript.

## Running it

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run preview
npm run check      # TypeScript and Astro diagnostics
npm run verify     # a11y, contrast, security headers, print, no-JS, screenshots
npm run icons      # regenerate the PNG icons from public/favicon.svg
```

Requires Node 20.11 or newer.

## Deploying to Vercel

1. In Vercel, **Add New → Project** and import this repository.
2. Framework preset: **Astro**. The build command, output directory and headers
   all come from `vercel.json`, so nothing else needs setting.
3. Deploy.

Every push then builds automatically, and each branch gets its own preview URL —
useful for checking a change on a real phone before it goes live.

When a custom domain is attached, update the fallback origin in
`astro.config.mjs`. It only affects canonical URLs, Open Graph tags and the
sitemap, so nothing breaks in the meantime.

## Publishing a document

Every download is currently in a **coming soon** state. The picker UI, the
labels and the screen-reader text are all built and working; they are just
waiting on files.

1. Put the file in `public/docs/`.
2. Open `src/data/deliverables.ts`, find the entry, and change
   `status: 'coming-soon'` to `status: 'available'` with an `href`.

That is the whole change — see `public/docs/README.md` for the exact edit.

## Editing the words

All copy lives in two files:

- `src/content/i18n/zh.json`
- `src/content/i18n/en.json`

They have the same shape, and TypeScript treats a key present in one but missing
from the other as a build error, so a half-finished translation cannot reach a
reader. You can edit them on github.com and Vercel will rebuild on push — no
local setup needed.

## Design

Follows the **HWD Style Guide v.1** for colour, layout and logo use.
The typeface is a later project decision — see Typefaces below.

| | |
|---|---|
| Orange Red Crayola | `#FF5A5A` |
| Pale Pink | `#FFDADA` |
| Keppel | `#4DB6A6` |
| Opal | `#C6D8D3` |
| Cyber Yellow | `#FFD333` |
| Floral White | `#FFFBF5` |
| Eerie Black | `#222222` |
| Jet | `#333333` |

Only the guide's approved pairings are used: Floral White + Eerie Black, Floral
White + Cyber Yellow, Opal + Keppel, Pale Pink + Coral.

**One rule worth knowing before you change a colour:** text on a brand colour is
always Eerie Black, never white. White is 3.0:1 on Coral and 2.4:1 on Keppel,
both failing WCAG AA; Eerie Black is 5.2:1 and 6.5:1, both passing. The colour
pairs the site relies on are asserted in `scripts/verify.mjs`.

Chinese is set above and larger than English throughout, as the guide requires.

### Typefaces

**Quire Sans** throughout, self-hosted from `public/fonts/`, licensed from Monotype
by the project. Six weights are supplied as separate static files rather than one
variable font — Light, Regular, Bold, Black and the two italics — declared in
`src/styles/fonts.css`. Browsers fetch only the faces a page renders, so today
that is Regular and Bold (about 82 KB); the rest cost nothing until used.

Bold is declared over the range `600 700`, so the semibold UI text resolves to the
real Bold file instead of a synthesised weight.

**Noto Sans TC** (思源) carries Chinese, loaded from Google Fonts. Quire Sans has
no CJK coverage, so every Chinese glyph falls to it — as the style guide requires.

To re-generate the WOFF2 files from new TTFs, convert with `fonttools`
(`font.flavor = 'woff2'`) and keep the same filenames.

Chinese is set above and larger than English throughout, as the guide requires.

### Pillar colours

Each pillar has one colour across the whole site — cards, the pillars strip and
the diagram all read from the same tokens in `tokens.css`, so changing a pillar's
colour is a one-line edit that propagates everywhere:

| Pillar | Resource | Accent | Tint (card headers) |
|---|---|---|---|
| Transparent communication | Schedule of Condition | Keppel | Opal, half-lifted to Floral White |
| Fair terms and conduct | Model Tenancy Agreement | Cyber Yellow | Floral White |
| Appropriate solution | Pocket Tenancy Clinic | Orange Red Crayola | Pale Pink, half-lifted to Floral White |

Each card also carries a numeral matching the diagram, so the pairing never
depends on colour alone.

### The logo

`assets/brand/hwd-lockup.png` is the official lockup, recovered at full
resolution. It sits outside `public/` on purpose: it is the master that
`npm run icons` composites the header lockup and the Open Graph image from, and
everything under `public/` is deployed whether a page references it or not — at
278 KB it was a third of the build with nothing ever requesting it. The site
serves `public/brand/hwd-lockup-660.png` instead. `public/favicon.svg` is the
house-and-heart mark rebuilt as vector
geometry — the pale lines are knockouts rather than white paint, so it stays
correct on any background. Both follow the guide's rules: never stretched,
outlined, recoloured, shadowed, rotated, or given a gradient.

## Accessibility

Targets WCAG 2.2 AA, and `npm run verify` checks it rather than assuming it:

- axe-core over every page, zero violations
- the contrast of each colour pair the design system actually uses
- the download picker and language toggle driven with **JavaScript disabled**
- screenshots at 390px and 1440px in both languages

Content is visible by default and the reveal animations are added only once
JavaScript has marked the document, so nothing is ever hidden from a reader
without it. All motion stops under `prefers-reduced-motion: reduce`.

Because the page is hidden ahead of being revealed, a reveal that never runs
would cost the reader the whole page. Two nets prevent that: the reveal shows
everything rather than throwing, and the bootstrap in `BaseLayout.astro` shows
the page anyway if the reveal never reports itself ready.

## Security

`npm run verify` serves the build behind the real `vercel.json` response
headers, so every check above runs under the policy the site actually ships,
and a Content-Security-Policy that blocks something is a failing check rather
than a surprise after deploy. It also asserts the policy itself:

- `script-src` is `'self'` plus pinned hashes — no `'unsafe-inline'`, no
  `'unsafe-eval'`. Client scripts are emitted as files rather than inlined
  (see `vite.build.assetsInlineLimit` in `astro.config.mjs`), which leaves only
  the two `is:inline` bootstraps to pin.
- every inline script in the build is covered by a hash in `vercel.json`, and
  no stale hash is left behind. Change a bootstrap script without repinning it
  and this check fails with the hash to paste in.
- each page is loaded in a browser and must report zero CSP violations.

`style-src` keeps `'unsafe-inline'` deliberately: the pillar accents and reveal
delays are inline `style` attributes, which no hash can cover.

One thing left as a judgement call rather than changed: Noto Sans TC is loaded
from Google Fonts, so every visitor's IP reaches Google and the stylesheet is
render-blocking. Chinese already falls back to PingFang HK and Microsoft
JhengHei, so the link could simply be dropped — worth deciding deliberately
rather than by default.

## Print

These are documents people print, so `src/styles/print.css` is not an
afterthought — and `npm run verify` checks the printed page too. Content hidden
ahead of a scroll reveal cannot be revealed by printing, so without a print
rule a page printed before scrolling comes out blank where most of the text
should be. The check asserts every block prints, the sticky header is unstuck,
and the lockup stays so a printed sheet still says where it came from.

## Growing into the full Pocket Clinic

`src/content.config.ts` already defines the schemas and URL scheme for the
browsable version — Treatment Rooms, glossary, the Model Tenancy Agreement
clause index, and the Tenancy Risk Diagnostics Form. The collections are empty;
adding content is a matter of dropping files in, and the schemas fail the build
rather than the reader if a translation or a cross-reference is missing.

When the diagnostics checklist needs interactivity, add React with
`npx astro add react` and write it as an island — the content pages keep shipping
zero JavaScript.

## Licence

Code: see [LICENSE](./LICENSE).

The project's documents may be freely reproduced and distributed in full and
without alteration only for non-profit-making purposes.
© Pro Bono Hong Kong Limited.
