/**
 * StepCollaboratorService — keeps the `step_collaborators` table in sync with
 * the platform collaborators stored on a step's plan metadata.
 *
 * Why a dedicated table? The metadata blob is fine for rendering chips inline,
 * but cross-step queries ("steps shared with me", "recent crew I've collaborated
 * with") need first-class rows. Phase 11 §11 introduced this table; this
 * service is the write-side. AddPeoplePicker already reads from it for the
 * "Recent crew" group.
 *
 * RLS notes (see migration): writes are restricted to `added_by = auth.uid()`,
 * reads are visible to both the collaborator and the adder. We only sync rows
 * the current user added — never reach across other people's writes.
 */

import { supabase } from '@/services/supabase';
import type { StepCollaborator } from '@/types/step-detail';

const TABLE_ROLES = new Set(['helm', 'crew', 'foredeck', 'coach', 'mentor']);

function normalizeRole(role: string | undefined): string {
  if (!role || !role.trim()) return 'collaborator';
  const lower = role.trim().toLowerCase();
  return TABLE_ROLES.has(lower) ? lower : 'other';
}

/**
 * Reconcile `step_collaborators` rows owned by `addedBy` for this step against
 * the desired list. Off-platform collaborators (no user_id) are ignored —
 * those stay in metadata only.
 */
export async function syncStepCollaborators(
  stepId: string,
  addedBy: string,
  next: StepCollaborator[],
): Promise<void> {
  const desired = next
    .filter((c) => c.type === 'platform' && c.user_id)
    .map((c) => ({
      step_id: stepId,
      user_id: c.user_id as string,
      role: normalizeRole(c.role),
      added_by: addedBy,
    }));

  const { data: currentRaw, error: readErr } = await supabase
    .from('step_collaborators')
    .select('id, user_id, role')
    .eq('step_id', stepId)
    .eq('added_by', addedBy);
  if (readErr) throw readErr;

  const current = (currentRaw ?? []) as { id: string; user_id: string; role: string }[];
  const desiredByUser = new Map(desired.map((d) => [d.user_id, d]));
  const currentByUser = new Map(current.map((r) => [r.user_id, r]));

  const idsToDelete = current
    .filter((r) => !desiredByUser.has(r.user_id))
    .map((r) => r.id);

  const toUpsert = desired.filter((d) => {
    const cur = currentByUser.get(d.user_id);
    return !cur || cur.role !== d.role;
  });

  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('step_collaborators')
      .delete()
      .in('id', idsToDelete);
    if (delErr) throw delErr;
  }

  if (toUpsert.length > 0) {
    const { error: upErr } = await supabase
      .from('step_collaborators')
      .upsert(toUpsert, { onConflict: 'step_id,user_id' });
    if (upErr) throw upErr;
  }
}
