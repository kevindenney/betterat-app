/**
 * Shared deep-link routing for discussion notifications, used by both the
 * Inbox Read panel (app/(tabs)/inbox.tsx) and the standalone notifications
 * screen (app/social-notifications.tsx) so the two surfaces behave the same.
 *
 * Cohort posts live at the blueprint_step level (step_id NULL,
 * blueprint_step_id set) and are SHARED across every plan member's forked
 * copy. To open the thread the notification points at, we resolve the
 * viewer's own forked timeline_step for that blueprint_step, then route to
 * /step/[id]?scope=cohort so the Discussion tab lands directly on the Cohort
 * scope. Returns false (no navigation) when the viewer has no forked copy —
 * the Cohort tab wouldn't render there anyway.
 */

import { router } from 'expo-router';
import { supabase } from '@/services/supabase';

interface DiscussionNotification {
  type: string;
  data?: Record<string, any> | null;
}

export async function routeCohortDiscussionNotification(
  notification: DiscussionNotification,
  viewerId: string | null | undefined,
): Promise<boolean> {
  const blueprintStepId =
    (notification.data?.blueprint_step_id as string | undefined) ?? null;
  if (!viewerId || !blueprintStepId) return false;

  const { data } = await supabase
    .from('timeline_steps')
    .select('id')
    .eq('user_id', viewerId)
    .eq('source_blueprint_step_id', blueprintStepId)
    .maybeSingle();

  const viewerStepId = (data as { id?: string } | null)?.id;
  if (!viewerStepId) return false;

  router.push(`/step/${viewerStepId}?scope=cohort` as never);
  return true;
}
