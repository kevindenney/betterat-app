import { supabase } from './supabase';
import { logger } from '@/lib/logger';
import { suggestCapabilityTags } from '@/services/CapabilityTagService';
import type { StepActData, StepPlanData, StepReviewData } from '@/types/step-detail';
import type { TimelineStepRecord } from '@/types/timeline-steps';
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

function captureSnippets(act: StepActData): string[] {
  return [
    ...(act.observations ?? []).map((row) => row.text),
    ...(act.media_uploads ?? []).map((row) => row.caption),
    ...(act.media_links ?? []).map((row) => row.caption),
  ]
    .map((text) => text?.trim())
    .filter((text): text is string => Boolean(text))
    .slice(0, 4);
}

function reviewText(review: StepReviewData): string {
  const legacy = review as StepReviewData & {
    what_worked?: string;
    what_didnt?: string;
  };
  return [
    ...(review.sections ?? []).map((section) => section.content),
    legacy.what_worked,
    legacy.what_didnt,
    review.what_learned,
    review.deviation_reason,
    review.next_step_notes,
    review.key_takeaway,
    review.teaching_reflection,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join('\n');
}

function mergeCapabilityRows(
  base: CapabilityEvidenceRow[],
  incoming: CapabilityEvidenceRow[],
): CapabilityEvidenceRow[] {
  const present = new Set(base.map((row) => row.capabilityName.trim().toLowerCase()));
  const merged = [...base];
  for (const row of incoming) {
    const key = row.capabilityName.trim().toLowerCase();
    if (present.has(key)) continue;
    present.add(key);
    merged.push(row);
  }
  return merged;
}

export async function autoTagAndWriteStepCapabilityEvidence({
  step,
  baseRows,
  canUseAI = true,
}: {
  step: TimelineStepRecord;
  baseRows?: CapabilityEvidenceRow[];
  /**
   * When false (free user over their monthly AI allowance), skip the model call
   * and write only the deterministic base rows — never block step completion on
   * a metered feature.
   */
  canUseAI?: boolean;
}): Promise<CapabilityEvidenceRow[]> {
  const metadata = (step.metadata ?? {}) as {
    plan?: StepPlanData;
    act?: StepActData;
    review?: StepReviewData;
  };
  const plan = metadata.plan ?? {};
  const act = metadata.act ?? {};
  const review = metadata.review ?? {};
  const base = baseRows ?? buildCapabilityEvidenceRows({ plan, act, review });
  const autoTagBase = base.map((row) =>
    row.source === 'ai' ? { ...row, confirmed: true } : row,
  );
  const captures = captureSnippets(act);
  const reflection = reviewText(review);
  const suggestions = canUseAI
    ? await suggestCapabilityTags({
        interestId: step.interest_id,
        captures,
        reflection,
        existingNames: autoTagBase.map((row) => row.capabilityName),
        capturesCount:
          (act.observations?.length ?? 0) +
          (act.media_uploads?.length ?? 0) +
          (act.media_links?.length ?? 0),
      })
    : [];
  const rows = mergeCapabilityRows(
    autoTagBase,
    suggestions.map((row) => ({ ...row, confirmed: true })),
  );
  await writeStepCapabilityEvidence({
    stepId: step.id,
    rows,
    provenance: buildEvidenceProvenance(step),
  });
  return rows;
}

/** "From “Two-boat testing” · May 2026" — provenance shown under a public
 *  capability quote. Same for every row written from one step. */
function buildEvidenceProvenance(step: TimelineStepRecord): string {
  const iso = step.completed_at ?? step.starts_at ?? null;
  const when = iso ? Date.parse(iso) : Date.now();
  const monYear = new Date(Number.isFinite(when) ? when : Date.now()).toLocaleDateString(
    'en-US',
    { month: 'short', year: 'numeric' },
  );
  const title = (step.title ?? '').trim();
  return title ? `From “${title}” · ${monYear}` : `From a practice session · ${monYear}`;
}

export interface NewlySettledCapability {
  name: string;
  evidenceCount: number;
}

/**
 * Capabilities that crossed into "settled" (confirmed + strong) for the first
 * time across the owner's timeline as a result of completing this step. Drives
 * the Trophy-of-Becoming moment. Returns [] on any error — a missing trophy is
 * never worth blocking step completion.
 */
export async function detectNewlySettledCapabilities(
  stepId: string,
): Promise<NewlySettledCapability[]> {
  const { data, error } = await supabase.rpc('newly_settled_capabilities', {
    p_step_id: stepId,
  });
  if (error) {
    logger.warn('newly_settled_capabilities failed', error);
    return [];
  }
  return (data ?? []).map((row: { capability_name: string; evidence_count: number }) => ({
    name: row.capability_name,
    evidenceCount: row.evidence_count ?? 0,
  }));
}

export async function writeStepCapabilityEvidence({
  stepId,
  rows,
  provenance,
}: {
  stepId: string;
  rows: CapabilityEvidenceRow[];
  /** Provenance label stored alongside any row that carries a quote. */
  provenance?: string;
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
    evidence_quote: row.evidenceQuote ?? null,
    evidence_provenance: row.evidenceQuote ? (provenance ?? null) : null,
  }));

  const { error } = await supabase
    .from('step_capability_evidence')
    .upsert(payload, { onConflict: 'step_id,capability_id' });

  if (error) {
    logger.error('Failed to write step capability evidence', error);
    throw error;
  }
}
