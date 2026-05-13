/**
 * Playbook types — per-user, per-interest personal knowledge system
 *
 * Replaces the Library primitives with a richer compiled-knowledge layer:
 * Vision, Concepts (inheritable wiki), Resources, Patterns, Reviews, Q&A,
 * Suggestions queue, Raw Inbox, and read-only shares.
 */

export type ResourceType =
  | 'online_course'
  | 'youtube_channel'
  | 'youtube_video'
  | 'website'
  | 'book_digital'
  | 'book_physical'
  | 'social_media'
  | 'cloud_folder'
  | 'pdf'
  | 'image'
  | 'document'
  | 'note'
  | 'other';

// ---------------------------------------------------------------------------
// Playbook root + Resources (renamed from Library)
// ---------------------------------------------------------------------------

export interface PlaybookRecord {
  id: string;
  user_id: string;
  interest_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PlaybookResourceRecord {
  id: string;
  playbook_id: string;
  user_id: string;
  title: string;
  url: string | null;
  resource_type: ResourceType;
  source_platform: string | null;
  author_or_creator: string | null;
  description: string | null;
  body_text: string | null;
  thumbnail_url: string | null;
  capability_goals: string[];
  tags: string[];
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreatePlaybookResourceInput {
  playbook_id: string;
  title: string;
  url?: string | null;
  resource_type?: ResourceType;
  source_platform?: string | null;
  author_or_creator?: string | null;
  description?: string | null;
  body_text?: string | null;
  thumbnail_url?: string | null;
  capability_goals?: string[];
  tags?: string[];
  sort_order?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdatePlaybookResourceInput {
  title?: string;
  url?: string | null;
  resource_type?: ResourceType;
  source_platform?: string | null;
  author_or_creator?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  capability_goals?: string[];
  tags?: string[];
  sort_order?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Concepts — three-tier inheritable wiki
// ---------------------------------------------------------------------------

export type ConceptOrigin = 'platform_baseline' | 'pathway_baseline' | 'personal' | 'forked';

export interface PlaybookConceptRecord {
  id: string;
  /** null for platform/pathway baseline rows */
  playbook_id: string | null;
  origin: ConceptOrigin;
  /** Self-FK: points at the baseline a forked row was cloned from */
  source_concept_id: string | null;
  interest_id: string;
  pathway_id: string | null;
  slug: string;
  title: string;
  body_md: string;
  updated_by: string | null;
  /** UUIDs of related concepts — bidirectional backlinks */
  related_concept_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface CreatePlaybookConceptInput {
  playbook_id: string | null;
  origin: ConceptOrigin;
  source_concept_id?: string | null;
  interest_id: string;
  pathway_id?: string | null;
  slug: string;
  title: string;
  body_md?: string;
}

export interface UpdatePlaybookConceptInput {
  title?: string;
  body_md?: string;
  slug?: string;
  related_concept_ids?: string[];
}

// ---------------------------------------------------------------------------
// Patterns — AI-detected correlations
// ---------------------------------------------------------------------------

export type PatternStatus = 'active' | 'pinned' | 'dismissed';

export interface PlaybookPatternRecord {
  id: string;
  playbook_id: string;
  user_id: string;
  title: string;
  body_md: string;
  /** Array of `{ type: 'step' | 'concept' | 'resource', id: string, note?: string }` */
  evidence: Record<string, unknown>[];
  status: PatternStatus;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Reviews — weekly compiled cards
// ---------------------------------------------------------------------------

export interface PlaybookReviewRecord {
  id: string;
  playbook_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  summary_md: string;
  focus_suggestion_md: string | null;
  updated_pages: Record<string, unknown>[];
  /** Health check results: contradictions, gaps, stale concepts */
  knowledge_health: {
    contradictions?: { concept_ids: string[]; description: string }[];
    gaps?: { topic: string; description: string }[];
    stale_concepts?: { concept_id: string; title: string; last_updated: string }[];
  } | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Q&A
// ---------------------------------------------------------------------------

export interface PlaybookQARecord {
  id: string;
  playbook_id: string;
  user_id: string;
  question: string;
  answer_md: string;
  sources: Record<string, unknown>[];
  pinned: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Suggestions queue — every AI write lands here first
// ---------------------------------------------------------------------------

export type SuggestionKind =
  | 'concept_update'
  | 'concept_create'
  | 'pattern_detected'
  | 'weekly_review'
  | 'focus_suggestion'
  | 'cross_interest_idea';

export type SuggestionStatus = 'pending' | 'accepted' | 'edited' | 'rejected';

export interface PlaybookSuggestionRecord {
  id: string;
  playbook_id: string;
  user_id: string;
  kind: SuggestionKind;
  /** Shape depends on `kind` — see acceptance handlers */
  payload: Record<string, unknown>;
  /** `{ source_step_ids?: string[], source_resource_ids?: string[], source_concept_ids?: string[], source_inbox_item_ids?: string[], model?: string }` */
  provenance: Record<string, unknown>;
  status: SuggestionStatus;
  created_at: string;
  resolved_at: string | null;
}

// ---------------------------------------------------------------------------
// Raw Inbox — captures awaiting on-demand ingest
// ---------------------------------------------------------------------------

export type InboxItemKind = 'file' | 'url' | 'photo' | 'voice' | 'text';
export type InboxItemStatus = 'pending' | 'ingesting' | 'ingested' | 'dismissed' | 'failed';

export interface PlaybookInboxItemRecord {
  id: string;
  playbook_id: string;
  user_id: string;
  kind: InboxItemKind;
  title: string | null;
  source_url: string | null;
  storage_path: string | null;
  raw_text: string | null;
  metadata: Record<string, unknown>;
  status: InboxItemStatus;
  ingested_at: string | null;
  created_resource_id: string | null;
  created_at: string;
}

export interface CreatePlaybookInboxItemInput {
  playbook_id: string;
  kind: InboxItemKind;
  title?: string | null;
  source_url?: string | null;
  storage_path?: string | null;
  raw_text?: string | null;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Shares — coach / teammate read-only access
// ---------------------------------------------------------------------------

export type ShareRole = 'view';
export type ShareInviteStatus = 'pending' | 'accepted' | 'revoked';

export interface PlaybookShareRecord {
  id: string;
  playbook_id: string;
  owner_user_id: string;
  shared_with_user_id: string | null;
  shared_with_email: string | null;
  role: ShareRole;
  invite_status: ShareInviteStatus;
  invited_at: string;
  accepted_at: string | null;
}

export interface CreatePlaybookShareInput {
  playbook_id: string;
  shared_with_email: string;
  shared_with_user_id?: string | null;
}

// ---------------------------------------------------------------------------
// Step ↔ Playbook links (typed join table)
// ---------------------------------------------------------------------------

export type StepPlaybookLinkType = 'resource' | 'concept' | 'past_learning' | 'qa';

export interface StepPlaybookLinkRecord {
  step_id: string;
  item_type: StepPlaybookLinkType;
  item_id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Shared metadata helpers (re-exported from Library shape — resource metadata
// structures are unchanged by the rename)
// ---------------------------------------------------------------------------

export interface CourseLesson {
  id: string;
  title: string;
  sort_order: number;
  url?: string;
  duration_minutes?: number;
  description?: string;
}

export interface CourseModule {
  id: string;
  title: string;
  sort_order: number;
  lessons: CourseLesson[];
}

export interface CourseStructure {
  modules: CourseModule[];
  total_lessons: number;
  estimated_hours?: number;
}

export interface CourseProgress {
  completed_lesson_ids: string[];
  last_completed_at?: string;
}

export interface CourseMetadata {
  course_structure?: CourseStructure;
  progress?: CourseProgress;
}

export function getCourseMetadata(resource: PlaybookResourceRecord): CourseMetadata {
  const meta = resource.metadata as CourseMetadata;
  return {
    course_structure: meta?.course_structure,
    progress: meta?.progress,
  };
}

export function getAllLessons(structure: CourseStructure): CourseLesson[] {
  return structure.modules
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((m) => m.lessons.sort((a, b) => a.sort_order - b.sort_order));
}

export function getCourseCompletionPercent(resource: PlaybookResourceRecord): number {
  const { course_structure, progress } = getCourseMetadata(resource);
  if (!course_structure || course_structure.total_lessons === 0) return 0;
  const completed = progress?.completed_lesson_ids?.length ?? 0;
  return Math.round((completed / course_structure.total_lessons) * 100);
}

export interface FileUploadMetadata {
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  public_url?: string;
}

export function getFileMetadata(resource: PlaybookResourceRecord): FileUploadMetadata | null {
  const meta = resource.metadata as { file_upload?: FileUploadMetadata };
  return meta?.file_upload ?? null;
}

export function isUploadedFile(resource: PlaybookResourceRecord): boolean {
  return getFileMetadata(resource) !== null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
