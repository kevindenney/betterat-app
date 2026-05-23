/**
 * useTargetEvent — fetches the Event a Step is linked to (Step.target_event_kind
 * + Step.target_event_id). Polymorphic dispatch by kind.
 *
 * Used by the PlanInServiceOfCard to render the linked-event chip and by
 * Atlas to anchor the amber NEXT tag on the event's venue coords.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { StepTargetEventKind, UpcomingEventOption } from './useUserUpcomingEvents';

interface UseTargetEventArgs {
  kind: StepTargetEventKind | null | undefined;
  id: string | null | undefined;
}

export function useTargetEvent({ kind, id }: UseTargetEventArgs) {
  return useQuery({
    queryKey: ['target-event', kind, id],
    enabled: Boolean(kind && id),
    staleTime: 60_000,
    queryFn: async (): Promise<UpcomingEventOption | null> => {
      if (!kind || !id) return null;
      if (kind === 'regatta') {
        const { data, error } = await supabase
          .from('regattas')
          .select('id, name, start_date, venue, latitude, longitude')
          .eq('id', id)
          .maybeSingle();
        if (error || !data) return null;
        return {
          kind: 'regatta',
          id: data.id,
          label: data.name || 'Untitled regatta',
          starts_at: data.start_date,
          subtitle: data.venue ?? undefined,
          lat: data.latitude ?? undefined,
          lng: data.longitude ?? undefined,
        };
      }
      // Other kinds resolve via their own table — not yet wired.
      return null;
    },
  });
}
