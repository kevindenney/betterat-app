/**
 * BlueprintFleetService — peer subscribers for a blueprint, projected for
 * the canonical Fleet view.
 *
 * Generalizes the Phase 10 HkdwFleetService into a blueprint-agnostic
 * data layer. Returns one row per subscriber (excluding the viewer) with
 * their current step number, status relative to the viewer (same-step /
 * ahead / behind), and a pre-rendered activity line.
 *
 * Data sources:
 *   - blueprint_steps (sort order + total)
 *   - blueprint_subscriptions (who's enrolled)
 *   - step_user_progress (each subscriber's per-step status)
 *   - profiles (display name + avatar)
 *
 * The brief calls for getBlueprintPeers({ blueprintId, filter, sort }):
 *   - filter: 'all' | 'same-step' | 'ahead' | 'behind'
 *   - sort:   'current-step-desc' | 'last-active-desc'
 * Both default sensibly so callers can pass only what they need.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { getBlueprintSubscribers } from '@/services/BlueprintService';

const logger = createLogger('BlueprintFleetService');

export type FleetPeerStatus = 'same-step' | 'ahead' | 'behind';
export type FleetFilter = 'all' | FleetPeerStatus;
export type FleetSort = 'current-step-desc' | 'last-active-desc';

export interface BlueprintFleetPeer {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  current_step_number: number | null;
  current_step_title: string | null;
  activity_line: string | null;
  total_steps: number;
  status: FleetPeerStatus;
  last_active_at: string | null;
}

export interface GetBlueprintPeersInput {
  blueprintId: string;
  viewerUserId: string;
  filter?: FleetFilter;
  sort?: FleetSort;
}

/**
 * Returns peers for a blueprint, optionally filtered + sorted.
 * Defaults to {filter: 'all', sort: 'current-step-desc'} per the
 * canonical's "fleet.peers({ blueprintId, sort: 'currentStep desc' })".
 */
export async function getBlueprintPeers(
  input: GetBlueprintPeersInput,
): Promise<BlueprintFleetPeer[]> {
  const { blueprintId, viewerUserId, filter = 'all', sort = 'current-step-desc' } = input;
  try {
    const rows = await loadAllPeers(blueprintId, viewerUserId);
    const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
    return sortPeers(filtered, sort);
  } catch (err) {
    logger.error('Failed to load blueprint peers', err);
    return [];
  }
}

async function loadAllPeers(
  blueprintId: string,
  viewerUserId: string,
): Promise<BlueprintFleetPeer[]> {
  // 1. Curated steps for sort order + total
  const { data: curatedRows } = await supabase
    .from('blueprint_steps')
    .select('step_id, sort_order')
    .eq('blueprint_id', blueprintId)
    .order('sort_order', { ascending: true });
  const stepOrder = new Map<string, number>(
    ((curatedRows as { step_id: string; sort_order: number }[] | null) ?? []).map(
      (r) => [r.step_id, r.sort_order + 1],
    ),
  );
  const totalSteps = stepOrder.size;

  // 2. Subscribers of the blueprint (excluding viewer)
  const subscribers = await getBlueprintSubscribers(blueprintId);
  const peerIds = subscribers
    .map((s) => s.subscriber_id)
    .filter((id) => id !== viewerUserId);
  if (peerIds.length === 0) return [];

  // 3. Per-user progress rows joined onto blueprint_steps
  const { data: progressRows } = await supabase
    .from('step_user_progress')
    .select(
      `
      user_id,
      status,
      updated_at,
      blueprint_step_id,
      blueprint_step:blueprint_steps!inner(
        blueprint_id,
        step:timeline_steps!step_id!inner(id, title)
      )
      `,
    )
    .eq('blueprint_step.blueprint_id', blueprintId)
    .in('user_id', peerIds);

  // 4. Viewer's current step (for status derivation)
  const { data: viewerProgress } = await supabase
    .from('step_user_progress')
    .select(
      'blueprint_step_id, status, updated_at, blueprint_step:blueprint_steps!inner(blueprint_id, step:timeline_steps!step_id!inner(id))',
    )
    .eq('blueprint_step.blueprint_id', blueprintId)
    .eq('user_id', viewerUserId);
  const viewerCurrentStepNumber = highestStep(
    (viewerProgress as
      | { blueprint_step: { step: { id: string } }; status: string }[]
      | null) ?? [],
    stepOrder,
  );

  // 5. Reduce per-user rows to "highest step seen" per peer.
  type PeerAgg = {
    currentStepNumber: number | null;
    currentStepTitle: string | null;
    currentStatus: string | null;
    lastActiveAt: string | null;
  };
  const peerAggs = new Map<string, PeerAgg>();
  for (const row of (progressRows as any[]) ?? []) {
    const peerId = row.user_id as string;
    const stepId = row.blueprint_step?.step?.id as string | undefined;
    if (!stepId) continue;
    const stepNumber = stepOrder.get(stepId) ?? null;
    if (stepNumber == null) continue;
    const title = (row.blueprint_step?.step?.title as string | undefined) ?? null;
    const updatedAt = row.updated_at as string | null;

    const agg = peerAggs.get(peerId) ?? {
      currentStepNumber: null,
      currentStepTitle: null,
      currentStatus: null,
      lastActiveAt: null,
    };

    if (agg.currentStepNumber == null || stepNumber >= agg.currentStepNumber) {
      agg.currentStepNumber = stepNumber;
      agg.currentStepTitle = title;
      agg.currentStatus = row.status;
    }
    if (!agg.lastActiveAt || (updatedAt && updatedAt > agg.lastActiveAt)) {
      agg.lastActiveAt = updatedAt;
    }
    peerAggs.set(peerId, agg);
  }

  const subMap = new Map(subscribers.map((s) => [s.subscriber_id, s]));

  return peerIds.map((peerId) => {
    const sub = subMap.get(peerId);
    const agg = peerAggs.get(peerId);
    const curNum = agg?.currentStepNumber ?? null;

    let status: FleetPeerStatus = 'same-step';
    if (viewerCurrentStepNumber != null && curNum != null) {
      if (curNum > viewerCurrentStepNumber) status = 'ahead';
      else if (curNum < viewerCurrentStepNumber) status = 'behind';
    }

    return {
      user_id: peerId,
      name: sub?.subscriber_name ?? null,
      avatar_url: sub?.subscriber_avatar_url ?? null,
      current_step_number: curNum,
      current_step_title: agg?.currentStepTitle ?? null,
      activity_line: renderActivityLine(
        agg?.currentStatus ?? null,
        agg?.lastActiveAt ?? null,
      ),
      total_steps: totalSteps,
      status,
      last_active_at: agg?.lastActiveAt ?? null,
    };
  });
}

function sortPeers(rows: BlueprintFleetPeer[], sort: FleetSort): BlueprintFleetPeer[] {
  if (sort === 'last-active-desc') {
    return [...rows].sort((a, b) => {
      const aT = a.last_active_at ? Date.parse(a.last_active_at) : 0;
      const bT = b.last_active_at ? Date.parse(b.last_active_at) : 0;
      return bT - aT;
    });
  }
  return [...rows].sort((a, b) => (b.current_step_number ?? 0) - (a.current_step_number ?? 0));
}

function highestStep(
  rows: { blueprint_step: { step: { id: string } }; status: string }[],
  stepOrder: Map<string, number>,
): number | null {
  let highest: number | null = null;
  for (const r of rows) {
    const id = r.blueprint_step?.step?.id;
    const n = id ? stepOrder.get(id) : undefined;
    if (n == null) continue;
    if (highest == null || n > highest) highest = n;
  }
  return highest;
}

function renderActivityLine(
  status: string | null,
  lastActiveAt: string | null,
): string | null {
  if (!status && !lastActiveAt) return null;
  if (status === 'reflecting') return 'reflecting now';
  if (status === 'settled') {
    if (!lastActiveAt) return 'finished';
    const days = daysSince(lastActiveAt);
    if (days === 0) return 'finished today';
    if (days === 1) return 'finished yesterday';
    if (days < 7) return `finished ${days} days ago`;
    return 'finished';
  }
  if (status === 'doing') return 'captured this week';
  if (status === 'planned') {
    if (!lastActiveAt) return 'planned';
    const days = daysSince(lastActiveAt);
    if (days < 1) return 'last active today';
    if (days === 1) return 'last active yesterday';
    return `last active ${days}d`;
  }
  return status ?? null;
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000)));
}
