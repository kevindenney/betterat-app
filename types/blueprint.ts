/**
 * Blueprint Types
 *
 * A blueprint is a published, subscribable version of a user's timeline
 * for a specific interest. Subscribers receive living updates as the
 * blueprint author adds new steps.
 */

export type BlueprintAccessLevel = 'public' | 'org_members' | 'paid' | 'fleet';
export type BlueprintPricingType = 'one_time' | 'recurring';

export interface BlueprintRecord {
  id: string;
  user_id: string;
  interest_id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_published: boolean;
  subscriber_count: number;
  organization_id: string | null;
  program_id: string | null;
  fleet_id: string | null;
  access_level: BlueprintAccessLevel;
  price_cents: number | null;
  currency: string;
  pricing_type: BlueprintPricingType;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  migrated_from_interest_id: string | null;
  auto_curate: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBlueprintInput {
  user_id: string;
  interest_id: string;
  slug: string;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  is_published?: boolean;
  organization_id?: string | null;
  program_id?: string | null;
  fleet_id?: string | null;
  access_level?: BlueprintAccessLevel;
  price_cents?: number | null;
  currency?: string;
  pricing_type?: BlueprintPricingType;
}

export interface UpdateBlueprintInput {
  title?: string;
  description?: string | null;
  cover_image_url?: string | null;
  is_published?: boolean;
  slug?: string;
  interest_id?: string;
  access_level?: BlueprintAccessLevel;
  organization_id?: string | null;
  program_id?: string | null;
  price_cents?: number | null;
  currency?: string;
  pricing_type?: BlueprintPricingType;
  auto_curate?: boolean;
}

export interface BlueprintPurchaseRecord {
  id: string;
  blueprint_id: string;
  buyer_id: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_paid_cents: number;
  platform_fee_cents: number;
  currency: string;
  status: 'pending' | 'completed' | 'refunded';
  purchased_at: string;
}

export interface BlueprintSubscriptionRecord {
  id: string;
  blueprint_id: string;
  subscriber_id: string;
  subscribed_at: string;
  last_synced_at: string;
  auto_adopt: boolean;
  stripe_subscription_id: string | null;
  subscription_status: 'active' | 'past_due' | 'canceled' | 'unpaid';
}

export interface BlueprintStepActionRecord {
  id: string;
  subscription_id: string;
  source_step_id: string;
  action: 'adopted' | 'dismissed' | 'seen';
  acted_at: string;
  adopted_step_id: string | null;
}

/** Junction record linking a curated step to a blueprint */
export interface BlueprintStepRecord {
  id: string;
  blueprint_id: string;
  step_id: string;
  sort_order: number;
  added_at: string;
}

/** Blueprint with joined author profile info (for display) */
export interface BlueprintWithAuthor extends BlueprintRecord {
  author_name?: string;
  author_avatar_emoji?: string;
  author_avatar_color?: string;
  author_bio?: string;
  organization_name?: string;
  organization_slug?: string;
  program_name?: string;
}

/** A new step from a subscribed blueprint that hasn't been acted on */
export interface BlueprintNewStep {
  step_id: string;
  step_title: string;
  step_description: string | null;
  step_status: string;
  step_created_at: string;
  blueprint_id: string;
  blueprint_title: string;
  blueprint_slug: string;
  author_id: string;
  interest_id: string;
  author_name?: string;
  subscription_id: string;
}

/** Per-step progress for a subscriber (returned from RPC) */
export interface SubscriberStepProgress {
  source_step_id: string;
  adopted_step_id: string | null;
  action: 'adopted' | 'dismissed' | 'seen';
  status: string;
  overall_rating: number | null;
  has_evidence: boolean;
  step_title: string;
}

/** Per-subscriber progress summary (returned from RPC) */
export interface SubscriberProgress {
  subscriber_id: string;
  name: string;
  avatar_url: string | null;
  subscribed_at: string;
  steps: SubscriberStepProgress[];
  /** Computed client-side */
  adopted_count: number;
  completed_count: number;
  dismissed_count: number;
}

/** Suggested next step from a subscribed blueprint (returned from RPC) */
export interface BlueprintSuggestedNextStep {
  subscription_id: string;
  blueprint_id: string;
  blueprint_title: string;
  blueprint_slug: string;
  author_id: string;
  author_name: string | null;
  next_step_id: string;
  next_step_title: string;
  next_step_description: string | null;
  next_step_sort_order: number;
  total_steps: number;
  adopted_count: number;
  dismissed_count: number;
}

/** Subscribed blueprint with joined info for display on timeline */
export interface SubscribedBlueprintInfo {
  subscription_id: string;
  blueprint_id: string;
  blueprint_title: string;
  blueprint_slug: string;
  author_name: string | null;
  subscribed_at: string;
}

/** A single visible step from a peer subscriber's timeline */
export interface PeerTimelineStep {
  id: string;
  title: string;
  status: string;
  completed_at: string | null;
}

/** A peer subscriber's timeline summary for a given blueprint */
export interface PeerTimeline {
  blueprint_id: string;
  blueprint_title: string;
  subscriber_id: string;
  subscriber_name: string | null;
  subscriber_avatar_emoji: string | null;
  subscriber_avatar_color: string | null;
  steps: PeerTimelineStep[];
  completed_count: number;
  total_count: number;
}
