/**
 * useBlueprintActivity — read audit_events for one blueprint via
 * admin_blueprint_audit_feed (SECURITY DEFINER + is_org_admin_member gate).
 *
 * Returns events grouped by calendar day in the local timezone, with the
 * same shape the editor's Activity sub-tab renders.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export type ActivityTone = 'navy' | 'brown' | 'warm' | 'green';
export type ActivityTagTone = 'ok' | 'warn' | 'plain';

export interface ActivityEvent {
  id: string;
  occurredAt: string;
  actorName: string;
  actorInitials: string;
  actorTone: ActivityTone;
  verb: string;
  verbLabel: string;
  description: string;
  tag: { label: string; tone: ActivityTagTone } | null;
  whenLabel: string;
}

export interface ActivityDayGroup {
  label: string;
  count: number;
  rows: ActivityEvent[];
}

interface RpcRow {
  id: string;
  occurred_at: string;
  actor_name: string;
  actor_initials: string;
  actor_tone: string;
  verb: string;
  verb_label: string;
  description: string;
}

const PUBLISH_VERBS = new Set(['blueprint_publish', 'published']);
const WARN_VERBS = new Set(['removed', 'role_changed', 'sso_config']);

function classifyTag(verb: string, verbLabel: string): ActivityEvent['tag'] {
  if (PUBLISH_VERBS.has(verb)) return { label: 'Published', tone: 'ok' };
  if (WARN_VERBS.has(verb)) return { label: verbLabel || 'Changed', tone: 'warn' };
  return { label: verbLabel || 'Updated', tone: 'plain' };
}

function dayLabel(d: Date): string {
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function useBlueprintActivity(blueprintId: string, limit = 50) {
  const queryKey = ['blueprint-activity', blueprintId, limit];

  const { data = [], isLoading, error } = useQuery({
    queryKey,
    enabled: !!blueprintId,
    staleTime: 30_000,
    queryFn: async (): Promise<ActivityEvent[]> => {
      const { data: rows, error: rpcErr } = await supabase.rpc('admin_blueprint_audit_feed', {
        p_blueprint_id: blueprintId,
        p_limit: limit,
      });
      if (rpcErr) {
        console.warn('[useBlueprintActivity] RPC failed', rpcErr);
        return [];
      }
      return ((rows ?? []) as RpcRow[]).map((r) => {
        const dt = new Date(r.occurred_at);
        return {
          id: r.id,
          occurredAt: r.occurred_at,
          actorName: r.actor_name,
          actorInitials: r.actor_initials,
          actorTone: (r.actor_tone as ActivityTone) ?? 'navy',
          verb: r.verb,
          verbLabel: r.verb_label,
          description: r.description,
          tag: classifyTag(r.verb, r.verb_label),
          whenLabel: timeLabel(dt),
        };
      });
    },
  });

  const groups: ActivityDayGroup[] = useMemo(() => {
    if (data.length === 0) return [];
    const byDay = new Map<string, ActivityEvent[]>();
    for (const e of data) {
      const dt = new Date(e.occurredAt);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      const bucket = byDay.get(key) ?? [];
      bucket.push(e);
      byDay.set(key, bucket);
    }
    return Array.from(byDay.entries()).map(([key, rows]) => {
      const [y, m, d] = key.split('-').map(Number);
      const date = new Date(y, m, d);
      return { label: dayLabel(date), count: rows.length, rows };
    });
  }, [data]);

  return { groups, total: data.length, loading: isLoading, error };
}
