/**
 * mint-demo-session
 *
 * POST { persona_key, redirect_to? } returns an actionLink. The actionLink is
 * this function's GET endpoint with a one-time token; GET validates the
 * five-minute demo window, generates the real Supabase magic link, and 302s.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

type Persona = {
  email: string;
  landingRoute: string;
  orgSlug?: string;
  orgName?: string;
};

const PERSONAS: Record<string, Persona> = {
  markus: {
    email: 'demo-markus@regattaflow.app',
    landingRoute: '/practice',
  },
  yvonne: {
    email: 'demo-yvonne@regattaflow.app',
    landingRoute: '/practice',
  },
  szanton: {
    email: 'sarah.szanton@jhu-dean-demo.edu',
    landingRoute: '/admin/johns-hopkins-school-of-nursing/overview',
    orgName: 'Johns Hopkins School of Nursing',
  },
  patricia: {
    email: 'patricia.morrison@jhu-faculty-demo.edu',
    landingRoute: '/faculty-dashboard',
  },
  maya: {
    email: 'nursing-peer-1@demo.regattaflow.io',
    landingRoute: '/practice',
  },
  'pradan-field': {
    email: 'pradan.field@betterat.app',
    landingRoute: '/admin/pradan-khunti/overview',
    orgSlug: 'pradan-khunti',
  },
  savitri: {
    email: 'demo-savitri@betterat.app',
    landingRoute: '/practice',
  },
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Supabase reserves the SUPABASE_ secret prefix for system-managed values,
// so the demo gate uses DEMO_MODE_ENABLED instead. Value 'true' enables.
const DEMO_MODE = Deno.env.get('DEMO_MODE_ENABLED');
const DEMO_REDIRECT_BASE_URL = Deno.env.get('DEMO_REDIRECT_BASE_URL') ?? 'https://betterat.app';
const DEMO_FUNCTION_BASE_URL = Deno.env.get('DEMO_FUNCTION_BASE_URL');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (DEMO_MODE !== 'true') {
    return jsonError('Demo mode is not enabled', 410);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonError('Supabase env not configured', 500);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (req.method === 'GET') {
    return consumeDemoToken(req, sb);
  }
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  return mintDemoToken(req, sb);
});

async function mintDemoToken(req: Request, sb: ReturnType<typeof createClient>) {
  const callerIp = getCallerIp(req);
  const userAgent = req.headers.get('user-agent') ?? null;

  let body: { persona_key?: string; redirect_to?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonError('JSON body required', 400);
  }

  const personaKey = String(body.persona_key ?? '').trim();
  const persona = PERSONAS[personaKey];
  const redirectTo = persona
    ? await resolvePersonaLanding(sb, persona)
    : normalizeRedirect(body.redirect_to, '/demo');

  if (!persona) {
    await audit(sb, {
      persona_key: personaKey || 'unknown',
      caller_ip: callerIp,
      user_agent: userAgent,
      redirect_to: redirectTo,
      status: 'rejected',
      error_message: 'Unknown demo persona',
    });
    return jsonError('Unknown demo persona', 404);
  }

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error: countErr } = await sb
    .from('demo_session_audit')
    .select('id', { count: 'exact', head: true })
    .eq('caller_ip', callerIp)
    .gte('requested_at', since)
    .in('status', ['minted', 'consumed', 'expired', 'failed']);

  if (countErr) return jsonError(`rate limit check failed: ${countErr.message}`, 500);
  if ((count ?? 0) >= 5) {
    await audit(sb, {
      persona_key: personaKey,
      persona_email: persona.email,
      caller_ip: callerIp,
      user_agent: userAgent,
      redirect_to: redirectTo,
      status: 'rate_limited',
      error_message: 'Rate limit exceeded',
    });
    return jsonError('Rate limit exceeded', 429);
  }

  const rawToken = crypto.randomUUID() + '.' + crypto.randomUUID();
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

  const { error: auditErr } = await sb.from('demo_session_audit').insert({
    persona_key: personaKey,
    persona_email: persona.email,
    caller_ip: callerIp,
    user_agent: userAgent,
    redirect_to: redirectTo,
    action_token_hash: tokenHash,
    expires_at: expiresAt,
    status: 'minted',
  });
  if (auditErr) return jsonError(`audit insert failed: ${auditErr.message}`, 500);

  return json({
    actionLink: `${functionBaseUrl()}/mint-demo-session?token=${encodeURIComponent(rawToken)}`,
    expiresAt,
    personaKey,
  });
}

async function consumeDemoToken(req: Request, sb: ReturnType<typeof createClient>) {
  const url = new URL(req.url);
  const rawToken = url.searchParams.get('token') ?? '';
  if (!rawToken) return jsonError('token required', 400);

  const tokenHash = await sha256(rawToken);
  const { data: row, error } = await sb
    .from('demo_session_audit')
    .select('id, persona_key, persona_email, redirect_to, expires_at, status')
    .eq('action_token_hash', tokenHash)
    .maybeSingle();

  if (error) return jsonError(`token lookup failed: ${error.message}`, 500);
  if (!row) return jsonError('Invalid demo session token', 404);
  if (row.status !== 'minted') return jsonError('Demo session token already used', 410);

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (!expiresAt || expiresAt < Date.now()) {
    await sb
      .from('demo_session_audit')
      .update({ status: 'expired', error_message: 'Token expired' })
      .eq('id', row.id);
    return jsonError('Demo session token expired', 410);
  }

  const persona = PERSONAS[row.persona_key];
  if (!persona || persona.email !== row.persona_email) {
    await sb
      .from('demo_session_audit')
      .update({ status: 'failed', error_message: 'Persona allowlist mismatch' })
      .eq('id', row.id);
    return jsonError('Persona allowlist mismatch', 500);
  }

  try {
    const landingPath = row.redirect_to ?? persona.landingRoute;
    const absoluteRedirectTo = absoluteRedirect(landingPath);
    // GoTrue ignores generate_link's `options.data` for users that already
    // exist, so the landing route never reaches the JWT for our pre-seeded
    // personas. Write it onto the user's metadata directly first; the magic
    // link is verified afterward, so the minted JWT picks up fresh metadata
    // and app/(auth)/callback can route to demo_persona_landing.
    await writePersonaLandingMetadata(sb, persona.email, row.persona_key, landingPath);
    const actionLink = await generateMagicLink(
      persona.email,
      absoluteRedirectTo,
      row.persona_key,
      landingPath,
    );
    await sb
      .from('demo_session_audit')
      .update({ status: 'consumed', consumed_at: new Date().toISOString() })
      .eq('id', row.id);
    return Response.redirect(actionLink, 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sb
      .from('demo_session_audit')
      .update({ status: 'failed', error_message: message })
      .eq('id', row.id);
    return jsonError(message, 500);
  }
}

/**
 * Persists the persona's landing route onto the auth user's metadata so the
 * minted magic-link JWT carries demo_persona_landing. generate_link's
 * `options.data` is silently dropped for existing users, so this is the only
 * reliable path. Non-fatal: a metadata failure still lets sign-in proceed
 * (the user just lands on the default route).
 */
async function writePersonaLandingMetadata(
  sb: ReturnType<typeof createClient>,
  email: string,
  personaKey: string,
  landingPath: string,
): Promise<void> {
  const { data: userId, error: lookupErr } = await sb.rpc(
    'find_auth_user_id_by_email',
    { p_email: email },
  );
  if (lookupErr || typeof userId !== 'string' || !userId) {
    console.warn(
      '[mint-demo-session] could not resolve user id for metadata write',
      email,
      lookupErr?.message,
    );
    return;
  }

  const adminAuth = (sb.auth as unknown as {
    admin: {
      updateUserById: (
        id: string,
        attrs: { user_metadata: Record<string, unknown> },
      ) => Promise<{ error: { message?: string } | null }>;
    };
  }).admin;

  const { error: updErr } = await adminAuth.updateUserById(userId, {
    user_metadata: {
      demo_persona: true,
      demo_persona_key: personaKey,
      demo_persona_landing: landingPath,
    },
  });
  if (updErr) {
    console.warn(
      '[mint-demo-session] updateUserById metadata write failed',
      email,
      updErr.message,
    );
  }
}

async function generateMagicLink(
  email: string,
  redirectTo: string,
  personaKey: string,
  landingPath: string,
): Promise<string> {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'magiclink',
      email,
      options: {
        redirect_to: redirectTo,
        // app/index.tsx reads demo_persona_landing from user_metadata
        // and routes there — works around the Supabase URL allowlist
        // silently dropping paths it doesn't recognize.
        data: {
          demo_persona: true,
          demo_persona_key: personaKey,
          demo_persona_landing: landingPath,
        },
      },
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`generate_link failed: ${resp.status} ${detail}`);
  }
  const linkData = await resp.json();
  const actionLink = linkData?.properties?.action_link ?? linkData?.action_link;
  if (!actionLink) {
    throw new Error(`generate_link returned no action_link: ${JSON.stringify(linkData)}`);
  }
  return actionLink;
}

async function audit(
  sb: ReturnType<typeof createClient>,
  row: {
    persona_key: string;
    persona_email?: string;
    caller_ip?: string;
    user_agent?: string | null;
    redirect_to?: string;
    status: 'rejected' | 'rate_limited' | 'failed';
    error_message: string;
  },
) {
  const { error } = await sb.from('demo_session_audit').insert(row);
  if (error) console.error('[mint-demo-session] audit failed', error.message);
}

function normalizeRedirect(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback;
  const value = input.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

async function resolvePersonaLanding(
  sb: ReturnType<typeof createClient>,
  persona: Persona,
): Promise<string> {
  if (!persona.orgSlug && !persona.orgName) return persona.landingRoute;

  let query = sb.from('organizations').select('id').limit(1);
  const result = persona.orgSlug
    ? await query.eq('slug', persona.orgSlug).maybeSingle()
    : await query.eq('name', persona.orgName!).maybeSingle();

  if (result.error || !result.data?.id) {
    console.warn(
      '[mint-demo-session] could not resolve org landing route',
      persona.orgSlug ?? persona.orgName,
      result.error?.message,
    );
    return persona.landingRoute;
  }

  return `/admin/${result.data.id}/overview`;
}

function absoluteRedirect(path: string): string {
  const base = DEMO_REDIRECT_BASE_URL.replace(/\/+$/, '');
  return `${base}${normalizeRedirect(path, '/demo')}`;
}

function functionBaseUrl(): string {
  if (DEMO_FUNCTION_BASE_URL) return DEMO_FUNCTION_BASE_URL.replace(/\/+$/, '');
  return `${SUPABASE_URL!.replace(/\/+$/, '')}/functions/v1`;
}

function getCallerIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? 'unknown';
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
