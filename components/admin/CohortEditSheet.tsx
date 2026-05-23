/**
 * Cohort edit modal (Frame 24 of the JHSON Admin Suite)
 *
 * Opens from cohort detail's "Edit cohort" button. Form vocabulary
 * matches ManageCompetenciesSheet — navy-tinted panels, explicit
 * success pill in footer, structured field labels.
 *
 * Basics section persists to betterat_org_cohorts (name, description,
 * status, max_seats, start/end dates, program). Blueprints + mentors
 * sections are still visual placeholders pending those schemas.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface CohortEditSheetProps {
  visible: boolean;
  cohortId: string;
  orgId: string;
  cohortName: string;
  description?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  maxSeats?: number | null;
  program?: string | null;
  onClose: () => void;
}

const STATUS_OPTIONS: { key: string; label: string; tone: 'ok' | 'warn' | 'neutral' }[] = [
  { key: 'recruiting', label: 'Recruiting', tone: 'warn' },
  { key: 'active', label: 'Active', tone: 'ok' },
  { key: 'completed', label: 'Completed', tone: 'neutral' },
  { key: 'on_hold', label: 'On hold', tone: 'warn' },
];

function formatDateForInput(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function parseInputToIso(input: string): string | null {
  if (!input.trim()) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

interface BlueprintRow {
  id: string;
  title: string;
  sub: string;
  category: 'rsn' | 'proc' | 'asmt' | 'comm';
  on: boolean;
}

const BLUEPRINTS: BlueprintRow[] = [
  { id: 'sepsis', title: 'Sepsis bundle recognition', sub: 'v0.4 draft · Dr. R. Murphy · 6 steps', category: 'rsn', on: true },
  { id: 'iv', title: 'IV insertion · supervised', sub: 'v2.1 · Dr. R. Murphy · 4 steps', category: 'proc', on: true },
  { id: 'h2t', title: 'Head-to-toe assessment', sub: 'v3.0 · J. Kim, RN · 8 steps', category: 'asmt', on: true },
  { id: 'isbar', title: 'ISBAR handoff communication', sub: 'v1.4 · Dean S. Park · 3 steps', category: 'comm', on: true },
  { id: 'teach', title: 'Discharge teach-back', sub: 'v1.0 · Noor Aziz · 5 steps', category: 'comm', on: false },
];

const CATEGORY_TONES: Record<BlueprintRow['category'], { bg: string; fg: string; label: string }> = {
  rsn: { bg: 'rgba(122, 90, 139, 0.14)', fg: '#7A5A8B', label: 'Clinical reasoning' },
  proc: { bg: 'rgba(139, 90, 60, 0.12)', fg: '#8B5A3C', label: 'Procedural' },
  asmt: { bg: 'rgba(90, 107, 139, 0.14)', fg: '#5A6B8B', label: 'Assessment' },
  comm: { bg: 'rgba(110, 139, 90, 0.14)', fg: '#6E8B5A', label: 'Communication' },
};

interface MentorRow {
  initials: string;
  tone: 'navy' | 'brown';
  name: string;
  role: string;
  badge: string;
}

const MENTORS: MentorRow[] = [
  { initials: 'SP', tone: 'navy', name: 'Dean S. Park', role: 'Faculty · oversight', badge: 'Owner' },
  { initials: 'JK', tone: 'brown', name: 'J. Kim, RN', role: 'Clinical preceptor · East Baltimore', badge: 'Mentor' },
];

export function CohortEditSheet({
  visible,
  cohortId,
  orgId,
  cohortName,
  description: initialDescription,
  status: initialStatus,
  startDate: initialStartDate,
  endDate: initialEndDate,
  maxSeats: initialMaxSeats,
  program: initialProgram,
  onClose,
}: CohortEditSheetProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(cohortName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [status, setStatus] = useState(initialStatus ?? 'active');
  const [statusOpen, setStatusOpen] = useState(false);
  const [startDate, setStartDate] = useState(formatDateForInput(initialStartDate));
  const [endDate, setEndDate] = useState(formatDateForInput(initialEndDate));
  const [maxSeats, setMaxSeats] = useState(
    initialMaxSeats != null ? String(initialMaxSeats) : '',
  );
  const [program, setProgram] = useState(initialProgram ?? 'BSN · pre-licensure');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    BLUEPRINTS.reduce((acc, b) => ({ ...acc, [b.id]: b.on }), {}),
  );

  // Reset form when re-opening with a different cohort
  useEffect(() => {
    if (!visible) return;
    setName(cohortName);
    setDescription(initialDescription ?? '');
    setStatus(initialStatus ?? 'active');
    setStartDate(formatDateForInput(initialStartDate));
    setEndDate(formatDateForInput(initialEndDate));
    setMaxSeats(initialMaxSeats != null ? String(initialMaxSeats) : '');
    setProgram(initialProgram ?? 'BSN · pre-licensure');
    setSavedAt(null);
  }, [
    visible,
    cohortName,
    initialDescription,
    initialStatus,
    initialStartDate,
    initialEndDate,
    initialMaxSeats,
    initialProgram,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const seatsInt = parseInt(maxSeats, 10);
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        max_seats: Number.isFinite(seatsInt) ? seatsInt : null,
        start_date: parseInputToIso(startDate),
        end_date: parseInputToIso(endDate),
        program: program.trim() || null,
      };
      const { error } = await supabase
        .from('betterat_org_cohorts')
        .update(payload)
        .eq('id', cohortId);
      if (error) throw error;

      // Audit best-effort
      await supabase.rpc('audit_log_event', {
        p_org_id: orgId,
        p_verb: 'cohort_edit',
        p_verb_label: 'Edited',
        p_description: `Updated cohort ${name.trim()} · status ${status}, max seats ${maxSeats || '—'}.`,
        p_target_type: 'cohort',
        p_target_id: cohortId,
        p_target_label: name.trim(),
        p_payload: { action: 'cohort.update', after: payload },
      });
    },
    onSuccess: () => {
      setSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ['admin-cohort-detail', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['admin-cohorts', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-feed', orgId] });
    },
  });

  if (!visible) return null;

  const saveError = saveMutation.error instanceof Error ? saveMutation.error.message : null;
  const currentStatusLabel =
    STATUS_OPTIONS.find((o) => o.key === status)?.label ?? status;

  return (
    <View style={s.scrim}>
      <Pressable style={s.scrimPress} onPress={onClose} />
      <View style={s.modal}>
        <View style={s.mHead}>
          <View>
            <Text style={s.mH2}>Edit cohort</Text>
            <Text style={s.mSub}>
              Changes save on Done. Cohort assignment is preserved.
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={s.xBtn}>
            <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.4)" />
          </Pressable>
        </View>

        <ScrollView style={s.mBody} contentContainerStyle={s.mBodyInner}>
          {/* Basics */}
          <View style={s.panel}>
            <View style={s.panelHead}>
              <Text style={s.panelEyebrow}>Basics</Text>
              <Text style={s.panelHint}>Visible to students and mentors</Text>
            </View>
            <View style={{ gap: 14 }}>
              <View>
                <Text style={s.fieldLabel}>Cohort name</Text>
                <TextInput value={name} onChangeText={setName} style={s.input} />
              </View>
              <View>
                <Text style={s.fieldLabel}>Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={2}
                  style={[s.input, s.inputMultiline]}
                />
              </View>
              <View style={s.row3}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Status</Text>
                  <Pressable
                    style={s.selectFake}
                    onPress={() => setStatusOpen((v) => !v)}
                  >
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
                      style={s.inputAffixField}
                    />
                  </View>
                </View>
              </View>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Max seats</Text>
                  <TextInput value={maxSeats} onChangeText={setMaxSeats} style={s.input} />
                  <Text style={s.fieldHelp}>30 currently subscribed · 2 spare seats</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Program</Text>
                  <TextInput
                    value={program}
                    onChangeText={setProgram}
                    style={s.input}
                  />
                  <View style={{ display: 'none' }}>
                    <Ionicons name="chevron-down" size={12} color="rgba(60, 60, 67, 0.4)" />
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Blueprints */}
          <View style={s.panel}>
            <View style={s.panelHead}>
              <Text style={s.panelEyebrow}>Assigned blueprints</Text>
              <Text style={s.panelHint}>
                {Object.values(picked).filter(Boolean).length} selected of 14 in the org
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              {BLUEPRINTS.map((bp) => {
                const on = !!picked[bp.id];
                const cat = CATEGORY_TONES[bp.category];
                return (
                  <Pressable
                    key={bp.id}
                    onPress={() => setPicked((p) => ({ ...p, [bp.id]: !p[bp.id] }))}
                    style={s.pickRow}
                  >
                    <View style={[s.pickCheck, on && s.pickCheckOn]}>
                      {on ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pickTitle}>{bp.title}</Text>
                      <Text style={s.pickSub}>{bp.sub}</Text>
                    </View>
                    <View style={[s.catChip, { backgroundColor: cat.bg }]}>
                      <Text style={[s.catChipText, { color: cat.fg }]}>{cat.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={{ marginTop: 10 }}>
              <Text style={s.showAllText}>Show all 14 ›</Text>
            </Pressable>
          </View>

          {/* Mentors */}
          <View style={s.panel}>
            <View style={s.panelHead}>
              <Text style={s.panelEyebrow}>Mentor assignments</Text>
              <Text style={s.panelHint}>
                Who can mentor across all blueprints in this cohort
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {MENTORS.map((m) => (
                <View key={m.initials} style={s.mentorRow}>
                  <View
                    style={[
                      s.mentorAv,
                      { backgroundColor: m.tone === 'navy' ? '#28406B' : '#8B5A3C' },
                    ]}
                  >
                    <Text style={s.mentorAvText}>{m.initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.mentorName}>{m.name}</Text>
                    <Text style={s.mentorRole}>{m.role}</Text>
                  </View>
                  <View style={s.mentorBadge}>
                    <Text style={s.mentorBadgeText}>{m.badge}</Text>
                  </View>
                  <Pressable hitSlop={6}>
                    <Ionicons name="close" size={14} color="rgba(60, 60, 67, 0.4)" />
                  </Pressable>
                </View>
              ))}
              <Pressable style={s.addMentorBtn}>
                <Ionicons name="add" size={12} color="#28406B" />
                <Text style={s.addMentorText}>Assign mentor</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View style={s.mFoot}>
          {savedAt ? (
            <View style={s.successPill}>
              <Ionicons name="checkmark-circle" size={12} color="#1E8F47" />
              <Text style={s.successPillText}>
                Changes saved{' '}
                {savedAt.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ) : saveError ? (
            <View style={s.errorPill}>
              <Ionicons name="alert-circle" size={12} color="#FF3B30" />
              <Text style={s.errorPillText}>{saveError}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable style={s.btnDangerGhost}>
            <Ionicons name="archive-outline" size={13} color="#FF3B30" />
            <Text style={s.btnDangerGhostText}>Archive cohort</Text>
          </Pressable>
          <Pressable style={s.btnGhost} onPress={onClose}>
            <Text style={s.btnGhostText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[s.btnPrimary, saveMutation.isPending && s.btnPrimaryDisabled]}
            disabled={saveMutation.isPending}
            onPress={() => saveMutation.mutate()}
          >
            <Text style={s.btnPrimaryText}>
              {saveMutation.isPending ? 'Saving…' : 'Done'}
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
    width: 760,
    maxHeight: 820,
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
  mSub: { marginTop: 4, fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)' },
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
  panelHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  panelEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#28406B',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  panelHint: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  fieldLabel: {
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.85)',
    fontWeight: '600',
    marginBottom: 6,
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

  fieldHelp: { marginTop: 4, fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },

  row2: { flexDirection: 'row', gap: 14 },
  row3: { flexDirection: 'row', gap: 14 },

  // Pick list
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  pickCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickCheckOn: { backgroundColor: '#28406B', borderColor: '#28406B' },
  pickTitle: { fontSize: 12.5, color: '#1C1C1E' },
  pickSub: { marginTop: 2, fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  catChip: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 3, borderRadius: 4 },
  catChipText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },

  showAllText: { fontSize: 11.5, fontWeight: '600', color: '#28406B' },

  // Mentors
  mentorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  mentorAv: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorAvText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  mentorName: { fontSize: 12.5, color: '#1C1C1E', fontWeight: '600' },
  mentorRole: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },
  mentorBadge: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    borderRadius: 4,
  },
  mentorBadgeText: { fontSize: 10, color: '#28406B', fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },

  addMentorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
  },
  addMentorText: { fontSize: 11.5, fontWeight: '600', color: '#28406B' },

  // Footer
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
  successPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(52, 199, 89, 0.14)',
    borderRadius: 999,
  },
  successPillText: { fontSize: 11, fontWeight: '600', color: '#1E8F47' },

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

  btnPrimaryDisabled: { opacity: 0.6 },

  btnDangerGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    backgroundColor: '#FFFFFF',
  },
  btnDangerGhostText: { fontSize: 12, fontWeight: '600', color: '#FF3B30' },

  btnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.10)',
    backgroundColor: '#FFFFFF',
  },
  btnGhostText: { fontSize: 12.5, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },

  btnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#28406B',
  },
  btnPrimaryText: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' },
});
