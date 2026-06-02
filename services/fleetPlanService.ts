/**
 * Fleet plans
 *
 * A fleet captain authors a curated, ordered plan of steps for the fleet — the
 * races AND the prep steps between them (practice, measurement, rigging, fleet
 * training, dinner). A plan is a fleet-scoped `timeline_blueprint`
 * (access_level='fleet', fleet_id set). Members browse it and SELECTIVELY adopt
 * individual steps into their own timeline (the plan is a menu, not a calendar —
 * never bulk-adopt; order is the captain's sort_order, not date).
 *
 * This service composes the existing blueprint + timeline-step primitives so
 * the subscribe / discussion / suggestion machinery all work unchanged.
 */
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { BlueprintRecord } from '@/types/blueprint';
import {
  createBlueprint,
  getSubscription,
  markStepAction,
  subscribe,
  unsubscribe,
} from './BlueprintService';
import { adoptStep, updateStep } from './TimelineStepService';

const logger = createLogger('fleetPlanService');

export const PLAN_ITEM_KINDS = [
  'race',
  'practice',
  'training',
  'event',
  'dinner',
  'other',
] as const;
export type PlanItemKind = (typeof PLAN_ITEM_KINDS)[number];

export const PLAN_ITEM_KIND_LABELS: Record<PlanItemKind, string> = {
  race: 'Race',
  practice: 'Practice',
  training: 'Fleet training',
  event: 'Event',
  dinner: 'Dinner',
  other: 'Other',
};

export interface FleetPlanSummary {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_published: boolean;
  author_id: string;
  author_name: string | null;
  interest_id: string;
  step_count: number;
  subscriber_count: number;
  viewer_subscribed: boolean;
  viewer_is_author: boolean;
  created_at: string;
  updated_at: string;
}

export interface FleetPlanStep {
  step_id: string;
  title: string | null;
  description: string | null;
  category: string;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  sort_order: number;
  viewer_adopted: boolean;
}

function slugifyPlan(title: string, fleetId: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = `${fleetId.slice(0, 6)}${Date.now().toString(36).slice(-4)}`;
  return `${base || 'fleet-plan'}-${suffix}`;
}

export async function createFleetPlan(params: {
  captainId: string;
  fleetId: string;
  interestId: string;
  title: string;
  description?: string | null;
}): Promise<BlueprintRecord> {
  const { captainId, fleetId, interestId, title, description } = params;
  return createBlueprint({
    user_id: captainId,
    interest_id: interestId,
    slug: slugifyPlan(title, fleetId),
    title: title.trim(),
    description: description?.trim() || null,
    fleet_id: fleetId,
    access_level: 'fleet',
    is_published: false,
  });
}

export async function addPlanItem(params: {
  blueprintId: string;
  kind: PlanItemKind;
  title: string;
  details?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  locationName?: string | null;
}): Promise<string> {
  const { blueprintId, kind, title, details, startsAt, endsAt, locationName } = params;
  // Co-edit: route through a SECURITY DEFINER RPC so ANY of the fleet's captains
  // (owner/captain/coach) can add a step, not just the plan author. The RPC
  // authors the step in the plan OWNER's timeline ('fleet' visibility) so member
  // suggestions/adoption keep working (they filter ts.user_id = bp.user_id), then
  // links it into blueprint_steps.
  const { data, error } = await supabase.rpc('fleet_plan_add_step', {
    p_blueprint_id: blueprintId,
    p_kind: kind,
    p_title: title.trim(),
    p_details: details?.trim() || null,
    p_starts_at: startsAt ?? null,
    p_ends_at: endsAt ?? null,
    p_location_name: locationName?.trim() || null,
  });
  if (error) {
    logger.error('Failed to add fleet plan step', error);
    throw error;
  }
  return data as string;
}

export async function updatePlanItem(
  stepId: string,
  updates: {
    kind?: PlanItemKind;
    title?: string;
    details?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    locationName?: string | null;
  },
): Promise<void> {
  await updateStep(stepId, {
    ...(updates.kind !== undefined ? { category: updates.kind } : {}),
    ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
    ...(updates.details !== undefined ? { description: updates.details?.trim() || null } : {}),
    ...(updates.startsAt !== undefined ? { starts_at: updates.startsAt } : {}),
    ...(updates.endsAt !== undefined ? { ends_at: updates.endsAt } : {}),
    ...(updates.locationName !== undefined
      ? { location_name: updates.locationName?.trim() || null }
      : {}),
  });
}

export async function removePlanItem(blueprintId: string, stepId: string): Promise<void> {
  // Co-edit RPC: unlinks the step and deletes the underlying owner-authored step
  // (gated on captain-role membership server-side).
  const { error } = await supabase.rpc('fleet_plan_remove_step', {
    p_blueprint_id: blueprintId,
    p_step_id: stepId,
  });
  if (error) {
    logger.error('Failed to remove fleet plan step', error);
    throw error;
  }
}

export async function reorderPlanItems(blueprintId: string, orderedStepIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('fleet_plan_reorder_steps', {
    p_blueprint_id: blueprintId,
    p_step_ids: orderedStepIds,
  });
  if (error) {
    logger.error('Failed to reorder fleet plan steps', error);
    throw error;
  }
}

export async function publishFleetPlan(blueprintId: string): Promise<void> {
  const { error } = await supabase.rpc('fleet_plan_set_published', {
    p_blueprint_id: blueprintId,
    p_published: true,
  });
  if (error) {
    logger.error('Failed to publish fleet plan', error);
    throw error;
  }
}

export async function unpublishFleetPlan(blueprintId: string): Promise<void> {
  const { error } = await supabase.rpc('fleet_plan_set_published', {
    p_blueprint_id: blueprintId,
    p_published: false,
  });
  if (error) {
    logger.error('Failed to unpublish fleet plan', error);
    throw error;
  }
}

export async function getFleetPlans(fleetId: string): Promise<FleetPlanSummary[]> {
  const { data, error } = await supabase.rpc('get_fleet_plans', { p_fleet_id: fleetId });
  if (error) {
    logger.error('Failed to load fleet plans', error);
    throw error;
  }
  return (data as FleetPlanSummary[]) ?? [];
}

export async function getFleetPlanSteps(blueprintId: string): Promise<FleetPlanStep[]> {
  const { data, error } = await supabase.rpc('get_fleet_plan_steps', {
    p_blueprint_id: blueprintId,
  });
  if (error) {
    logger.error('Failed to load fleet plan steps', error);
    throw error;
  }
  return (data as FleetPlanStep[]) ?? [];
}

// ---- Member side ----------------------------------------------------------

/**
 * Subscribe to a fleet plan. This enables the discussion + suggestion machinery
 * and auto-follows the captain so the plan's steps become adoptable. It does
 * NOT bulk-adopt the season — members pull individual steps themselves (the
 * plan is a menu, not a calendar; see feedback_plan_is_menu_not_calendar).
 */
export async function subscribeToFleetPlan(subscriberId: string, blueprintId: string): Promise<void> {
  await subscribe(subscriberId, blueprintId);
}

export async function unsubscribeFromFleetPlan(
  subscriberId: string,
  blueprintId: string,
): Promise<void> {
  await unsubscribe(subscriberId, blueprintId);
}

export async function isSubscribedToFleetPlan(
  subscriberId: string,
  blueprintId: string,
): Promise<boolean> {
  const sub = await getSubscription(subscriberId, blueprintId);
  return sub !== null;
}

/**
 * Adopt ONE plan step into the member's own timeline. Selective by design —
 * never call this in a loop over a whole plan. Records the adopt action so the
 * step stops being re-suggested.
 */
export async function adoptPlanStep(params: {
  subscriberId: string;
  blueprintId: string;
  sourceStepId: string;
  interestId: string;
}): Promise<void> {
  const { subscriberId, blueprintId, sourceStepId, interestId } = params;
  const adopted = await adoptStep(subscriberId, sourceStepId, interestId, blueprintId);
  const sub = await getSubscription(subscriberId, blueprintId);
  if (sub) {
    await markStepAction(sub.id, sourceStepId, 'adopted', adopted.id);
  }
}
