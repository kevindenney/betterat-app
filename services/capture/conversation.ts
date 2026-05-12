/* eslint-disable no-console -- Called from Vercel functions: console is the canonical logging path. */
/**
 * Shared Anthropic conversation/tool-loop for the cross-surface CaptureService.
 *
 * Step Arch C/4 — extracts the parallel tool-use loop from `api/telegram/webhook.ts`
 * and `api/whatsapp/webhook.ts` into a single pure-logic function:
 *
 *   - runConversationTurn — given a system prompt + message history, run the
 *     Anthropic Haiku tool-use loop until stop_reason !== 'tool_use' (or
 *     MAX_TOOL_ITERATIONS hit), executing tools against Supabase and emitting
 *     adapter-side callbacks for per-iteration UX (typing indicators,
 *     progress messages, inline-keyboard tracking).
 *
 * Adapters retain channel-specific I/O:
 *   - downloading + uploading photos/voice
 *   - building the Anthropic.ContentBlockParam[] for photo+caption turns
 *     (because the photo bytes live in the adapter)
 *   - converting the final text into a channel-specific reply (Telegram
 *     MarkdownV2 with inline-keyboard, WhatsApp plain text)
 *   - persisting the conversation row (channel-specific keying)
 *
 * Migration plan: docs/audit/step-architecture-migration-plan.md §4 Step C.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { executeTool, getAnthropicTools } from '../../lib/telegram/tools';
import type { AuthContext } from '../mcp/server';
import { MAX_TOOL_ITERATIONS } from './types';
import type { CaptureChannel } from './types';

// ---------------------------------------------------------------------------
// Inputs / outputs
// ---------------------------------------------------------------------------

export interface ConversationTurnInput {
  systemPrompt: string;
  /** Full message list to send to Claude — adapter builds this from history + new user content. */
  messages: Anthropic.MessageParam[];
  supabase: SupabaseClient;
  auth: AuthContext;
  channel: CaptureChannel;
  /**
   * If set, `attach_step_evidence` tool calls will have this URL injected as
   * `photo_url` (Claude often omits this optional parameter).
   */
  uploadedPhotoUrl?: string;
  /** Optional per-iteration callback: called once after each tool batch executes. */
  onProgress?: (iteration: number) => Promise<void> | void;
  /**
   * Optional callback for tool results — adapters use this to track inline-keyboard
   * hints (`getToolResponseKeyboard`). Called once per tool call with the raw JSON result.
   */
  onToolResult?: (toolName: string, rawResult: string) => void;
}

export interface ConversationTurnResult {
  /** Joined text from the final assistant message (post tool-use loop). */
  responseText: string;
  /** Number of tool-use iterations executed (0 = no tools called). */
  iterations: number;
  /**
   * Step IDs surfaced by tool results — used by adapters to inject
   * `[Steps: title (uuid)]` hints into the saved conversation history.
   */
  mentionedStepIds: { id: string; title: string }[];
  /** stop_reason of the final Claude response. */
  stopReason: Anthropic.Message['stop_reason'];
}

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Execute one conversational turn against Claude with the BetterAt tool set.
 *
 * The system prompt and tools are both marked with `cache_control: 'ephemeral'`
 * so the Anthropic prompt cache absorbs ~90% of repeated input tokens across
 * users. Callers should pass the same `systemPrompt` shape (built via
 * `services/capture/systemPrompt`) to keep the cache hit rate high.
 */
export async function runConversationTurn(
  input: ConversationTurnInput,
): Promise<ConversationTurnResult> {
  const {
    systemPrompt,
    messages,
    supabase,
    auth,
    channel,
    uploadedPhotoUrl,
    onProgress,
    onToolResult,
  } = input;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = getAnthropicTools();

  // Prompt caching — saves ~90% on repeated input tokens.
  const cachedSystem: Anthropic.TextBlockParam = {
    type: 'text',
    text: systemPrompt,
    cache_control: { type: 'ephemeral' },
  };
  const cachedTools = tools.map((tool, i) =>
    i === tools.length - 1
      ? { ...tool, cache_control: { type: 'ephemeral' as const } }
      : tool,
  );

  // Local mutable copy — we append assistant + tool_result blocks each iteration.
  const convo: Anthropic.MessageParam[] = [...messages];

  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [cachedSystem],
    tools: cachedTools,
    messages: convo,
  });

  let iterations = 0;
  const mentionedStepIds: { id: string; title: string }[] = [];

  while (response.stop_reason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlockParam & {
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      } => b.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      console.log(
        `[${channel}] Tool call #${iterations}: ${block.name}`,
        JSON.stringify(block.input).slice(0, 200),
      );

      // Inject photo_url for attach_step_evidence — Claude often omits this optional param
      let toolInput = block.input;
      if (block.name === 'attach_step_evidence' && uploadedPhotoUrl) {
        toolInput = { ...block.input, photo_url: uploadedPhotoUrl };
      }

      const toolStart = Date.now();
      const rawResult = await executeTool(block.name, toolInput, supabase, auth);
      console.log(
        `[${channel}] Tool result (${Date.now() - toolStart}ms): ${block.name}`,
        rawResult.slice(0, 300),
      );

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: rawResult,
      });

      // Extract step IDs for conversation context (so follow-up turns can
      // reference [Steps: title (uuid)] without re-fetching the timeline).
      try {
        const parsed = JSON.parse(rawResult);
        if (parsed.step?.id && parsed.step?.title) {
          mentionedStepIds.push({ id: parsed.step.id, title: parsed.step.title });
        } else if (parsed.step_id && parsed.step_title) {
          mentionedStepIds.push({ id: parsed.step_id, title: parsed.step_title });
        }
      } catch {
        /* ignore parse errors — adapter doesn't need them */
      }

      onToolResult?.(block.name, rawResult);
    }

    convo.push({ role: 'assistant', content: response.content as Anthropic.ContentBlockParam[] });
    convo.push({ role: 'user', content: toolResults });

    // Adapter-side UX hook — progress messages, typing indicators, etc.
    await onProgress?.(iterations);

    console.log(`[${channel}] Calling Claude iteration ${iterations + 1}...`);
    const claudeStart = Date.now();
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [cachedSystem],
      tools: cachedTools,
      messages: convo,
    });
    console.log(
      `[${channel}] Claude response (${Date.now() - claudeStart}ms): stop_reason=${response.stop_reason}`,
    );
  }

  console.log(
    `[${channel}] Tool loop done: ${iterations} iterations, stop_reason=${response.stop_reason}`,
  );

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  const responseText =
    textBlocks.map(b => b.text).join('\n\n') ||
    "I processed your request but don't have anything to say.";

  return {
    responseText,
    iterations,
    mentionedStepIds,
    stopReason: response.stop_reason,
  };
}
