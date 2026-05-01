/**
 * CoachService — channel-agnostic AI coach engine.
 *
 * Wraps the Claude Haiku 4.5 multi-turn tool loop and conversation persistence
 * that used to live inline in api/telegram/webhook.ts. Both the Telegram webhook
 * and the in-app /api/coach/chat endpoint call this service so behaviour stays
 * identical across channels.
 *
 * Conversation storage uses the existing telegram_conversations table:
 *   - Telegram channel: looked up by telegram_chat_id
 *   - In-app channel:  looked up by user_id (telegram_chat_id may be null)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAnthropicTools, executeTool } from '../../lib/telegram/tools';
import type { AuthContext } from '../mcp/server';
import { fetchCoachUserContext } from './userContext';
import { buildSystemPrompt, buildPhotoSystemPrompt, type CoachChannelName } from './systemPrompt';
import { getToolResponseActions } from './actionMapping';
import { classifyPhoto } from './photoRouter';
import type {
  CoachActionRow,
  CoachMentionedStep,
  CoachTurnInput,
  CoachTurnResult,
  CoachUserContext,
} from './types';

const MAX_TOOL_ITERATIONS = 8;
const MAX_CONVERSATION_MESSAGES = 10;
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

// ---------------------------------------------------------------------------
// Conversation row helpers
// ---------------------------------------------------------------------------

interface ConversationRow {
  id: string;
  messages: { role: string; content: string }[];
  pending_photo_url?: string | null;
}

interface LookupParams {
  channel: CoachChannelName;
  chatId?: number;
  userId: string;
}

async function loadOrCreateConversation(
  supabase: SupabaseClient,
  { channel, chatId, userId }: LookupParams,
): Promise<ConversationRow> {
  // For Telegram channel we key by telegram_chat_id (preserves existing behaviour).
  // For in-app channel we key by user_id with a NULL chat_id, so the row can
  // later be merged with a Telegram one when the user links Telegram.
  let row: ConversationRow | null = null;

  if (channel === 'telegram' && chatId !== undefined) {
    const { data } = await supabase
      .from('telegram_conversations')
      .select('id, messages, pending_photo_url')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();
    row = (data as ConversationRow | null) ?? null;
  } else {
    const { data } = await supabase
      .from('telegram_conversations')
      .select('id, messages, pending_photo_url')
      .eq('user_id', userId)
      .order('last_active_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    row = (data as ConversationRow | null) ?? null;
  }

  if (row) return row;

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    messages: [],
  };
  if (channel === 'telegram' && chatId !== undefined) {
    insertPayload.telegram_chat_id = chatId;
  } else {
    // In-app rows still need a telegram_chat_id (column is NOT NULL on the
    // table). Use a deterministic synthetic value so re-inserts collide and
    // the unique-index gate keeps working. Telegram chat_ids are positive
    // BIGINTs from Telegram, so we use negative values for in-app rows.
    // -1 * (low 53 bits of UUID hash) keeps us inside JS Number safe range.
    insertPayload.telegram_chat_id = syntheticChatIdForUser(userId);
  }

  const { data: created } = await supabase
    .from('telegram_conversations')
    .insert(insertPayload)
    .select('id, messages, pending_photo_url')
    .single();

  return created as ConversationRow;
}

/**
 * Stable, negative-valued synthetic chat_id derived from the user_id.
 * Used for in-app-only conversation rows so they don't collide with real
 * Telegram chat_ids (which are always positive).
 */
function syntheticChatIdForUser(userId: string): number {
  // Hash the UUID into ~52 bits of integer to stay within JS Number safe range.
  let hash = 0n;
  for (const ch of userId) {
    hash = (hash * 131n + BigInt(ch.charCodeAt(0))) & ((1n << 52n) - 1n);
  }
  // Negative to distinguish from Telegram-issued chat_ids.
  return -Number(hash);
}

// ---------------------------------------------------------------------------
// Persisted conversation summary helpers
// ---------------------------------------------------------------------------

function buildAssistantSummary(
  responseText: string,
  iterations: number,
  mentionedSteps: CoachMentionedStep[],
): string {
  // Append step IDs as a trailing metadata block (newline-separated) so the
  // model sees them as context, not as a leading text pattern to mimic. Avoid
  // marker prefixes like "[Used N tool(s)]" — Haiku copies those into its
  // *output* on later turns, making it look like tools ran when they didn't.
  const stepContext = mentionedSteps.length > 0
    ? `\n\n<context-only>steps: ${mentionedSteps.map(s => `${s.title} (${s.id})`).join(', ')}</context-only>`
    : '';

  // Truncate verbose tool-using responses so Haiku doesn't learn to write
  // "✅ Done!" prose without actually calling the underlying tool.
  const body = iterations > 0 ? responseText.slice(0, 120) : responseText;
  return `${body}${stepContext}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RunCoachTurnOptions {
  channel: CoachChannelName;
  /** Telegram chat_id, if running on the Telegram channel. */
  chatId?: number;
  /** Resolved auth context (userId, clubId, tier). */
  auth: AuthContext;
  /** Pre-fetched user context — pass through to skip an extra fetch. */
  userCtx?: CoachUserContext;
  /** Input from the user this turn (text, voice, or photo). */
  input: CoachTurnInput;
  /** Hint for the model when extra context should be appended to the system prompt. */
  systemPromptExtra?: string;
}

/**
 * Run a single coach turn end-to-end:
 *   1. Load conversation history (last MAX_CONVERSATION_MESSAGES messages)
 *   2. Compose the user message (text / voice transcript / image+caption)
 *   3. Multi-turn Claude tool loop (up to MAX_TOOL_ITERATIONS)
 *   4. Track mentioned step IDs + action buttons
 *   5. Persist the user + assistant messages and the pending_photo_url
 */
export async function runCoachTurn(
  supabase: SupabaseClient,
  opts: RunCoachTurnOptions,
): Promise<CoachTurnResult> {
  const { channel, chatId, auth, input } = opts;
  const userCtx = opts.userCtx ?? (await fetchCoachUserContext(supabase, auth.userId, auth.clubId));

  const conversation = await loadOrCreateConversation(supabase, {
    channel,
    chatId,
    userId: auth.userId,
  });

  const history = (conversation.messages ?? []) as { role: string; content: string }[];
  const recentHistory = history.slice(-MAX_CONVERSATION_MESSAGES);

  // ---- Build user content + system prompt ---------------------------------
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let userContent: Anthropic.ContentBlockParam[] | string;
  let systemPrompt: string;
  let historyEntry: string;
  let uploadedPhotoUrl = '';

  if (input.kind === 'photo') {
    const captionText = input.caption || "What is this? If it's food, analyze and log the nutrition.";
    const photoUrlNote = input.photoUrl ? `\n\n[Photo uploaded: ${input.photoUrl}]` : '';
    userContent = [
      {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: input.mimeType as 'image/jpeg', data: input.photoBase64 },
      },
      { type: 'text' as const, text: `${captionText}${photoUrlNote}` },
    ];
    const category = await classifyPhoto(anthropic, input.photoBase64, input.mimeType);
    console.warn(`[coach] Photo classified as: ${category}`);
    systemPrompt = buildPhotoSystemPrompt(channel, userCtx, category);
    historyEntry = `[Sent a photo${input.caption ? `: ${input.caption}` : ''}]${input.photoUrl ? ` [url: ${input.photoUrl}]` : ''}`;
    uploadedPhotoUrl = input.photoUrl;

    // Store pending photo URL so action buttons can attach it later.
    if (input.photoUrl) {
      await supabase
        .from('telegram_conversations')
        .update({ pending_photo_url: input.photoUrl })
        .eq('id', conversation.id);
    }

    // Photo caption debrief detection: when a photo arrives with a multi-sentence
    // narrative caption ("learned X, next time Y"), the user is debriefing AND
    // attaching evidence in one shot. The category prompt only tells the bot to
    // attach + critique — without this addendum it never calls log_debrief and
    // the narrative is lost.
    const caption = (input.caption ?? '').trim();
    const captionLooksLikeDebrief = caption.length > 40 && /[.,;!?]/.test(caption);
    if (captionLooksLikeDebrief) {
      const lastAssistantMsg = recentHistory.filter(m => m.role === 'assistant').slice(-1)[0]?.content ?? '';
      const stepIdMatch = lastAssistantMsg.match(/\(([0-9a-f-]{36})\)/i);
      const stepIdHint = stepIdMatch ? ` Use step_id=${stepIdMatch[1]} for log_debrief unless attach_step_evidence returns a different id.` : '';
      systemPrompt += `\n\nPHOTO + DEBRIEF DETECTED: The user's caption is a multi-sentence retrospective ("${caption.slice(0, 120)}${caption.length > 120 ? '…' : ''}"). After attach_step_evidence, you MUST also call log_debrief on the same step — split the caption into what_learned (insight / what went well) and what_to_change (what they'd do next time / gear or technique fix). Do NOT skip log_debrief — the narrative is the lesson, the photo is just evidence.${stepIdHint}`;
    }
  } else {
    const userText = input.text;
    systemPrompt = buildSystemPrompt(channel, userCtx);
    userContent = userText;
    historyEntry = input.voiceTranscript ? `[Voice note]: ${userText}` : userText;

    // Voice-note nudge mirrors the legacy webhook behaviour.
    if (input.voiceTranscript) {
      systemPrompt += `\n\nThe user sent a voice note (transcribed above). If they're describing something they want to do, ` +
        `propose creating a step with create_step. If they're debriefing something they did, follow the DEBRIEF FLOW.`;
    }

    // URL detection nudge — preserved from the webhook.
    const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
    const urlMatches = userText.match(URL_RE) ?? [];
    if (urlMatches.length > 0) {
      systemPrompt += `\n\nThe user's message contains ${urlMatches.length} URL(s): ${urlMatches.join(', ')}. ` +
        `Call save_url_to_playbook for each unique URL unless the user explicitly asks for something different. ` +
        `Acknowledge concisely after saving — don't dump tool output.`;
    }

    // Photo follow-up: if the previous turn left a pending photo URL, the user
    // is now telling us which step to attach it to. Re-inject the URL so the
    // attach_step_evidence call below picks it up, and instruct the model to
    // attach immediately once the step is identified.
    if (conversation.pending_photo_url) {
      uploadedPhotoUrl = conversation.pending_photo_url;
      systemPrompt += `\n\nPENDING PHOTO FOLLOW-UP: A photo was uploaded earlier in this thread (URL: ${conversation.pending_photo_url}). The user's current message is clarifying which step it belongs to. Once you identify the matching step (call get_student_timeline if needed), IMMEDIATELY call attach_step_evidence with that step_id — do NOT ask for confirmation, the user already gave you the context. After attaching, give a one-line confirmation.`;
    }

    // Debrief detection: when the previous assistant turn referenced a step
    // (i.e. it has step IDs in its context) and the user's message is a
    // multi-sentence narrative, the user is debriefing. Haiku tends to
    // promise "Let me save your debrief..." in text without actually calling
    // a tool, so force the call here.
    const lastAssistantMsg = recentHistory.filter(m => m.role === 'assistant').slice(-1)[0]?.content ?? '';
    const lastTurnHadStep = /\(([0-9a-f-]{36})\)/i.test(lastAssistantMsg);
    const looksLikeNarrative = userText.length > 40 && /[.,;!?]/.test(userText);
    if (lastTurnHadStep && looksLikeNarrative) {
      const stepIdMatch = lastAssistantMsg.match(/\(([0-9a-f-]{36})\)/i);
      const stepIdHint = stepIdMatch ? ` Use step_id=${stepIdMatch[1]}.` : '';
      systemPrompt += `\n\nDEBRIEF DETECTED: The user is narrating what happened on a step they just touched — this is an end-of-session retrospective, not a single in-the-moment note. You MUST call log_debrief FIRST with the user's narrative split into what_learned (positive / insights), what_to_change (what didn't work), and next_step_notes (next focus, if mentioned).${stepIdHint} Do NOT call log_observation for this — log_observation is for short single-moment fragments only. Do NOT write "Let me save your debrief" without actually calling the tool — that's a hallucination. After log_debrief succeeds, you may ask one focused follow-up question.`;
    }
  }

  if (opts.systemPromptExtra) {
    systemPrompt += `\n\n${opts.systemPromptExtra}`;
  }

  const messages: Anthropic.MessageParam[] = [
    ...recentHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userContent },
  ];

  // ---- Call Claude --------------------------------------------------------
  const tools = getAnthropicTools();

  const cachedSystem: Anthropic.TextBlockParam = {
    type: 'text',
    text: systemPrompt,
    cache_control: { type: 'ephemeral' },
  };
  const cachedTools = tools.map((tool, i) =>
    i === tools.length - 1 ? { ...tool, cache_control: { type: 'ephemeral' as const } } : tool,
  );

  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [cachedSystem],
    tools: cachedTools,
    messages,
  });

  // ---- Tool use loop ------------------------------------------------------
  let iterations = 0;
  let lastActionRows: CoachActionRow[] | null = null;
  let attachEvidenceCalled = false;
  const mentionedSteps: CoachMentionedStep[] = [];

  while (response.stop_reason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlockParam & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      console.warn(`[coach] Tool call #${iterations}: ${block.name}`, JSON.stringify(block.input).slice(0, 200));

      // Inject photo_url for attach_step_evidence — Claude often omits this optional param.
      let toolInput = block.input;
      if (block.name === 'attach_step_evidence' && uploadedPhotoUrl) {
        toolInput = { ...block.input, photo_url: uploadedPhotoUrl };
        attachEvidenceCalled = true;
      }

      const toolStart = Date.now();
      const result = await executeTool(block.name, toolInput, supabase, auth);
      console.warn(`[coach] Tool result (${Date.now() - toolStart}ms): ${block.name}`, result.slice(0, 300));

      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });

      // Track step IDs from tool results for conversation context.
      try {
        const parsed = JSON.parse(result);
        if (parsed.step?.id && parsed.step?.title) {
          mentionedSteps.push({ id: parsed.step.id, title: parsed.step.title });
        } else if (parsed.step_id && parsed.step_title) {
          mentionedSteps.push({ id: parsed.step_id, title: parsed.step_title });
        }
      } catch {
        /* ignore parse errors */
      }

      const hasPhoto = input.kind === 'photo';
      const rows = getToolResponseActions(block.name, result, hasPhoto);
      if (rows !== null) {
        lastActionRows = rows.length > 0 ? rows : null;
      }
    }

    messages.push({ role: 'assistant', content: response.content as Anthropic.ContentBlockParam[] });
    messages.push({ role: 'user', content: toolResults });

    console.warn(`[coach] Calling Claude iteration ${iterations + 1}...`);
    const claudeStart = Date.now();
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [cachedSystem],
      tools: cachedTools,
      messages,
    });
    console.warn(`[coach] Claude response (${Date.now() - claudeStart}ms): stop_reason=${response.stop_reason}`);
  }
  console.warn(`[coach] Tool loop done: ${iterations} iterations, stop_reason=${response.stop_reason}`);

  // ---- Extract final text ------------------------------------------------
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  const responseText = textBlocks.map(b => b.text).join('\n\n')
    || "I processed your request but don't have anything to say.";

  // ---- Persist conversation ----------------------------------------------
  const savedAssistantContent = buildAssistantSummary(responseText, iterations, mentionedSteps);
  const updatedHistory = [
    ...recentHistory,
    { role: 'user', content: historyEntry },
    { role: 'assistant', content: savedAssistantContent },
  ];

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    messages: updatedHistory,
    last_active_at: nowIso,
    last_assistant_at: nowIso,
    user_id: auth.userId,
  };
  // Clear the pending photo URL only after the attach actually happened, so
  // multi-turn follow-ups ("which step?" → "the moonraker race") still have
  // the URL available on the next turn.
  if (attachEvidenceCalled) {
    updatePayload.pending_photo_url = null;
  }
  await supabase
    .from('telegram_conversations')
    .update(updatePayload)
    .eq('id', conversation.id);

  return {
    text: responseText,
    actionButtons: lastActionRows ?? [],
    mentionedSteps,
    iterations,
  };
}
