/**
 * useAdminCalendar — the org's scheduled steps for the Org Admin · Calendar
 * surface. Reads admin_org_calendar (SECURITY DEFINER, gated by
 * is_org_admin_member) so an admin sees every org-scoped step, not just their
 * own under timeline_steps RLS.
 *
 * The universal model (D30–D31): a race is just a step with is_race = true, so
 * the same calendar carries races (badged) and ordinary scheduled steps.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import {
  AdminCalendarEvent,
  CalendarRpcRow,
  mapCalendarRow,
  scheduledCount,
  raceCount,
} from '@/lib/admin/adminCalendar';

export type { AdminCalendarEvent } from '@/lib/admin/adminCalendar';

export interface AdminCalendarData {
  loading: boolean;
  error: string | null;
  events: AdminCalendarEvent[];
  scheduledCount: number;
  raceCount: number;
}

export const adminCalendarKey = (orgId: string) => ['admin-calendar', orgId] as const;

export function useAdminCalendar(orgId: string): AdminCalendarData {
  const { data, isLoading, error } = useQuery({
    queryKey: adminCalendarKey(orgId),
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminCalendarEvent[]> => {
      const { data: rows, error: rpcErr } = await supabase.rpc('admin_org_calendar', {
        p_org_id: orgId,
      });
      if (rpcErr) throw rpcErr;
      return ((rows ?? []) as CalendarRpcRow[]).map(mapCalendarRow);
    },
  });

  const events = useMemo(() => data ?? [], [data]);

  return {
    loading: isLoading,
    error: error ? (error as Error).message : null,
    events,
    scheduledCount: scheduledCount(events),
    raceCount: raceCount(events),
  };
}
