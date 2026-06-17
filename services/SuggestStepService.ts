import { supabase } from '@/services/supabase';

/**
 * Single writer for peer/coach step suggestions.
 *
 * Every suggestion is one `step_suggestions` row. A DB trigger
 * (`notify_on_step_suggestion_insert`) fans out the `step_suggested`
 * bell notification, so callers never write social_notifications
 * directly — that keeps the Inbox (step_suggestions) and the bell
 * (social_notifications) in lockstep with no double-notify.
 *
 * `sourceStepId` is set ONLY when it points at a real timeline_steps
 * row the recipient can fork. Blueprint-sourced and free-form coach
 * suggestions pass it NULL and carry `suggestedTitle`/`suggestedDescription`
 * instead, which the Inbox and bell render directly.
 *
 * Recipient privacy (`profiles.allow_suggest_step`) is enforced by the
 * `enforce_step_suggestion_allowed` BEFORE INSERT trigger; we translate
 * its rejection into a user-facing message.
 */

export interface SuggestStepInput {
  sourceUserId: string;
  targetUserId: string;
  /** A real timeline_steps id to attach as the forkable source, else null. */
  sourceStepId?: string | null;
  /** Explicit title when there is no source step. */
  suggestedTitle?: string | null;
  /** Explicit description when there is no source step. */
  suggestedDescription?: string | null;
  /** Optional personal note from the sender. */
  message?: string | null;
}

const NOT_ACCEPTING_TOKEN = 'recipient_not_accepting_suggestions';

export class SuggestStepService {
  /**
   * Send a suggestion. Returns the new step_suggestions id. Throws an
   * Error with a user-safe `message` on failure.
   */
  static async suggest(input: SuggestStepInput): Promise<string> {
    const clean = (v: string | null | undefined): string | null => {
      const t = v?.trim();
      return t ? t : null;
    };

    const { data, error } = await supabase
      .from('step_suggestions')
      .insert({
        source_user_id: input.sourceUserId,
        target_user_id: input.targetUserId,
        source_step_id: input.sourceStepId ?? null,
        suggested_title: clean(input.suggestedTitle),
        suggested_description: clean(input.suggestedDescription),
        message: clean(input.message),
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      if (error.message?.includes(NOT_ACCEPTING_TOKEN)) {
        throw new Error("This person isn't accepting step suggestions.");
      }
      throw new Error('Could not send suggestion');
    }

    return (data as { id: string }).id;
  }
}
