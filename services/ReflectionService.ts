import { supabase } from '@/services/supabase';

/**
 * Single writer for peer reflections — a short note one practitioner leaves
 * on another's practice. Each reflection is one `peer_reflections` row
 * (migration 20260524220000); it surfaces in the recipient's Inbox Read
 * segment via the `inbox_items` view (kind='reflection').
 *
 * `targetStepId` is set only when the reflection is about a specific step the
 * recipient owns; a profile-level reflection passes it NULL.
 */

export interface LeaveReflectionInput {
  sourceUserId: string;
  targetUserId: string;
  body: string;
  /** A recipient timeline_steps id this reflection is about, else null. */
  targetStepId?: string | null;
}

export class ReflectionService {
  /** Leave a reflection. Returns the new peer_reflections id. */
  static async leave(input: LeaveReflectionInput): Promise<string> {
    const body = input.body.trim();
    if (!body) throw new Error('Write a reflection before sending.');

    const { data, error } = await supabase
      .from('peer_reflections')
      .insert({
        source_user_id: input.sourceUserId,
        target_user_id: input.targetUserId,
        target_step_id: input.targetStepId ?? null,
        body,
        status: 'unread',
      })
      .select('id')
      .single();

    if (error) throw new Error('Could not send reflection');

    return (data as { id: string }).id;
  }
}
