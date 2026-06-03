/**
 * LogShiftSheet — N2 completed-shift capture for the nursing Atlas.
 *
 * Opens from the Sites surface ("Log shift" / a site card). Captures a real
 * clinical shift: site (preselected), unit, the competencies practiced, a
 * self-rating, and an optional PHI-linted reflection. Writes through
 * useLogClinicalShift, which produces located competency evidence so the Sites
 * coverage bars fill in. Site-level only — there is no room/unit/patient field.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  useLogClinicalShift,
  lintHealthcareText,
  type ShiftSelfRating,
} from '@/hooks/useLogClinicalShift';

export interface LogShiftSite {
  id: string | null;
  name: string;
  unit?: string | null;
  specialty?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface LogShiftSheetProps {
  visible: boolean;
  onClose: () => void;
  site: LogShiftSite | null;
  onLogged?: (count: number) => void;
  bottomOffset?: number;
}

type CompetencyRow = {
  id: string;
  title: string | null;
  category: string | null;
  competency_number: number | null;
  sort_order: number | null;
};

const RATINGS: { key: ShiftSelfRating; label: string }[] = [
  { key: 'needs_practice', label: 'Needs practice' },
  { key: 'developing', label: 'Developing' },
  { key: 'proficient', label: 'Proficient' },
  { key: 'confident', label: 'Confident' },
];

export function LogShiftSheet({
  visible,
  onClose,
  site,
  onLogged,
  bottomOffset = 0,
}: LogShiftSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rating, setRating] = useState<ShiftSelfRating>('developing');
  const [reflection, setReflection] = useState('');
  const logShift = useLogClinicalShift();

  const { data: competencies = [], isLoading } = useQuery({
    queryKey: ['nursing-competencies-catalog'],
    enabled: visible,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CompetencyRow[]> => {
      const { data: interest } = await supabase
        .from('interests')
        .select('id')
        .eq('slug', 'nursing')
        .maybeSingle();
      const interestId = (interest as { id?: string } | null)?.id;
      if (!interestId) return [];
      const { data } = await supabase
        .from('betterat_competencies')
        .select('id, title, category, competency_number, sort_order')
        .eq('interest_id', interestId)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });
      return (data ?? []) as CompetencyRow[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, CompetencyRow[]>();
    for (const c of competencies) {
      const cat = c.category ?? 'Other';
      const arr = map.get(cat) ?? [];
      arr.push(c);
      map.set(cat, arr);
    }
    return Array.from(map.entries());
  }, [competencies]);

  const reflectionError = lintHealthcareText(reflection);
  const canSubmit = selected.size > 0 && !reflectionError && !logShift.isPending;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setSelected(new Set());
    setRating('developing');
    setReflection('');
  };

  const handleSubmit = () => {
    if (!site || selected.size === 0) return;
    if (reflectionError) {
      showAlert('Check your note', reflectionError);
      return;
    }
    const now = new Date();
    logShift.mutate(
      {
        sitePoiId: site.id,
        siteName: site.name,
        lat: site.lat,
        lng: site.lng,
        shiftLabel: [site.name, site.unit].filter(Boolean).join(' · '),
        unit: site.unit ?? null,
        specialty: site.specialty ?? null,
        shiftStart: now.toISOString(),
        shiftEnd: now.toISOString(),
        competencyIds: Array.from(selected),
        selfRating: rating,
        reflection: reflection.trim() || null,
      },
      {
        onSuccess: (res) => {
          onLogged?.(res.competenciesLogged);
          reset();
          onClose();
        },
        onError: (err) => {
          showAlert('Could not log shift', err.message);
        },
      },
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={[styles.sheet, { paddingBottom: bottomOffset + IOS_SPACING.lg }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>LOG A SHIFT</Text>
            <Text style={styles.title} numberOfLines={1}>
              {site?.name ?? 'Clinical site'}
            </Text>
            {site?.unit ? <Text style={styles.subtitle}>{site.unit}</Text> : null}
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
            <Ionicons name="close" size={20} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>How did it go?</Text>
          <View style={styles.ratingRow}>
            {RATINGS.map((r) => (
              <Pressable
                key={r.key}
                style={[styles.ratingChip, rating === r.key && styles.ratingChipActive]}
                onPress={() => setRating(r.key)}
              >
                <Text style={[styles.ratingText, rating === r.key && styles.ratingTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>
            Competencies practiced {selected.size > 0 ? `· ${selected.size}` : ''}
          </Text>
          {isLoading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={IOS_COLORS.secondaryLabel} />
          ) : (
            grouped.map(([category, items]) => (
              <View key={category} style={styles.group}>
                <Text style={styles.groupHead}>{category}</Text>
                {items.map((c) => {
                  const on = selected.has(c.id);
                  return (
                    <Pressable key={c.id} style={styles.compRow} onPress={() => toggle(c.id)}>
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
                      </View>
                      <Text style={styles.compText} numberOfLines={2}>
                        {c.title ?? `Competency ${c.competency_number ?? ''}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}

          <Text style={styles.sectionLabel}>Reflection (optional)</Text>
          <TextInput
            style={styles.note}
            placeholder="What did you take away? No patient, room, or unit detail."
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            value={reflection}
            onChangeText={setReflection}
            multiline
          />
          {reflectionError ? (
            <View style={styles.lintRow}>
              <Ionicons name="warning" size={12} color="#D97706" />
              <Text style={styles.lintText}>{reflectionError}</Text>
            </View>
          ) : null}

          <View style={styles.privacyRow}>
            <Ionicons name="lock-closed" size={11} color={IOS_COLORS.tertiaryLabel} />
            <Text style={styles.privacyText}>
              Logged at site level and shared with your cohort only — never a room, unit, or patient.
            </Text>
          </View>
        </ScrollView>

        <Pressable
          style={[styles.submit, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {logShift.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>
              {selected.size > 0 ? `Log ${selected.size} competenc${selected.size === 1 ? 'y' : 'ies'}` : 'Pick competencies to log'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: 8,
    maxHeight: '88%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(60,60,67,0.3)',
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: IOS_COLORS.secondaryLabel },
  title: { fontSize: 20, fontWeight: '700', color: IOS_COLORS.label, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: IOS_COLORS.secondaryLabel, marginTop: 1 },
  close: { padding: 4 },
  body: { marginTop: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: IOS_SPACING.md,
    marginBottom: 8,
  },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ratingChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  ratingChipActive: { backgroundColor: '#0B1220', borderColor: '#0B1220' },
  ratingText: { fontSize: 13, color: IOS_COLORS.label, fontWeight: '500' },
  ratingTextActive: { color: '#FFFFFF', fontWeight: '600' },
  group: { marginBottom: 6 },
  groupHead: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginTop: 8,
    marginBottom: 4,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  compText: { flex: 1, fontSize: 14, color: IOS_COLORS.label },
  note: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    minHeight: 72,
    fontSize: 14,
    color: IOS_COLORS.label,
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  lintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  lintText: { flex: 1, fontSize: 12, color: '#D97706' },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: IOS_SPACING.md },
  privacyText: { flex: 1, fontSize: 11, color: IOS_COLORS.tertiaryLabel, lineHeight: 15 },
  submit: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: IOS_SPACING.md,
  },
  submitDisabled: { backgroundColor: 'rgba(0,122,255,0.4)' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default LogShiftSheet;
