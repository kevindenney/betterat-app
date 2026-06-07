#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });

const config = {
  studentEmail:
    process.env.JHU_SMOKE_STUDENT_EMAIL ||
    'qa-jhu-student-202606071600@betterat.app',
  blueprintId:
    process.env.JHU_SMOKE_BLUEPRINT_ID ||
    'e601c5c6-c2d2-496e-99f0-719f6f353088',
  orgId:
    process.env.JHU_SMOKE_ORG_ID ||
    '678e149e-2abb-422c-ac61-b76756a2150e',
  interestId:
    process.env.JHU_SMOKE_INTEREST_ID ||
    'bec249c5-6412-4d16-bb84-bfcfb887ff67',
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const found = data.users.find(
      (user) => String(user.email).toLowerCase() === email.toLowerCase(),
    );
    if (found) return found;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function ensureMembership(studentId) {
  const now = new Date().toISOString();
  const { data: existing, error: lookupError } = await supabase
    .from('organization_memberships')
    .select('*')
    .eq('user_id', studentId)
    .eq('organization_id', config.orgId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    const needsUpdate =
      existing.role !== 'member' ||
      existing.status !== 'active' ||
      existing.membership_status !== 'active' ||
      existing.is_verified !== true;

    if (!needsUpdate) return existing;

    const { data, error } = await supabase
      .from('organization_memberships')
      .update({
        role: 'member',
        status: 'active',
        membership_status: 'active',
        is_verified: true,
        verified_at: existing.verified_at ?? now,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('organization_memberships')
    .insert({
      id: randomUUID(),
      organization_id: config.orgId,
      user_id: studentId,
      role: 'member',
      status: 'active',
      membership_status: 'active',
      is_verified: true,
      verified_at: now,
      verification_source: null,
      metadata: {
        source: 'mobile qa JHU blueprint smoke post-signup',
        student_email: config.studentEmail,
      },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function ensureSubscription(studentId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('blueprint_subscriptions')
    .upsert(
      {
        blueprint_id: config.blueprintId,
        subscriber_id: studentId,
        subscribed_at: now,
        last_synced_at: now,
      },
      { onConflict: 'blueprint_id,subscriber_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getFirstBlueprintStep() {
  const { data, error } = await supabase
    .from('blueprint_steps')
    .select('id, step_id, sort_order')
    .eq('blueprint_id', config.blueprintId)
    .order('sort_order', { ascending: true })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) {
    throw new Error(`Blueprint ${config.blueprintId} has no curated steps`);
  }
  return row;
}

async function ensureAdoptedStep(studentId, blueprintStep) {
  const { data: existing, error: existingError } = await supabase
    .from('timeline_steps')
    .select('*')
    .eq('user_id', studentId)
    .eq('source_id', blueprintStep.step_id)
    .eq('source_blueprint_id', config.blueprintId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: source, error: sourceError } = await supabase
    .from('timeline_steps')
    .select('*')
    .eq('id', blueprintStep.step_id)
    .single();
  if (sourceError) throw sourceError;

  const { data: maxRow } = await supabase
    .from('timeline_steps')
    .select('sort_order')
    .eq('user_id', studentId)
    .eq('interest_id', config.interestId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = (maxRow?.sort_order ?? 0) + 1;
  const metadata = { ...(source.metadata ?? {}) };
  delete metadata.brain_dump;

  const { data, error } = await supabase
    .from('timeline_steps')
    .insert({
      user_id: studentId,
      interest_id: config.interestId,
      organization_id: config.orgId,
      source_type: 'copied',
      source_id: source.id,
      copied_from_user_id: source.user_id,
      source_blueprint_id: config.blueprintId,
      source_blueprint_step_id: blueprintStep.id,
      title: source.title || `Step ${nextSort}`,
      description: source.description,
      category: source.category ?? 'general',
      status: 'pending',
      starts_at: source.starts_at ?? null,
      ends_at: source.ends_at ?? null,
      location_name: source.location_name ?? null,
      location_lat: source.location_lat ?? null,
      location_lng: source.location_lng ?? null,
      location_place_id: source.location_place_id ?? null,
      visibility: 'private',
      share_approximate_location: false,
      sort_order: nextSort,
      metadata,
      collaborator_user_ids: [],
      is_timed: false,
      is_race: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function markAdopted(subscription, blueprintStep, adoptedStep) {
  const { data, error } = await supabase
    .from('blueprint_step_actions')
    .upsert(
      {
        subscription_id: subscription.id,
        source_step_id: blueprintStep.step_id,
        action: 'adopted',
        acted_at: new Date().toISOString(),
        adopted_step_id: adoptedStep.id,
      },
      { onConflict: 'subscription_id,source_step_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  const user = await findAuthUserByEmail(config.studentEmail);
  if (!user) {
    throw new Error(`Student auth user not found: ${config.studentEmail}`);
  }

  const membership = await ensureMembership(user.id);
  const subscription = await ensureSubscription(user.id);
  const blueprintStep = await getFirstBlueprintStep();
  const adoptedStep = await ensureAdoptedStep(user.id, blueprintStep);
  const action = await markAdopted(subscription, blueprintStep, adoptedStep);

  console.log(
    JSON.stringify(
      {
        student: { id: user.id, email: user.email },
        membership: {
          id: membership.id,
          role: membership.role,
          status: membership.status,
          membership_status: membership.membership_status,
        },
        subscription: {
          id: subscription.id,
          blueprint_id: subscription.blueprint_id,
          subscriber_id: subscription.subscriber_id,
          subscription_status: subscription.subscription_status,
        },
        adopted_step: {
          id: adoptedStep.id,
          title: adoptedStep.title,
          source_id: adoptedStep.source_id,
          source_blueprint_id: adoptedStep.source_blueprint_id,
          source_blueprint_step_id: adoptedStep.source_blueprint_step_id,
        },
        action: {
          id: action.id,
          action: action.action,
          adopted_step_id: action.adopted_step_id,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
