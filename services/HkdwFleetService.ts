/**
 * HkdwFleetService — Phase 10 Surface B (Worlds Fleet) data layer.
 *
 * Reads peer subscribers for a blueprint and projects each one into a
 * compact "current step + status + last-activity" row. Status is derived
 * relative to the viewer's own progress on the same blueprint.
 *
 * Lives in its own service file (not BlueprintService.ts) to keep the
 * Phase 10 surface area isolated from in-flight playbook work.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { getBlueprintSubscribers } from '@/services/BlueprintService';

const logger = createLogger('HkdwFleetService');

export interface BlueprintFleetPeer {
  /** Subscriber's auth.users.id. */
  user_id: string;
  /** Profile display name. */
  name: string | null;
  /** Profile avatar URL, if any. */
  avatar_url: string | null;
  /** The peer's current step number within the blueprint (1-based). */
  current_step_number: number | null;
  /** The peer's current step title. */
  current_step_title: string | null;
  /** "captured 2 sessions" / "reflecting now" / "last active 4d" — pre-rendered. */
  activity_line: string | null;
  /** Total steps in the blueprint. */
  total_steps: number;
  /** Where the peer sits relative to the viewer. */
  status: 'same-step' | 'ahead' | 'behind';
  /** Most-recent activity timestamp, used for ordering. */
  last_active_at: string | null;
}

export async function getBlueprintFleetPeers(
  blueprintId: string,
  viewerUserId: string,
): Promise<BlueprintFleetPeer[]> {
  try {
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
          step:timeline_steps!inner(id, title)
        )
        `,
      )
      .eq('blueprint_step.blueprint_id', blueprintId)
      .in('user_id', peerIds);

    // 4. Viewer's current step (for status derivation)
    const { data: viewerProgress } = await supabase
      .from('step_user_progress')
      .select(
        'blueprint_step_id, status, updated_at, blueprint_step:blueprint_steps!inner(blueprint_id, step:timeline_steps!inner(id))',
      )
      .eq('blueprint_step.blueprint_id', blueprintId)
      .eq('user_id', viewerUserId);
    const viewerCurrentStepNumber = viewerHighestStep(
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

      let status: BlueprintFleetPeer['status'] = 'same-step';
      if (viewerCurrentStepNumber != null && curNum != null) {
        if (curNum > viewerCurrentStepNumber) status = 'ahead';
        else if (curNum < viewerCurrentStepNumber) status = 'behind';
        else status = 'same-step';
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
  } catch (err) {
    logger.error('Failed to load fleet peers', err);
    return [];
  }
}

function viewerHighestStep(
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
