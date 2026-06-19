/**
 * Assign members sheet — the "Assign members" counterpart to the cohort
 * detail roster. Picks org members who aren't already in the cohort and
 * inserts them into betterat_org_cohort_members (the institutional cohort
 * membership the admin Studio reads).
 *
 * Candidate pool = the org's existing people (organization_memberships →
 * users, via useAdminPeople), minus whoever is already on the roster. A
 * cohort can only contain people who already belong to the org, so this is
 * an assignment surface, not an invite surface (that's AddPersonSheet).
 * Vocabulary (member/members) is passed in so it reads natively per org type.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAdminPeople } from '@/hooks/useAdminPeople';

export interface AssignMembersSheetProps {
  visible: boolean;
  orgId: string;
  cohortId: string;
  cohortName: string;
  existingUserIds: string[];
  memberNoun?: string;
  membersNoun?: string;
  onClose: () => void;
  onAssigned?: (count: number) => void;
}

type AssignRole = 'student' | 'mentor';

export function AssignMembersSheet({
  visible,
  orgId,
  cohortId,
  cohortName,
  existingUserIds,
  memberNoun = 'member',
  membersNoun = 'members',
  onClose,
  onAssigned,
}: AssignMembersSheetProps) {
  const queryClient = useQueryClient();
  const { rows, loading } = useAdminPeople(orgId);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<AssignRole>('student');
  const [error, setError] = useState<string | null>(null);

  const existing = useMemo(() => new Set(existingUserIds), [existingUserIds]);

  const candidates = useMemo(() => {
    const pool = rows.filter((r) => !existing.has(r.userId));
    if (!search.trim()) return pool;
    const q = search.toLowerCase();
    return pool.filter(
      (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    );
  }, [rows, existing, search]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === candidates.length && candidates.length > 0
        ? new Set()
        : new Set(candidates.map((c) => c.userId)),
    );
  };

  const assignMutation = useMutation({
    mutationFn: async (): Promise<number> => {
      const ids = Array.from(selected);
      if (ids.length === 0) throw new Error(`Select at least one ${memberNoun}.`);
      const payload = ids.map((userId) => ({
        cohort_id: cohortId,
        user_id: userId,
        role,
      }));
      const { error: insertErr } = await supabase
        .from('betterat_org_cohort_members')
        .insert(payload);
      if (insertErr) throw insertErr;

      // Audit best-effort — never block the assignment on the log.
      const countLabel = `${ids.length} ${ids.length === 1 ? memberNoun : membersNoun}`;
      await supabase
        .rpc('audit_log_event', {
          p_org_id: orgId,
          p_verb: 'cohort_assign',
          p_verb_label: 'Assigned',
          p_description: `Assigned ${countLabel} to ${cohortName} as ${role}.`,
          p_target_type: 'cohort',
          p_target_id: cohortId,
          p_target_label: cohortName,
          p_payload: { action: 'cohort.assign_members', count: ids.length, role },
        })
        .then(undefined, () => undefined);

      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-cohort-detail', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['admin-cohorts', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-people', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-feed', orgId] });
      onAssigned?.(count);
      setSelected(new Set());
      setSearch('');
      setError(null);
      onClose();
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not assign members.');
    },
  });

  if (!visible) return null;

  const allSelected = selected.size === candidates.length && candidates.length > 0;

  return (
    <View style={s.scrim}>
      <Pressable style={s.scrimPress} onPress={onClose} />
      <View style={s.modal}>
        <View style={s.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.title}>Assign {membersNoun}</Text>
            <Text style={s.sub} numberOfLines={1}>
              Add org {membersNoun} to {cohortName}
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
              placeholder={`Search ${membersNoun} by name or email…`}
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              style={s.searchField}
            />
          </View>
          <View style={s.roleRow}>
            {(
              [
                { key: 'student', label: memberNoun },
                { key: 'mentor', label: 'Mentor' },
              ] as { key: AssignRole; label: string }[]
            ).map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setRole(r.key)}
                style={[s.roleChip, role === r.key && s.roleChipOn]}
              >
                <Text style={[s.roleChipText, role === r.key && s.roleChipTextOn]}>
                  as {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.listHead}>
          <Text style={s.listHeadText}>
            {loading ? 'Loading…' : `${candidates.length} available`}
          </Text>
          {candidates.length > 0 ? (
            <Pressable style={s.selectAll} onPress={toggleAll}>
              <Ionicons name="checkbox-outline" size={12} color="rgba(60, 60, 67, 0.7)" />
              <Text style={s.selectAllText}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
          {loading ? (
            <Text style={s.muted}>Loading {membersNoun}…</Text>
          ) : candidates.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={28} color="rgba(40, 64, 107, 0.5)" />
              <Text style={s.emptyTitle}>
                {search ? 'No matches' : `Everyone's already assigned`}
              </Text>
              <Text style={s.emptyBody}>
                {search
                  ? `Nothing matches "${search}".`
                  : `Every org ${memberNoun} is already on this roster. Invite more people from the People tab.`}
              </Text>
            </View>
          ) : (
            candidates.map((c) => {
              const checked = selected.has(c.userId);
              return (
                <Pressable key={c.userId} onPress={() => toggle(c.userId)} style={s.row}>
                  <View style={[s.checkbox, checked && s.checkboxOn]}>
                    {checked ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
                  </View>
                  <View style={[s.avi, { backgroundColor: c.gradient[0] }]}>
                    <Text style={s.aviText}>{c.initials}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {c.email}
                      {c.cohortLabel ? ` · ${c.cohortLabel}` : ''}
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
            <Text style={s.footSummary}>
              {selected.size} selected
            </Text>
          )}
          <View style={{ flex: 1 }} />
          <Pressable style={s.btnGhost} onPress={onClose}>
            <Text style={s.btnGhostText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[s.btnPrimary, (selected.size === 0 || assignMutation.isPending) && s.btnDisabled]}
            disabled={selected.size === 0 || assignMutation.isPending}
            onPress={() => assignMutation.mutate()}
          >
            <Text style={s.btnPrimaryText}>
              {assignMutation.isPending
                ? 'Assigning…'
                : `Assign ${selected.size > 0 ? selected.size : ''}`.trim()}
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
    width: 600,
    maxWidth: '94%',
    maxHeight: 720,
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
    gap: 10,
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
  roleRow: { flexDirection: 'row', gap: 6 },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    backgroundColor: '#FFFFFF',
  },
  roleChipOn: { borderColor: '#007AFF', backgroundColor: 'rgba(0, 122, 255, 0.10)' },
  roleChipText: { fontSize: 12, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },
  roleChipTextOn: { color: '#007AFF', fontWeight: '600' },

  listHead: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listHeadText: { fontSize: 11.5, fontWeight: '600', color: 'rgba(60, 60, 67, 0.6)' },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectAllText: { fontSize: 11.5, fontWeight: '600', color: 'rgba(60, 60, 67, 0.7)' },

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
  avi: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  aviText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },
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
