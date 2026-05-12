/**
 * Step Detail types — Plan/Act/Review metadata stored in timeline_steps.metadata
 */

import type { StepMeasurements } from './measurements';
import type { StepNutrition } from './step-nutrition';

export interface SubStep {
  id: string;
  text: string;
  sort_order: number;
  completed: boolean;
}

export interface MediaUpload {
  id: string;
  uri: string;
  type: 'photo' | 'video';
  caption?: string;
}

export type MediaLinkPlatform =
  | 'google_photos'
  | 'apple_photos'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'other';

export interface MediaLink {
  id: string;
  url: string;
  caption?: string;
  platform: MediaLinkPlatform;
  added_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface StepCollaborator {
  id: string;
  type: 'platform' | 'external';
  user_id?: string;
  display_name: string;
  avatar_url?: string;
  avatar_emoji?: string;
  avatar_color?: string;
  connection_space?: string;
}

export interface StepLocation {
  name: string;
  lat?: number;
  lng?: number;
  venue_id?: string;
}

export interface StepPlanData {
  what_will_you_do?: string;
  what_chat_history?: ChatMessage[];
  how_sub_steps?: SubStep[];
  why_reasoning?: string;
  who_collaborators?: string[];           // legacy plain-text names
  collaborators?: StepCollaborator[];     // structured collaborators
  connection_space?: string;              // where they connect (Discord, Zoom, etc.)
  capability_goals?: string[];
  where_location?: StepLocation;          // structured location with optional coordinates
  competency_ids?: string[];              // structured competency references
  linked_resource_ids?: string[];
  equipment_context?: AnyExtractedEntity[];
  date_enrichment?: DateEnrichment;
  conversation_id?: string;               // AI conversation that created this plan
}

export interface Observation {
  id: string;
  text: string;
  timestamp: string;
}

export interface StepActData {
  started_at?: string;
  notes?: string;
  observations?: Observation[];            // timestamped observation entries (matches Telegram log_observation format)
  media_uploads?: MediaUpload[];
  media_links?: MediaLink[];
  sub_step_progress?: Record<string, boolean>;
  sub_step_deviations?: Record<string, string>;  // what user actually did instead (keyed by sub-step id)
  sub_step_overrides?: Record<string, string>;    // edited sub-step text during training (keyed by sub-step id)
  conversation_id?: string;               // AI conversation during training
  measurements?: StepMeasurements;         // AI-extracted structured measurements
  nutrition?: StepNutrition;               // AI-extracted nutrition data
}

export interface InstructorCompetencyAssessment {
  rating: 'needs_improvement' | 'satisfactory' | 'excellent';
  notes?: string;
}

export type InstructorReviewStatus = 'approved' | 'needs_revision';

export interface CompetencyEvidenceItem {
  competency_id?: string;
  competency_title: string;
  category?: string;
  demonstrated_level: 'initial_exposure' | 'developing' | 'proficient' | 'not_demonstrated';
  evidence_basis: string;
  advancement_suggestion?: string;
}

export interface StepCompetencyAssessment {
  assessed_at: string;
  planned_competency_results: CompetencyEvidenceItem[];
  additional_competencies_found: CompetencyEvidenceItem[];
  gap_summary: string;
}

/**
 * v2 review section — one prompt-keyed, source-tagged entry inside
 * `metadata.review.sections[]`. See lib/step/getReviewSections.ts for the
 * canonical prompt set and Step Arch A–E migration notes.
 */
export interface StepReviewSection {
  prompt:
    | 'what_happened'
    | 'what_worked'
    | 'what_didnt'
    | 'what_did_you_learn'
    | 'anything_else';
  prompt_label: string;
  content: string;
  source:
    | 'telegram'
    | 'whatsapp'
    | 'voice_transcript'
    | 'voice'
    | 'in_app'
    | 'web'
    | 'sms'
    | 'legacy';
  captured_at: string | null;
  duration_seconds?: number;
  ai_summary?: string;
}

export interface StepReviewData {
  overall_rating?: number;
  worked_to_plan?: boolean;
  /** @deprecated Step Arch E — read via getReviewSections selector. */
  deviation_reason?: string;
  /** @deprecated Step Arch E — read via getReviewSections selector. */
  what_learned?: string;
  capability_progress?: Record<string, number>;
  /** @deprecated Step Arch E — read via getReviewSections selector. */
  next_step_notes?: string;
  instructor_assessment?: Record<string, InstructorCompetencyAssessment>;
  instructor_suggested_next?: string;  // instructor's suggested follow-up step
  instructor_review_status?: InstructorReviewStatus;
  instructor_review_note?: string;     // reason for approval/revision request
  instructor_review_at?: string;       // ISO timestamp
  competency_assessment?: StepCompetencyAssessment;
  /** v2 sections — prompt-keyed review entries. Source of truth post-Step-E. */
  sections?: StepReviewSection[];
  /** Source of the most recent write into sections[]. */
  composed_via?: StepReviewSection['source'];
  /** ISO timestamp of the first write into sections[] on this row. */
  composed_at?: string;
}

export interface CrossInterestSuggestion {
  id: string;
  sourceInterestSlug: string;
  sourceInterestName: string;
  sourceInterestColor: string;
  sourceInterestIcon: string | null;
  suggestion: string;
  relevance: string;
  /** Suggested step category for the created step (e.g. 'nutrition', 'strength') */
  suggestedCategory?: string;
}

// ---------------------------------------------------------------------------
// Brain dump types — unstructured entry that AI structures into a plan
// ---------------------------------------------------------------------------

export interface ExtractedUrl {
  url: string;
  platform: MediaLinkPlatform | 'pdf' | 'article' | 'unknown';
  title?: string;
  thumbnail_url?: string;
}

// ---------------------------------------------------------------------------
// Entity extraction types — recognized entities from brain dump text
// ---------------------------------------------------------------------------

export interface ExtractedEntity {
  raw_text: string;
  type: 'person' | 'equipment' | 'location' | 'date';
}

export interface ExtractedPersonEntity extends ExtractedEntity {
  type: 'person';
  matched_user_id?: string;
  matched_display_name?: string;
  confidence: 'exact' | 'likely' | 'ambiguous' | 'unmatched';
  ambiguous_matches?: { user_id: string; display_name: string; avatar_emoji?: string }[];
}

export interface ExtractedEquipmentEntity extends ExtractedEntity {
  type: 'equipment';
  category: 'boat' | 'sail' | 'gear' | 'tool' | 'instrument' | 'other';
  ownership: 'mine' | 'needed' | 'unknown';
  matched_boat_id?: string;
  matched_equipment_id?: string;
  resolved_name?: string;
}

export interface ExtractedLocationEntity extends ExtractedEntity {
  type: 'location';
  coordinates?: { lat: number; lng: number };
  venue_id?: string;
  resolved_name?: string;
}

export interface DateEnrichment {
  wind?: { speed_knots: number; direction: number; gusts?: number };
  tide?: { state: string; height_m: number; next_high?: string; next_low?: string };
  rig_suggestion?: string;
  sail_suggestion?: string;
}

export interface ExtractedDateEntity extends ExtractedEntity {
  type: 'date';
  parsed_iso: string;
  parsed_end_iso?: string;
  has_time: boolean;
  enrichment?: DateEnrichment;
}

export type AnyExtractedEntity =
  | ExtractedPersonEntity
  | ExtractedEquipmentEntity
  | ExtractedLocationEntity
  | ExtractedDateEntity;

// ---------------------------------------------------------------------------
// Brain dump data
// ---------------------------------------------------------------------------

export interface BrainDumpData {
  raw_text: string;
  extracted_urls: ExtractedUrl[];
  extracted_people: string[];
  extracted_topics: string[];
  extracted_dates?: { raw: string; rough_iso: string }[];
  extracted_equipment?: string[];
  extracted_locations?: string[];
  extracted_entities?: AnyExtractedEntity[];
  source_step_id?: string;
  source_review_notes?: string;
  created_at: string;
  ai_structured_at?: string;
}

export interface StepMetadata {
  plan?: StepPlanData;
  act?: StepActData;
  review?: StepReviewData;
  brain_dump?: BrainDumpData;
  [key: string]: unknown;
}
