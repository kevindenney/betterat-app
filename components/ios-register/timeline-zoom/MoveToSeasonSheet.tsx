/**
 * MoveToSeasonSheet — bottom sheet for Section E (Frames 15–16).
 *
 * Targets two entry points:
 *   • Frame 15 — bulk Move from the multi-select action bar.
 *   • Frame 16 — single step Move (called from a step's ••• menu in a
 *     follow-up; the sheet itself accepts an array of step ids either
 *     way).
 *
 * Lists every season the user owns. Tapping a row commits the move
 * immediately (no extra confirm — the action bar already gates intent).
 * "+ New season" expands an inline form (name, start, end dates) that
 * creates the season and immediately moves the steps into it.
 *
 * Persistence note: while timeline_steps has no `season_id` column yet
 * (the current/archived lane grouping is a UI construct), this commit
 * writes the chosen season's id into each step's `metadata.season_id`.
 * The L4 adapter reads that field to bucket bricks, so the user sees
 * the moved step jump lanes immediately. When the schema decision
 * lands, the column can be backfilled from metadata.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { Season } from '@/types/season';

export interface MoveTargetSeason {
  id: string;
  name: string;
  dateRange: string;
  isCurrent: boolean;
  archived: boolean;
}

interface MoveToSeasonSheetProps {
  visible: boolean;
  stepIds: string[];
  /** All seasons available as move targets, ordered current → archived. */
  seasons: MoveTargetSeason[];
  /** Called when the user picks an existing season. */
  onPickSeason: (seasonId: string) => void;
  /**
   * Called when the user fills the new-season form. Resolves to the
   * created season's id; the sheet then immediately invokes the move.
   * The caller owns the seasons table write.
   */
  onCreateSeason: (input: {
    name: string;
    start_date: string;
    end_date: string;
  }) => Promise<string>;
  onDismiss: () => void;
}

export function MoveToSeasonSheet({
  visible,
  stepIds,
  seasons,
  onPickSeason,
  onCreateSeason,
  onDismiss,
}: MoveToSeasonSheetProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const countLabel = stepIds.length === 1 ? '1 step' : `${stepIds.length} steps`;

  const canCreate = useMemo(
    () =>
      name.trim().length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(endDate),
    [name, startDate, endDate],
  );

  const reset = () => {
    setCreating(false);
    setName('');
    setStartDate('');
    setEndDate('');
    setBusy(false);
    setErrorText(null);
  };

  const handleDismiss = () => {
    reset();
    onDismiss();
  };

  const handlePick = (seasonId: string) => {
    onPickSeason(seasonId);
    reset();
  };

  const handleCreateAndMove = async () => {
    if (!canCreate) return;
    setBusy(true);
    setErrorText(null);
    try {
      const id = await onCreateSeason({
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
      });
      handlePick(id);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not create season');
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={handleDismiss} />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Move {countLabel}</Text>
              <Pressable hitSlop={8} onPress={handleDismiss} style={styles.closeBtn}>
                <Text style={styles.closeText}>Cancel</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                style={styles.createRow}
                onPress={() => setCreating((v) => !v)}
              >
                <View style={styles.createIconWrap}>
                  <Ionicons
                    name={creating ? 'remove' : 'add'}
                    size={20}
                    color={IOS_REGISTER.accentUserAction}
                  />
                </View>
                <Text style={styles.createLabel}>
                  {creating ? 'Cancel new season' : 'New season'}
                </Text>
              </Pressable>

              {creating ? (
                <View style={styles.createForm}>
                  <TextInput
                    style={styles.input}
                    placeholder="Season name (e.g. Fall '26 rotation)"
                    placeholderTextColor={IOS_REGISTER.labelTertiary}
                    value={name}
                    onChangeText={setName}
                    autoFocus
                  />
                  <View style={styles.dateRow}>
                    <TextInput
                      style={[styles.input, styles.dateInput]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={IOS_REGISTER.labelTertiary}
                      value={startDate}
                      onChangeText={setStartDate}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={styles.dateSep}>→</Text>
                    <TextInput
                      style={[styles.input, styles.dateInput]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={IOS_REGISTER.labelTertiary}
                      value={endDate}
                      onChangeText={setEndDate}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {errorText ? (
                    <Text style={styles.errorText}>{errorText}</Text>
                  ) : null}
                  <Pressable
                    style={[
                      styles.createButton,
                      (!canCreate || busy) && styles.createButtonDisabled,
                    ]}
                    disabled={!canCreate || busy}
                    onPress={handleCreateAndMove}
                  >
                    <Text style={styles.createButtonText}>
                      {busy ? 'Creating…' : `Create + move ${countLabel}`}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.divider} />

              {seasons.length === 0 ? (
                <Text style={styles.emptyText}>
                  No seasons yet. Use "New season" above to create your first one.
                </Text>
              ) : (
                seasons.map((s) => (
                  <Pressable
                    key={s.id}
                    style={styles.seasonRow}
                    onPress={() => handlePick(s.id)}
                  >
                    <View style={styles.seasonText}>
                      <Text style={styles.seasonName}>{s.name}</Text>
                      <Text style={styles.seasonDates}>
                        {s.dateRange || '—'}
                      </Text>
                    </View>
                    {s.isCurrent ? (
                      <View style={styles.currentPill}>
                        <Text style={styles.currentPillText}>CURRENT</Text>
                      </View>
                    ) : s.archived ? (
                      <Ionicons
                        name="archive-outline"
                        size={16}
                        color={IOS_REGISTER.labelSecondary}
                      />
                    ) : null}
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={IOS_REGISTER.labelTertiary}
                    />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Helper for the practice screen — projects Season records into MoveTargetSeason. */
export function buildMoveTargets(
  current: Season | null,
  all: Season[],
): MoveTargetSeason[] {
  const fmt = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '';
  const range = (s: Season) =>
    s.start_date && s.end_date ? `${fmt(s.start_date)} → ${fmt(s.end_date)}` : '';
  const out: MoveTargetSeason[] = [];
  const seen = new Set<string>();
  if (current) {
    out.push({
      id: current.id,
      name: current.name ?? current.short_name ?? 'Current rotation',
      dateRange: range(current),
      isCurrent: true,
      archived: false,
    });
    seen.add(current.id);
  }
  for (const s of all) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({
      id: s.id,
      name: s.name ?? s.short_name ?? 'Past rotation',
      dateRange: range(s),
      isCurrent: false,
      archived: s.status === 'archived',
    });
  }
  return out;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  backdropTap: { flex: 1 },
  sheetWrap: {
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '85%',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 0 : 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separatorStrong,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
  scroll: { maxHeight: 520 },
  scrollContent: { paddingVertical: 8 },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.accentUserAction,
  },
  createForm: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  input: {
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: IOS_REGISTER.label,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
  },
  dateSep: {
    fontSize: 15,
    color: IOS_REGISTER.labelTertiary,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
  },
  createButton: {
    marginTop: 4,
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_REGISTER.separator,
    marginVertical: 6,
  },
  emptyText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    textAlign: 'center',
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  seasonText: { flex: 1 },
  seasonName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  seasonDates: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  currentPill: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  currentPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
