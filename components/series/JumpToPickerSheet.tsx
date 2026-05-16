/**
 * JumpToPickerSheet — canonical Phase I Frame 4.
 *
 * Near-full-height bottom sheet that lists every step in the active Series
 * with a number, title, date, three phase dots, and a current-step highlight
 * in iOS-blue. Tapping a row navigates to that step and dismisses the sheet.
 *
 * Per docs/redesign/ios-register/series-feature-canonical.html Frame 4.
 *
 * v1 phase-dot heuristic: the existing step data does not carry per-phase
 * Plan/Do/Reflect status, only a coarse stepStatus / status. We render dots
 * as a deterministic projection of that coarse status:
 *   - completed   → three full dots
 *   - current     → one full (Plan), one half (Do), one empty (Reflect)
 *   - upcoming    → three empty dots
 * When per-phase status lands, swap the projection for the real data.
 */

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export type JumpToPickerItemKind = 'completed' | 'current' | 'upcoming';

export interface JumpToPickerItem {
  id: string;
  index: number;
  title: string;
  kind: JumpToPickerItemKind;
  dateLabel?: string;
  relativeLabel?: string;
}

export interface JumpToPickerSheetProps {
  visible: boolean;
  seriesLabel: string;
  seriesName: string;
  currentIndex: number;
  totalSteps: number;
  progress: number;
  items: JumpToPickerItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

const clamp01 = (n: number): number => {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
};

export function JumpToPickerSheet({
  visible,
  seriesLabel: _seriesLabel,
  seriesName,
  currentIndex,
  totalSteps,
  progress,
  items,
  onSelect,
  onClose,
}: JumpToPickerSheetProps) {
  const safeProgress = clamp01(progress);
  const subhead = totalSteps > 0
    ? `${seriesName} · ${totalSteps} steps`
    : seriesName;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={styles.sheet}
          >
            <View style={styles.grabber} />

            <View style={styles.head}>
              <Pressable
                onPress={onClose}
                style={styles.back}
                accessibilityRole="button"
                accessibilityLabel="Back"
                testID="jump-to-back"
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={20} color="#007AFF" />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>Jump to</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {subhead}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={styles.x}
                accessibilityRole="button"
                accessibilityLabel="Close"
                testID="jump-to-close"
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color="#8E8E93" />
              </Pressable>
            </View>

            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${safeProgress * 100}%` }]}
                  testID="jump-to-progress"
                />
              </View>
              <Text style={styles.count}>
                <Text style={styles.countCurrent}>{currentIndex}</Text>
                <Text style={styles.countOf}> / {totalSteps}</Text>
              </Text>
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {items.map((item) => (
                <JumpToPickerRow
                  key={item.id}
                  item={item}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                />
              ))}
            </ScrollView>

            <View style={styles.cancelBar}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                testID="jump-to-cancel"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

interface JumpToPickerRowProps {
  item: JumpToPickerItem;
  onPress: () => void;
}

function JumpToPickerRow({ item, onPress }: JumpToPickerRowProps) {
  const isDone = item.kind === 'completed';
  const isCurrent = item.kind === 'current';
  const meta = item.relativeLabel && item.dateLabel
    ? `${item.dateLabel} · ${item.relativeLabel}`
    : item.relativeLabel || item.dateLabel || '';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, isCurrent && styles.rowCurrent]}
      accessibilityRole="button"
      accessibilityLabel={`Step ${item.index}: ${item.title}`}
      testID={`jump-to-row-${item.id}`}
    >
      {isCurrent && <View style={styles.currentBar} />}
      <Text
        style={[styles.num, isDone && styles.numDone, isCurrent && styles.numCurrent]}
      >
        {item.index}
      </Text>
      <View style={styles.pbody}>
        <Text
          style={[styles.ptitle, isDone && styles.ptitleDone, isCurrent && styles.ptitleCurrent]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {meta ? (
          <Text style={styles.pmeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <View style={styles.phaseDots}>
        <PhaseDot kind={item.kind} slot="plan" />
        <PhaseDot kind={item.kind} slot="do" />
        <PhaseDot kind={item.kind} slot="reflect" />
      </View>
    </Pressable>
  );
}

interface PhaseDotProps {
  kind: JumpToPickerItemKind;
  slot: 'plan' | 'do' | 'reflect';
}

function PhaseDot({ kind, slot }: PhaseDotProps) {
  // v1 deterministic projection — see file header for the rationale.
  let style: any = styles.dotEmpty;
  if (kind === 'completed') style = styles.dotDone;
  else if (kind === 'current') {
    if (slot === 'plan') style = styles.dotFull;
    else if (slot === 'do') style = styles.dotHalf;
    else style = styles.dotEmpty;
  }
  return <View style={[styles.dotBase, style]} />;
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.36)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 0,
  },
  sheet: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
    maxHeight: '88%',
    minHeight: '50%',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginTop: 6,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 64,
  },
  backText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#007AFF',
    letterSpacing: -0.3,
    marginLeft: -2,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 11.5,
    color: '#8E8E93',
    marginTop: 2,
    letterSpacing: -0.05,
  },
  x: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E5E5EA',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 999,
  },
  count: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: -0.05,
    fontVariant: ['tabular-nums'],
  },
  countCurrent: {
    color: '#3C3C43',
  },
  countOf: {
    color: '#8E8E93',
    fontWeight: '500',
  },
  list: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  rowCurrent: {
    backgroundColor: '#E6F0FF',
  },
  currentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#007AFF',
  },
  num: {
    width: 24,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    fontVariant: ['tabular-nums'],
  },
  numDone: {
    color: '#C7C7CC',
  },
  numCurrent: {
    color: '#007AFF',
  },
  pbody: {
    flex: 1,
    minWidth: 0,
  },
  ptitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3C3C43',
    letterSpacing: -0.2,
  },
  ptitleDone: {
    color: '#8E8E93',
  },
  ptitleCurrent: {
    color: '#000',
    fontWeight: '600',
  },
  pmeta: {
    marginTop: 2,
    fontSize: 10.5,
    color: '#8E8E93',
    letterSpacing: -0.02,
  },
  phaseDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dotBase: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dotEmpty: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C7C7CC',
  },
  dotFull: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dotHalf: {
    backgroundColor: '#FFFFFF',
    borderColor: '#007AFF',
  },
  dotDone: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  cancelBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingTop: 10,
    paddingBottom: 22,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#007AFF',
    letterSpacing: -0.3,
    paddingVertical: 12,
  },
});
