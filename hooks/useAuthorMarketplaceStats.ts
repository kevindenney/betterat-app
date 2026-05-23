/**
 * useAuthorMarketplaceStats — real marketplace activity for the
 * signed-in author. Backed by marketplace_subscriptions (RLS gates to
 * author-self read).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface AuthorMarketplaceBlueprintStat {
  blueprintId: string;
  blueprintTitle: string;
  activeCount: number;
  trialingCount: number;
  canceledCount: number;
  mrrCents: number;
  unitAmountCents: number;
  cadence: 'monthly' | 'annual' | 'one_time';
}

export interface AuthorMarketplaceStats {
  activeCount: number;
  trialingCount: number;
  canceledCount: number;
  mrrCents: number;
  byBlueprint: AuthorMarketplaceBlueprintStat[];
}

interface SubRow {
  blueprint_id: string;
  status: string;
  unit_amount_cents: number;
  cadence: 'monthly' | 'annual' | 'one_time';
}

interface BlueprintRow {
  id: string;
  title: string;
}

function monthlyEquivalent(amount: number, cadence: 'monthly' | 'annual' | 'one_time'): number {
  if (cadence === 'annual') return Math.round(amount / 12);
  if (cadence === 'one_time') return 0; // doesn't recur
  return amount;
}

export function useAuthorMarketplaceStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['author-marketplace-stats'],
    staleTime: 30_000,
    queryFn: async (): Promise<AuthorMarketplaceStats> => {
      const empty: AuthorMarketplaceStats = {
        activeCount: 0,
        trialingCount: 0,
        canceledCount: 0,
        mrrCents: 0,
        byBlueprint: [],
      };
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return empty;

      const { data: subs } = await supabase
        .from('marketplace_subscriptions')
        .select('blueprint_id, status, unit_amount_cents, cadence')
        .eq('author_user_id', user.id);
      if (!subs || subs.length === 0) return empty;

      const rows = subs as SubRow[];
      const blueprintIds = Array.from(new Set(rows.map((r) => r.blueprint_id)));
      const { data: bps } = await supabase
        .from('blueprints')
        .select('id, title')
        .in('id', blueprintIds);
      const titleById = new Map(
        ((bps ?? []) as BlueprintRow[]).map((b) => [b.id, b.title]),
      );

      const stats: AuthorMarketplaceStats = { ...empty };
      const byBp = new Map<string, AuthorMarketplaceBlueprintStat>();

      for (const r of rows) {
        const bp =
          byBp.get(r.blueprint_id) ??
          ({
            blueprintId: r.blueprint_id,
            blueprintTitle: titleById.get(r.blueprint_id) ?? 'Untitled',
            activeCount: 0,
            trialingCount: 0,
            canceledCount: 0,
            mrrCents: 0,
            unitAmountCents: r.unit_amount_cents,
            cadence: r.cadence,
          } as AuthorMarketplaceBlueprintStat);
        if (r.status === 'active') bp.activeCount += 1;
        if (r.status === 'trialing') bp.trialingCount += 1;
        if (r.status === 'canceled') bp.canceledCount += 1;
        if (r.status === 'active' || r.status === 'trialing') {
          bp.mrrCents += monthlyEquivalent(r.unit_amount_cents, r.cadence);
        }
        byBp.set(r.blueprint_id, bp);
      }

      const byBlueprint = Array.from(byBp.values()).sort((a, b) => b.mrrCents - a.mrrCents);
      stats.activeCount = byBlueprint.reduce((s, b) => s + b.activeCount, 0);
      stats.trialingCount = byBlueprint.reduce((s, b) => s + b.trialingCount, 0);
      stats.canceledCount = byBlueprint.reduce((s, b) => s + b.canceledCount, 0);
      stats.mrrCents = byBlueprint.reduce((s, b) => s + b.mrrCents, 0);
      stats.byBlueprint = byBlueprint;
      return stats;
    },
  });

  return useMemo(
    () => ({
      stats: data ?? null,
      loading: isLoading,
    }),
    [data, isLoading],
  );
}
