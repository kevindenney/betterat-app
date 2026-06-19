/**
 * Blueprint → cohort link sheet — backs the Creator Studio "Add a cohort"
 * control. Lists the org's cohorts (betterat_org_cohorts) that aren't already
 * linked to this blueprint and inserts the chosen ones into blueprint_cohorts
 * (composite PK blueprint_id+cohort_id, so a link is idempotent).
 *
 * Linking a cohort to a blueprint is how an org gates "this class moves
 * through this curriculum" — the same betterat_org_cohorts the admin Studio
 * manages, just attached to a blueprint here.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAdminCohorts } from '@/hooks/useAdminCohorts';

export interface BlueprintCohortLinkSheetProps {
  visible: boolean;
  blueprintId: string;
  orgId: string;
  blueprintTitle: string;
  linkedCohortIds: string[];
  onClose: () => void;
  onLinked?: (count: number) => void;
}

export function BlueprintCohortLinkSheet({
  visible,
  blueprintId,
  orgId,
  blueprintTitle,
  linkedCohortIds,
  onClose,
  onLinked,
}: BlueprintCohortLinkSheetProps) {
  const queryClient = useQueryClient();
  const { cohorts, loading } = useAdminCohorts(orgId);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const linked = useMemo(() => new Set(linkedCohortIds), [linkedCohortIds]);

  const candidates = useMemo(() => {
    const pool = cohorts.filter((c) => !linked.has(c.id));
    if (!search.trim()) return pool;
    const q = search.toLowerCase();
    return pool.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q),
    );
  }, [cohorts, linked, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const linkMutation = useMutation({
    mutationFn: async (): Promise<number> => {
      const ids = Array.from(selected);
      if (ids.length === 0) throw new Error('Select at least one cohort.');
      const payload = ids.map((cohortId) => ({
        blueprint_id: blueprintId,
        cohort_id: cohortId,
      }));
      const { error: insertErr } = await supabase.from('blueprint_cohorts').insert(payload);
      if (insertErr) throw insertErr;

      const countLabel = `${ids.length} ${ids.length === 1 ? 'cohort' : 'cohorts'}`;
      await supabase
        .rpc('audit_log_event', {
          p_org_id: orgId,
          p_verb: 'blueprint_cohort_link',
          p_verb_label: 'Linked',
          p_description: `Linked ${countLabel} to ${blueprintTitle}.`,
          p_target_type: 'blueprint',
          p_target_id: blueprintId,
          p_target_label: blueprintTitle,
          p_payload: { action: 'blueprint.link_cohorts', count: ids.length },
        })
        .then(undefined, () => undefined);

      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
      queryClient.invalidateQueries({ queryKey: ['admin-cohorts', orgId] });
      onLinked?.(count);
      setSelected(new Set());
      setSearch('');
      setError(null);
      onClose();
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not link cohorts.');
    },
  });

  if (!visible) return null;

  return (
    <View style={s.scrim}>
      <Pressable style={s.scrimPress} onPress={onClose} />
      <View style={s.modal}>
        <View style={s.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.title}>Add a cohort</Text>
            <Text style={s.sub} numberOfLines={1}>
              Link org cohorts to {blueprintTitle}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={s.xBtn}>
            <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.4)" />
          </Pressable>
        </View>

        <View style={s.controls}>
          <View style={s.searchInput}>
            <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search cohorts by name…"
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              style={s.searchField}
            />
          </View>
        </View>

        <View style={s.listHead}>
          <Text style={s.listHeadText}>
            {loading ? 'Loading…' : `${candidates.length} available`}
          </Text>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
          {loading ? (
            <Text style={s.muted}>Loading cohorts…</Text>
          ) : candidates.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="school-outline" size={28} color="rgba(40, 64, 107, 0.5)" />
              <Text style={s.emptyTitle}>
                {search ? 'No matches' : 'No cohorts to add'}
              </Text>
              <Text style={s.emptyBody}>
                {search
                  ? `Nothing matches "${search}".`
                  : cohorts.length === 0
                  ? 'This org has no cohorts yet. Create one from the admin Cohorts tab first.'
                  : 'Every cohort is already linked to this blueprint.'}
              </Text>
            </View>
          ) : (
            candidates.map((c) => {
              const checked = selected.has(c.id);
              return (
                <Pressable key={c.id} onPress={() => toggle(c.id)} style={s.row}>
                  <View style={[s.checkbox, checked && s.checkboxOn]}>
                    {checked ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
                  </View>
                  <View style={s.rowIcon}>
                    <Ionicons name="school" size={15} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
                      {c.description ? ` · ${c.description}` : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <View style={s.foot}>
          {error ? (
            <View style={s.errorPill}>
              <Ionicons name="alert-circle" size={12} color="#FF3B30" />
              <Text style={s.errorPillText} numberOfLines={1}>
                {error}
              </Text>
            </View>
          ) : (
            <Text style={s.footSummary}>{selected.size} selected</Text>
          )}
          <View style={{ flex: 1 }} />
          <Pressable style={s.btnGhost} onPress={onClose}>
            <Text style={s.btnGhostText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[s.btnPrimary, (selected.size === 0 || linkMutation.isPending) && s.btnDisabled]}
            disabled={selected.size === 0 || linkMutation.isPending}
            onPress={() => linkMutation.mutate()}
          >
            <Text style={s.btnPrimaryText}>
              {linkMutation.isPending ? 'Adding…' : `Add ${selected.size > 0 ? selected.size : ''}`.trim()}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  scrimPress: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  modal: {
    width: 560,
    maxWidth: '94%',
    maxHeight: 700,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...({ boxShadow: '0 30px 80px -20px rgba(0,0,0,0.4)' } as any),
  },

  head: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.2 },
  sub: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', marginTop: 3 },
  xBtn: { padding: 4 },

  controls: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchField: {
    flex: 1,
    fontSize: 13,
    color: '#1C1C1E',
    ...(typeof document !== 'undefined' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  listHead: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 6,
  },
  listHeadText: { fontSize: 11.5, fontWeight: '600', color: 'rgba(60, 60, 67, 0.6)' },

  body: { flexGrow: 0, flexShrink: 1 },
  bodyInner: { paddingHorizontal: 22, paddingBottom: 18, gap: 4 },

  muted: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', paddingVertical: 24, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#C7C7CC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { borderColor: '#28406B', backgroundColor: '#28406B' },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  rowMeta: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', marginTop: 4 },
  emptyBody: {
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 380,
  },

  foot: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footSummary: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },
  errorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255, 59, 48, 0.10)',
    borderRadius: 999,
    maxWidth: 300,
  },
  errorPillText: { fontSize: 11, fontWeight: '600', color: '#FF3B30', flex: 1 },

  btnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.10)',
    backgroundColor: '#FFFFFF',
  },
  btnGhostText: { fontSize: 12.5, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },
  btnPrimary: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#28406B' },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' },
});
