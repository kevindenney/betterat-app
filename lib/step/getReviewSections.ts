/**
 * getReviewSections — Step A read-side normalizer (migration plan: step-architecture-migration-plan.md §4 Step A).
 *
 * Normalizes either v1 `metadata.review` flat fields or v2 `metadata.review.sections[]`
 * into a single internal shape the UI can render.
 *
 * Dark-launch: this selector is the ONLY new read path. The Critique tab continues
 * to render identically for current production rows (flat fields synthesize into
 * sections whose content equals the flat-field value).
 *
 * Step B will add bot dual-writes that populate `sections[]`. From that point on,
 * v2-shaped rows will flow through this selector unchanged.
 *
 * See: docs/audit/step-architecture-migration-plan.md
 *      docs/redesign/addendum-2026-05-12-bot-architecture.md §2
 */

import type { StepMetadata, StepReviewData } from '@/types/step-detail';

// ---------------------------------------------------------------------------
// Canonical prompt set (locked per addendum §2 "Five canonical prompts")
// ---------------------------------------------------------------------------

export const REVIEW_PROMPTS = [
  'what_happened',
  'what_worked',
  'what_didnt',
  'what_did_you_learn',
  'anything_else',
] as const;

export type ReviewSectionPrompt = (typeof REVIEW_PROMPTS)[number];

export const REVIEW_PROMPT_LABELS: Record<ReviewSectionPrompt, string> = {
  what_happened: 'What happened?',
  what_worked: 'What worked?',
  what_didnt: "What didn't?",
  what_did_you_learn: 'What did you learn?',
  anything_else: 'Anything else worth noting?',
};

export const REVIEW_SECTION_SOURCES = [
  'telegram',
  'whatsapp',
  'voice_transcript',
  'voice',
  'in_app',
  'web',
  'sms',
  'legacy',
] as const;

export type ReviewSectionSource = (typeof REVIEW_SECTION_SOURCES)[number];

// ---------------------------------------------------------------------------
// Normalized output shape — what callers consume
// ---------------------------------------------------------------------------

export interface NormalizedReviewSection {
  prompt: ReviewSectionPrompt;
  prompt_label: string;
  content: string;
  source: ReviewSectionSource;
  /** ISO 8601 or null when origin is unknown (legacy rows without `completed_at`). */
  captured_at: string | null;
  duration_seconds?: number;
  ai_summary?: string;
}

export interface NormalizedReview {
  /** '2.0' iff sections[] was present and well-formed; '1.0' otherwise (or empty). */
  version: '1.0' | '2.0';
  composed_via: ReviewSectionSource | null;
  composed_at: string | null;
  sections: NormalizedReviewSection[];
}

// ---------------------------------------------------------------------------
// v1 → v2 mapping (locked per D6: next_step_notes folds into anything_else)
// ---------------------------------------------------------------------------

const LEGACY_FIELD_TO_PROMPT: Array<{
  field: keyof Pick<StepReviewData, 'what_learned' | 'deviation_reason' | 'next_step_notes'>;
  prompt: ReviewSectionPrompt;
}> = [
  { field: 'what_learned', prompt: 'what_did_you_learn' },
  { field: 'deviation_reason', prompt: 'what_didnt' },
  { field: 'next_step_notes', prompt: 'anything_else' },
];

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

const EMPTY: NormalizedReview = {
  version: '1.0',
  composed_via: null,
  composed_at: null,
  sections: [],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNonEmptyString(value: unknown): string | null {
  const s = asString(value);
  return s && s.trim().length > 0 ? s : null;
}

function asPrompt(value: unknown): ReviewSectionPrompt | null {
  if (typeof value !== 'string') return null;
  return (REVIEW_PROMPTS as readonly string[]).includes(value)
    ? (value as ReviewSectionPrompt)
    : null;
}

function asSource(value: unknown): ReviewSectionSource {
  if (typeof value !== 'string') return 'legacy';
  return (REVIEW_SECTION_SOURCES as readonly string[]).includes(value)
    ? (value as ReviewSectionSource)
    : 'legacy';
}

function normalizeV2Section(raw: unknown): NormalizedReviewSection | null {
  if (!isPlainObject(raw)) return null;
  const prompt = asPrompt(raw.prompt);
  const content = asNonEmptyString(raw.content);
  if (!prompt || !content) return null;
  const promptLabel = asNonEmptyString(raw.prompt_label) ?? REVIEW_PROMPT_LABELS[prompt];
  const section: NormalizedReviewSection = {
    prompt,
    prompt_label: promptLabel,
    content,
    source: asSource(raw.source),
    captured_at: asNonEmptyString(raw.captured_at),
  };
  if (typeof raw.duration_seconds === 'number' && Number.isFinite(raw.duration_seconds)) {
    section.duration_seconds = raw.duration_seconds;
  }
  const aiSummary = asNonEmptyString(raw.ai_summary);
  if (aiSummary) section.ai_summary = aiSummary;
  return section;
}

function synthesizeV1Sections(
  review: StepReviewData,
  fallbackCapturedAt: string | null,
): NormalizedReviewSection[] {
  const out: NormalizedReviewSection[] = [];
  for (const { field, prompt } of LEGACY_FIELD_TO_PROMPT) {
    const content = asNonEmptyString(review[field]);
    if (!content) continue;
    out.push({
      prompt,
      prompt_label: REVIEW_PROMPT_LABELS[prompt],
      content,
      source: 'legacy',
      captured_at: fallbackCapturedAt,
    });
  }
  return out;
}

/**
 * Normalize step.metadata.review to a sections[] view.
 *
 * Preference order:
 *   1. Well-formed v2 `sections[]` if present (even partial — keeps what parses).
 *   2. Synthesized v1 sections from flat fields.
 *   3. Empty.
 *
 * Never throws. Malformed inputs degrade silently to empty/partial output.
 */
export function getReviewSections(
  metadata: StepMetadata | null | undefined,
  fallbackCapturedAt: string | null = null,
): NormalizedReview {
  if (!isPlainObject(metadata)) return EMPTY;
  const review = metadata.review;
  if (!isPlainObject(review)) return EMPTY;

  const rawSections = (review as { sections?: unknown }).sections;
  if (Array.isArray(rawSections)) {
    const parsed = rawSections
      .map(normalizeV2Section)
      .filter((s): s is NormalizedReviewSection => s !== null);
    if (parsed.length > 0) {
      return {
        version: '2.0',
        composed_via: asSource((review as { composed_via?: unknown }).composed_via),
        composed_at: asNonEmptyString((review as { composed_at?: unknown }).composed_at),
        sections: parsed,
      };
    }
    // sections[] present but nothing usable — fall through to v1 synthesis below.
  }

  const sections = synthesizeV1Sections(review as StepReviewData, fallbackCapturedAt);
  if (sections.length === 0) return EMPTY;
  return {
    version: '1.0',
    composed_via: 'legacy',
    composed_at: fallbackCapturedAt,
    sections,
  };
}

/**
 * Convenience: find the first section content matching a prompt.
 *
 * Used by the Critique tab to seed its TextInput-bound state from either
 * v1 flat fields or v2 sections, depending on which is present.
 */
export function getReviewSectionContent(
  sections: NormalizedReviewSection[],
  prompt: ReviewSectionPrompt,
): string | null {
  const match = sections.find((s) => s.prompt === prompt);
  return match ? match.content : null;
}
