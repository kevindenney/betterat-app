/**
 * useLogClinicalShift — the N2 keystone write path for the nursing Atlas.
 *
 * A student logs a COMPLETED clinical shift at a real site. This is the only
 * action that produces *located* clinical evidence:
 *   1. inserts a `clinical_shifts` row (the site/unit/time record),
 *   2. inserts one `betterat_competency_attempts` row per competency practiced,
 *      tagged `event_type='clinical_shift', event_id=<shift.id>` so each attempt
 *      is locatable to the shift's site POI — this is what finally fills the
 *      Sites coverage bars and the N3 by-site view,
 *   3. best-effort: drops a located `timeline_step` + `step_location` at the
 *      site (cohort audience, site precision, healthcare flag) so the shift
 *      shows on the Map segment and Nearby — without leaking a precise dot.
 *
 * Privacy: free-text reflection is lint-blocked for PHI (room/bed/MRN/DOB/
 * patient initials) before any write. Located steps are forced to site-level
 * precision + cohort audience; there is no "exact" option for a healthcare site.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { createStep, resolveInterestId } from '@/services/TimelineStepService';
import { logger } from '@/lib/logger';
import { NURSING_SITE_COVERAGE_KEY } from '@/hooks/useNursingSiteCoverage';
import { NURSING_COMPETENCY_COVERAGE_KEY } from '@/hooks/useNursingCompetencyCoverage';

export type ShiftSelfRating = 'confident' | 'proficient' | 'developing' | 'needs_practice';

export interface LogShiftInput {
  /** Real atlas_poi id for the site. Null only if logging an unmapped site. */
  sitePoiId: string | null;
  siteName: string;
  lat?: number | null;
  lng?: number | null;
  /** Human shift label, e.g. "4 South · Cardiac telemetry · Day". */
  shiftLabel: string;
  unit?: string | null;
  specialty?: string | null;
  /** ISO timestamps. Defaults applied by the caller. */
  shiftStart: string;
  shiftEnd?: string | null;
  cohortId?: string | null;
  orgId?: string | null;
  /** Competencies practiced this shift (framework ids). */
  competencyIds: string[];
  /** Self-rating applied to every competency logged this shift. */
  selfRating: ShiftSelfRating;
  /** Optional free-text reflection — lint-checked for PHI before write. */
  reflection?: string | null;
}

export interface LogShiftResult {
  shiftId: string;
  competenciesLogged: number;
}

/**
 * Block protected health information in free-text. Returns a human message for
 * the first violation, or null when the text is clean. Site-level only — a
 * nursing student should never type room/bed/MRN/DOB/patient identifiers.
 */
export function lintHealthcareText(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  const checks: { re: RegExp; msg: string }[] = [
    { re: /\b(room|rm|bed|bay)\s*#?\s*\d+/i, msg: 'Remove room/bed numbers — log at site level only.' },
    { re: /\bmrn\b|\bmedical record\b/i, msg: 'Remove the MRN — no patient identifiers.' },
    { re: /\bdob\b|\bdate of birth\b/i, msg: 'Remove date of birth — no patient identifiers.' },
    { re: /\bpatient'?s?\s+initials?\b|\binitials?\s+(?:are|were|:)/i, msg: 'Remove patient initials — no patient identifiers.' },
    { re: /\b\d{6,}\b/, msg: 'Remove the long ID number — no record/account numbers.' },
  ];
  for (const c of checks) {
    if (c.re.test(text)) return c.msg;
  }
  return null;
}

export function useLogClinicalShift() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<LogShiftResult, Error, LogShiftInput>({
    mutationFn: async (input): Promise<LogShiftResult> => {
      if (!user?.id) throw new Error('You must be signed in to log a shift.');
      if (input.competencyIds.length === 0) {
        throw new Error('Pick at least one competency you practiced.');
      }

      const phi = lintHealthcareText(input.reflection);
      if (phi) throw new Error(phi);

      // 1. The shift record.
      const { data: shift, error: shiftErr } = await supabase
        .from('clinical_shifts')
        .insert({
          student_id: user.id,
          org_id: input.orgId ?? null,
          site_poi_id: input.sitePoiId,
          cohort_id: input.cohortId ?? null,
          shift_label: input.shiftLabel,
          unit: input.unit ?? null,
          specialty: input.specialty ?? null,
          shift_start: input.shiftStart,
          shift_end: input.shiftEnd ?? null,
        })
        .select('id')
        .single();
      if (shiftErr || !shift) {
        throw new Error(shiftErr?.message ?? 'Could not save the shift.');
      }
      const shiftId = (shift as { id: string }).id;

      // 2. Located competency attempts. attempt_number is per (user, competency)
      // — read current counts so we increment rather than collide.
      const { data: priorRows } = await supabase
        .from('betterat_competency_attempts')
        .select('competency_id')
        .eq('user_id', user.id)
        .in('competency_id', input.competencyIds);
      const priorCount = new Map<string, number>();
      for (const r of (priorRows ?? []) as { competency_id: string }[]) {
        priorCount.set(r.competency_id, (priorCount.get(r.competency_id) ?? 0) + 1);
      }

      const clinicalContext = [input.siteName, input.unit].filter(Boolean).join(' · ') || input.siteName;
      const attemptRows = input.competencyIds.map((competency_id) => ({
        user_id: user.id,
        competency_id,
        attempt_number: (priorCount.get(competency_id) ?? 0) + 1,
        status: 'unvalidated',
        self_rating: input.selfRating,
        self_notes: input.reflection?.trim() || null,
        clinical_context: clinicalContext,
        event_type: 'clinical_shift',
        event_id: shiftId,
      }));
      const { error: attemptsErr } = await supabase
        .from('betterat_competency_attempts')
        .insert(attemptRows);
      if (attemptsErr) {
        throw new Error(attemptsErr.message ?? 'Saved the shift but could not log competencies.');
      }

      // 3. Best-effort located step for the Map segment + Nearby. A failure here
      // must not fail the shift — the coverage loop above is the contract.
      try {
        const interestId = await resolveInterestId('nursing');
        if (interestId && input.lat != null && input.lng != null) {
          const step = await createStep({
            user_id: user.id,
            interest_id: interestId,
            title: `Clinical shift · ${input.siteName}`,
            description: input.unit ?? null,
            status: 'completed',
            starts_at: input.shiftStart,
            ends_at: input.shiftEnd ?? null,
            location_name: input.siteName,
            location_lat: input.lat,
            location_lng: input.lng,
          });
          await supabase.from('step_location').upsert(
            {
              step_id: step.id,
              set_by: user.id,
              name: input.siteName,
              lat: input.lat,
              lng: input.lng,
              poi_id: input.sitePoiId,
              is_healthcare_site: true,
              location_precision: 'site',
              location_audience: 'cohort',
              interest_slug: 'nursing',
            },
            { onConflict: 'step_id' },
          );
        }
      } catch (e) {
        logger.debug('Located clinical step skipped', e);
      }

      return { shiftId, competenciesLogged: attemptRows.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NURSING_SITE_COVERAGE_KEY, user?.id] });
      queryClient.invalidateQueries({ queryKey: [NURSING_COMPETENCY_COVERAGE_KEY, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['atlas-next-event'] });
    },
  });
}
