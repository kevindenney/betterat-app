#!/usr/bin/env node

/**
 * Seeds the seven persona accounts used by /demo.
 *
 * Run with:
 *   node scripts/seed-multi-audience-demo-personas.mjs
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoPassword = process.env.DEMO_PASSWORD;

if (!supabaseUrl || !serviceKey || !demoPassword) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DEMO_PASSWORD');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PERSONAS = [
  {
    key: 'markus',
    email: 'demo-markus@regattaflow.app',
    fullName: 'Markus Tham',
    metadataRole: 'sailor',
  },
  {
    key: 'yvonne',
    email: 'demo-yvonne@regattaflow.app',
    fullName: 'Yvonne Leung',
    metadataRole: 'sailor',
  },
  {
    key: 'szanton',
    email: 'sarah.szanton@jhu-dean-demo.edu',
    fullName: 'Dr. Sarah Szanton',
    metadataRole: 'club_manager',
    org: { match: { name: 'Johns Hopkins School of Nursing' }, role: 'admin' },
    interestSlug: 'nursing',
  },
  {
    key: 'patricia',
    email: 'patricia.morrison@jhu-faculty-demo.edu',
    fullName: 'Patricia Morrison',
    metadataRole: 'coach',
    org: { match: { name: 'Johns Hopkins School of Nursing' }, role: 'faculty' },
    interestSlug: 'nursing',
  },
  {
    key: 'maya',
    email: 'nursing-peer-1@demo.regattaflow.io',
    fullName: 'Maya Patel',
    metadataRole: 'sailor',
    org: { match: { name: 'Johns Hopkins School of Nursing' }, role: 'student' },
    interestSlug: 'nursing',
  },
  {
    key: 'pradan-field',
    email: 'pradan.field@betterat.app',
    fullName: 'Suman Tirkey',
    metadataRole: 'coach',
    org: { match: { slug: 'pradan-khunti' }, role: 'manager' },
    interestSlug: 'lac-craft-business',
  },
  {
    key: 'savitri',
    email: 'demo-savitri@betterat.app',
    fullName: 'Savitri Devi Munda',
    metadataRole: 'sailor',
    org: { match: { slug: 'pradan-khunti' }, role: 'member' },
    interestSlug: 'lac-craft-business',
  },
];

async function main() {
  console.log('Seeding multi-audience demo personas...');
  const usersByEmail = await loadUsersByEmail();

  for (const persona of PERSONAS) {
    const userId = await ensureAuthUser(persona, usersByEmail);
    await upsertProfile(userId, persona);
    await upsertPublicUser(userId, persona);

    if (persona.interestSlug) {
      await ensureInterest(userId, persona.interestSlug);
    }
    if (persona.org) {
      await ensureMembership(userId, persona);
    }

    console.log(`  ok ${persona.key.padEnd(13)} ${persona.email}`);
  }

  console.log('Done.');
}

async function loadUsersByEmail() {
  const out = new Map();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const user of data.users ?? []) {
      if (user.email) out.set(user.email.toLowerCase(), user);
    }
    if (!data.users || data.users.length < 1000) break;
    page += 1;
  }
  return out;
}

async function ensureAuthUser(persona, usersByEmail) {
  const existing = usersByEmail.get(persona.email.toLowerCase());
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: {
        full_name: persona.fullName,
        name: persona.fullName,
        role: persona.metadataRole,
        demo_persona_key: persona.key,
      },
    });
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: persona.email,
    password: demoPassword,
    email_confirm: true,
    user_metadata: {
      full_name: persona.fullName,
      name: persona.fullName,
      role: persona.metadataRole,
      demo_persona_key: persona.key,
    },
  });
  if (error || !data.user) {
    throw new Error(`createUser ${persona.email}: ${error?.message ?? 'missing user'}`);
  }
  usersByEmail.set(persona.email.toLowerCase(), data.user);
  return data.user.id;
}

async function upsertProfile(userId, persona) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: persona.email,
      full_name: persona.fullName,
      subscription_tier: 'pro',
      profile_public: true,
      portfolio_public_opt_in: true,
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`profiles upsert ${persona.email}: ${error.message}`);
}

async function upsertPublicUser(userId, persona) {
  const { error } = await supabase.from('users').upsert(
    {
      id: userId,
      email: persona.email,
      full_name: persona.fullName,
      subscription_tier: 'pro',
    },
    { onConflict: 'id' },
  );
  if (error) console.warn(`  warn users upsert ${persona.email}: ${error.message}`);
}

async function ensureInterest(userId, slug) {
  const { data: interest, error: interestErr } = await supabase
    .from('interests')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (interestErr) throw new Error(`interest ${slug}: ${interestErr.message}`);
  if (!interest?.id) {
    console.warn(`  warn interest not found: ${slug}`);
    return;
  }

  const { error } = await supabase
    .from('user_interests')
    .upsert({ user_id: userId, interest_id: interest.id }, { onConflict: 'user_id,interest_id' });
  if (error) throw new Error(`user_interests ${slug}: ${error.message}`);
}

async function ensureMembership(userId, persona) {
  const query = supabase
    .from('organizations')
    .select('id, name, slug')
    .limit(1);
  const match = persona.org.match;
  const result = match.slug
    ? await query.eq('slug', match.slug).maybeSingle()
    : await query.eq('name', match.name).maybeSingle();

  if (result.error) throw new Error(`org lookup ${persona.key}: ${result.error.message}`);
  if (!result.data?.id) {
    console.warn(`  warn org not found for ${persona.key}`);
    return;
  }

  const { error } = await supabase.from('organization_memberships').upsert(
    {
      organization_id: result.data.id,
      user_id: userId,
      role: persona.org.role,
      status: 'active',
      membership_status: 'active',
      is_verified: true,
      joined_at: new Date().toISOString(),
      metadata: {
        demo_persona_key: persona.key,
        demo_seed: 'multi-audience',
      },
    },
    { onConflict: 'organization_id,user_id' },
  );
  if (error) throw new Error(`membership ${persona.key}: ${error.message}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
