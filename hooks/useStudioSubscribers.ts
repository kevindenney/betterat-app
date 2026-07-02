/**
 * useStudioSubscribers
 *
 * The Creator Studio · Subscribers roster for the signed-in author. Reads the
 * studio_author_subscribers RPC (SECURITY DEFINER, keyed off auth.uid() =
 * blueprints.author_user_id) — one row per active/trialing subscription on a
 * blueprint this author owns — and groups it into one entry per person, with
 * the blueprints they subscribe to.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface StudioSubscriberPlan {
  blueprintId: string;
  blueprintTitle: string;
  status: 'active' | 'trialing';
  cadence: 'monthly' | 'annual' | 'one_time';
  unitAmountCents: number;
  currency: string;
  subscribedAt: string | null;
}

export interface StudioSubscriber {
  userId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  plans: StudioSubscriberPlan[];
  /** Most recent subscription across this person's plans. */
  latestSubscribedAt: string | null;
  trialing: boolean;
}

export interface StudioSubscriberStep {
  stepId: string;
  templateId: string;
  sortOrder: number;
  title: string;
  status: string;
  updatedAt: string | null;
  completedAt: string | null;
  reviewStatus: 'approved' | 'needs_revision' | null;
  reviewNote: string | null;
  suggestedNext: string | null;
}

export interface StudioSubscribersData {
  loading: boolean;
  subscribers: StudioSubscriber[];
  totalSubscribers: number;
  trialingCount: number;
}

interface Row {
  buyer_user_id: string;
  buyer_name: string | null;
  buyer_avatar_url: string | null;
  blueprint_id: string;
  blueprint_title: string | null;
  status: string;
  cadence: string;
  unit_amount_cents: number;
  currency: string;
  subscribed_at: string | null;
}

interface StepRow {
  step_id: string;
  template_id: string;
  sort_order: number | null;
  title: string | null;
  status: string | null;
  updated_at: string | null;
  completed_at: string | null;
  review_status: string | null;
  review_note: string | null;
  suggested_next: string | null;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function useStudioSubscriberSteps(
  blueprintId?: string | null,
  subscriberId?: string | null,
) {
  return useQuery<StudioSubscriberStep[]>({
    queryKey: ['studio-author-subscriber-steps', blueprintId, subscriberId],
    enabled: !!blueprintId && !!subscriberId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('studio_author_subscriber_steps', {
        p_blueprint_id: blueprintId,
        p_subscriber_id: subscriberId,
      });
      if (error) {
        console.warn('[useStudioSubscriberSteps] RPC failed', error);
        throw error;
      }
      return ((data ?? []) as StepRow[]).map((row) => ({
        stepId: row.step_id,
        templateId: row.template_id,
        sortOrder: row.sort_order ?? 0,
        title: row.title?.trim() || 'Untitled step',
        status: row.status ?? 'pending',
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        reviewStatus:
          row.review_status === 'approved' || row.review_status === 'needs_revision'
            ? row.review_status
            : null,
        reviewNote: row.review_note,
        suggestedNext: row.suggested_next,
      }));
    },
  });
}

export function useStudioSubscribers(): StudioSubscribersData {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['studio-author-subscribers', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<StudioSubscriber[]> => {
      const { data: rows, error } = await supabase.rpc('studio_author_subscribers', {
        p_limit: 200,
      });
      if (error) {
        console.warn('[useStudioSubscribers] RPC failed', error);
        return [];
      }
      const byUser = new Map<string, StudioSubscriber>();
      for (const r of (rows ?? []) as Row[]) {
        const name = r.buyer_name?.trim() || 'Subscriber';
        const status = r.status === 'trialing' ? 'trialing' : 'active';
        const plan: StudioSubscriberPlan = {
          blueprintId: r.blueprint_id,
          blueprintTitle: r.blueprint_title?.trim() || 'Untitled blueprint',
          status,
          cadence: (r.cadence as StudioSubscriberPlan['cadence']) ?? 'monthly',
          unitAmountCents: r.unit_amount_cents ?? 0,
          currency: r.currency ?? 'usd',
          subscribedAt: r.subscribed_at,
        };
        const existing = byUser.get(r.buyer_user_id);
        if (existing) {
          existing.plans.push(plan);
          if (
            plan.subscribedAt &&
            (!existing.latestSubscribedAt || plan.subscribedAt > existing.latestSubscribedAt)
          ) {
            existing.latestSubscribedAt = plan.subscribedAt;
          }
          existing.trialing = existing.trialing || status === 'trialing';
        } else {
          byUser.set(r.buyer_user_id, {
            userId: r.buyer_user_id,
            name,
            initials: initialsFor(name),
            avatarUrl: r.buyer_avatar_url,
            plans: [plan],
            latestSubscribedAt: plan.subscribedAt,
            trialing: status === 'trialing',
          });
        }
      }
      return Array.from(byUser.values()).sort((a, b) =>
        (b.latestSubscribedAt ?? '').localeCompare(a.latestSubscribedAt ?? ''),
      );
    },
  });

  const subscribers = useMemo(() => data ?? [], [data]);

  return {
    loading: isLoading,
    subscribers,
    totalSubscribers: subscribers.length,
    trialingCount: subscribers.filter((s) => s.trialing).length,
  };
}
