/**
 * Shared button/callback action dispatcher for the cross-surface CaptureService.
 *
 * Step Arch C/3 — extracts the parallel `handleCallbackQuery` (Telegram) and
 * `handleButtonReply` (WhatsApp) handlers into a pure-logic core:
 *   - parseButtonPayload  — turn raw "action:rest[:sub]" strings into a tagged union
 *   - runButtonAction     — dispatch to the corresponding executeTool call and
 *                           return a typed success/error result
 *
 * Channel adapters retain only the I/O they own:
 *   - link-table lookups (telegram_links vs whatsapp_links)
 *   - conversation-table reads/writes for pending_photo_url
 *   - sending the reply (sendMessage vs sendText) + any channel-specific
 *     formatting (Telegram MarkdownV2 escaping)
 *
 * Migration plan: docs/audit/step-architecture-migration-plan.md §4 Step C.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { executeTool } from '../../lib/telegram/tools';
import type { AuthContext } from '../mcp/server';
import type { CaptureChannel } from './types';

// ---------------------------------------------------------------------------
// Parsed action shape
// ---------------------------------------------------------------------------

export type ButtonAction =
  | { kind: 'attach'; stepId: string }
  | { kind: 'detail'; stepId: string }
  | { kind: 'substep_done'; stepId: string; subStepId: string }
  | { kind: 'status'; stepId: string; newStatus: 'completed' | 'in_progress' | 'skipped' }
  | { kind: 'invalid'; reason: string };

const STATUS_MAP: Record<string, 'completed' | 'in_progress' | 'skipped'> = {
  done: 'completed',
  wip: 'in_progress',
  skip: 'skipped',
};

/**
 * Parse a "action:rest[:sub]" button payload into a tagged union.
 *
 * Supported shapes:
 *   - "done:<step_id>" | "wip:<step_id>" | "skip:<step_id>"
 *   - "detail:<step_id>"
 *   - "attach:<step_id>"
 *   - "substep_done:<step_id>:<sub_step_id>"
 *
 * Returns { kind: 'invalid' } for any malformed input.
 */
export function parseButtonPayload(data: string): ButtonAction {
  if (!data) return { kind: 'invalid', reason: 'empty payload' };

  const colonIdx = data.indexOf(':');
  if (colonIdx < 0) return { kind: 'invalid', reason: 'missing action separator' };

  const action = data.slice(0, colonIdx);
  const rest = data.slice(colonIdx + 1);
  if (!action || !rest) return { kind: 'invalid', reason: 'empty action or args' };

  if (action === 'substep_done') {
    const sep = rest.indexOf(':');
    if (sep < 0) return { kind: 'invalid', reason: 'substep_done missing sub_step_id' };
    const stepId = rest.slice(0, sep);
    const subStepId = rest.slice(sep + 1);
    if (!stepId || !subStepId) return { kind: 'invalid', reason: 'substep_done empty ids' };
    return { kind: 'substep_done', stepId, subStepId };
  }

  if (action === 'attach') return { kind: 'attach', stepId: rest };
  if (action === 'detail') return { kind: 'detail', stepId: rest };

  const newStatus = STATUS_MAP[action];
  if (newStatus) return { kind: 'status', stepId: rest, newStatus };

  return { kind: 'invalid', reason: `unknown action: ${action}` };
}

// ---------------------------------------------------------------------------
// Dispatch result + execution
// ---------------------------------------------------------------------------

/**
 * Typed shape of the underlying `executeTool` JSON responses we care about
 * at the dispatcher layer. The adapter is welcome to read more fields off
 * the raw response if needed; this just types the common ones.
 */
export type ButtonActionResult =
  | {
      ok: true;
      kind: 'attach';
      stepId: string;
      stepTitle: string | null;
    }
  | {
      ok: true;
      kind: 'detail';
      title: string | null;
      subSteps: { completed: boolean; text: string }[];
    }
  | {
      ok: true;
      kind: 'substep_done';
      subStepTitle: string | null;
      progress: string | null;
    }
  | {
      ok: true;
      kind: 'status';
      newStatus: 'completed' | 'in_progress' | 'skipped';
      stepTitle: string | null;
    }
  | { ok: false; error: string };

/** Per-channel display label for the photo-attach caption. */
const ATTACH_CAPTION: Record<CaptureChannel, string> = {
  telegram: 'Added via Telegram',
  whatsapp: 'Added via WhatsApp',
  in_app_voice: 'Added via voice',
};

interface RunButtonContext {
  supabase: SupabaseClient;
  auth: AuthContext;
  channel: CaptureChannel;
  /** Pre-fetched pending photo URL from the channel's conversations table. */
  pendingPhotoUrl?: string | null;
}

function readError(parsed: unknown): string | null {
  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    const err = (parsed as { error: unknown }).error;
    if (typeof err === 'string') return err;
  }
  return null;
}

function readString(parsed: unknown, key: string): string | null {
  if (parsed && typeof parsed === 'object' && key in parsed) {
    const v = (parsed as Record<string, unknown>)[key];
    if (typeof v === 'string') return v;
  }
  return null;
}

/**
 * Dispatch a parsed `ButtonAction` to the appropriate `executeTool` call
 * and return a typed result. Does NOT send any reply — the caller (adapter)
 * is responsible for converting the result into a channel-specific message.
 *
 * For `attach`, the adapter must pre-fetch its channel's pending photo URL
 * and pass it via `ctx.pendingPhotoUrl`. The shared module won't reach into
 * the per-channel `*_conversations` table because the key shape differs
 * (chat_id vs phone).
 */
export async function runButtonAction(
  action: ButtonAction,
  ctx: RunButtonContext,
): Promise<ButtonActionResult> {
  if (action.kind === 'invalid') {
    return { ok: false, error: `Invalid action: ${action.reason}` };
  }

  const { supabase, auth, channel } = ctx;

  if (action.kind === 'attach') {
    const photoUrl = ctx.pendingPhotoUrl ?? null;
    if (!photoUrl) {
      return { ok: false, error: 'No photo to attach — send a photo first' };
    }

    const raw = await executeTool(
      'attach_step_evidence',
      { step_id: action.stepId, photo_url: photoUrl, caption: ATTACH_CAPTION[channel] },
      supabase,
      auth,
    );
    const parsed = JSON.parse(raw);
    const err = readError(parsed);
    if (err) return { ok: false, error: err };
    return {
      ok: true,
      kind: 'attach',
      stepId: action.stepId,
      stepTitle: readString(parsed, 'step_title'),
    };
  }

  if (action.kind === 'detail') {
    const raw = await executeTool('get_step_detail', { step_id: action.stepId }, supabase, auth);
    const parsed = JSON.parse(raw);
    const err = readError(parsed);
    if (err) return { ok: false, error: err };
    const subSteps = Array.isArray((parsed as { sub_steps?: unknown }).sub_steps)
      ? ((parsed as { sub_steps: unknown[] }).sub_steps.filter(
          (s): s is { completed: boolean; text: string } =>
            !!s && typeof s === 'object' && 'completed' in s && 'text' in s,
        ))
      : [];
    return {
      ok: true,
      kind: 'detail',
      title: readString(parsed, 'title'),
      subSteps,
    };
  }

  if (action.kind === 'substep_done') {
    const raw = await executeTool(
      'toggle_sub_step',
      { step_id: action.stepId, sub_step_id: action.subStepId, completed: true },
      supabase,
      auth,
    );
    const parsed = JSON.parse(raw);
    const err = readError(parsed);
    if (err) return { ok: false, error: err };
    return {
      ok: true,
      kind: 'substep_done',
      subStepTitle: readString(parsed, 'sub_step_title'),
      progress: readString(parsed, 'progress'),
    };
  }

  // action.kind === 'status'
  const raw = await executeTool(
    'update_step_status',
    { step_id: action.stepId, status: action.newStatus },
    supabase,
    auth,
  );
  const parsed = JSON.parse(raw);
  const err = readError(parsed);
  if (err) return { ok: false, error: err };
  const stepBlock = (parsed as { step?: { title?: unknown } }).step;
  const stepTitle = stepBlock && typeof stepBlock.title === 'string' ? stepBlock.title : null;
  return {
    ok: true,
    kind: 'status',
    newStatus: action.newStatus,
    stepTitle,
  };
}

/**
 * Convenience: human-readable status label used by both adapters in their
 * success replies ("✅ Done: <title>" / "▶️ Started: <title>" / "⏭️ Skipped: <title>").
 */
export function statusLabel(newStatus: 'completed' | 'in_progress' | 'skipped'): string {
  switch (newStatus) {
    case 'completed':
      return '✅ Done';
    case 'in_progress':
      return '▶️ Started';
    case 'skipped':
      return '⏭️ Skipped';
  }
}
