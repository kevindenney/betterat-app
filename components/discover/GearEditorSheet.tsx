/**
 * GearEditorSheet — add/edit a gear item with full fields, replacing the
 * single-line Alert.prompt flow. Vocab (kinds, spec fields, nouns) comes from
 * getGearLabels so the same form speaks sailing / golf / nursing / default.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { GearItem, GearLabels, GearStatus } from '@/services/GearService';

export interface GearEditorValues {
  name: string;
  kind: string;
  spec: Record<string, string>;
  status: GearStatus;
  isPrimary: boolean;
  notes: string | null;
}

interface GearEditorSheetProps {
  visible: boolean;
  labels: GearLabels;
  /** Existing item when editing; null when adding. */
  item?: GearItem | null;
  /** Parent gear when adding sub-gear (e.g. a sail on a boat). */
  parentName?: string | null;
  /** Suggest primary when this is the first item of its kind. */
  suggestPrimary?: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (values: GearEditorValues) => void;
}

const STATUS_OPTIONS: { value: GearStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'backup', label: 'Backup' },
  { value: 'loaned', label: 'Loaned' },
  { value: 'retired', label: 'Retired' },
];

function specToStrings(spec: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(spec ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') out[key] = String(value);
  }
  return out;
}

export function GearEditorSheet({
  visible,
  labels,
  item,
  parentName,
  suggestPrimary,
  saving,
  onClose,
  onSave,
}: GearEditorSheetProps) {
  const editing = Boolean(item);

  const [name, setName] = useState('');
  const [kind, setKind] = useState(labels.primaryKind);
  const [spec, setSpec] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<GearStatus>('active');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(item?.name ?? '');
    setKind(item?.kind ?? (parentName ? 'gear' : labels.primaryKind));
    setSpec(specToStrings(item?.spec));
    setStatus(item?.status ?? 'active');
    setIsPrimary(item ? item.is_primary : Boolean(suggestPrimary));
    setNotes(item?.notes ?? '');
  }, [visible, item, parentName, labels.primaryKind, suggestPrimary]);

  const canSave = name.trim().length > 0 && !saving;

  const title = useMemo(() => {
    if (editing) return `Edit ${labels.itemNoun}`;
    if (parentName) return `Add to ${parentName}`;
    return labels.addLabel;
  }, [editing, labels, parentName]);

  const handleSave = () => {
    if (!canSave) return;
    const cleanSpec: Record<string, string> = {};
    for (const [key, value] of Object.entries(spec)) {
      const trimmed = value.trim();
      if (trimmed) cleanSpec[key] = trimmed;
    }
    onSave({
      name: name.trim(),
      kind,
      spec: cleanSpec,
      status,
      isPrimary: status === 'retired' ? false : isPrimary,
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
              <Text style={styles.headerBtnText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{title}</Text>
            <Pressable
              onPress={handleSave}
              style={[styles.headerBtn, !canSave && styles.headerBtnDisabled]}
              disabled={!canSave}
              hitSlop={8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
              ) : (
                <Text
                  style={[
                    styles.headerBtnText,
                    styles.headerBtnPrimary,
                    !canSave && styles.headerBtnTextDisabled,
                  ]}
                >
                  {editing ? 'Save' : 'Add'}
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={labels.specFields[0]?.placeholder || 'Name'}
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              autoCapitalize="words"
              autoFocus
              returnKeyType="next"
            />

            <Text style={[styles.label, styles.sectionGap]}>Type</Text>
            <View style={styles.chipsRow}>
              {labels.kindOptions.map((option) => {
                const active = kind === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setKind(option.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {labels.specFields.map((field) => (
              <View key={field.key}>
                <Text style={[styles.label, styles.sectionGap]}>
                  {field.label} <Text style={styles.labelOptional}>optional</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={spec[field.key] ?? ''}
                  onChangeText={(value) => setSpec((prev) => ({ ...prev, [field.key]: value }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={IOS_REGISTER.labelTertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            ))}

            <Text style={[styles.label, styles.sectionGap]}>Status</Text>
            <View style={styles.chipsRow}>
              {STATUS_OPTIONS.map((option) => {
                const active = status === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setStatus(option.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.primaryRow, styles.sectionGap]}>
              <View style={styles.primaryRowBody}>
                <Text style={styles.primaryTitle}>Primary {labels.itemNoun}</Text>
                <Text style={styles.primaryHint}>Pre-selected on steps that use gear</Text>
              </View>
              <Switch
                value={isPrimary}
                onValueChange={setIsPrimary}
                disabled={status === 'retired'}
              />
            </View>

            <Text style={[styles.label, styles.sectionGap]}>
              Notes <Text style={styles.labelOptional}>optional</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Setup quirks, maintenance, who else uses it…"
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              multiline
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.16)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  headerBtn: {
    minWidth: 64,
    paddingVertical: 4,
  },
  headerBtnDisabled: {
    opacity: 0.5,
  },
  headerBtnText: {
    fontSize: 16,
    color: IOS_COLORS.systemBlue,
  },
  headerBtnPrimary: {
    fontWeight: '700',
    textAlign: 'right',
  },
  headerBtnTextDisabled: {
    color: IOS_REGISTER.labelTertiary,
  },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  labelOptional: {
    fontWeight: '400',
    textTransform: 'none',
    color: IOS_REGISTER.labelTertiary,
  },
  sectionGap: { marginTop: 20 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.16)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: IOS_REGISTER.label,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {},
    }),
  },
  inputMulti: {
    minHeight: 72,
    maxHeight: 140,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(120,120,128,0.12)',
  },
  chipActive: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.16)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryRowBody: { flex: 1 },
  primaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  primaryHint: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 1,
  },
});
