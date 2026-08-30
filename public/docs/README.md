# Deliverable files

Put the published documents here, then point the manifest at them.

Suggested names, matching the manifest ids:

```
schedule-of-condition-zh.pdf    schedule-of-condition-zh.docx
schedule-of-condition-en.pdf    schedule-of-condition-en.docx
model-tenancy-agreement-zh.pdf  model-tenancy-agreement-zh.docx
model-tenancy-agreement-en.pdf  model-tenancy-agreement-en.docx
pocket-tenancy-clinic-zh.pdf    pocket-tenancy-clinic-zh.docx
pocket-tenancy-clinic-en.pdf    pocket-tenancy-clinic-en.docx
```

To make one live, open `src/data/deliverables.ts`, find its entry, and change:

```ts
{ language: 'zh', format: 'pdf', status: 'coming-soon' },
```

to:

```ts
{ language: 'zh', format: 'pdf', status: 'available', href: '/docs/pocket-tenancy-clinic-zh.pdf' },
```

That is the whole change. The card, the picker, the button and the
screen-reader label all follow from it, and the "coming soon" note for that
combination disappears on its own.

Files here are served with a one-hour edge cache and must revalidate (see
`vercel.json`), so replacing a document in place reaches readers quickly.

This README is ignored by the site — it is only here so the folder exists in
git before any documents do.
