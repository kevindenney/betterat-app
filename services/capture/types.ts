/**
 * Shared types for the cross-surface CaptureService.
 *
 * Step Arch C/1 — extracts duplicated structs from `api/telegram/webhook.ts`
 * and `api/whatsapp/webhook.ts`. Behavior unchanged; this just centralizes
 * the type definitions both webhooks (and the upcoming in-app voice path)
 * will consume.
 *
 * Migration plan: docs/audit/step-architecture-migration-plan.md §4 Step C.
 */

/** Per-user context block woven into the system prompt. */
export interface UserContext {
  fullName?: string;
  activeInterest?: string;
  interestDescription?: string;
  orgName?: string;
  location?: string;
}

/** Capture channel — drives formatting + adapter-specific shaping. */
export type CaptureChannel = 'telegram' | 'whatsapp' | 'in_app_voice';

/**
 * Shared conversation/runtime knobs. Kept in one place so both webhooks
 * stay in lockstep when these are tuned.
 */
export const MAX_TOOL_ITERATIONS = 8;
export const MAX_CONVERSATION_MESSAGES = 10;
export const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://better.at';
