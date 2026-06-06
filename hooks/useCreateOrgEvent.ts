/**
 * useCreateOrgEvent — authors one shared org event (§4.1) onto the Org Admin
 * Calendar. A race is just an event with isRace = true (D30/D31); the same
 * mutation creates both. Writes through admin_create_org_event (SECURITY
 * DEFINER, gated by is_org_admin_member), which resolves the org's interest
 * server-side and, per D33, does NOT mint a scoring row on the toggle.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { adminCalendarKey } from '@/hooks/useAdminCalendar';

export interface CreateOrgEventInput {
  title: string;
  startsAt: string | null; // ISO
  endsAt: string | null; // ISO
  isRace: boolean;
  description?: string | null;
  placeName?: string | null;
}

export function useCreateOrgEvent(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrgEventInput): Promise<string> => {
      const { data, error } = await supabase.rpc('admin_create_org_event', {
        p_org_id: orgId,
        p_title: input.title,
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt,
        p_is_race: input.isRace,
        p_description: input.description ?? null,
        p_place_name: input.placeName ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCalendarKey(orgId) });
    },
  });
}
