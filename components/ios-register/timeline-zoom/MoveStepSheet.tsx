/**
 * MoveStepSheet — explicit "move this step" position picker.
 *
 * L1 (single-step zoom) has no list to drag, so reordering there can't reuse
 * the L3 drag handle. This sheet is the non-spatial equivalent: it lists the
 * interest's working sequence (the same sort_order spine the L3 drag persists
 * to), highlights the step being moved, and lets the user tap any other step
 * to drop the moved one immediately after it — plus a leading "Move to the
 * top" row. Selecting a target emits a move intent; the caller resequences
 * sort_order and persists.
 *
 * Scope note: the picker spans the interest sequence, not a date-"arc",
 * because most steps are undated (sequence-to-anchor) and so don't belong to
 * a date window — arc-scoping would exclude exactly the steps users reorder.
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

export interface MoveStepItem {
  id: string;
  title: string;
  /** done/settled render a DONE pill; everything else is part of the queue. */
  isDone?: boolean;
  isRace?: boolean;
}

export type MoveTarget = { afterStepId: string } | { toTop: true };

interface Props {
  visible: boolean;
  /** Interest sequence in sort_order, including the step being moved. */
  steps: MoveStepItem[];
  movingStepId: string;
  onMove: (target: MoveTarget) => void;
  onClose: () => void;
  busy?: boolean;
}

const ROW_HEIGHT_ESTIMATE = 52;

export function MoveStepSheet({
  visible,
  steps,
  movingStepId,
  onMove,
  onClose,
  busy = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = React.useRef<ScrollView>(null);

  const movingIndex = steps.findIndex((s) => s.id === movingStepId);
  const movingTitle =
    movingIndex >= 0 ? steps[movingIndex].title : 'this step';

  React.useEffect(() => {
    if (!visible || movingIndex <= 0) return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, movingIndex * ROW_HEIGHT_ESTIMATE - 80),
        animated: false,
      });
    }, 60);
    return () => clearTimeout(id);
  }, [visible, movingIndex]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={busy ? undefined : onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 6) }]}>
        <View style={styles.handleBar} />
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Move step</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              Drop “{movingTitle}” after a step
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            disabled={busy}
            accessibilityLabel="Close"
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={18} color={IOS_REGISTER.labelSecondary} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.group}>
            {/* Leading "move to top" target — hidden when already first. */}
            {movingIndex !== 0 ? (
              <Pressable
                onPress={() => !busy && onMove({ toTop: true })}
                disabled={busy}
                style={({ pressed }) => [
                  styles.row,
                  styles.topRow,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Move to the top"
              >
                <Ionicons
                  name="arrow-up-circle-outline"
                  size={20}
                  color={IOS_REGISTER.accentUserAction}
                />
                <Text style={styles.topRowText}>Move to the top</Text>
              </Pressable>
            ) : null}

            {steps.map((item, idx) => {
              const isMoving = item.id === movingStepId;
              const ordinal = idx + 1;
              if (isMoving) {
                return (
                  <View
                    key={item.id}
                    style={[styles.row, styles.movingRow, idx > 0 && styles.rowDivider]}
                  >
                    <Text style={[styles.ord, styles.ordMoving]}>{ordinal}</Text>
                    <Text style={[styles.rowTitle, styles.movingTitle]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.movingPill}>
                      <Text style={styles.movingPillText}>MOVING</Text>
                    </View>
                  </View>
                );
              }
              return (
                <Pressable
                  key={item.id}
                  onPress={() => !busy && onMove({ afterStepId: item.id })}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.row,
                    idx > 0 && styles.rowDivider,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Move after ${item.title}`}
                >
                  <Text style={styles.ord}>{ordinal}</Text>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.isRace ? (
                    <View style={[styles.pill, styles.pillRace]}>
                      <Text style={[styles.pillText, styles.pillRaceText]}>RACE</Text>
                    </View>
                  ) : item.isDone ? (
                    <View style={[styles.pill, styles.pillDone]}>
                      <Text style={[styles.pillText, styles.pillDoneText]}>DONE</Text>
                    </View>
                  ) : null}
                  <Ionicons
                    name="arrow-down-outline"
                    size={15}
                    color={IOS_REGISTER.labelTertiary}
                  />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {busy ? (
          <View style={styles.busyOverlay} pointerEvents="auto">
            <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: IOS_REGISTER.groundBg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '82%',
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
    paddingBottom: 14,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  group: {
    borderRadius: 14,
    backgroundColor: IOS_REGISTER.cardBg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  rowPressed: {
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  topRow: {
    gap: 10,
  },
  topRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
  movingRow: {
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  ord: {
    width: 22,
    fontSize: 13,
    fontWeight: '700',
    color: IOS_REGISTER.labelTertiary,
    textAlign: 'center',
  },
  ordMoving: {
    color: IOS_REGISTER.accentUserAction,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  movingTitle: {
    fontWeight: '700',
    color: IOS_REGISTER.accentUserAction,
  },
  movingPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: 'rgba(0,122,255,0.16)',
  },
  movingPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: IOS_REGISTER.accentUserAction,
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pillDone: {
    backgroundColor: 'rgba(52,199,89,0.14)',
  },
  pillDoneText: {
    color: '#248A3D',
  },
  pillRace: {
    backgroundColor: 'rgba(194,65,12,0.12)',
  },
  pillRaceText: {
    color: '#C2410C',
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  pressed: {
    opacity: 0.55,
  },
});

export default MoveStepSheet;
