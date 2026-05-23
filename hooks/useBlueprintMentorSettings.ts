/**
 * useBlueprintMentorSettings — read + write the Mentor settings sub-tab.
 *
 * Reads from blueprint_mentor_settings keyed by blueprint_id. A missing
 * row reads as defaults (matching the column defaults). First write
 * upserts; subsequent writes update.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { logAuditEvent } from '@/services/auditLog';

export interface MentorSettings {
  facultyCanMentor: boolean;
  preceptorsCanMentor: boolean;
  peersCanMentor: boolean;
  canComment: boolean;
  canSettle: boolean;
  canProposeFollowup: boolean;
  canEditBlueprint: boolean;
  dailyDigestTime: string;
  onActionPing: string;
  weeklySummaryTime: string;
}

const DEFAULTS: MentorSettings = {
  facultyCanMentor: true,
  preceptorsCanMentor: true,
  peersCanMentor: false,
  canComment: true,
  canSettle: true,
  canProposeFollowup: true,
  canEditBlueprint: false,
  dailyDigestTime: '8:00 AM · weekdays',
  onActionPing: 'Flagged + Wants follow-up',
  weeklySummaryTime: 'Fri 4:00 PM',
};

interface Row {
  faculty_can_mentor: boolean;
  preceptors_can_mentor: boolean;
  peers_can_mentor: boolean;
  can_comment: boolean;
  can_settle: boolean;
  can_propose_followup: boolean;
  can_edit_blueprint: boolean;
  daily_digest_time: string;
  on_action_ping: string;
  weekly_summary_time: string;
}

function rowToSettings(r: Row): MentorSettings {
  return {
    facultyCanMentor: r.faculty_can_mentor,
    preceptorsCanMentor: r.preceptors_can_mentor,
    peersCanMentor: r.peers_can_mentor,
    canComment: r.can_comment,
    canSettle: r.can_settle,
    canProposeFollowup: r.can_propose_followup,
    canEditBlueprint: r.can_edit_blueprint,
    dailyDigestTime: r.daily_digest_time,
    onActionPing: r.on_action_ping,
    weeklySummaryTime: r.weekly_summary_time,
  };
}

const FIELD_LABELS: Record<keyof MentorSettings, string> = {
  facultyCanMentor: 'Faculty members can mentor',
  preceptorsCanMentor: 'Preceptors can mentor',
  peersCanMentor: 'Peer mentors',
  canComment: 'Comment on reflections',
  canSettle: 'Mark steps as settled',
  canProposeFollowup: 'Propose follow-up steps',
  canEditBlueprint: 'Edit blueprint content',
  dailyDigestTime: 'Daily digest',
  onActionPing: 'On-action ping',
  weeklySummaryTime: 'Weekly summary',
};

export function useBlueprintMentorSettings(blueprintId: string, orgId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['blueprint-mentor-settings', blueprintId];

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!blueprintId,
    staleTime: 30_000,
    queryFn: async (): Promise<MentorSettings> => {
      const { data: row, error } = await supabase
        .from('blueprint_mentor_settings')
        .select(
          'faculty_can_mentor, preceptors_can_mentor, peers_can_mentor, can_comment, can_settle, can_propose_followup, can_edit_blueprint, daily_digest_time, on_action_ping, weekly_summary_time',
        )
        .eq('blueprint_id', blueprintId)
        .maybeSingle();
      if (error) {
        console.warn('[useBlueprintMentorSettings] query failed', error);
        return DEFAULTS;
      }
      return row ? rowToSettings(row as Row) : DEFAULTS;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<MentorSettings>) => {
      const payload: Record<string, unknown> = { blueprint_id: blueprintId };
      if (patch.facultyCanMentor !== undefined) payload.faculty_can_mentor = patch.facultyCanMentor;
      if (patch.preceptorsCanMentor !== undefined)
        payload.preceptors_can_mentor = patch.preceptorsCanMentor;
      if (patch.peersCanMentor !== undefined) payload.peers_can_mentor = patch.peersCanMentor;
      if (patch.canComment !== undefined) payload.can_comment = patch.canComment;
      if (patch.canSettle !== undefined) payload.can_settle = patch.canSettle;
      if (patch.canProposeFollowup !== undefined)
        payload.can_propose_followup = patch.canProposeFollowup;
      if (patch.canEditBlueprint !== undefined) payload.can_edit_blueprint = patch.canEditBlueprint;
      if (patch.dailyDigestTime !== undefined) payload.daily_digest_time = patch.dailyDigestTime;
      if (patch.onActionPing !== undefined) payload.on_action_ping = patch.onActionPing;
      if (patch.weeklySummaryTime !== undefined)
        payload.weekly_summary_time = patch.weeklySummaryTime;
      const { error } = await supabase
        .from('blueprint_mentor_settings')
        .upsert(payload, { onConflict: 'blueprint_id' });
      if (error) throw error;
      return { patch };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      if (orgId && result?.patch) {
        const firstKey = Object.keys(result.patch)[0] as keyof MentorSettings | undefined;
        if (firstKey) {
          const value = result.patch[firstKey];
          const fieldLabel = FIELD_LABELS[firstKey] ?? firstKey;
          const description =
            typeof value === 'boolean'
              ? `${value ? 'Enabled' : 'Disabled'} ${fieldLabel.toLowerCase()}.`
              : `Set ${fieldLabel.toLowerCase()} to ${value}.`;
          void logAuditEvent({
            orgId,
            verb: 'config_change',
            verbLabel: 'Mentor settings',
            description,
            targetType: 'blueprint',
            targetId: blueprintId,
            payload: result.patch as Record<string, unknown>,
          });
          queryClient.invalidateQueries({ queryKey: ['blueprint-activity', blueprintId] });
        }
      }
    },
  });

  return {
    settings: data ?? DEFAULTS,
    loading: isLoading,
    update,
  };
}
