/**
 * Make the demo hero student Emily Rodriguez's Atlas coherent by closing the
 * "two data models" location seam.
 *
 * THE SEAM: a step's map anchor lives in THREE places that were never kept in
 * sync for the seeded student —
 *   1. timeline_steps.metadata.plan.where_location  (rendering source of truth;
 *      what useUserAtlasSteps reads first → drives map pins + the F4 picker tap)
 *   2. timeline_steps.location_lat / location_lng / location_name  (inline
 *      creation snapshot; useUserAtlasSteps' fallback)
 *   3. step_location row  (social-proof / peer-search aggregation table)
 * Emily's seed wrote ONLY #3, so the map + picker (which read #1/#2) saw her
 * steps as unlocated → every picker tap was a dead no-op.
 *
 * WHAT THIS DOES (additive + idempotent + reversible):
 *   A. For the 12 steps that already have a step_location row but no inline /
 *      where_location → copy lat/lng/name/poi_id INTO #1 and #2.
 *   B. For the 9 pending Pediatrics steps with no location anywhere → anchor
 *      them to real pediatric POIs (Harriet Lane Clinic for the 4 bedside
 *      fundamentals; Wald Community Nursing Center for the 5 discharge
 *      teach-back steps) and write all three models.
 *   C. Purge the 3 fake preceptor atlas_pois (Dr. Singh / Lin / Mara) so the
 *      Atlas "Faculty" layer is honestly empty rather than fake. Verified to
 *      have zero step_location / clinical_shifts references before delete.
 *
 * Cleanup / reverse:
 *   - A/B inline+metadata: re-running is safe (idempotent upserts). To fully
 *     revert the 9 pending anchors, null their location_* + delete their
 *     step_location rows + drop metadata.plan.where_location.
 *   - C: re-insert the 3 preceptor POIs from git history of the original seed.
 *
 * Run:  node scripts/seed-emily-step-locations.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://qavekrwdbsobecwrfxwu.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const EMILY = '37ac7510-8a05-4f15-86ea-1d8714b6507d';

// Real pediatric POIs for the unlocated planned steps.
const HARRIET_LANE = {
  poi_id: '3255ed8e-a6ba-4cce-b42e-27a03635924c',
  name: 'Harriet Lane Clinic',
  lat: 39.2978,
  lng: -76.5932,
};
const WALD = {
  poi_id: 'afa92fd5-b2cd-418c-ae83-bb9c6173fb7d',
  name: 'Wald Community Nursing Center',
  lat: 39.298,
  lng: -76.5925,
};

// Title → site for the 9 pending Pediatrics steps.
const PENDING_SITE_BY_TITLE = {
  'Bedside fundamentals · vitals + hand hygiene': HARRIET_LANE,
  'Focused assessment · cardio / pulm': HARRIET_LANE,
  'Medication safety · five rights': HARRIET_LANE,
  'SBAR handoff · structured communication': HARRIET_LANE,
  'Prepare the discharge packet': WALD,
  'Set the scene with plain language': WALD,
  'Walk through the three musts': WALD,
  'Verify understanding with teach-back': WALD,
  'Document the teach-back outcome': WALD,
};

const FAKE_PRECEPTOR_POIS = [
  'a34a79e4-4c00-41ee-9881-a6a377fc772f', // Dr. Singh · Resp pathway
  '52a97aa9-e961-4f5b-8778-235cd3e1250c', // Lin · Med-mgmt clinic
  'f66ebe3d-25b6-4a94-a32c-991882be21f5', // Mara · Heart-failure rounds
];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

/** Write all three location models for one step. */
async function applyLocation(step, place) {
  const where = {
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    location_precision: 'site',
    poi_id: place.poi_id,
  };
  const metadata = { ...(step.metadata ?? {}) };
  metadata.plan = { ...(metadata.plan ?? {}), where_location: where };

  const { error: stepErr } = await supabase
    .from('timeline_steps')
    .update({
      location_name: place.name,
      location_lat: place.lat,
      location_lng: place.lng,
      metadata,
    })
    .eq('id', step.id);
  if (stepErr) throw stepErr;

  const { error: locErr } = await supabase.from('step_location').upsert(
    {
      step_id: step.id,
      set_by: EMILY,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      poi_id: place.poi_id,
      location_precision: 'site',
      location_audience: step.visibility ?? 'private',
      interest_slug: 'nursing',
      is_healthcare_site: true,
    },
    { onConflict: 'step_id' },
  );
  if (locErr) throw locErr;
}

async function main() {
  const { data: steps, error: stepsErr } = await supabase
    .from('timeline_steps')
    .select('id, title, status, visibility, location_lat, location_lng, location_name, metadata')
    .eq('user_id', EMILY);
  if (stepsErr) throw stepsErr;

  const { data: locs, error: locsErr } = await supabase
    .from('step_location')
    .select('step_id, lat, lng, name, poi_id')
    .in(
      'step_id',
      steps.map((s) => s.id),
    );
  if (locsErr) throw locsErr;
  const locByStep = new Map(locs.map((l) => [l.step_id, l]));

  // A. Backfill steps that already carry coords (step_location row OR inline
  //    columns) into all three models. step_location wins when present; else
  //    fall back to the inline snapshot so an inline-only seed row is healed too.
  let backfilled = 0;
  for (const step of steps) {
    const loc = locByStep.get(step.id);
    let place = null;
    if (loc && loc.lat != null && loc.lng != null) {
      place = { name: loc.name, lat: loc.lat, lng: loc.lng, poi_id: loc.poi_id };
    } else if (step.location_lat != null && step.location_lng != null) {
      place = {
        name: step.location_name,
        lat: step.location_lat,
        lng: step.location_lng,
        poi_id: null,
      };
    }
    if (!place) continue;
    await applyLocation(step, place);
    backfilled += 1;
  }
  console.log(`A. Backfilled ${backfilled} steps with coords → where_location + inline + step_location`);

  // B. Anchor the 9 unlocated pending Pediatrics steps to real peds POIs.
  let anchored = 0;
  for (const step of steps) {
    const place = PENDING_SITE_BY_TITLE[step.title?.trim()];
    if (!place) continue;
    if (locByStep.has(step.id)) continue; // already handled in A
    await applyLocation(step, place);
    console.log(`   anchored "${step.title}" → ${place.name}`);
    anchored += 1;
  }
  console.log(`B. Anchored ${anchored} pending Pediatrics steps`);

  // C. Purge the 3 fake preceptor POIs (Faculty layer).
  const { data: deleted, error: delErr } = await supabase
    .from('atlas_pois')
    .delete()
    .in('id', FAKE_PRECEPTOR_POIS)
    .select('id, name');
  if (delErr) throw delErr;
  console.log(`C. Purged ${deleted?.length ?? 0} fake preceptor POIs:`);
  for (const p of deleted ?? []) console.log(`   - ${p.name}`);

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
