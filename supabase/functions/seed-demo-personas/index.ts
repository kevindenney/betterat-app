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
 *   1. Looks up auth.users by email; creates via admin.createUser if
 *      missing (email auto-confirmed; no password — sign-in is via
 *      magic link from mint-demo-session).
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
 *
 * Invoke:
 *   POST https://qavekrwdbsobecwrfxwu.supabase.co/functions/v1/seed-demo-personas
 *
 * Returns: { personas: [{ key, email, created, profileUpdated,
 *           membershipUpserted, interestUpserted, orgId }] }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface PersonaSeed {
  key: string;
  email: string;
  fullName: string;
  orgSlug: string;
  /** Membership role we want this persona to have. Must be in the
   *  role allowlists Codex's RPCs check. */
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
  // 1. Resolve org first — fail fast if it doesn't exist.
  const { data: orgRow, error: orgErr } = await sb
    .from('organizations')
    .select('id, interest_slug')
    .eq('slug', persona.orgSlug)
    .maybeSingle();
  if (orgErr) throw new Error(`org lookup failed: ${orgErr.message}`);
  if (!orgRow?.id) throw new Error(`org not found for slug ${persona.orgSlug}`);
  const orgId = orgRow.id as string;
  const interestSlug = (orgRow as { interest_slug: string | null }).interest_slug;

  // 2. Look up or create the auth.user. The admin API doesn't expose a
  //    findByEmail; we use listUsers with a filter and pick the first
  //    match. That endpoint is paginated — for a 2-persona seed in dev
  //    we only need to walk the first page (1000 users).
  const userId = await ensureAuthUser(persona.email);
  const created = userId.created;

  // 3. Upsert profile. Some triggers may already have created the row
  //    when the auth user was inserted; either way, ensure our fields.
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

  // 4. Upsert user_interests for the org's interest_slug (when set).
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

  // 5. Upsert organization_membership. Match on (organization_id,
  //    user_id) — both columns participate in the unique constraint.
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
 */
async function ensureAuthUser(email: string): Promise<EnsuredUser> {
  // listUsers paginates; for the dev seed we walk pages until we find
  // the match or exhaust. Cap at 10 pages (10k users) so a runaway
  // doesn't time out.
  const PER_PAGE = 1000;
  for (let page = 1; page <= 10; page++) {
    const resp = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=${PER_PAGE}&page=${page}`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`admin/users list failed: ${resp.status} ${detail}`);
    }
    const body = (await resp.json()) as { users?: { id: string; email?: string | null }[] };
    const match = body.users?.find(
      (u) => (u.email ?? '').trim().toLowerCase() === email.toLowerCase(),
    );
    if (match?.id) return { id: match.id, created: false };
    if (!body.users || body.users.length < PER_PAGE) break;
  }

  // Not found — create.
  const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: { demo_persona: true },
    }),
  });
  if (!createResp.ok) {
    const detail = await createResp.text();
    throw new Error(`admin/users create failed: ${createResp.status} ${detail}`);
  }
  const createdBody = (await createResp.json()) as { id?: string; user?: { id: string } };
  const id = createdBody.id ?? createdBody.user?.id;
  if (!id) throw new Error(`admin/users create returned no id: ${JSON.stringify(createdBody)}`);
  return { id, created: true };
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
