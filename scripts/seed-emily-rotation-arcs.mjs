/**
 * Seed nursing "rotation" arcs (seasons rows) for the demo hero student Emily
 * Rodriguez so the Atlas F4 picker shows >1 collapsible ROTATION group.
 *
 * arc == season (data model). A clinical rotation is just a dated season window.
 * We read Emily's actual clinical_shifts dates, partition them into 3 monthly
 * rotations, and insert one season per rotation. The most recent rotation is
 * status='active' so getCurrentSeason picks it as the "current" arc; her steps
 * bucket into arcs by date-containment (no metadata.season_id needed).
 *
 * Additive + reversible. Cleanup:
 *   delete from seasons where user_id = EMILY and metadata-ish description LIKE
 *   'seed:emily-rotation%';  (we tag description for safe teardown)
 *
 * Run:  node scripts/seed-emily-rotation-arcs.mjs
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
const SEED_TAG = 'seed:emily-rotation';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  // 1. Gather Emily's shift dates from both clinical_shifts and her located steps.
  const { data: shifts, error: shiftErr } = await supabase
    .from('clinical_shifts')
    .select('shift_start')
    .eq('student_id', EMILY)
    .order('shift_start', { ascending: true });
  if (shiftErr) throw shiftErr;

  const { data: steps, error: stepErr } = await supabase
    .from('timeline_steps')
    .select('starts_at, created_at')
    .eq('user_id', EMILY);
  if (stepErr) throw stepErr;

  const dates = [];
  for (const s of shifts ?? []) if (s.shift_start) dates.push(new Date(s.shift_start));
  for (const s of steps ?? []) {
    const d = s.starts_at ?? s.created_at;
    if (d) dates.push(new Date(d));
  }
  dates.sort((a, b) => a - b);

  if (dates.length === 0) {
    console.error('Emily has no dated shifts/steps — nothing to partition.');
    process.exit(1);
  }

  const min = dates[0];
  const max = dates[dates.length - 1];
  console.log(`Emily date span: ${ymd(min)} .. ${ymd(max)} (${dates.length} dated rows)`);

  // 2. Define 3 rotation windows that partition the span. We want the latest to
  //    be "current" (status active). Build month-aligned windows ending at max.
  //    Windows are inclusive; the arc resolver treats end_date inclusive (+1d).
  const startMonth = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth(), 1));

  // Total whole months between start and end, split into ~3 buckets.
  const monthsSpan =
    (endMonth.getUTCFullYear() - startMonth.getUTCFullYear()) * 12 +
    (endMonth.getUTCMonth() - startMonth.getUTCMonth());

  // Build 3 windows. If the data spans <3 months, still make 3 adjacent monthly
  // windows ending at the max month so date-containment buckets cleanly.
  const ROTATIONS = [
    { name: 'Med-Surg Rotation', short: 'Med-Surg', desc: 'Adult medical-surgical clinical rotation' },
    { name: 'Pediatrics Rotation', short: 'Peds', desc: 'Pediatric clinical rotation' },
    { name: 'Critical Care Rotation', short: 'Critical Care', desc: 'ICU / critical care clinical rotation' },
  ];

  // Anchor the 3 windows to the last 3 months ending at endMonth (current last).
  const windows = [];
  for (let i = 2; i >= 0; i--) {
    const wStart = new Date(Date.UTC(endMonth.getUTCFullYear(), endMonth.getUTCMonth() - i, 1));
    const wEnd = new Date(Date.UTC(endMonth.getUTCFullYear(), endMonth.getUTCMonth() - i + 1, 0)); // last day of month
    windows.push({ start: wStart, end: wEnd });
  }
  // Ensure the earliest window extends back far enough to capture min.
  if (min < windows[0].start) windows[0].start = startMonth;

  void monthsSpan; // span informs the choice above; windows are month-aligned.

  // 3. Clean any prior seed rows so this is idempotent.
  const { error: delErr } = await supabase
    .from('seasons')
    .delete()
    .eq('user_id', EMILY)
    .like('description', `${SEED_TAG}%`);
  if (delErr) throw delErr;

  // 4. Insert the 3 rotations. Latest = active, earlier = completed.
  const rows = ROTATIONS.map((r, i) => {
    const w = windows[i];
    const isLatest = i === ROTATIONS.length - 1;
    return {
      name: r.name,
      short_name: r.short,
      year: w.start.getUTCFullYear(),
      year_end: w.end.getUTCFullYear(),
      user_id: EMILY,
      start_date: ymd(w.start),
      end_date: ymd(w.end),
      status: isLatest ? 'active' : 'completed',
      description: `${SEED_TAG}: ${r.desc}`,
    };
  });

  const { data: inserted, error: insErr } = await supabase
    .from('seasons')
    .insert(rows)
    .select('id, name, start_date, end_date, status');
  if (insErr) throw insErr;

  console.log('\nInserted rotation arcs:');
  for (const s of inserted) {
    console.log(`  ${s.status.padEnd(9)} ${s.name}  [${s.start_date} .. ${s.end_date}]`);
  }

  // 5. Report how Emily's dated rows bucket into these windows.
  const buckets = inserted.map((s) => ({ s, count: 0 }));
  let earlier = 0;
  for (const d of dates) {
    const hit = buckets.find(
      (b) => d >= new Date(b.s.start_date) && d <= new Date(`${b.s.end_date}T23:59:59Z`),
    );
    if (hit) hit.count++;
    else earlier++;
  }
  console.log('\nDate-containment buckets:');
  for (const b of buckets) console.log(`  ${b.s.name}: ${b.count} rows`);
  if (earlier) console.log(`  (earlier / unbucketed): ${earlier} rows`);

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
