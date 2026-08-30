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
npm run verify     # accessibility, contrast, no-JS behaviour, screenshots
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

Follows the **HWD Style Guide v.1**.

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

IBM Plex Sans (primary) and Noto Sans TC (Chinese) load from Google Fonts.

**Tabarra Pro** — the guide's secondary, friendlier face — is a commercial
typeface and its files are not in this repository, so `--font-display` currently
falls back to IBM Plex Sans, which the guide also sanctions for headings. To
enable it, add the licensed `.woff2` files to `public/fonts/` and uncomment
`src/styles/tabarra.css`; nothing else changes.

### The logo

`public/brand/hwd-lockup.png` is the official lockup, recovered at full
resolution. `public/favicon.svg` is the house-and-heart mark rebuilt as vector
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
