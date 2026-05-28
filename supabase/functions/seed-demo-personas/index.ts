/**
 * seed-demo-personas — one-shot service-role-backed edge function that
 * ensures the two missing demo personas are present in dev:
 *
 *   * Dr. Sarah Szanton — Dean, Johns Hopkins School of Nursing
 *   * PRADAN Field Officer — manages the Khunti unit
 *
 * The other five personas are already seeded; running this against
 * them is a no-op (idempotent by email lookup).
 *
 * For each persona this:
 *   1. Tries admin.createUser with email auto-confirmed; on
 *      email_exists, falls back to find_auth_user_id_by_email RPC.
 *   2. Upserts profiles row with full_name, profile_public=true,
 *      portfolio_public_opt_in=true.
 *   3. Upserts user_interests for the org's interest_slug.
 *   4. Upserts organization_memberships row with the role we want
 *      (Szanton=admin, PRADAN field officer=manager — both satisfy
 *      has_org_role_in checks in Codex's RPCs).
 *
 * Gating mirrors mint-demo-session: DEMO_MODE_ENABLED env required;
 * without it the function returns 410 Gone. Idempotent: POST again to
 * verify the state.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface PersonaSeed {
  key: string;
  email: string;
  fullName: string;
  orgSlug: string;
  role: 'admin' | 'manager' | 'faculty' | 'instructor';
}

const PERSONAS_TO_SEED: PersonaSeed[] = [
  {
    key: 'szanton',
    email: 'sarah.szanton@jhu-dean-demo.edu',
    fullName: 'Dr. Sarah Szanton',
    orgSlug: 'johns-hopkins-school-of-nursing',
    role: 'admin',
  },
  {
    key: 'pradan-field',
    email: 'pradan.field@betterat.app',
    fullName: 'PRADAN Field Officer',
    orgSlug: 'pradan-khunti',
    role: 'manager',
  },
];

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const DEMO_MODE = Deno.env.get('DEMO_MODE_ENABLED');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (DEMO_MODE !== 'true') return jsonError('Demo mode is not enabled', 410);
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonError('Supabase env not configured', 500);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: PersonaResult[] = [];
  for (const persona of PERSONAS_TO_SEED) {
    try {
      results.push(await seedPersona(sb, persona));
    } catch (err) {
      results.push({
        key: persona.key,
        email: persona.email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return json({ personas: results });
});

interface PersonaResult {
  key: string;
  email: string;
  created?: boolean;
  userId?: string;
  profileUpdated?: boolean;
  membershipUpserted?: boolean;
  interestUpserted?: boolean;
  orgId?: string;
  error?: string;
}

async function seedPersona(
  sb: ReturnType<typeof createClient>,
  persona: PersonaSeed,
): Promise<PersonaResult> {
  const { data: orgRow, error: orgErr } = await sb
    .from('organizations')
    .select('id, interest_slug')
    .eq('slug', persona.orgSlug)
    .maybeSingle();
  if (orgErr) throw new Error(`org lookup failed: ${orgErr.message}`);
  if (!orgRow?.id) throw new Error(`org not found for slug ${persona.orgSlug}`);
  const orgId = orgRow.id as string;
  const interestSlug = (orgRow as { interest_slug: string | null }).interest_slug;

  const userId = await ensureAuthUser(sb, persona.email);
  const created = userId.created;

  const { error: profileErr } = await sb.from('profiles').upsert(
    {
      id: userId.id,
      email: persona.email,
      full_name: persona.fullName,
      profile_public: true,
      portfolio_public_opt_in: true,
    },
    { onConflict: 'id' },
  );
  if (profileErr) throw new Error(`profile upsert failed: ${profileErr.message}`);

  let interestUpserted = false;
  if (interestSlug) {
    const { data: interestRow, error: interestLookupErr } = await sb
      .from('interests')
      .select('id')
      .eq('slug', interestSlug)
      .maybeSingle();
    if (interestLookupErr) {
      throw new Error(`interest lookup failed: ${interestLookupErr.message}`);
    }
    if (interestRow?.id) {
      const { error: uiErr } = await sb.from('user_interests').upsert(
        { user_id: userId.id, interest_id: interestRow.id },
        { onConflict: 'user_id,interest_id' },
      );
      if (uiErr) throw new Error(`user_interests upsert failed: ${uiErr.message}`);
      interestUpserted = true;
    }
  }

  const { error: memErr } = await sb.from('organization_memberships').upsert(
    {
      organization_id: orgId,
      user_id: userId.id,
      role: persona.role,
      status: 'active',
      membership_status: 'active',
    },
    { onConflict: 'organization_id,user_id' },
  );
  if (memErr) throw new Error(`membership upsert failed: ${memErr.message}`);

  return {
    key: persona.key,
    email: persona.email,
    created,
    userId: userId.id,
    profileUpdated: true,
    membershipUpserted: true,
    interestUpserted,
    orgId,
  };
}

interface EnsuredUser {
  id: string;
  created: boolean;
}

/**
 * Resolves an auth user by email; creates one with email auto-confirmed
 * if missing. No password — sign-in is via magic link from
 * mint-demo-session, so a credential set isn't needed.
 *
 * Uses supabase-js admin.createUser; on email_exists falls back to the
 * SECURITY DEFINER find_auth_user_id_by_email RPC because GoTrue's
 * admin/users list endpoint 500s on this project.
 */
async function ensureAuthUser(
  sb: ReturnType<typeof createClient>,
  email: string,
): Promise<EnsuredUser> {
  // Type the admin client loosely — supabase-js v2 exposes
  // sb.auth.admin.createUser on a service-role client.
  const adminAuth = (sb.auth as unknown as {
    admin: {
      createUser: (params: {
        email: string;
        email_confirm?: boolean;
        user_metadata?: Record<string, unknown>;
      }) => Promise<{ data: { user: { id: string } | null }; error: { message?: string; code?: string; status?: number } | null }>;
    };
  }).admin;

  const { data, error } = await adminAuth.createUser({
    email,
    email_confirm: true,
    user_metadata: { demo_persona: true },
  });

  if (data?.user?.id) {
    return { id: data.user.id, created: true };
  }

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    const isExists =
      error.code === 'email_exists' ||
      msg.includes('already been registered') ||
      msg.includes('already exists') ||
      msg.includes('duplicate');

    if (!isExists) {
      throw new Error(`createUser failed: ${error.message ?? JSON.stringify(error)}`);
    }
  }

  // Fall back to RPC lookup.
  const { data: existingId, error: lookupErr } = await sb.rpc(
    'find_auth_user_id_by_email',
    { p_email: email },
  );
  if (lookupErr) {
    throw new Error(`find_auth_user_id_by_email failed: ${lookupErr.message}`);
  }
  if (typeof existingId !== 'string' || !existingId) {
    throw new Error(`auth.user not found after createUser conflict: ${email}`);
  }
  return { id: existingId, created: false };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number): Response {
  return json({ error: message }, status);
}
