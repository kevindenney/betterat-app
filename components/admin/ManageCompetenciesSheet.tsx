/**
 * ManageCompetenciesSheet — modal CRUD for org_competencies.
 *
 * Opens from the Insights page header. An org admin can:
 *   - See the current competency framework (rows ordered by display_order)
 *   - Add a new competency (short label + full label + category +
 *     optional description)
 *   - Delete an existing one (cascade is safe — no evidence FK yet)
 *
 * Mutations invalidate the ['admin-org-competencies', orgId] query so
 * Insights refreshes immediately. The (org_id, short_label) unique
 * constraint surfaces as an inline error.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { StudioButton } from '@/components/studio/StudioShell';

const CATEGORIES = [
  'Procedural',
  'Assessment',
  'Communication',
  'Tactics',
  'Boathandling',
  'Clinical reasoning',
  'Professionalism',
  'Other',
] as const;

export interface ManageCompetenciesSheetProps {
  visible: boolean;
  orgId: string;
  orgShortName: string;
  onClose: () => void;
}

interface CompetencyRow {
  id: string;
  short_label: string;
  full_label: string;
  category: string;
  description: string | null;
  display_order: number;
  created_at: string | null;
}

export function ManageCompetenciesSheet({
  visible,
  orgId,
  orgShortName,
  onClose,
}: ManageCompetenciesSheetProps) {
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['manage-competencies', orgId],
    enabled: !!orgId && visible,
    staleTime: 30_000,
    queryFn: async (): Promise<CompetencyRow[]> => {
      // In the modal we sort newest-first so a just-added row sits right
      // under the Add form and the user can immediately confirm it landed.
      // The Insights view keeps display_order for stable framework ordering.
      const { data, error } = await supabase
        .from('org_competencies')
        .select('id, short_label, full_label, category, description, display_order, created_at')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[ManageCompetenciesSheet] query failed', error);
        return [];
      }
      return (data ?? []) as CompetencyRow[];
    },
  });

  const [draftShort, setDraftShort] = useState('');
  const [draftFull, setDraftFull] = useState('');
  const [draftCategory, setDraftCategory] = useState<string>(CATEGORIES[0]);
  const [draftDescription, setDraftDescription] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  // Auto-clear the "added X" toast after 3 seconds so the form returns to neutral.
  useEffect(() => {
    if (!lastAdded) return;
    const handle = setTimeout(() => setLastAdded(null), 3000);
    return () => clearTimeout(handle);
  }, [lastAdded]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!draftShort.trim()) throw new Error('Short label is required');
      if (!draftFull.trim()) throw new Error('Full label is required');
      const nextOrder = (rows[rows.length - 1]?.display_order ?? 0) + 1;
      const { error } = await supabase.from('org_competencies').insert({
        org_id: orgId,
        short_label: draftShort.trim(),
        full_label: draftFull.trim(),
        category: draftCategory,
        description: draftDescription.trim() || null,
        display_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage-competencies', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-org-competencies', orgId] });
      setLastAdded(draftShort.trim() || draftFull.trim());
      setDraftShort('');
      setDraftFull('');
      setDraftCategory(CATEGORIES[0]);
      setDraftDescription('');
      setAddError(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to add competency';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        setAddError(
          `"${draftShort.trim()}" already exists for ${orgShortName}. Pick a different short label.`,
        );
      } else {
        setAddError(msg);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('org_competencies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage-competencies', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-org-competencies', orgId] });
    },
  });

  if (!visible) return null;

  return (
    <View style={s.scrim}>
      <Pressable style={s.scrimPress} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.head}>
          <View style={s.headCol}>
            <Text style={s.title}>Manage competencies</Text>
            <Text style={s.note}>
              The framework {orgShortName} tracks. Shown on Insights, used in
              accreditation reports.
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.4)" />
          </Pressable>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
          {/* Add form — placed first so the primary action is immediately visible */}
          <View style={s.formSection}>
            <View style={s.formHead}>
              <Ionicons name="add-circle" size={16} color="#28406B" />
              <Text style={s.formTitle}>Add a competency</Text>
              {lastAdded ? (
                <View style={s.successPill}>
                  <Ionicons name="checkmark-circle" size={12} color="#1E8F47" />
                  <Text style={s.successPillText}>Added "{lastAdded}"</Text>
                </View>
              ) : null}
            </View>
            <View style={s.formRow}>
              <View style={[s.fieldCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>Short label</Text>
                <TextInput
                  value={draftShort}
                  onChangeText={setDraftShort}
                  placeholder="e.g. Sepsis"
                  placeholderTextColor="rgba(60, 60, 67, 0.4)"
                  style={s.input}
                />
              </View>
              <View style={[s.fieldCol, { flex: 2 }]}>
                <Text style={s.fieldLabel}>Full label</Text>
                <TextInput
                  value={draftFull}
                  onChangeText={setDraftFull}
                  placeholder="e.g. Sepsis bundle recognition"
                  placeholderTextColor="rgba(60, 60, 67, 0.4)"
                  style={s.input}
                />
              </View>
            </View>

            <View style={s.fieldCol}>
              <Text style={s.fieldLabel}>Category</Text>
              <View style={s.catPicker}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setDraftCategory(c)}
                    style={[s.catPill, draftCategory === c && s.catPillActive]}
                  >
                    <Text
                      style={[
                        s.catPillText,
                        draftCategory === c && s.catPillTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={s.fieldCol}>
              <Text style={s.fieldLabel}>Description (optional)</Text>
              <TextInput
                value={draftDescription}
                onChangeText={setDraftDescription}
                placeholder="What does evidence of this competency look like?"
                placeholderTextColor="rgba(60, 60, 67, 0.4)"
                style={[s.input, s.inputMultiline]}
                multiline
              />
            </View>

            {addError ? <Text style={s.addError}>{addError}</Text> : null}
          </View>

          {/* Divider between Add form and existing list */}
          <View style={s.sectionDivider} />

          {/* Existing list */}
          <View style={s.listSection}>
            <Text style={s.sectionEyebrow}>
              {rows.length} existing {rows.length === 1 ? 'competency' : 'competencies'}
            </Text>
            {isLoading ? (
              <Text style={s.loading}>Loading…</Text>
            ) : rows.length === 0 ? (
              <Text style={s.empty}>
                None yet. Use the form above — try a procedural skill like "IV
                insertion · supervised" or an assessment like "Head-to-toe
                assessment".
              </Text>
            ) : (
              rows.map((r) => (
                <View key={r.id} style={s.row}>
                  <View style={s.rowCol}>
                    <View style={s.rowHead}>
                      <View style={s.shortChip}>
                        <Text style={s.shortChipText}>{r.short_label}</Text>
                      </View>
                      <Text style={s.rowFull}>{r.full_label}</Text>
                      <View style={[s.catChip, categoryToneStyle(r.category)]}>
                        <Text style={[s.catChipText, categoryToneTextStyle(r.category)]}>
                          {r.category}
                        </Text>
                      </View>
                    </View>
                    {r.description ? (
                      <Text style={s.rowDesc} numberOfLines={2}>
                        {r.description}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => deleteMutation.mutate(r.id)}
                    style={s.deleteBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="trash-outline" size={15} color="#FF3B30" />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <View style={s.footer}>
          <Text style={s.footerHint}>
            Changes appear on Insights immediately. Existing evidence isn't
            removed when a competency is deleted.
          </Text>
          <View style={s.footerActions}>
            <StudioButton variant="ghost" label="Done" onPress={onClose} />
            <StudioButton
              variant="primary"
              accent="navy"
              icon="add"
              label={addMutation.isPending ? 'Adding…' : 'Add competency'}
              onPress={() => addMutation.mutate()}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function categoryToneStyle(category: string) {
  switch (category) {
    case 'Procedural':
      return { backgroundColor: 'rgba(184, 90, 102, 0.14)' };
    case 'Assessment':
      return { backgroundColor: 'rgba(0, 122, 255, 0.10)' };
    case 'Communication':
      return { backgroundColor: 'rgba(107, 91, 191, 0.14)' };
    case 'Tactics':
      return { backgroundColor: 'rgba(40, 64, 107, 0.12)' };
    case 'Boathandling':
      return { backgroundColor: 'rgba(184, 133, 90, 0.16)' };
    case 'Clinical reasoning':
      return { backgroundColor: 'rgba(110, 139, 90, 0.16)' };
    case 'Professionalism':
      return { backgroundColor: 'rgba(139, 110, 90, 0.16)' };
    default:
      return { backgroundColor: 'rgba(60, 60, 67, 0.08)' };
  }
}

function categoryToneTextStyle(category: string) {
  switch (category) {
    case 'Procedural':
      return { color: '#B85A66' };
    case 'Assessment':
      return { color: '#007AFF' };
    case 'Communication':
      return { color: '#6B5BBF' };
    case 'Tactics':
      return { color: '#28406B' };
    case 'Boathandling':
      return { color: '#B8855A' };
    case 'Clinical reasoning':
      return { color: '#6E8B5A' };
    case 'Professionalism':
      return { color: '#8B6E5A' };
    default:
      return { color: 'rgba(60, 60, 67, 0.85)' };
  }
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
  sheet: {
    width: 720,
    maxHeight: 760,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...({
      boxShadow: '0 30px 80px -20px rgba(0,0,0,0.4)',
    } as any),
  },
  head: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  note: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', marginTop: 3 },

  body: { flex: 1 },
  bodyInner: { paddingHorizontal: 22, paddingVertical: 16, gap: 24 },

  listSection: { gap: 8 },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  loading: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)' },
  empty: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 18 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FAFAF7',
    borderRadius: 10,
  },
  rowCol: { flex: 1, minWidth: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  shortChip: {
    paddingHorizontal: 7,
    paddingTop: 2,
    paddingBottom: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  shortChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: 0.2,
  },
  rowFull: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  catChip: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 3, borderRadius: 4 },
  catChipText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  rowDesc: {
    marginTop: 5,
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 16,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
  },

  formSection: {
    gap: 10,
    padding: 16,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(40, 64, 107, 0.05)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(40, 64, 107, 0.15)',
  },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  formTitle: { fontSize: 14, fontWeight: '700', color: '#28406B', letterSpacing: -0.1 },
  successPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(52, 199, 89, 0.14)',
    borderRadius: 999,
  },
  successPillText: { fontSize: 11, fontWeight: '600', color: '#1E8F47' },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
    marginVertical: 4,
  },
  formRow: { flexDirection: 'row', gap: 12 },
  fieldCol: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    fontSize: 13,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
    ...(typeof document !== 'undefined' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  inputMultiline: { minHeight: 70 },

  catPicker: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    backgroundColor: '#FFFFFF',
  },
  catPillActive: { backgroundColor: '#28406B', borderColor: '#28406B' },
  catPillText: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '500' },
  catPillTextActive: { color: '#FFFFFF', fontWeight: '600' },

  addError: { fontSize: 12, color: '#FF3B30', fontWeight: '500', marginTop: 4 },

  footer: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerHint: { flex: 1, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 16 },
  footerActions: { flexDirection: 'row', gap: 8 },
});
