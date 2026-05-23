/**
 * ScheduleBulkSheet — Frame 12 bulk Schedule action.
 *
 * Two modes:
 *   • Shift by ±N days — preserves each step's relative date offset
 *     (Mon stays Mon). Common for "push this week's plan to next week".
 *   • Set to specific date — collapses every selected step to the same
 *     starts_at. Useful for "all of these happen Saturday morning".
 *
 * The caller gets the resolved write per step via onApplyShift /
 * onApplyAbsolute so it can fire a single updateStep per id and keep
 * the cache invalidation in one place.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface ScheduleBulkSheetProps {
  visible: boolean;
  stepIds: string[];
  onApplyShift: (days: number) => void;
  onApplyAbsolute: (isoDate: string) => void;
  onDismiss: () => void;
}

type Mode = 'shift' | 'absolute';

export function ScheduleBulkSheet({
  visible,
  stepIds,
  onApplyShift,
  onApplyAbsolute,
  onDismiss,
}: ScheduleBulkSheetProps) {
  const [mode, setMode] = useState<Mode>('shift');
  const [days, setDays] = useState('7');
  const [date, setDate] = useState('');
  const countLabel = stepIds.length === 1 ? '1 step' : `${stepIds.length} steps`;

  const reset = () => {
    setMode('shift');
    setDays('7');
    setDate('');
  };
  const handleDismiss = () => {
    reset();
    onDismiss();
  };

  const shiftValue = useMemo(() => {
    const parsed = parseInt(days.trim(), 10);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [days]);
  const validShift = !Number.isNaN(shiftValue) && shiftValue !== 0;
  const validAbsolute = /^\d{4}-\d{2}-\d{2}$/.test(date);

  const apply = () => {
    if (mode === 'shift' && validShift) {
      onApplyShift(shiftValue);
      reset();
    } else if (mode === 'absolute' && validAbsolute) {
      onApplyAbsolute(date);
      reset();
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
              <Text style={styles.title}>Schedule {countLabel}</Text>
              <Pressable hitSlop={8} onPress={handleDismiss} style={styles.closeBtn}>
                <Text style={styles.closeText}>Cancel</Text>
              </Pressable>
            </View>

            <View style={styles.modeTabs}>
              <Pressable
                style={[styles.modeTab, mode === 'shift' && styles.modeTabOn]}
                onPress={() => setMode('shift')}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={14}
                  color={mode === 'shift' ? '#FFFFFF' : IOS_REGISTER.label}
                />
                <Text
                  style={[styles.modeTabText, mode === 'shift' && styles.modeTabTextOn]}
                >
                  Shift by days
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeTab, mode === 'absolute' && styles.modeTabOn]}
                onPress={() => setMode('absolute')}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={mode === 'absolute' ? '#FFFFFF' : IOS_REGISTER.label}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    mode === 'absolute' && styles.modeTabTextOn,
                  ]}
                >
                  Set date
                </Text>
              </Pressable>
            </View>

            <View style={styles.body}>
              {mode === 'shift' ? (
                <>
                  <Text style={styles.label}>
                    Shift every selected step's date by:
                  </Text>
                  <View style={styles.shiftRow}>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() =>
                        setDays(String((parseInt(days, 10) || 0) - 1))
                      }
                      hitSlop={6}
                    >
                      <Ionicons name="remove" size={20} color={IOS_REGISTER.label} />
                    </Pressable>
                    <TextInput
                      style={styles.daysInput}
                      value={days}
                      onChangeText={setDays}
                      keyboardType="number-pad"
                      selectTextOnFocus
                    />
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() =>
                        setDays(String((parseInt(days, 10) || 0) + 1))
                      }
                      hitSlop={6}
                    >
                      <Ionicons name="add" size={20} color={IOS_REGISTER.label} />
                    </Pressable>
                    <Text style={styles.daysSuffix}>days</Text>
                  </View>
                  <Text style={styles.helpText}>
                    Negative shifts pull earlier. Steps with no date are skipped.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Set every selected step to:</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={IOS_REGISTER.labelTertiary}
                    value={date}
                    onChangeText={setDate}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.helpText}>
                    Overwrites the existing date on every selected step.
                  </Text>
                </>
              )}

              <Pressable
                style={[
                  styles.applyButton,
                  ((mode === 'shift' && !validShift) ||
                    (mode === 'absolute' && !validAbsolute)) &&
                    styles.applyButtonDisabled,
                ]}
                disabled={
                  (mode === 'shift' && !validShift) ||
                  (mode === 'absolute' && !validAbsolute)
                }
                onPress={apply}
              >
                <Text style={styles.applyButtonText}>
                  {mode === 'shift'
                    ? `Shift ${countLabel} by ${shiftValue > 0 ? '+' : ''}${shiftValue || 0} day${shiftValue === 1 || shiftValue === -1 ? '' : 's'}`
                    : `Set ${countLabel} to ${date || '—'}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
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
  backdropTap: { flex: 1 },
  sheetWrap: { backgroundColor: 'transparent' },
  sheet: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
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
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: IOS_REGISTER.cardBg,
  },
  modeTabOn: {
    backgroundColor: '#1F1F1F',
    borderColor: '#1F1F1F',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.label,
  },
  modeTabTextOn: { color: '#FFFFFF' },
  body: { padding: 16, gap: 12 },
  label: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysInput: {
    flex: 1,
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 10,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    textAlign: 'center',
  },
  daysSuffix: {
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
  },
  dateInput: {
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: IOS_REGISTER.label,
  },
  helpText: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    lineHeight: 14,
  },
  applyButton: {
    marginTop: 4,
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyButtonDisabled: { opacity: 0.45 },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
