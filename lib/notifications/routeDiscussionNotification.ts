/**
 * Shared deep-link routing for discussion notifications, used by both the
 * Inbox Read panel (app/(tabs)/inbox.tsx) and the standalone notifications
 * screen (app/social-notifications.tsx) so the two surfaces behave the same.
 *
 * Cohort posts live at the blueprint_step level (step_id NULL,
 * blueprint_step_id set) and are SHARED across every plan member's forked
 * copy. To open the thread the notification points at, we resolve the
 * viewer's own forked timeline_step for that blueprint_step, then route to
 * the real timeline surface — /(tabs)/races?selected=<id>&tab=discussion&
 * scope=cohort — so the step's card opens with the Cohort discussion active.
 * (Routing to the standalone /step/[id] screen lands on the wrong detail
 * view; the timeline card is the canonical step surface.) Returns false (no
 * navigation) when the viewer has no forked copy — the Cohort tab wouldn't
 * render there anyway.
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

  router.push({
    pathname: '/(tabs)/races',
    params: { selected: viewerStepId, tab: 'discussion', scope: 'cohort' },
  } as never);
  return true;
}
