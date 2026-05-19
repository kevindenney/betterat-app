import { supabase } from './supabase';
import type { EvidenceStrength } from '@/components/step/reflect-tab/CapabilitiesPracticed';

export type CapabilityLevel =
  | 'emerging'
  | 'developing'
  | 'competent'
  | 'fluent'
  | 'expert';

export interface CapabilityEvidenceTrailEntry {
  id: string;
  stepId: string;
  stepTitle: string;
  capturedAt: string;
  strength: EvidenceStrength;
  evidenceCount: number;
  pipLevel: number;
  pathName: string | null;
}

export interface CapabilityMapEntry {
  id: string;
  name: string;
  level: CapabilityLevel;
  levelIndex: 0 | 1 | 2 | 3 | 4;
  pipsOn: number;
  pipsTotal: 5;
  evidenceCount: number;
  evidenceStepCount: number;
  isFresh: boolean;
  isJustEarned: boolean;
  latestEvidenceAt: string | null;
  recentEvidence: CapabilityEvidenceTrailEntry[];
}

interface TimelineStepLite {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface CapabilityEvidenceRowRecord {
  id: string;
  step_id: string;
  capability_id: string;
  capability_name: string;
  strength: EvidenceStrength;
  pip_level: number;
  evidence_count: number;
  created_at: string;
}

const PIPS_TOTAL = 5 as const;
const JUST_EARNED_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function getCapabilityMap(
  userId: string,
  interestId: string,
): Promise<CapabilityMapEntry[]> {
  const stepMap = await getInterestSteps(userId, interestId);
  const stepIds = Array.from(stepMap.keys());
  if (stepIds.length === 0) return [];

  const { data, error } = await supabase
    .from('step_capability_evidence')
    .select(
      'id, step_id, capability_id, capability_name, strength, pip_level, evidence_count, created_at',
    )
    .eq('confirmed', true)
    .in('step_id', stepIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const grouped = new Map<
    string,
    {
      name: string;
      rows: CapabilityEvidenceTrailEntry[];
      stepIds: Set<string>;
      latestEvidenceAt: string | null;
      pipTotal: number;
    }
  >();

  for (const row of (data ?? []) as CapabilityEvidenceRowRecord[]) {
    const step = stepMap.get(row.step_id);
    if (!step) continue;
    const existing = grouped.get(row.capability_id) ?? {
      name: row.capability_name || row.capability_id,
      rows: [],
      stepIds: new Set<string>(),
      latestEvidenceAt: null,
      pipTotal: 0,
    };

    const capturedAt = row.created_at ?? step.completed_at ?? step.updated_at;
    existing.rows.push({
      id: row.id,
      stepId: row.step_id,
      stepTitle: step.title || 'Untitled step',
      capturedAt,
      strength: row.strength,
      evidenceCount: row.evidence_count,
      pipLevel: row.pip_level,
      pathName: null,
    });
    existing.stepIds.add(row.step_id);
    existing.pipTotal += row.pip_level;
    if (!existing.latestEvidenceAt || capturedAt > existing.latestEvidenceAt) {
      existing.latestEvidenceAt = capturedAt;
    }
    grouped.set(row.capability_id, existing);
  }

  const now = Date.now();
  return Array.from(grouped.entries())
    .map(([id, group]) => {
      const evidenceRows = group.rows.length;
      const levelIndex = levelIndexForEvidenceRows(evidenceRows);
      const latestAt = group.latestEvidenceAt;
      const latestMs = latestAt ? new Date(latestAt).getTime() : 0;
      return {
        id,
        name: group.name,
        level: levelLabelForIndex(levelIndex),
        levelIndex,
        pipsOn: Math.max(
          1,
          Math.min(PIPS_TOTAL, Math.round(group.pipTotal / Math.max(1, evidenceRows))),
        ),
        pipsTotal: PIPS_TOTAL,
        evidenceCount: evidenceRows,
        evidenceStepCount: group.stepIds.size,
        isFresh: latestMs > 0 && now - latestMs <= JUST_EARNED_WINDOW_MS,
        isJustEarned: latestMs > 0 && now - latestMs <= JUST_EARNED_WINDOW_MS,
        latestEvidenceAt: latestAt,
        recentEvidence: group.rows
          .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
          .slice(0, 4),
      };
    })
    .sort((a, b) => {
      const aTime = a.latestEvidenceAt ?? '';
      const bTime = b.latestEvidenceAt ?? '';
      return bTime.localeCompare(aTime) || b.evidenceCount - a.evidenceCount;
    });
}

async function getInterestSteps(userId: string, interestId: string) {
  const { data, error } = await supabase
    .from('timeline_steps')
    .select('id, title, created_at, updated_at, completed_at')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return new Map(
    ((data ?? []) as TimelineStepLite[]).map((step) => [step.id, step]),
  );
}

export function levelIndexForEvidenceRows(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count >= 25) return 4;
  if (count >= 13) return 3;
  if (count >= 7) return 2;
  if (count >= 3) return 1;
  return 0;
}

export function levelLabelForIndex(levelIndex: 0 | 1 | 2 | 3 | 4): CapabilityLevel {
  if (levelIndex === 4) return 'expert';
  if (levelIndex === 3) return 'fluent';
  if (levelIndex === 2) return 'competent';
  if (levelIndex === 1) return 'developing';
  return 'emerging';
}
