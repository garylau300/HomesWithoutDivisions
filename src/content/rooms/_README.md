# Treatment and Emergency Rooms

Empty for now. This is where the browsable web version of the Pocket Clinic's
twelve rooms will live — ten Treatment Rooms (A–J) for the top ten tenancy
issues, and two Emergency Rooms (K–L).

One file per room per language, named `<locale>/<letter>-<slug>.md`, for example
`zh/a-eviction-and-harassment.md` and `en/a-eviction-and-harassment.md`. The
schema in `src/content.config.ts` validates the frontmatter at build time, so a
room missing a translation or pointing at a clause that does not exist fails the
build rather than the reader.

Files whose name starts with `_` — this one — are ignored by the loader.

```md
---
locale: zh
letter: A
slug: eviction-and-harassment
title: 迫遷與滋擾
kind: treatment
pillar: solution
knowYourPosition:
  - 業主能否合法要你遷出，由《業主與租客（綜合）條例》第 IVA 部決定，而不是租約寫甚麼就是甚麼。
actionGuide:
  - 立即以書面（WhatsApp、電郵等）記錄事件經過，並保留所有訊息。
relatedClauses: []
statutoryRefs:
  - s.120AAZO
seeAlso:
  - landlords-re-entry
---

Body content in Markdown.
```
