import type { Locale } from '../lib/i18n';

/*
 * ============================================================================
 *  THE DELIVERABLES MANIFEST
 * ============================================================================
 *
 *  This is the only file you need to touch to publish a document.
 *
 *  To make a download live:
 *    1. Put the file in  public/docs/   (e.g. public/docs/pocket-clinic-zh.pdf)
 *    2. Find its entry in `files` below.
 *    3. Change   status: 'coming-soon'
 *          to    status: 'available', href: '/docs/pocket-clinic-zh.pdf'
 *
 *  Nothing else changes. The card, the picker, the button label and the
 *  screen-reader text all follow from this.
 *
 *  Copy for each deliverable — its name, pillar and description, in both
 *  languages — lives in src/content/i18n/{zh,en}.json under "deliverables",
 *  keyed by the same id.
 * ============================================================================
 */

export type DeliverableId =
  | 'schedule-of-condition'
  | 'model-tenancy-agreement'
  | 'pocket-tenancy-clinic';

export type PillarId = 'communication' | 'terms' | 'solution';

export type DocFormat = 'docx' | 'pdf';

export type DocStatus = 'available' | 'coming-soon';

export interface DeliverableFile {
  language: Locale;
  format: DocFormat;
  status: DocStatus;
  /** Required when status is 'available'. Path under public/, e.g. '/docs/x.pdf'. */
  href?: string;
}

export interface Deliverable {
  id: DeliverableId;
  pillar: PillarId;
  /** Serial number shown on the card. */
  index: number;
  /** Where the browsable web version of this document will live, once it exists. */
  futureRoute: string;
  files: DeliverableFile[];
}

/** Every combination starts unavailable; see the instructions at the top. */
const comingSoon = (): DeliverableFile[] => [
  { language: 'zh', format: 'docx', status: 'coming-soon' },
  { language: 'zh', format: 'pdf', status: 'coming-soon' },
  { language: 'en', format: 'docx', status: 'coming-soon' },
  { language: 'en', format: 'pdf', status: 'coming-soon' },
];

export const DELIVERABLES: Deliverable[] = [
  {
    id: 'schedule-of-condition',
    pillar: 'communication',
    index: 1,
    futureRoute: '/schedule-of-condition',
    files: comingSoon(),
  },
  {
    id: 'model-tenancy-agreement',
    pillar: 'terms',
    index: 2,
    futureRoute: '/agreement',
    files: comingSoon(),
  },
  {
    id: 'pocket-tenancy-clinic',
    pillar: 'solution',
    index: 3,
    futureRoute: '/clinic',
    files: comingSoon(),
  },
];

/**
 * The three pillars, in the order the source documents present them.
 * `accent` names the CSS custom property pair defined in tokens.css, which is
 * where the approved colour pairings from the style guide are enforced.
 */
export const PILLARS: {
  id: PillarId;
  deliverable: DeliverableId;
  accent: string;
  accentTint: string;
}[] = [
  {
    id: 'communication',
    deliverable: 'schedule-of-condition',
    accent: 'var(--accent-communication)',
    accentTint: 'var(--accent-communication-tint)',
  },
  {
    id: 'terms',
    deliverable: 'model-tenancy-agreement',
    accent: 'var(--accent-terms)',
    accentTint: 'var(--accent-terms-tint)',
  },
  {
    id: 'solution',
    deliverable: 'pocket-tenancy-clinic',
    accent: 'var(--accent-solution)',
    accentTint: 'var(--accent-solution-tint)',
  },
];

export function pillarFor(id: DeliverableId) {
  const pillar = PILLARS.find((p) => p.deliverable === id);
  if (!pillar) throw new Error(`No pillar defined for deliverable "${id}"`);
  return pillar;
}

export function fileFor(
  deliverable: Deliverable,
  language: Locale,
  format: DocFormat,
): DeliverableFile {
  const file = deliverable.files.find((f) => f.language === language && f.format === format);
  if (!file) {
    throw new Error(`Manifest is missing ${language}/${format} for "${deliverable.id}"`);
  }
  return file;
}
