/**
 * Inspiration Types
 *
 * Types for the "Inspiration → Interest → Blueprint" pipeline.
 * A user pastes inspiring content (URL, text, description) and the system
 * extracts skills, proposes an interest, and generates a blueprint skeleton.
 */

/** How the user provided the inspiring content */
export type InspirationContentType = 'url' | 'text' | 'description';

/** Uploaded file metadata sent to the extractor. V1 supports PDF only. */
export interface InspirationAttachment {
  filename: string;
  mime: string;
  storage_path: string;
  public_url?: string | null;
}

/** Input to the inspiration-extract edge function */
export interface InspirationExtractInput {
  content_type: InspirationContentType;
  content: string;
  user_existing_interest_slugs: string[];
  attachments?: InspirationAttachment[];
  interest_id?: string | null;
  interest_slug?: string | null;
  interest_label?: string | null;
  persona_vocabulary?: Record<string, unknown> | null;
  recurring_anchors?: Record<string, unknown>[] | null;
}

/** AI-proposed interest details */
export interface ProposedInterest {
  name: string;
  slug: string;
  description: string;
  suggested_domain_slug: string;
  accent_color: string;
  icon_name: string;
}

/** A single step in the generated blueprint */
export interface InspirationBlueprintStep {
  title: string;
  description: string;
  category: string;
  order: number;
  sub_steps: string[];
  reasoning: string;
  estimated_duration_days: number;
  /** Slugs of existing user interests this step overlaps with */
  cross_interest_slugs: string[];
}

/** Generated blueprint skeleton */
export interface InspirationBlueprint {
  title: string;
  description: string;
  steps: InspirationBlueprintStep[];
}

export interface InspirationCalendarSeason {
  name: string;
  start_date: string;
  end_date: string;
}

export interface InspirationCalendarStep {
  title: string;
  type_label: string;
  tense: 'past' | 'future';
  date: string | null;
  recurrence: string | null;
  is_anchor: boolean;
  season_name: string | null;
  confidence: number;
  source_span?: string | null;
}

export interface InspirationCalendar {
  seasons: InspirationCalendarSeason[];
  steps: InspirationCalendarStep[];
}

/** Overlap between generated content and user's existing interests */
export interface InterestOverlap {
  slug: string;
  relevance: string;
}

/** Full extraction result from the AI edge function */
export interface InspirationExtraction {
  proposed_interest: ProposedInterest;
  blueprint: InspirationBlueprint;
  calendar?: InspirationCalendar | null;
  source_summary: string;
  existing_interest_overlaps: InterestOverlap[];
  /** 0–1 confidence in the extraction quality */
  confidence: number;
}

/** User's choice in the interest review step */
export interface InspirationInterestReview {
  interestEdits: Partial<ProposedInterest>;
  selectedExistingInterestId: string | null;
}

/** Input to InspirationService.activate() */
export interface ActivateInspirationInput {
  userId: string;
  extraction: InspirationExtraction;
  /** User overrides to the proposed interest */
  interestEdits?: Partial<ProposedInterest>;
  /** If set, attach the generated plan to this existing user interest instead */
  selectedExistingInterestId?: string | null;
  /** User edits to individual steps (removals, title changes, etc.) */
  editedSteps?: InspirationBlueprintStep[];
  /** User-confirmed dated/seasonal work extracted from the dump. */
  calendarReview?: InspirationCalendar | null;
  /** Original content for saving to playbook inbox */
  sourceContent: string;
  sourceContentType: InspirationContentType;
}

/** Result of activating an inspiration */
export interface ActivateInspirationResult {
  interestId: string;
  interestSlug: string;
  blueprintId: string;
  blueprintSlug: string;
  stepIds: string[];
  playbookId: string;
}
