/**
 * VisionEditSheet — edit the arc's vision statement + optional
 * competency anchors. The picker is hidden when the user belongs to
 * no org with a competency framework, so individual sailors get a
 * clean text-only sheet while institutional users (JHU nursing) get
 * the richer anchoring step.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import {
  useUserOrgCompetencies,
  type OrgCompetencyOption,
} from '@/hooks/useUserOrgCompetencies';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialStatement: string | null | undefined;
  initialCompetencyIds: string[] | undefined;
  /** Scope the competency picker to the active interest's slug — so
   *  the sailor's VISION edit doesn't surface JHU Nursing
   *  competencies. Null/undefined falls back to all orgs the viewer
   *  belongs to. */
  interestSlug?: string | null;
  onSave: (statement: string, competencyIds: string[]) => Promise<void> | void;
}

export function VisionEditSheet({
  visible,
  onClose,
  initialStatement,
  initialCompetencyIds,
  interestSlug,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const { data: competencies = [], isLoading } = useUserOrgCompetencies(interestSlug);

  const [statement, setStatement] = useState(initialStatement ?? '');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialCompetencyIds ?? []),
  );
  const [saving, setSaving] = useState(false);

  // Re-seed local state when the sheet opens for a different arc.
  useEffect(() => {
    if (visible) {
      setStatement(initialStatement ?? '');
      setSelected(new Set(initialCompetencyIds ?? []));
    }
  }, [visible, initialStatement, initialCompetencyIds]);

  const grouped = useMemo(() => {
    const byOrg = new Map<string, { orgName: string; rows: OrgCompetencyOption[] }>();
    for (const c of competencies) {
      const entry = byOrg.get(c.orgId);
      if (entry) entry.rows.push(c);
      else byOrg.set(c.orgId, { orgName: c.orgName, rows: [c] });
    }
    return Array.from(byOrg.values()).sort((a, b) => a.orgName.localeCompare(b.orgName));
  }, [competencies]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(statement.trim(), Array.from(selected));
      onClose();
    } finally {
      setSaving(false);
    }
  }, [statement, selected, onSave, onClose, saving]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
          <View style={styles.headerBar}>
            <Pressable onPress={onClose} hitSlop={8} disabled={saving}>
              <Text style={[styles.headerBtn, saving && styles.headerBtnDisabled]}>
                Cancel
              </Text>
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Arc vision
            </Text>
            <Pressable onPress={handleSave} hitSlop={8} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={IOS_COLORS.systemBlue} size="small" />
              ) : (
                <Text style={styles.headerBtn}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.eyebrow}>WHAT DOES &ldquo;DONE&rdquo; LOOK LIKE?</Text>
            <TextInput
              style={styles.statement}
              value={statement}
              onChangeText={setStatement}
              placeholder="A podium at HHYC fall series · Land an ICU job at JHH by May · Ship the first 10 paying customers"
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              multiline
              textAlignVertical="top"
              autoFocus
            />

            {isLoading ? null : grouped.length > 0 ? (
              <>
                <Text style={[styles.eyebrow, styles.eyebrowSpace]}>
                  ANCHOR TO COMPETENCIES (OPTIONAL)
                </Text>
                <Text style={styles.help}>
                  Picking competencies turns the progress strip into per-competency
                  bars instead of an aggregate count. Skip if your vision isn&rsquo;t
                  about ticking boxes.
                </Text>
                {grouped.map((group) => (
                  <View key={group.orgName} style={styles.orgBlock}>
                    <Text style={styles.orgLabel} numberOfLines={1}>
                      {group.orgName}
                    </Text>
                    {group.rows.map((c) => {
                      const checked = selected.has(c.id);
                      return (
                        <Pressable
                          key={c.id}
                          style={styles.compRow}
                          onPress={() => toggle(c.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked }}
                        >
                          <Ionicons
                            name={checked ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={
                              checked ? IOS_COLORS.systemBlue : IOS_REGISTER.labelTertiary
                            }
                          />
                          <View style={styles.compRowBody}>
                            <Text style={styles.compFull} numberOfLines={2}>
                              {c.fullLabel}
                            </Text>
                            <Text style={styles.compMeta} numberOfLines={1}>
                              {c.category}
                              {c.shortLabel ? ` · ${c.shortLabel}` : ''}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: IOS_REGISTER.cardBg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
    gap: 10,
  },
  headerBtn: {
    fontSize: 15,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  headerBtnDisabled: { color: IOS_REGISTER.labelTertiary },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 14,
    paddingBottom: 36,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  eyebrowSpace: { marginTop: 18 },
  statement: {
    minHeight: 110,
    fontSize: 17,
    lineHeight: 24,
    color: IOS_REGISTER.label,
    fontStyle: 'italic',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  help: {
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 12,
  },
  orgBlock: { marginBottom: 14 },
  orgLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 6,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  compRowBody: { flex: 1, gap: 2 },
  compFull: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  compMeta: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelTertiary,
  },
});
