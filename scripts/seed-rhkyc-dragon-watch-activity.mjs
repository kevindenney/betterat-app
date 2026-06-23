#!/usr/bin/env node

/**
 * Seed recent RHKYC Dragon Fleet groupmate activity for Watch > Groups.
 *
 * The fleet feed intentionally excludes the signed-in viewer's own steps. The
 * existing Dragon demo had members and races, but no sail-racing timeline steps
 * from other fleet members, so Watch > Groups rendered "No group activity yet."
 *
 * Run:
 *   node scripts/seed-rhkyc-dragon-watch-activity.mjs
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoPassword = process.env.DEMO_PASSWORD || 'demo1234';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(supabaseUrl, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RHKYC_DRAGON_FLEET_ID = '63422b6f-429a-4557-aab9-2a928316cbe5';
const RHKYC_ORG_ID = 'a1000001-0000-0000-0000-000000000001';
const SEED = 'rhkyc-dragon-watch-activity-v1';

const PEERS = [
  {
    email: 'sarah.chen@sailing.com',
    fullName: 'Sarah Chen',
    boat: 'Phoenix Rising',
    steps: [
      {
        id: 'd4a90001-7300-4000-8000-000000000001',
        title: 'Check leech tension before the club start',
        description: 'Compare upper batten twist with last weekend and mark the traveler setting that kept the boat moving through chop.',
        category: 'rig-tuning',
        status: 'in_progress',
        locationName: 'RHKYC Kellett Island',
        locationAddress: 'Kellett Island, Causeway Bay, Hong Kong',
        lat: 22.28265,
        lng: 114.18309,
        hoursAgo: 2,
      },
      {
        id: 'd4a90001-7300-4000-8000-000000000002',
        title: 'Debrief the final downwind layline',
        description: 'Replay the last gybe choice and write one rule for when to protect the inside lane in easterly pressure.',
        category: 'race-review',
        status: 'pending',
        locationName: 'Victoria Harbour',
        locationAddress: 'Victoria Harbour, Hong Kong',
        lat: 22.29412,
        lng: 114.16978,
        hoursAgo: 18,
      },
    ],
  },
  {
    email: 'marcus.thompson@racing.com',
    fullName: 'Marcus Thompson',
    boat: 'Thunder',
    steps: [
      {
        id: 'd4a90002-7300-4000-8000-000000000001',
        title: 'Run two timed port-tack approaches',
        description: 'Practice the committee-boat approach with a 45-second burn and call the acceleration point out loud.',
        category: 'starts',
        status: 'in_progress',
        locationName: 'Kellett Island start area',
        locationAddress: 'Kellett Island, Hong Kong',
        lat: 22.28214,
        lng: 114.18475,
        hoursAgo: 5,
      },
    ],
  },
  {
    email: 'emma.wilson@yacht.club',
    fullName: 'Emma Wilson',
    boat: 'Lightning Strike',
    steps: [
      {
        id: 'd4a90003-7300-4000-8000-000000000001',
        title: 'Test jib car one hole forward',
        description: 'Log helm balance and target height with the car forward before deciding whether to keep it for Sunday.',
        category: 'boat-speed',
        status: 'pending',
        locationName: 'Middle Island',
        locationAddress: 'Middle Island, Hong Kong',
        lat: 22.24041,
        lng: 114.19730,
        hoursAgo: 9,
      },
    ],
  },
  {
    email: 'david.lee@dragon.hk',
    fullName: 'David Lee',
    boat: 'Dragon Master',
    steps: [
      {
        id: 'd4a90004-7300-4000-8000-000000000001',
        title: 'Assign mark-rounding calls by role',
        description: 'Give bow, trim, and helm one call each so the leeward gate stays quiet and repeatable.',
        category: 'crew-work',
        status: 'completed',
        locationName: 'RHKYC pontoons',
        locationAddress: 'Kellett Island, Hong Kong',
        lat: 22.28294,
        lng: 114.18242,
        hoursAgo: 28,
      },
    ],
  },
  {
    email: 'linda.chang@sailing.hk',
    fullName: 'Linda Chang',
    boat: 'Sea Spirit',
    steps: [
      {
        id: 'd4a90005-7300-4000-8000-000000000001',
        title: 'Measure forestay repeatability at the dock',
        description: 'Record pin setting, rig tension, and mast blocks after rigging so the light-air setup is reproducible.',
        category: 'rig-tuning',
        status: 'completed',
        locationName: 'RHKYC hardstand',
        locationAddress: 'Kellett Island, Hong Kong',
        lat: 22.28331,
        lng: 114.18180,
        hoursAgo: 36,
      },
    ],
  },
];

function isoHoursAgo(hoursAgo) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function splitName(fullName) {
  const [firstName, ...lastParts] = fullName.split(' ');
  return { firstName, lastName: lastParts.join(' ') };
}

async function findOrCreateUser(peer) {
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', peer.email)
    .maybeSingle();
  if (profileErr) throw profileErr;
  if (profile?.id) {
    const { error: updateErr } = await supabase.auth.admin.updateUserById(profile.id, {
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: peer.fullName, name: peer.fullName, demo_seed: SEED },
    });
    if (updateErr) throw updateErr;
    return profile.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: peer.email,
    password: demoPassword,
    email_confirm: true,
    user_metadata: { full_name: peer.fullName, name: peer.fullName, demo_seed: SEED },
  });
  if (error || !data?.user) {
    throw new Error(`Could not create ${peer.email}: ${error?.message ?? 'no user returned'}`);
  }
  return data.user.id;
}

async function ensureFleetMember(userId) {
  const { data: existing, error: lookupErr } = await supabase
    .from('fleet_members')
    .select('id')
    .eq('fleet_id', RHKYC_DRAGON_FLEET_ID)
    .eq('user_id', userId)
    .maybeSingle();
  if (lookupErr) throw lookupErr;

  if (existing?.id) {
    const { error } = await supabase
      .from('fleet_members')
      .update({ role: 'member', status: 'active' })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('fleet_members').insert({
    fleet_id: RHKYC_DRAGON_FLEET_ID,
    user_id: userId,
    role: 'member',
    status: 'active',
    joined_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function main() {
  const { data: fleet, error: fleetErr } = await supabase
    .from('fleets')
    .select('id, name')
    .eq('id', RHKYC_DRAGON_FLEET_ID)
    .maybeSingle();
  if (fleetErr) throw fleetErr;
  if (!fleet) throw new Error(`Missing fleet ${RHKYC_DRAGON_FLEET_ID}`);

  const { data: interest, error: interestErr } = await supabase
    .from('interests')
    .select('id, slug')
    .eq('slug', 'sail-racing')
    .maybeSingle();
  if (interestErr) throw interestErr;
  if (!interest) throw new Error('Missing sail-racing interest');

  console.log(`Seeding Watch activity for ${fleet.name}`);

  for (const peer of PEERS) {
    const userId = await findOrCreateUser(peer);
    const { firstName, lastName } = splitName(peer.fullName);

    const { error: profileErr } = await supabase.from('profiles').upsert(
      {
        id: userId,
        email: peer.email,
        first_name: firstName,
        last_name: lastName,
        full_name: peer.fullName,
        organization: 'RHKYC Dragon Fleet',
        bio: `${peer.boat} skipper in the RHKYC Dragon Fleet.`,
        primary_interest_id: interest.id,
        account_type: 'individual',
        profile_public: true,
        default_step_visibility: 'crew',
        allow_peer_visibility: true,
        allow_follower_sharing: true,
      },
      { onConflict: 'id' },
    );
    if (profileErr) throw profileErr;

    await ensureFleetMember(userId);

    const stepRows = peer.steps.map((step, index) => ({
      id: step.id,
      user_id: userId,
      interest_id: interest.id,
      organization_id: RHKYC_ORG_ID,
      source_type: 'manual',
      title: step.title,
      description: step.description,
      category: step.category,
      status: step.status,
      visibility: 'crew',
      sort_order: (index + 1) * 10,
      location_name: step.locationName,
      location_lat: step.lat,
      location_lng: step.lng,
      share_approximate_location: true,
      updated_at: isoHoursAgo(step.hoursAgo),
      created_at: isoHoursAgo(step.hoursAgo + 24),
      metadata: {
        demo_seed: SEED,
        fleet_id: RHKYC_DRAGON_FLEET_ID,
        boat_name: peer.boat,
        plan: {
          what_will_you_do: step.description,
          how_sub_steps: [
            'Set the boat up before leaving the dock',
            'Test one change on the water',
            'Write the repeatable cue after sailing',
          ],
          where_location: {
            name: step.locationName,
            address: step.locationAddress,
            lat: step.lat,
            lng: step.lng,
          },
        },
      },
    }));

    const { error: stepsErr } = await supabase
      .from('timeline_steps')
      .upsert(stepRows, { onConflict: 'id' });
    if (stepsErr) throw stepsErr;

    const locationRows = peer.steps.map((step) => ({
      step_id: step.id,
      lat: step.lat,
      lng: step.lng,
      name: step.locationName,
      address: step.locationAddress,
      set_by: userId,
      set_at: isoHoursAgo(step.hoursAgo),
      location_precision: 'site',
      location_audience: 'following',
      interest_slug: interest.slug,
      is_healthcare_site: false,
    }));

    const { error: locationsErr } = await supabase
      .from('step_location')
      .upsert(locationRows, { onConflict: 'step_id' });
    if (locationsErr) throw locationsErr;

    console.log(`  ${peer.fullName}: ${stepRows.length} step(s)`);
  }

  const { data: members, error: membersErr } = await supabase
    .from('fleet_members')
    .select('user_id')
    .eq('fleet_id', RHKYC_DRAGON_FLEET_ID)
    .eq('status', 'active');
  if (membersErr) throw membersErr;

  const { data: steps, error: stepsErr } = await supabase
    .from('timeline_steps')
    .select('id, title')
    .in('user_id', (members ?? []).map((member) => member.user_id))
    .eq('interest_id', interest.id)
    .neq('visibility', 'private');
  if (stepsErr) throw stepsErr;

  let rpcCount = 'not checked';
  if (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const { error: signInErr } = await anon.auth.signInWithPassword({
      email: 'sarah.chen@sailing.com',
      password: demoPassword,
    });
    if (!signInErr) {
      const { data: rpcRows, error: rpcErr } = await anon.rpc('get_fleet_step_activity', {
        p_fleet_id: RHKYC_DRAGON_FLEET_ID,
        p_interest_id: interest.id,
        p_limit: 10,
      });
      if (rpcErr) throw rpcErr;
      rpcCount = String(rpcRows?.length ?? 0);
    } else {
      rpcCount = `skipped: ${signInErr.message}`;
    }
  }

  console.log(
    `Done. Active fleet members: ${members?.length ?? 0}; sail-racing fleet steps: ${steps?.length ?? 0}; RPC rows as Sarah: ${rpcCount}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
