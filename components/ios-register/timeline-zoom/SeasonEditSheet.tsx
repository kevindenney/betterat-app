/**
 * SeasonEditSheet — single shared form for adding and editing arcs.
 *
 * Used by both the L3 picker (+ New arc / row edit) and the L4 BROWSE
 * ARCS section so the create/edit affordances feel identical wherever
 * the user reaches them.
 *
 * Date inputs are plain text (YYYY-MM-DD) for v1 — gets us shipped
 * without dragging in a per-platform DateTimePicker. Validation is
 * lightweight: required title + dates parse + end >= start.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import type { Season, SeasonStatus, CreateSeasonInput, UpdateSeasonInput } from '@/types/season';

type Mode = 'add' | 'edit';

interface Props {
  visible: boolean;
  /** Persona-native noun for the calendar block (arc / rotation /
   *  season / sketchbook / project) — keeps error + placeholder copy in
   *  the interest's voice rather than the sailing default. */
  periodNoun: string;
  mode: Mode;
  /** Existing season to populate the form in edit mode. */
  season?: Season | null;
  onClose: () => void;
  onCreate?: (input: CreateSeasonInput) => Promise<void> | void;
  onUpdate?: (seasonId: string, input: UpdateSeasonInput) => Promise<void> | void;
  onArchive?: (seasonId: string) => Promise<void> | void;
  onDelete?: (seasonId: string) => Promise<void> | void;
  /** Only empty arcs (no steps resolved to them) may be deleted outright. */
  canDelete?: boolean;
}

const STATUS_OPTIONS: { value: SeasonStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'draft', label: 'Draft' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusMonthsIso(months: number, base: string): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function looksLikeIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function SeasonEditSheet({
  visible,
  periodNoun,
  mode,
  season,
  onClose,
  onCreate,
  onUpdate,
  onArchive,
  onDelete,
  canDelete = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const initial = useMemo(() => {
    if (mode === 'edit' && season) {
      return {
        name: season.name,
        shortName: season.short_name ?? '',
        startDate: season.start_date.slice(0, 10),
        endDate: season.end_date.slice(0, 10),
        status: season.status,
        description: season.description ?? '',
      };
    }
    const today = todayIso();
    return {
      name: '',
      shortName: '',
      startDate: today,
      endDate: plusMonthsIso(6, today),
      status: 'active' as SeasonStatus,
      description: '',
    };
  }, [mode, season]);

  const [name, setName] = useState(initial.name);
  const [shortName, setShortName] = useState(initial.shortName);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [status, setStatus] = useState<SeasonStatus>(initial.status);
  const [description, setDescription] = useState(initial.description);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when the sheet opens with a different season or mode.
  useEffect(() => {
    if (!visible) return;
    setName(initial.name);
    setShortName(initial.shortName);
    setStartDate(initial.startDate);
    setEndDate(initial.endDate);
    setStatus(initial.status);
    setDescription(initial.description);
    setError(null);
    setSubmitting(false);
  }, [visible, initial]);

  const canSubmit =
    name.trim().length > 0 &&
    looksLikeIsoDate(startDate) &&
    looksLikeIsoDate(endDate) &&
    endDate >= startDate &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const startYear = parseInt(startDate.slice(0, 4), 10);
      const endYear = parseInt(endDate.slice(0, 4), 10);
      if (mode === 'add' && onCreate) {
        await onCreate({
          name: name.trim(),
          short_name: shortName.trim() || undefined,
          year: startYear,
          year_end: endYear !== startYear ? endYear : undefined,
          start_date: startDate,
          end_date: endDate,
          description: description.trim() || undefined,
        });
      } else if (mode === 'edit' && season && onUpdate) {
        await onUpdate(season.id, {
          name: name.trim(),
          short_name: shortName.trim() || undefined,
          start_date: startDate,
          end_date: endDate,
          status,
          description: description.trim() || undefined,
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn’t save the ${periodNoun}.`);
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!season || !onArchive) return;
    setError(null);
    setSubmitting(true);
    try {
      await onArchive(season.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn’t archive the ${periodNoun}.`);
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!season || !onDelete) return;
    showConfirm(
      `Delete ${periodNoun}`,
      `Delete “${season.name}”? It has no steps, so nothing else is removed. This can’t be undone.`,
      async () => {
        setError(null);
        setSubmitting(true);
        try {
          await onDelete(season.id);
          onClose();
        } catch (e) {
          setError(e instanceof Error ? e.message : `Couldn’t delete the ${periodNoun}.`);
          setSubmitting(false);
        }
      },
      { destructive: true },
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose} />
      {/* Android needs 'height', not 'padding': with edge-to-edge enabled
          (SDK 54 / targetSdk 35) adjustResize is ignored on Android 15+ and
          'padding' computes 0 inside this transparent Modal, so the keyboard
          overlays the form. 'height' resizes off keyboard events instead —
          same pattern as PlusComposerV3Sheet. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? 'height' : 'padding'}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom) }]}>
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'add' ? 'New arc' : 'Edit arc'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={IOS_REGISTER.labelSecondary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="Name">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Winter 2025-2026"
                placeholderTextColor={IOS_REGISTER.labelTertiary}
                style={styles.input}
                returnKeyType="next"
              />
            </Field>

            <Field label="Short name (optional)">
              <TextInput
                value={shortName}
                onChangeText={setShortName}
                placeholder="Winter '26"
                placeholderTextColor={IOS_REGISTER.labelTertiary}
                style={styles.input}
                returnKeyType="next"
              />
            </Field>

            <View style={styles.row2}>
              <View style={styles.cell}>
                <Field label="Start date">
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={IOS_REGISTER.labelTertiary}
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                  />
                </Field>
              </View>
              <View style={styles.cell}>
                <Field label="End date">
                  <TextInput
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={IOS_REGISTER.labelTertiary}
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                  />
                </Field>
              </View>
            </View>

            {mode === 'edit' ? (
              <Field label="Status">
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map((opt) => {
                    const active = opt.value === status;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setStatus(opt.value)}
                        style={[styles.statusChip, active && styles.statusChipActive]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            active && styles.statusChipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            ) : null}

            <Field label="Description (optional)">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={`What this ${periodNoun} is about`}
                placeholderTextColor={IOS_REGISTER.labelTertiary}
                style={[styles.input, styles.inputMultiline]}
                multiline
                numberOfLines={3}
              />
            </Field>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {mode === 'edit' && onArchive && season && season.status !== 'archived' ? (
              <Pressable
                onPress={handleArchive}
                disabled={submitting}
                style={[styles.archiveBtn, submitting && styles.disabled]}
              >
                <Ionicons name="archive-outline" size={16} color={IOS_REGISTER.labelSecondary} />
                <Text style={styles.archiveBtnText}>Archive arc</Text>
              </Pressable>
            ) : null}

            {mode === 'edit' && onDelete && canDelete && season ? (
              <Pressable
                onPress={handleDelete}
                disabled={submitting}
                style={[styles.archiveBtn, submitting && styles.disabled]}
              >
                <Ionicons name="trash-outline" size={16} color="#E5484D" />
                <Text style={styles.deleteBtnText}>Delete arc</Text>
              </Pressable>
            ) : null}
          </ScrollView>
          {/* Static style arrays here: the function-form Pressable style
              silently drops layout props (flex:1, backgroundColor), leaving
              both buttons text-sized and crammed bottom-left — see
              feedback_pressable_margin_row_stripping. */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[styles.primaryBtn, !canSubmit && styles.disabled]}
            >
              <Text style={styles.primaryBtnText}>
                {mode === 'add' ? 'Create' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '90%',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separator,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  body: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    fontSize: 15,
    color: IOS_REGISTER.label,
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  cell: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  statusChipActive: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  statusChipText: {
    fontSize: 12.5,
    color: IOS_REGISTER.label,
    fontWeight: '500',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorText: {
    color: '#C4474A',
    fontSize: 13,
    marginTop: 4,
  },
  archiveBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  archiveBtnText: {
    fontSize: 13.5,
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '500',
  },
  deleteBtnText: {
    fontSize: 13.5,
    color: '#E5484D',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_REGISTER.label,
  },
  primaryBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: IOS_REGISTER.accentUserAction,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.4,
  },
});
