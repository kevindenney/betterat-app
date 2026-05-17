import { supabase } from './supabase';
import { logger } from '@/lib/logger';
import type { StepActData, StepPlanData, StepReviewData } from '@/types/step-detail';
import type {
  CapabilityEvidenceRow,
  EvidenceStrength,
} from '@/components/step/reflect-tab/CapabilitiesPracticed';

interface BuildEvidenceRowsInput {
  plan: StepPlanData;
  act: StepActData;
  review: StepReviewData;
}

export function buildCapabilityEvidenceRows({
  plan,
  act,
  review,
}: BuildEvidenceRowsInput): CapabilityEvidenceRow[] {
  const evidenceCount =
    (act.observations?.length ?? 0) +
    (act.media_uploads?.length ?? 0) +
    (act.media_links?.length ?? 0);
  const rows = new Map<string, CapabilityEvidenceRow>();

  const addRow = (id: string, name: string, strength: EvidenceStrength = 'material') => {
    const key = id.trim();
    if (!key || rows.has(key)) return;
    rows.set(key, {
      capabilityId: key,
      capabilityName: name.trim() || key,
      confirmed: true,
      strength,
      pipLevel: strength === 'strong' ? 5 : strength === 'material' ? 3 : 2,
      evidenceCount,
    });
  };

  for (const id of plan.competency_ids ?? []) addRow(id, id, 'material');
  for (const goal of plan.capability_goals ?? []) addRow(goal, goal, 'worth-noting');

  const assessment = review.competency_assessment;
  for (const item of assessment?.planned_competency_results ?? []) {
    addRow(
      item.competency_id ?? item.competency_title,
      item.competency_title,
      item.demonstrated_level === 'proficient' ? 'strong' : 'material',
    );
  }
  for (const item of assessment?.additional_competencies_found ?? []) {
    addRow(
      item.competency_id ?? item.competency_title,
      item.competency_title,
      item.demonstrated_level === 'proficient' ? 'strong' : 'worth-noting',
    );
  }

  return Array.from(rows.values());
}

export async function writeStepCapabilityEvidence({
  stepId,
  rows,
}: {
  stepId: string;
  rows: CapabilityEvidenceRow[];
}) {
  const confirmed = rows.filter((row) => row.confirmed);
  if (confirmed.length === 0) return;

  const payload = confirmed.map((row) => ({
    step_id: stepId,
    capability_id: row.capabilityId,
    capability_name: row.capabilityName,
    confirmed: row.confirmed,
    strength: row.strength,
    pip_level: row.pipLevel,
    evidence_count: row.evidenceCount,
    evidence_capture_ids: [],
  }));

  const { error } = await supabase
    .from('step_capability_evidence')
    .upsert(payload, { onConflict: 'step_id,capability_id' });

  if (error) {
    logger.error('Failed to write step capability evidence', error);
    throw error;
  }
}
