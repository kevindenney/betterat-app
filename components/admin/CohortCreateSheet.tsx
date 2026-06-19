/**
 * Cohort create modal — the "New cohort" counterpart to CohortEditSheet.
 *
 * Inserts a fresh row into betterat_org_cohorts (the institutional cohort
 * model the org-admin Studio reads). Mirrors the edit sheet's Basics panel
 * and persistence so create/edit feel like one surface; the edit sheet's
 * blueprint/mentor placeholders are intentionally omitted here since there's
 * nothing to assign until the cohort exists. Vocabulary (Cohort/Program) is
 * passed in so the sheet reads natively per org type.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface CohortCreateSheetProps {
  visible: boolean;
  orgId: string;
  cohortNoun?: string;
  programNoun?: string;
  onClose: () => void;
  onCreated?: (cohortId: string) => void;
}

const STATUS_OPTIONS: { key: string; label: string; tone: 'ok' | 'warn' | 'neutral' }[] = [
  { key: 'recruiting', label: 'Recruiting', tone: 'warn' },
  { key: 'active', label: 'Active', tone: 'ok' },
  { key: 'completed', label: 'Completed', tone: 'neutral' },
  { key: 'on_hold', label: 'On hold', tone: 'warn' },
];

function parseInputToIso(input: string): string | null {
  if (!input.trim()) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function CohortCreateSheet({
  visible,
  orgId,
  cohortNoun = 'Cohort',
  programNoun = 'Program',
  onClose,
  onCreated,
}: CohortCreateSheetProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [statusOpen, setStatusOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxSeats, setMaxSeats] = useState('');
  const [program, setProgram] = useState('');

  // Reset the form each time the sheet opens fresh.
  useEffect(() => {
    if (!visible) return;
    setName('');
    setDescription('');
    setStatus('active');
    setStatusOpen(false);
    setStartDate('');
    setEndDate('');
    setMaxSeats('');
    setProgram('');
  }, [visible]);

  const createMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const seatsInt = parseInt(maxSeats, 10);
      const payload: Record<string, unknown> = {
        org_id: orgId,
        name: name.trim(),
        description: description.trim() || null,
        status,
        max_seats: Number.isFinite(seatsInt) ? seatsInt : null,
        start_date: parseInputToIso(startDate),
        end_date: parseInputToIso(endDate),
        program: program.trim() || null,
      };
      const { data, error } = await supabase
        .from('betterat_org_cohorts')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;

      // Audit best-effort — never block the create on the log.
      await supabase
        .rpc('audit_log_event', {
          p_org_id: orgId,
          p_verb: 'cohort_create',
          p_verb_label: 'Created',
          p_description: `Created ${cohortNoun.toLowerCase()} ${name.trim()} · status ${status}.`,
          p_target_type: 'cohort',
          p_target_id: data.id,
          p_target_label: name.trim(),
          p_payload: { action: 'cohort.create', after: payload },
        })
        .then(undefined, () => undefined);

      return data.id as string;
    },
    onSuccess: (cohortId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-cohorts', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-feed', orgId] });
      onCreated?.(cohortId);
      onClose();
    },
  });

  if (!visible) return null;

  const createError = createMutation.error instanceof Error ? createMutation.error.message : null;
  const currentStatusLabel = STATUS_OPTIONS.find((o) => o.key === status)?.label ?? status;
  const canSubmit = name.trim().length > 0 && !createMutation.isPending;

  return (
    <View style={s.scrim}>
      <Pressable style={s.scrimPress} onPress={onClose} />
      <View style={s.modal}>
        <View style={s.mHead}>
          <View>
            <Text style={s.mH2}>New {cohortNoun.toLowerCase()}</Text>
            <Text style={s.mSub}>
              Create the {cohortNoun.toLowerCase()}, then assign {programNoun.toLowerCase()}s and
              members from its detail page.
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={s.xBtn}>
            <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.4)" />
          </Pressable>
        </View>

        <ScrollView style={s.mBody} contentContainerStyle={s.mBodyInner}>
          <View style={s.panel}>
            <View style={s.panelHead}>
              <Text style={s.panelEyebrow}>Basics</Text>
              <Text style={s.panelHint}>Visible to students and mentors</Text>
            </View>
            <View style={{ gap: 14 }}>
              <View>
                <Text style={s.fieldLabel}>{cohortNoun} name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={`e.g. ${cohortNoun} A · 2027`}
                  placeholderTextColor="rgba(60, 60, 67, 0.4)"
                  style={s.input}
                  autoFocus
                />
              </View>
              <View>
                <Text style={s.fieldLabel}>Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={2}
                  placeholder="What's this group moving through together?"
                  placeholderTextColor="rgba(60, 60, 67, 0.4)"
                  style={[s.input, s.inputMultiline]}
                />
              </View>
              <View style={s.row3}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Status</Text>
                  <Pressable style={s.selectFake} onPress={() => setStatusOpen((v) => !v)}>
                    <View
                      style={[
                        s.statusDot,
                        {
                          backgroundColor:
                            status === 'active'
                              ? '#1E8F47'
                              : status === 'recruiting' || status === 'on_hold'
                              ? '#C99632'
                              : 'rgba(60, 60, 67, 0.6)',
                        },
                      ]}
                    />
                    <Text style={s.selectFakeText}>{currentStatusLabel}</Text>
                    <Ionicons
                      name={statusOpen ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color="rgba(60, 60, 67, 0.4)"
                    />
                  </Pressable>
                  {statusOpen ? (
                    <View style={s.statusDropdown}>
                      {STATUS_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.key}
                          style={s.statusOption}
                          onPress={() => {
                            setStatus(opt.key);
                            setStatusOpen(false);
                          }}
                        >
                          <View
                            style={[
                              s.statusDot,
                              {
                                backgroundColor:
                                  opt.tone === 'ok'
                                    ? '#1E8F47'
                                    : opt.tone === 'warn'
                                    ? '#C99632'
                                    : 'rgba(60, 60, 67, 0.6)',
                              },
                            ]}
                          />
                          <Text style={s.statusOptionText}>{opt.label}</Text>
                          {status === opt.key ? (
                            <Ionicons name="checkmark" size={14} color="#28406B" />
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Start date</Text>
                  <View style={[s.input, s.inputAffix]}>
                    <Ionicons name="calendar-outline" size={12} color="rgba(60, 60, 67, 0.6)" />
                    <TextInput
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="Sep 1, 2027"
                      placeholderTextColor="rgba(60, 60, 67, 0.4)"
                      style={s.inputAffixField}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>End date</Text>
                  <View style={[s.input, s.inputAffix]}>
                    <Ionicons name="calendar-outline" size={12} color="rgba(60, 60, 67, 0.6)" />
                    <TextInput
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="May 30, 2028"
                      placeholderTextColor="rgba(60, 60, 67, 0.4)"
                      style={s.inputAffixField}
                    />
                  </View>
                </View>
              </View>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Max seats</Text>
                  <TextInput
                    value={maxSeats}
                    onChangeText={setMaxSeats}
                    placeholder="30"
                    placeholderTextColor="rgba(60, 60, 67, 0.4)"
                    keyboardType="number-pad"
                    style={s.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>{programNoun}</Text>
                  <TextInput
                    value={program}
                    onChangeText={setProgram}
                    placeholder={`e.g. ${programNoun} track`}
                    placeholderTextColor="rgba(60, 60, 67, 0.4)"
                    style={s.input}
                  />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={s.mFoot}>
          {createError ? (
            <View style={s.errorPill}>
              <Ionicons name="alert-circle" size={12} color="#FF3B30" />
              <Text style={s.errorPillText}>{createError}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable style={s.btnGhost} onPress={onClose}>
            <Text style={s.btnGhostText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[s.btnPrimary, !canSubmit && s.btnPrimaryDisabled]}
            disabled={!canSubmit}
            onPress={() => createMutation.mutate()}
          >
            <Text style={s.btnPrimaryText}>
              {createMutation.isPending ? 'Creating…' : `Create ${cohortNoun.toLowerCase()}`}
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
    width: 640,
    maxWidth: '94%',
    maxHeight: 760,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...({ boxShadow: '0 30px 80px -20px rgba(0,0,0,0.4)' } as any),
  },

  mHead: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  mH2: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.2 },
  mSub: { marginTop: 4, fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', maxWidth: 460 },
  xBtn: { padding: 4 },

  mBody: { flex: 1 },
  mBodyInner: { paddingHorizontal: 24, paddingVertical: 18, gap: 18 },

  panel: {
    padding: 18,
    backgroundColor: 'rgba(40, 64, 107, 0.05)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(40, 64, 107, 0.15)',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#28406B',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  panelHint: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  fieldLabel: { fontSize: 11, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '600', marginBottom: 6 },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    fontSize: 13,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  inputAffix: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 },
  inputAffixField: { flex: 1, fontSize: 13, color: '#1C1C1E', paddingVertical: 9 },

  selectFake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1E8F47' },
  selectFakeText: { flex: 1, fontSize: 13, color: '#1C1C1E' },

  row2: { flexDirection: 'row', gap: 14 },
  row3: { flexDirection: 'row', gap: 14 },

  statusDropdown: {
    marginTop: 4,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.10)',
    ...({ boxShadow: '0 8px 24px -8px rgba(0,0,0,0.15)' } as any),
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusOptionText: { flex: 1, fontSize: 13, color: '#1C1C1E' },

  mFoot: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#F5F4EE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255, 59, 48, 0.10)',
    borderRadius: 999,
    maxWidth: 320,
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
  btnPrimaryDisabled: { opacity: 0.5 },
  btnPrimaryText: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' },
});
