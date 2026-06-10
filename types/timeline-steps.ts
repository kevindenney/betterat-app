// Re-export step metadata types for convenience
export type { StepMetadata, StepPlanData, StepActData, StepReviewData } from './step-detail';

export type TimelineStepSourceType =
  | 'manual'
  | 'template'
  | 'copied'
  | 'program_session'
  | 'blueprint'
  | 'user_fork'
  | 'suggestion';
export type TimelineStepStatus = 'pending' | 'in_progress' | 'completed' | 'settled' | 'skipped';
export type TimelineStepVisibility = 'private' | 'crew' | 'fleet' | 'public';

export type MapFeedScope = 'mine' | 'following' | 'crew' | 'fleet' | 'all';
export type MapFeedTimeWindow = 'now' | 'today' | 'week' | 'upcoming';

export type TimelineStepRecord = {
  id: string;
  user_id: string;
  interest_id: string;
  organization_id: string | null;
  program_session_id: string | null;
  source_type: TimelineStepSourceType;
  source_id: string | null;
  /** Nullable as of 20260528030937 — Atlas-draft steps land here with null
   *  until the user types a title on /step/[id]. Renderers must coalesce. */
  title: string | null;
  description: string | null;
  category: string;
  status: TimelineStepStatus;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_place_id: string | null;
  visibility: TimelineStepVisibility;
  share_approximate_location: boolean;
  copied_from_user_id: string | null;
  source_blueprint_id: string | null;
  /** Back-pointer to the canonical blueprint_steps join row. Null on
   *  older adopted rows (pre-fix) and on non-blueprint steps. */
  source_blueprint_step_id?: string | null;
  /** True on fleet-plan template rows owned by the plan author. These rows back
   *  the published plan but are hidden from the author's personal timeline so a
   *  personal-timeline delete can't cascade them out of the plan. Members adopt
   *  their own private copies instead. */
  is_plan_template?: boolean;
  /** Phase N.4 — true when this step is a race (gets Atlas course/marks/
   *  conditions). The only first-class step distinction; set in the composer. */
  is_race?: boolean;
  /** Arc/series link (20260609120000) — stamped by the race composer at
   *  creation; nullable on older and non-race rows. */
  season_id?: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  collaborator_user_ids: string[];
  completed_at: string | null;
  due_at: string | null;
  is_timed: boolean;
  share_token?: string | null;
  share_enabled?: boolean;
  public_shared_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateTimelineStepInput = {
  user_id: string;
  interest_id: string;
  organization_id?: string | null;
  program_session_id?: string | null;
  source_type?: TimelineStepSourceType;
  source_id?: string | null;
  /**
   * Step title. May be empty/null for drafts (e.g. atlas long-press
   * creates a step then expects the user to type a title on the
   * detail screen). DB constraint was relaxed in 20260528030937.
   */
  title?: string | null;
  description?: string | null;
  category?: string;
  status?: TimelineStepStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  location_name?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_place_id?: string | null;
  visibility?: TimelineStepVisibility;
  share_approximate_location?: boolean;
  sort_order?: number;
  due_at?: string | null;
  metadata?: Record<string, unknown>;
  is_timed?: boolean;
  /** Phase N.4 — mark this step a race. Drives the ⛵ Atlas pin + race cockpit. */
  is_race?: boolean;
  /**
   * Series link (Option A, ATLAS_RACE_SOURCE_OF_TRUTH_SPEC §6.1). References
   * seasons(id). Stamped on race steps from the active season so siblings
   * sharing (course_id | area_id, season_id) read as "N races in {Season}".
   */
  season_id?: string | null;
};

export type UpdateTimelineStepInput = Partial<
  Omit<CreateTimelineStepInput, 'user_id' | 'interest_id' | 'source_type' | 'source_id'>
> & {
  /**
   * Set by the L2/L3 drag-reorder gesture (Section D, Frame 13). The
   * client computes a new position by averaging neighbor sort_orders;
   * the service does no special handling — sort_order falls through
   * to the generic UPDATE payload.
   */
  sort_order?: number;
};

export type TimelineStepListFilters = {
  userId: string;
  interestId?: string | null;
  organizationId?: string | null;
  status?: TimelineStepStatus | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

export type MapFeedFilters = {
  viewerUserId: string;
  scope?: MapFeedScope;
  timeWindow?: MapFeedTimeWindow;
  interestId?: string | null;
  organizationId?: string | null;
  limit?: number;
};

export type TimelineStepMapPin = {
  pinId: string;
  stepId: string;
  ownerId: string;
  ownerDisplayName: string;
  ownerType: 'user' | 'coach' | 'organization';
  title: string;
  category: string;
  status: TimelineStepStatus;
  startsAt: string | null;
  endsAt: string | null;
  location: {
    name: string | null;
    lat: number;
    lng: number;
    isApproximate: boolean;
  };
  sourceType: TimelineStepSourceType;
  visibility: TimelineStepVisibility;
};
