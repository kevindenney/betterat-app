/* eslint-disable no-console -- Vercel function: console is the canonical logging path. */
/**
 * In-app CaptureService turn endpoint.
 *
 * Step Arch C/5 — gives the in-app surface (voice transcript + text + photo
 * captions) access to the same conversational tool-using CaptureService that
 * powers Telegram + WhatsApp. The endpoint is stateless: the client owns the
 * conversation history and passes it in on every request. Auth is enforced
 * via Supabase JWT; once the JWT validates, the rest of the flow uses a
 * service-role client (matches the bot adapters, so the same RPCs and
 * server-side execution paths apply).
 *
 * Request body:
 *   {
 *     userMessage: string,                             // required
 *     history?: { role: 'user'|'assistant', content: string }[],
 *     uploadedPhotoUrl?: string,                       // optional, client-uploaded
 *   }
 *
 * Response body:
 *   {
 *     responseText: string,
 *     iterations: number,
 *     mentionedStepIds: { id: string; title: string }[],
 *   }
 *
 * Migration plan: docs/audit/step-architecture-migration-plan.md §4 Step C.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type Anthropic from '@anthropic-ai/sdk';
import {
  createSupabaseClient,
  resolveAuthContext,
  loadUserContext,
} from '../../services/capture/auth';
import {
  buildSystemPrompt,
  buildPhotoSystemPrompt,
} from '../../services/capture/systemPrompt';
import { runConversationTurn } from '../../services/capture/conversation';
import { MAX_CONVERSATION_MESSAGES } from '../../services/capture/types';

// Allow up to 120s for multi-tool chains (debrief flow: 5+ tool calls).
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Request/response types
// ---------------------------------------------------------------------------

interface CaptureTurnRequest {
  userMessage?: unknown;
  history?: unknown;
  uploadedPhotoUrl?: unknown;
}

interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

function parseHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is HistoryEntry =>
        !!m &&
        typeof m === 'object' &&
        (m as { role?: unknown }).role !== undefined &&
        ((m as { role: unknown }).role === 'user' ||
          (m as { role: unknown }).role === 'assistant') &&
        typeof (m as { content?: unknown }).content === 'string',
    )
    .slice(-MAX_CONVERSATION_MESSAGES);
}

// ---------------------------------------------------------------------------
// JWT verification
// ---------------------------------------------------------------------------

async function verifyJwt(authorizationHeader: string | undefined): Promise<string | null> {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const verifier = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await verifier.auth.getUser(token.trim());
  if (error || !data.user) return null;
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 1. JWT auth gate
  const userId = await verifyJwt(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // 2. Service-role Supabase client for the rest of the flow (matches the
  //    bot adapters, including the B/2 mark_step_active service_role path).
  const supabase = createSupabaseClient();
  if (!supabase) {
    res.status(500).json({ error: 'Service not configured' });
    return;
  }

  // 3. Parse and validate body
  let body: CaptureTurnRequest;
  try {
    body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as CaptureTurnRequest)
        : ((req.body ?? {}) as CaptureTurnRequest);
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const userMessage =
    typeof body.userMessage === 'string' ? body.userMessage.trim() : '';
  if (!userMessage) {
    res.status(400).json({ error: 'userMessage is required' });
    return;
  }

  const uploadedPhotoUrl =
    typeof body.uploadedPhotoUrl === 'string' && body.uploadedPhotoUrl.length > 0
      ? body.uploadedPhotoUrl
      : undefined;
  const history = parseHistory(body.history);

  // 4. Resolve BetterAt auth context + user context for the system prompt
  const auth = await resolveAuthContext(supabase, userId);
  const userCtx = await loadUserContext(supabase, userId, auth.clubId);

  // 5. Build system prompt + initial message list
  const systemPrompt = uploadedPhotoUrl
    ? buildPhotoSystemPrompt(userCtx, 'in_app_voice')
    : buildSystemPrompt(userCtx, 'in_app_voice');

  // For the in-app surface the photo bytes don't live here — the client has
  // already uploaded the photo and supplied a URL. We surface the URL in the
  // text so Claude can pass it to attach_step_evidence (the runConversationTurn
  // loop also auto-injects it as photo_url on that tool).
  const userContent = uploadedPhotoUrl
    ? `${userMessage}\n\n[Photo uploaded: ${uploadedPhotoUrl}]`
    : userMessage;

  const initialMessages: Anthropic.MessageParam[] = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userContent },
  ];

  // 6. Run the shared tool-use loop
  try {
    const result = await runConversationTurn({
      systemPrompt,
      messages: initialMessages,
      supabase,
      auth,
      channel: 'in_app_voice',
      uploadedPhotoUrl,
    });

    res.status(200).json({
      responseText: result.responseText,
      iterations: result.iterations,
      mentionedStepIds: result.mentionedStepIds,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[in_app_voice] runConversationTurn failed:', message);
    res.status(500).json({ error: 'Capture turn failed', details: message });
  }
}
