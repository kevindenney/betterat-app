/**
 * useAdminOrgBlueprints — Admin · Blueprints list backing query.
 * Wraps admin_org_blueprints RPC (SECURITY DEFINER + is_org_active_member).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export type BlueprintCategory = 'procedural' | 'assessment' | 'communication' | 'reasoning' | 'other';
export type BlueprintStatus = 'draft' | 'review' | 'live' | 'archived';
export type AuthorTone = 'navy' | 'brown' | 'warm' | 'green';

export interface AdminBlueprintRow {
  id: string;
  slug: string;
  title: string;
  category: BlueprintCategory;
  version: string;
  status: BlueprintStatus;
  stepCount: number;
  description: string | null;
  authorUserId: string | null;
  authorName: string;
  authorInitials: string;
  authorTone: AuthorTone;
  subscribers: number;
  cohortLabels: string[];
  lastEditedAt: string;
  publishedAt: string | null;
}

type RpcRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  version: string;
  status: string;
  step_count: number;
  description: string | null;
  author_user_id: string | null;
  author_name: string;
  author_initials: string;
  author_tone: string;
  subscribers: number;
  cohort_labels: string[] | null;
  last_edited_at: string;
  published_at: string | null;
};

export function useAdminOrgBlueprints(orgId: string) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['admin-org-blueprints', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminBlueprintRow[]> => {
      const { data: rows, error: rpcErr } = await supabase.rpc('admin_org_blueprints', {
        p_org_id: orgId,
      });
      if (rpcErr) {
        console.warn('[useAdminOrgBlueprints] RPC failed', rpcErr);
        return [];
      }
      return ((rows ?? []) as RpcRow[]).map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        category: r.category as BlueprintCategory,
        version: r.version,
        status: r.status as BlueprintStatus,
        stepCount: r.step_count,
        description: r.description,
        authorUserId: r.author_user_id,
        authorName: r.author_name,
        authorInitials: r.author_initials,
        authorTone: r.author_tone as AuthorTone,
        subscribers: r.subscribers,
        cohortLabels: r.cohort_labels ?? [],
        lastEditedAt: r.last_edited_at,
        publishedAt: r.published_at,
      }));
    },
  });

  return { blueprints: data, loading: isLoading, error };
}

export function formatLastEditedRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const sec = Math.max(0, (now - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = sec / 60;
  if (min < 60) return `${Math.round(min)}m ago`;
  const hr = min / 60;
  if (hr < 24) {
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p' : 'a';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${h12}:${minutes}${ampm}`;
  }
  const day = hr / 24;
  if (day < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
