import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { LOCALES } from './lib/i18n';

/*
 * ============================================================================
 *  CONTENT SCHEMAS — for the browsable web version of the Pocket Clinic
 * ============================================================================
 *
 *  The landing and about pages do not use these collections. They are defined
 *  now because the URL scheme and the cross-references between documents are
 *  the expensive things to change later, and because Zod validates them at
 *  build time: a missing translation or a Treatment Room pointing at a clause
 *  that does not exist fails the build rather than the reader.
 *
 *  Adding content is then additive — drop a file in, and it routes and renders.
 *
 *  Planned routes (mirrored under /zh and /en):
 *    /clinic                   hub
 *    /clinic/checklist         Tenancy Risk Diagnostics Form
 *    /clinic/rooms/[slug]      the twelve Treatment and Emergency Rooms
 *    /clinic/glossary          glossary
 *    /agreement                Model Tenancy Agreement, clause by clause
 *    /schedule-of-condition    Schedule of Condition
 * ============================================================================
 */

const locale = z.enum(LOCALES);

/** A statutory reference as printed in the source, e.g. "s.120AAZO". */
const statutoryRef = z.string().regex(/^(s\.|Schedule |Cap\. )/, {
  message: 'Use the form used in the Pocket Clinic, e.g. "s.120AAZO" or "Schedule 7".',
});

/**
 * The twelve rooms. Ten Treatment Rooms (A–J) for the top ten tenancy issues,
 * two Emergency Rooms (K–L). Each room has the same three-part structure the
 * printed Pocket Clinic uses.
 */
const rooms = defineCollection({
  loader: glob({ base: './src/content/rooms', pattern: '**/[^_]*.md' }),
  schema: z.object({
    locale,
    /** A–L, matching the circled letters in the printed guide. */
    letter: z.string().regex(/^[A-L]$/),
    slug: z.string(),
    title: z.string(),
    kind: z.enum(['treatment', 'emergency']),
    pillar: z.enum(['communication', 'terms', 'solution']),
    /** 1. Know your position — what the law says before you do anything. */
    knowYourPosition: z.array(z.string()).min(1),
    /** 2. Action guide — the practical steps, for current tenants. */
    actionGuide: z.array(z.string()).default([]),
    /** 3. Guide to the Model Tenancy Agreement — the clauses that bear on this. */
    relatedClauses: z.array(z.string()).default([]),
    statutoryRefs: z.array(statutoryRef).default([]),
    /** Other rooms a reader here usually needs next. */
    seeAlso: z.array(z.string()).default([]),
  }),
});

/** Terms defined in "A Few Terms Before You Start", surfaced inline site-wide. */
const glossary = defineCollection({
  loader: file('./src/content/glossary/terms.json'),
  schema: z.object({
    id: z.string(),
    locale,
    term: z.string(),
    definition: z.string(),
    /** The room that explains this term in full, if there is one. */
    room: z.string().optional(),
  }),
});

/** The Model Tenancy Agreement clause index, so rooms and clauses cross-link. */
const clauses = defineCollection({
  loader: file('./src/content/clauses/clauses.json'),
  schema: z.object({
    id: z.string(),
    locale,
    /** e.g. "5", "Addendum E", "Schedule 7 Part 2". */
    reference: z.string(),
    heading: z.string(),
    plainSummary: z.string(),
    /** Verbatim clause text, where quoting it helps. */
    text: z.string().optional(),
    rooms: z.array(z.string()).default([]),
  }),
});

/**
 * The Tenancy Risk Diagnostics Form: three parts of twelve statements.
 *
 * `room` is the field that makes the results page work — a statement the reader
 * leaves unticked links straight to the Treatment Room that deals with it. It is
 * why the schema exists before the content does.
 */
const trdf = defineCollection({
  loader: file('./src/content/trdf/statements.json'),
  schema: z.object({
    id: z.string(),
    locale,
    part: z.enum(['communication', 'terms', 'solution']),
    number: z.number().int().min(1).max(12),
    statement: z.string(),
    /** Marked with ⚠️ in the printed form: leaving it unticked is a red flag. */
    redFlag: z.boolean().default(false),
    /** Basic Housing Units questions do not apply to non-domestic buildings. */
    basicHousingUnitsOnly: z.boolean().default(false),
    room: z.string(),
  }),
});

export const collections = { rooms, glossary, clauses, trdf };
