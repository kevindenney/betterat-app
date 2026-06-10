/**
 * StepLocationService — keeps the `step_location` table in sync with the
 * `where_location` value stored on a step's plan metadata. Mirrors the
 * pattern used by StepCollaboratorService for collaborators.
 *
 * Why a dedicated table? Social-proof queries ("X sailors set steps here",
 * "popular venues nearby") need first-class rows and proper indexes; the
 * metadata blob is fine for rendering but not for aggregation. The Phase 11
 * §10/§11 design treats this table as the source of truth for cross-step
 * location data.
 *
 * RLS notes: writes are restricted to `set_by = auth.uid()`, but reads are
 * world-readable for any authenticated user (so we can surface the social
 * proof count).
 */

import { supabase } from '@/services/supabase';
import type { StepLocation } from '@/types/step-detail';

/**
 * Upsert (or remove) a `step_location` row for the given step.
 *
 * - If `location` is undefined / has no name, the row is deleted.
 * - Otherwise we upsert keyed by step_id and stamp `set_by = setBy`.
 *
 * Fire-and-forget — the metadata blob remains the source of truth for
 * rendering, so we never want to block a metadata write on this side write.
 */
export async function syncStepLocation(
  stepId: string,
  setBy: string,
  location: StepLocation | undefined,
): Promise<void> {
  const hasName = Boolean(location?.name?.trim());

  if (!hasName) {
    const { error: delErr } = await supabase
      .from('step_location')
      .delete()
      .eq('step_id', stepId)
      .eq('set_by', setBy);
    if (delErr) throw delErr;
    return;
  }

  const row: Record<string, unknown> = {
    step_id: stepId,
    set_by: setBy,
    name: location!.name,
    lat: location!.lat ?? null,
    lng: location!.lng ?? null,
  };

  // Key-presence semantics: location-change paths pass the key (a POI pick
  // sets it, a move to a non-POI place sets undefined → NULL clears the
  // stale snap target). Precision-only edits spread a stored blob that may
  // predate poi_id — no key, so a seeded DB value is left intact.
  if ('poi_id' in location!) {
    row.poi_id = location!.poi_id ?? null;
  }

  // Only write precision when the caller specified one — omitting it leaves
  // any prior choice intact (and a NULL column is treated as 'exact').
  if (location!.location_precision) {
    row.location_precision = location!.location_precision;
  }

  const { error: upErr } = await supabase
    .from('step_location')
    .upsert(row, { onConflict: 'step_id' });
  if (upErr) throw upErr;
}
