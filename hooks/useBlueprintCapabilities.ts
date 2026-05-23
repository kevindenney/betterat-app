/**
 * useBlueprintCapabilities — capabilities trained by a blueprint, joined
 * to the org_competencies catalog and grouped by category for the
 * editor's Capabilities sub-tab.
 *
 * Returns the org's full taxonomy with each row flagged on/off and a
 * strength value (0..3). Mutations toggle attachment and update strength.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export type CapabilityCategory =
  | 'Procedural'
  | 'Assessment'
  | 'Communication'
  | 'Clinical reasoning'
  | 'Tactics'
  | 'Boathandling'
  | 'Professionalism'
  | 'Other';

export type CapabilityStrength = 0 | 1 | 2 | 3; // 0=off, 1=supporting, 2=secondary, 3=primary

export interface CapabilityRow {
  competencyId: string;
  shortLabel: string;
  fullLabel: string;
  category: CapabilityCategory;
  isActive: boolean; // org_competencies.is_active
  isNew: boolean; // created within the last 14 days, for the "New" badge
  selected: boolean;
  strength: CapabilityStrength;
}

export interface CapabilityGroup {
  category: CapabilityCategory;
  caps: CapabilityRow[];
  selectedCount: number;
  totalCount: number;
}

interface CompetencyRow {
  id: string;
  short_label: string;
  full_label: string;
  category: string;
  is_active: boolean;
  created_at: string;
  display_order: number;
}

interface AttachmentRow {
  competency_id: string;
  strength: number;
}

const NEW_WINDOW_DAYS = 14;

function isNewCompetency(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function useBlueprintCapabilities(blueprintId: string, orgId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['blueprint-capabilities', blueprintId];

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!blueprintId && !!orgId,
    staleTime: 30_000,
    queryFn: async (): Promise<{ competencies: CompetencyRow[]; attachments: AttachmentRow[] }> => {
      const [compRes, attachRes] = await Promise.all([
        supabase
          .from('org_competencies')
          .select('id, short_label, full_label, category, is_active, created_at, display_order')
          .eq('org_id', orgId)
          .order('display_order', { ascending: true }),
        supabase
          .from('blueprint_capabilities')
          .select('competency_id, strength')
          .eq('blueprint_id', blueprintId),
      ]);
      if (compRes.error) console.warn('[useBlueprintCapabilities] competencies failed', compRes.error);
      if (attachRes.error) console.warn('[useBlueprintCapabilities] attachments failed', attachRes.error);
      return {
        competencies: (compRes.data ?? []) as CompetencyRow[],
        attachments: (attachRes.data ?? []) as AttachmentRow[],
      };
    },
  });

  const groups: CapabilityGroup[] = useMemo(() => {
    if (!data) return [];
    const byCompetencyId = new Map<string, number>();
    for (const a of data.attachments) byCompetencyId.set(a.competency_id, a.strength);

    const rows: CapabilityRow[] = data.competencies
      .filter((c) => c.is_active)
      .map((c) => {
        const strength = byCompetencyId.get(c.id);
        return {
          competencyId: c.id,
          shortLabel: c.short_label,
          fullLabel: c.full_label,
          category: (c.category as CapabilityCategory) ?? 'Other',
          isActive: c.is_active,
          isNew: isNewCompetency(c.created_at),
          selected: strength != null,
          strength: (strength ?? 0) as CapabilityStrength,
        };
      });

    const grouped = new Map<CapabilityCategory, CapabilityRow[]>();
    for (const r of rows) {
      if (!grouped.has(r.category)) grouped.set(r.category, []);
      grouped.get(r.category)!.push(r);
    }

    // Display order: matches the design's Procedural / Assessment / Communication
    // / Clinical reasoning / others-alphabetical
    const order: CapabilityCategory[] = [
      'Procedural',
      'Assessment',
      'Communication',
      'Clinical reasoning',
      'Tactics',
      'Boathandling',
      'Professionalism',
      'Other',
    ];
    const sortedCategories = Array.from(grouped.keys()).sort(
      (a, b) => order.indexOf(a) - order.indexOf(b),
    );

    return sortedCategories.map((cat) => {
      const caps = grouped.get(cat) ?? [];
      return {
        category: cat,
        caps,
        selectedCount: caps.filter((c) => c.selected).length,
        totalCount: caps.length,
      };
    });
  }, [data]);

  const totalSelected = useMemo(
    () => groups.reduce((sum, g) => sum + g.selectedCount, 0),
    [groups],
  );

  const setCapability = useMutation({
    mutationFn: async (input: { competencyId: string; strength: CapabilityStrength }) => {
      if (input.strength === 0) {
        const { error } = await supabase
          .from('blueprint_capabilities')
          .delete()
          .eq('blueprint_id', blueprintId)
          .eq('competency_id', input.competencyId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('blueprint_capabilities').upsert(
        {
          blueprint_id: blueprintId,
          competency_id: input.competencyId,
          strength: input.strength,
        },
        { onConflict: 'blueprint_id,competency_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    groups,
    totalSelected,
    loading: isLoading,
    setCapability,
  };
}

export function strengthLabel(s: CapabilityStrength): string {
  return ['—', 'Supporting', 'Secondary', 'Primary'][s];
}
