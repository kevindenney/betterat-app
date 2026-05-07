/**
 * Firebase Auth Bridge Edge Function
 * Exchanges Firebase ID token for RegattaFlow/Supabase session
 * Uses direct REST API calls to avoid supabase-js bundling issues
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Support multiple Firebase projects (RegattaFlow native + DragonWorlds integration)
const FIREBASE_PROJECTS = [
  {
    projectId: Deno.env.get('FIREBASE_PROJECT_ID') || 'regattaflow-app',
    apiKey: Deno.env.get('FIREBASE_API_KEY') || '',
  },
  {
    // DragonWorlds Firebase project - hardcoded for integration
    projectId: 'dragonworldshk2027',
    apiKey: 'AIzaSyDE_R9qmxZ7NNtNsYc045HvkszrB0_bg9s',
  },
];
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface BridgeRequest {
  firebaseToken: string;
  profile?: {
    displayName?: string;
    boatClass?: string;
    clubName?: string;
    photoUrl?: string;
  };
  communitySlug?: string;
}

// Direct Supabase REST API helper
async function supabaseQuery(
  table: string,
  options: {
    method?: string;
    select?: string;
    filter?: Record<string, string>;
    body?: Record<string, unknown>;
    upsert?: boolean;
  } = {}
) {
  const { method = 'GET', select, filter, body, upsert } = options;

  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  const params = new URLSearchParams();

  if (select) params.set('select', select);
  if (filter) {
    for (const [key, value] of Object.entries(filter)) {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;

  const headers: Record<string, string> = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (upsert) {
    headers['Prefer'] = 'resolution=merge-duplicates';
  }
  if (method === 'GET') {
    headers['Prefer'] = 'return=representation';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${error}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Create user via Supabase Auth Admin API
async function createAuthUser(email: string, metadata: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    const errorMsg = error.message || error.msg || error.error || JSON.stringify(error);
    console.log('[Auth Bridge] Create auth user failed:', errorMsg);
    throw new Error(errorMsg);
  }

  return response.json();
}

// Ensure auth user exists, create if not (handles "already exists" gracefully)
async function ensureAuthUser(email: string, metadata: Record<string, unknown>) {
  try {
    console.log('[Auth Bridge] Ensuring auth user exists for:', email);
    const user = await createAuthUser(email, metadata);
    console.log('[Auth Bridge] Created new auth user:', user.id);
    return user;
  } catch (err) {
    const errorMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    console.log('[Auth Bridge] Create auth user error:', errorMsg);
    // If user already exists, that's fine - check various error formats
    if (
      errorMsg.includes('already been registered') ||
      errorMsg.includes('already exists') ||
      errorMsg.includes('duplicate') ||
      errorMsg.includes('unique constraint') ||
      errorMsg.includes('email_address')
    ) {
      console.log('[Auth Bridge] Auth user already exists for:', email);
      return { id: null, email }; // Return minimal object, we don't need the ID
    }
    throw err;
  }
}

// Decode JWT payload
function decodeJwt(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
  return JSON.parse(atob(padded));
}

// Verify Firebase token - tries multiple Firebase projects
async function verifyFirebaseToken(idToken: string) {
  // First, decode the token to check which project it's from
  const payload = decodeJwt(idToken);
  const tokenProjectId = payload.aud as string;

  console.log('[Auth Bridge] Token project ID:', tokenProjectId);

  // Find matching project config
  const projectConfig = FIREBASE_PROJECTS.find(p => p.projectId === tokenProjectId);

  // Try API verification with matching project's API key
  if (projectConfig?.apiKey) {
    console.log('[Auth Bridge] Verifying with API key for project:', projectConfig.projectId);
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${projectConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const user = data.users?.[0];
      if (user) {
        console.log('[Auth Bridge] API verification successful for:', user.email);
        return {
          localId: user.localId,
          email: user.email,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
        };
      }
    } else {
      console.log('[Auth Bridge] API verification failed, status:', response.status);
    }
  }

  // Fallback: validate JWT claims for any known project
  const now = Math.floor(Date.now() / 1000);

  if (!payload.sub) throw new Error('Invalid token: no subject');
  if (payload.exp && (payload.exp as number) < now) throw new Error('Token expired');

  // Check if issuer matches any known project
  const validProject = FIREBASE_PROJECTS.find(
    p => payload.iss === `https://securetoken.google.com/${p.projectId}` && payload.aud === p.projectId
  );

  if (!validProject) {
    console.error('[Auth Bridge] Token from unknown project. ISS:', payload.iss, 'AUD:', payload.aud);
    throw new Error(`Invalid issuer: token from unknown Firebase project`);
  }

  console.log('[Auth Bridge] JWT validation successful for project:', validProject.projectId);
  return {
    localId: payload.sub as string,
    email: payload.email as string,
    displayName: payload.name as string | undefined,
    photoUrl: payload.picture as string | undefined,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: BridgeRequest = await req.json().catch(() => ({}));

    // Accept Firebase token from body OR Authorization header
    let firebaseToken = body.firebaseToken;
    if (!firebaseToken) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        firebaseToken = authHeader.slice(7);
      }
    }

    if (!firebaseToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firebase token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Firebase token
    let firebaseUser;
    try {
      firebaseUser = await verifyFirebaseToken(firebaseToken);
    } catch (error) {
      console.error('Firebase token verification failed:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired Firebase token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let userId: string;
    let isNewUser = false;

    // Check for existing user by firebase_uid
    const existingByFirebase = await supabaseQuery('users', {
      select: 'id',
      filter: { firebase_uid: `eq.${firebaseUser.localId}` },
    });

    // authUserId tracks the actual auth.users ID for session/membership operations
    let authUserId: string | null = null;

    if (existingByFirebase?.[0]) {
      userId = existingByFirebase[0].id;
      // Ensure auth user exists for magic link generation
      const authUser = await ensureAuthUser(firebaseUser.email.toLowerCase(), {
        full_name: body.profile?.displayName || firebaseUser.displayName,
        firebase_uid: firebaseUser.localId,
        auth_source: 'dragon_worlds',
      });
      authUserId = authUser?.id || userId;
    } else {
      // Check by email
      const existingByEmail = await supabaseQuery('users', {
        select: 'id',
        filter: { email: `eq.${firebaseUser.email.toLowerCase()}` },
      });

      if (existingByEmail?.[0]) {
        userId = existingByEmail[0].id;
        // Link Firebase UID
        await supabaseQuery('users', {
          method: 'PATCH',
          filter: { id: `eq.${userId}` },
          body: { firebase_uid: firebaseUser.localId, auth_source: 'dragon_worlds' },
        });
        // Ensure auth user exists for magic link generation
        const authUser = await ensureAuthUser(firebaseUser.email.toLowerCase(), {
          full_name: body.profile?.displayName || firebaseUser.displayName,
          firebase_uid: firebaseUser.localId,
          auth_source: 'dragon_worlds',
        });
        authUserId = authUser?.id || userId;
      } else {
        // Create new user
        isNewUser = true;
        const displayName = body.profile?.displayName || firebaseUser.displayName || firebaseUser.email.split('@')[0];

        const authUser = await createAuthUser(firebaseUser.email, {
          full_name: displayName,
          avatar_url: body.profile?.photoUrl || firebaseUser.photoUrl,
          firebase_uid: firebaseUser.localId,
          auth_source: 'dragon_worlds',
        });

        userId = authUser.id;

        // Create profile
        await supabaseQuery('users', {
          method: 'POST',
          body: {
            id: userId,
            email: firebaseUser.email.toLowerCase(),
            full_name: displayName,
            avatar_url: body.profile?.photoUrl || firebaseUser.photoUrl,
            firebase_uid: firebaseUser.localId,
            auth_source: 'dragon_worlds',
            user_type: 'sailor',
            onboarding_completed: true,
          },
          upsert: true,
        });
      }
    }

    // Auto-join community using the auth user ID (from session)
    // This ensures the membership matches the authenticated session
    const membershipUserId = authUserId || userId;
    const communitySlug = body.communitySlug || '2027-hk-dragon-worlds';
    const communities = await supabaseQuery('communities', {
      select: 'id',
      filter: { slug: `eq.${communitySlug}` },
    });

    if (communities?.[0]) {
      try {
        console.log('[Auth Bridge] Auto-joining community with user:', membershipUserId);
        await supabaseQuery('community_memberships', {
          method: 'POST',
          body: {
            user_id: membershipUserId,
            community_id: communities[0].id,
            role: 'member',
            notifications_enabled: true,
          },
          upsert: true,
        });
      } catch (err) {
        // Ignore duplicate membership errors - user is already a member
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (!errorMsg.includes('duplicate key') && !errorMsg.includes('23505')) {
          throw err;
        }
        console.log('[Auth Bridge] User already a community member');
      }
    }

    // Generate real Supabase session using Admin API.
    //
    // The magic-link flow is racy: when two parallel bridge calls
    // generate links for the same email, Supabase invalidates the
    // older link's hashed_token when the newer one is issued. The
    // slower call's verify() then 401s and we 500.
    //
    // Defense-in-depth: if verify fails, regenerate the link and try
    // once more. The HKDW client also serializes calls, but external
    // / future callers (WebView reloads, deep links) can still race.
    // deno-lint-ignore no-explicit-any
    async function generateAndVerify(): Promise<any> {
      const generateLinkResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'magiclink',
          email: firebaseUser.email.toLowerCase(),
          options: {
            data: {
              firebase_bridge: true,
              firebase_uid: firebaseUser.localId,
            },
          },
        }),
      });

      if (!generateLinkResponse.ok) {
        const errorText = await generateLinkResponse.text();
        throw new Error(`generate_link failed: ${generateLinkResponse.status} ${errorText}`);
      }

      const linkData = await generateLinkResponse.json();
      const tokenHash = linkData.properties?.hashed_token || linkData.hashed_token;

      if (!tokenHash) {
        throw new Error(`generate_link returned no hashed_token: ${JSON.stringify(linkData)}`);
      }

      const verifyResponse = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'magiclink',
          token_hash: tokenHash,
        }),
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        throw new Error(`verify failed: ${verifyResponse.status} ${errorText}`);
      }

      return await verifyResponse.json();
    }

    // deno-lint-ignore no-explicit-any
    let sessionData: any;
    try {
      sessionData = await generateAndVerify();
    } catch (firstErr) {
      console.warn('[Auth Bridge] First generate+verify attempt failed, retrying once:', firstErr);
      sessionData = await generateAndVerify();
    }

    if (!sessionData.access_token) {
      console.error('No access_token in verify response:', sessionData);
      throw new Error('Session creation failed');
    }

    // Get profile
    const profiles = await supabaseQuery('users', {
      select: 'full_name',
      filter: { id: `eq.${userId}` },
    });

    // Calculate expires_at in milliseconds if it's in seconds
    let expiresAtMs = sessionData.expires_at;
    if (expiresAtMs < 10000000000) {
      // It's in seconds, convert to milliseconds
      expiresAtMs = expiresAtMs * 1000;
    }

    // Return response with real Supabase session tokens
    // Session object includes both snake_case (Supabase standard) and camelCase (Dragon Worlds compatible)
    // IMPORTANT: userId should be the auth.users ID (sessionData.user.id) for RLS to work
    // since RLS checks auth.uid() which comes from the JWT
    const sessionUserId = sessionData.user?.id ?? userId;

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          // Snake case (Supabase standard)
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
          expires_in: sessionData.expires_in,
          expires_at: sessionData.expires_at,
          token_type: sessionData.token_type || 'bearer',
          user: sessionData.user,
          // Camel case (Dragon Worlds compatible)
          accessToken: sessionData.access_token,
          refreshToken: sessionData.refresh_token,
          expiresIn: sessionData.expires_in,
          expiresAt: expiresAtMs, // Dragon Worlds expects milliseconds
          userId: sessionUserId,
          email: firebaseUser.email,
        },
        // Also include flat fields for backwards compatibility
        accessToken: sessionData.access_token,
        refreshToken: sessionData.refresh_token,
        expiresIn: sessionData.expires_in,
        expiresAt: expiresAtMs,
        user: {
          id: sessionUserId,
          email: firebaseUser.email,
          fullName: profiles?.[0]?.full_name,
          isNewUser,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bridge error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
