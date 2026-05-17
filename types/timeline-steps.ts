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
  title: string;
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
  title: string;
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
  due_at?: string | null;
  metadata?: Record<string, unknown>;
  is_timed?: boolean;
};

export type UpdateTimelineStepInput = Partial<
  Omit<CreateTimelineStepInput, 'user_id' | 'interest_id' | 'source_type' | 'source_id'>
>;

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
