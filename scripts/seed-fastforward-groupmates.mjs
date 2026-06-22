#!/usr/bin/env node

/**
 * Seed groupmates and recent activity for the FastForward DTC Founders Circle.
 *
 * This gives Emily's Entrepreneur Watch > Groups tab real peer activity to
 * follow/adapt. Until the affinity-group RLS migration is applied in dev,
 * the script also follows these groupmates from Emily so existing timeline
 * visibility policies allow the feed to render.
 *
 * Run:
 *   node scripts/seed-fastforward-groupmates.mjs
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
const demoPassword = process.env.DEMO_PASSWORD || 'BetterAtDemo!2026';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const INTEREST_ID = 'c0000000-0000-4000-8000-0000000000e1';
const FASTFORWARD_ORG_ID = 'e1d0a000-0000-4000-8000-000000000011';
const FASTFORWARD_GROUP_ID = 'e1d0b000-0000-4000-8000-000000000011';
const EMILY_ID = '37ac7510-8a05-4f15-86ea-1d8714b6507d';
const SEED = 'fastforward-watch-groupmates-v1';

const PEERS = [
  {
    key: 'maya',
    email: 'maya.patel.fastforward-demo@betterat.app',
    fullName: 'Maya Patel',
    organization: 'KinKit',
    bio: 'Founder testing postpartum care kits through JHU FastForward.',
    steps: [
      {
        id: 'e1d0c001-0000-4000-8000-000000000001',
        title: 'Interview 5 repeat buyers',
        description: 'Ask what triggered the second purchase and what would make the bundle feel essential.',
        category: 'customer-discovery',
        status: 'in_progress',
        sortOrder: 10,
        locationName: 'FastForward U, Baltimore',
        locationAddress: '320 W 29th St, Baltimore, MD',
        lat: 39.32422,
        lng: -76.62261,
        hoursAgo: 4,
      },
      {
        id: 'e1d0c001-0000-4000-8000-000000000002',
        title: 'Rewrite product page around one job',
        description: 'Lead with the recovery moment the kit solves, then move ingredients and credentials below the fold.',
        category: 'marketing',
        status: 'pending',
        sortOrder: 20,
        locationName: 'Baltimore, MD',
        locationAddress: 'Baltimore, MD',
        lat: 39.29088,
        lng: -76.61076,
        hoursAgo: 20,
      },
    ],
  },
  {
    key: 'jordan',
    email: 'jordan.chen.fastforward-demo@betterat.app',
    fullName: 'Jordan Chen',
    organization: 'Ridge Goods',
    bio: 'DTC apparel founder working on durable commuter layers.',
    steps: [
      {
        id: 'e1d0c002-0000-4000-8000-000000000001',
        title: 'Run landing-page price test',
        description: 'Compare $78 and $92 preorder pages before ordering the next fabric lot.',
        category: 'pricing',
        status: 'in_progress',
        sortOrder: 10,
        locationName: 'Homewood, Baltimore',
        locationAddress: 'Homewood, Baltimore, MD',
        lat: 39.32935,
        lng: -76.62050,
        hoursAgo: 8,
      },
      {
        id: 'e1d0c002-0000-4000-8000-000000000002',
        title: 'Email ten wholesale leads',
        description: 'Send a short sell sheet to local running stores and track replies by channel.',
        category: 'sales',
        status: 'completed',
        sortOrder: 20,
        locationName: 'Baltimore, MD',
        locationAddress: 'Baltimore, MD',
        lat: 39.29195,
        lng: -76.62276,
        hoursAgo: 30,
      },
    ],
  },
  {
    key: 'priya',
    email: 'priya.shah.fastforward-demo@betterat.app',
    fullName: 'Priya Shah',
    organization: 'Nomad Pantry',
    bio: 'Founder of a compact meal-kit line for travel nurses and medical residents.',
    steps: [
      {
        id: 'e1d0c003-0000-4000-8000-000000000001',
        title: 'Review gross margin by channel',
        description: 'Split direct, campus pop-up, and wholesale margin before choosing the next launch channel.',
        category: 'finance',
        status: 'in_progress',
        sortOrder: 10,
        locationName: 'FastForward U, Baltimore',
        locationAddress: '320 W 29th St, Baltimore, MD',
        lat: 39.32422,
        lng: -76.62261,
        hoursAgo: 2,
      },
      {
        id: 'e1d0c003-0000-4000-8000-000000000002',
        title: 'Mock post-purchase onboarding',
        description: 'Draft the first three emails: setup, usage reminder, and reorder trigger.',
        category: 'retention',
        status: 'pending',
        sortOrder: 20,
        locationName: 'Baltimore, MD',
        locationAddress: 'Baltimore, MD',
        lat: 39.28652,
        lng: -76.61592,
        hoursAgo: 14,
      },
    ],
  },
];

async function ensureUser(peer) {
  const { data: profile, error: profileLookupErr } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', peer.email)
    .maybeSingle();
  if (profileLookupErr) throw profileLookupErr;
  if (profile?.id) return profile.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email: peer.email,
    password: demoPassword,
    email_confirm: true,
    user_metadata: {
      full_name: peer.fullName,
      name: peer.fullName,
      demo_seed: SEED,
    },
  });
  if (error || !data?.user) {
    if (error?.message?.toLowerCase().includes('already')) {
      const { data: retryProfile, error: retryErr } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', peer.email)
        .maybeSingle();
      if (retryErr) throw retryErr;
      if (retryProfile?.id) return retryProfile.id;
    }
    throw new Error(`createUser ${peer.email}: ${error?.message ?? 'no user returned'}`);
  }
  return data.user.id;
}

function isoHoursAgo(hoursAgo) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

async function main() {
  const { data: group, error: groupErr } = await supabase
    .from('affinity_groups')
    .select('id, name')
    .eq('id', FASTFORWARD_GROUP_ID)
    .maybeSingle();
  if (groupErr) throw groupErr;
  if (!group) throw new Error(`Missing FastForward group ${FASTFORWARD_GROUP_ID}`);

  console.log(`Seeding ${group.name}`);

  for (const peer of PEERS) {
    const userId = await ensureUser(peer);
    const [firstName, ...lastParts] = peer.fullName.split(' ');
    const lastName = lastParts.join(' ');

    const { error: profileErr } = await supabase.from('profiles').upsert(
      {
        id: userId,
        email: peer.email,
        first_name: firstName,
        last_name: lastName,
        full_name: peer.fullName,
        organization: peer.organization,
        bio: peer.bio,
        primary_interest_id: INTEREST_ID,
        account_type: 'individual',
        profile_public: true,
        default_step_visibility: 'crew',
        allow_peer_visibility: true,
        allow_follower_sharing: true,
      },
      { onConflict: 'id' },
    );
    if (profileErr) throw profileErr;

    const { error: memberErr } = await supabase.from('affinity_group_members').upsert(
      {
        group_id: FASTFORWARD_GROUP_ID,
        user_id: userId,
        role: 'member',
        status: 'active',
      },
      { onConflict: 'group_id,user_id' },
    );
    if (memberErr) throw memberErr;

    const { error: followErr } = await supabase.from('user_follows').upsert(
      {
        follower_id: EMILY_ID,
        following_id: userId,
        notifications_enabled: true,
        is_favorite: false,
        is_muted: false,
      },
      { onConflict: 'follower_id,following_id' },
    );
    if (followErr) throw followErr;

    const stepRows = peer.steps.map((step) => ({
      id: step.id,
      user_id: userId,
      interest_id: INTEREST_ID,
      organization_id: FASTFORWARD_ORG_ID,
      source_type: 'manual',
      title: step.title,
      description: step.description,
      category: step.category,
      status: step.status,
      visibility: 'crew',
      sort_order: step.sortOrder,
      location_name: step.locationName,
      location_lat: step.lat,
      location_lng: step.lng,
      share_approximate_location: false,
      updated_at: isoHoursAgo(step.hoursAgo),
      created_at: isoHoursAgo(step.hoursAgo + 24),
      metadata: {
        demo_seed: SEED,
        group_id: FASTFORWARD_GROUP_ID,
        founder_business: peer.organization,
        plan: {
          what_will_you_do: step.description,
          how_sub_steps: [
            'Write the smallest testable version',
            'Run it with real customers this week',
            'Bring results back to the founder circle',
          ],
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
      interest_slug: 'entrepreneur',
      is_healthcare_site: false,
    }));

    const { error: locationsErr } = await supabase
      .from('step_location')
      .upsert(locationRows, { onConflict: 'step_id' });
    if (locationsErr) throw locationsErr;

    console.log(
      `  ${peer.fullName}: ${userId}, ${stepRows.length} steps + locations, followed by Emily`,
    );
  }

  const { data: members, error: membersErr } = await supabase
    .from('affinity_group_members')
    .select('user_id')
    .eq('group_id', FASTFORWARD_GROUP_ID)
    .eq('status', 'active');
  if (membersErr) throw membersErr;

  const { data: steps, error: stepsErr } = await supabase
    .from('timeline_steps')
    .select('id')
    .in('user_id', (members ?? []).map((m) => m.user_id))
    .eq('interest_id', INTEREST_ID);
  if (stepsErr) throw stepsErr;

  console.log(`Done. Active members: ${members?.length ?? 0}; entrepreneur steps: ${steps?.length ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
