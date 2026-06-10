/**
 * Community Knowledge Feed Types
 *
 * Types for the Reddit-style community knowledge feed system.
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type PostType = 'tip' | 'question' | 'report' | 'discussion' | 'safety_alert';

export type FeedSortType = 'hot' | 'new' | 'rising' | 'top' | 'conditions_match';

export type VenueRole = 'moderator' | 'race_officer' | 'coach' | 'contributor';

/** Audience a knowledge post is addressed to. Gates fail closed (RLS). */
export type KnowledgeScopeType = 'public' | 'private' | 'fleet' | 'org' | 'blueprint';

export type TidePhase = 'rising' | 'falling' | 'high' | 'low' | 'ebb' | 'flood';

export type TopPeriod = 'today' | 'week' | 'month' | 'all';

export const POST_TYPE_CONFIG: Record<PostType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  tip: { label: 'Tip', icon: 'bulb-outline', color: '#0D9488', bgColor: '#CCFBF1' },
  question: { label: 'Question', icon: 'help-circle-outline', color: '#EA580C', bgColor: '#FFEDD5' },
  report: { label: 'Report', icon: 'document-text-outline', color: '#059669', bgColor: '#D1FAE5' },
  discussion: { label: 'Discussion', icon: 'chatbubbles-outline', color: '#2563EB', bgColor: '#DBEAFE' },
  safety_alert: { label: 'Safety', icon: 'warning-outline', color: '#DC2626', bgColor: '#FEE2E2' },
};

// ============================================================================
// CORE TYPES
// ============================================================================

export interface FeedPost {
  id: string;
  venue_id: string;
  community_id?: string | null;
  author_id: string | null;
  title: string;
  body: string | null;
  post_type: PostType;
  category: string | null;
  /** Legacy — trigger-synced to (scope_type === 'public'). Prefer scope_type. */
  is_public: boolean;
  scope_type: KnowledgeScopeType;
  scope_id: string | null;
  racing_area_id: string | null;
  /** Generic place anchor (atlas_pois) — hospital, haat, market, course… */
  poi_id?: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  view_count: number;
  pinned: boolean;
  is_resolved: boolean;
  accepted_answer_id: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  // Joined fields
  author?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  racing_area?: {
    id: string;
    area_name: string;
  };
  poi?: {
    id: string;
    name: string;
    kind: string;
  } | null;
  venue?: {
    id: string;
    name: string;
    country?: string;
    region?: string;
  };
  community?: {
    id: string;
    name: string;
    slug: string;
    community_type: string;
  };
  catalog_race_id?: string | null;
  catalog_race?: {
    id: string;
    name: string;
    short_name: string | null;
    slug: string;
  } | null;
  topic_tags?: TopicTag[];
  condition_tags?: ConditionTag[];
  user_vote?: number | null;
  // Computed fields
  hot_score?: number;
  condition_match_score?: number;
  author_venue_stats?: AuthorVenueStats;
}

export interface ConditionTag {
  id: string;
  discussion_id: string;
  wind_direction_min: number | null;
  wind_direction_max: number | null;
  wind_speed_min: number | null;
  wind_speed_max: number | null;
  tide_phase: TidePhase | null;
  wave_height_min: number | null;
  wave_height_max: number | null;
  current_speed_min: number | null;
  current_speed_max: number | null;
  season: string | null;
  time_of_day: string | null;
  label: string | null;
}

export interface TopicTag {
  id: string;
  name: string;
  display_name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

export interface ThreadedComment {
  id: string;
  discussion_id: string;
  parent_id: string | null;
  author_id: string | null;
  body: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
  depth: number;
  author?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  user_vote?: number | null;
  replies?: ThreadedComment[];
}

export interface AuthorVenueStats {
  race_count: number;
  avg_finish: number | null;
  best_finish: number | null;
}

export interface CurrentConditions {
  windSpeed: number | null;
  windDirection: number | null;
  windGusts?: number | null;
  waveHeight?: number | null;
  currentSpeed?: number | null;
  tidalState?: TidePhase | null;
  season?: string;
}

export interface MembershipStatus {
  isMember: boolean;
  isModerator: boolean;
  roles: VenueRole[];
}

// ============================================================================
// PARAMS
// ============================================================================

export interface CreatePostParams {
  venue_id?: string;      // Optional - for location-tagged posts
  community_id?: string;  // Optional - for community posts
  // Note: At least one of venue_id or community_id must be provided
  title: string;
  body?: string;
  post_type: PostType;
  category?: string;
  scope_type?: KnowledgeScopeType;
  scope_id?: string;
  racing_area_id?: string;
  poi_id?: string;
  location_lat?: number;
  location_lng?: number;
  location_label?: string;
  topic_tag_ids?: string[];
  condition_tags?: Omit<ConditionTag, 'id' | 'discussion_id'>[];
  catalog_race_id?: string;
}

export interface UpdatePostParams {
  title?: string;
  body?: string;
  post_type?: PostType;
  category?: string;
  is_resolved?: boolean;
  accepted_answer_id?: string;
}

export interface FeedQueryParams {
  venueId: string;
  sort?: FeedSortType;
  postType?: PostType;
  tagIds?: string[];
  racingAreaId?: string | null;
  topPeriod?: TopPeriod;
  currentConditions?: CurrentConditions;
  catalogRaceId?: string;
  scopeType?: KnowledgeScopeType;
  scopeId?: string;
  page?: number;
  limit?: number;
}

/**
 * The one place a knowledge post anchors to: a sailing racing area
 * (venue_racing_areas) or any Atlas POI (atlas_pois — hospital, haat,
 * market, course…). DB CHECK enforces at most one.
 */
export type KnowledgeAnchor =
  | { racingAreaId: string; poiId?: undefined }
  | { poiId: string; racingAreaId?: undefined };

export interface AreaKnowledgeSummary {
  posts: FeedPost[];
  /** Visible-post counts per audience scope (RLS already applied). */
  countsByScope: Partial<Record<KnowledgeScopeType, number>>;
  totalVisible: number;
}

/** One place bucket of a group's (fleet/org/blueprint) knowledge posts. */
export interface GroupKnowledgePlace {
  /** Exactly one of these is set; both null for venue-wide notes. */
  racingAreaId: string | null;
  poiId: string | null;
  placeName: string | null;
  /** atlas_pois.kind for POI buckets, 'racing_area' for areas, null venue-wide. */
  placeKind: string | null;
  posts: FeedPost[];
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
