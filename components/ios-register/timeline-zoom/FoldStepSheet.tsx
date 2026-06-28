/**
 * FoldStepSheet — pick a canonical target to fold this step into.
 *
 * "Fold" moves a source step's work (notes, captures, reflections,
 * measurements, child rows) onto a target step that owns the identity/timing/
 * course/Atlas context — e.g. folding "Tune the rig before Saturday" into
 * "Race 3: Summer Saturday Series". The source becomes a reversible folded
 * reference rather than a duplicate sitting next to the anchor it belongs to.
 *
 * The list is ranked so the most plausible anchors float up: races first,
 * then same-day, then nearby-in-time. The picker only chooses the target —
 * the caller confirms the (computed) move before committing.
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

export interface FoldTargetItem {
  id: string;
  title: string;
  isRace?: boolean;
  isDone?: boolean;
  /** Short reason this target ranked where it did, e.g. "SAME DAY". */
  contextTag?: string;
  /** When known, the target's date, already formatted for display. */
  whenLabel?: string;
}

interface Props {
  visible: boolean;
  sourceTitle: string;
  targets: FoldTargetItem[];
  onSelect: (targetId: string) => void;
  onClose: () => void;
  busy?: boolean;
}

export function FoldStepSheet({
  visible,
  sourceTitle,
  targets,
  onSelect,
  onClose,
  busy = false,
}: Props) {
  const insets = useSafeAreaInsets();

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
            <Text style={styles.title}>Fold into another step</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Move “{sourceTitle}” onto the step it belongs to
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
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {targets.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No other steps in this interest to fold into yet.
              </Text>
            </View>
          ) : (
            <View style={styles.group}>
              {targets.map((item, idx) => (
                <Pressable
                  key={item.id}
                  onPress={() => !busy && onSelect(item.id)}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.row,
                    idx > 0 && styles.rowDivider,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Fold into ${item.title}`}
                >
                  <Ionicons
                    name={item.isRace ? 'flag' : 'git-merge-outline'}
                    size={18}
                    color={
                      item.isRace
                        ? '#C2410C'
                        : IOS_REGISTER.labelTertiary
                    }
                  />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.whenLabel ? (
                      <Text style={styles.rowWhen} numberOfLines={1}>
                        {item.whenLabel}
                      </Text>
                    ) : null}
                  </View>
                  {item.isRace ? (
                    <View style={[styles.pill, styles.pillRace]}>
                      <Text style={[styles.pillText, styles.pillRaceText]}>RACE</Text>
                    </View>
                  ) : item.contextTag ? (
                    <View style={[styles.pill, styles.pillContext]}>
                      <Text style={[styles.pillText, styles.pillContextText]}>
                        {item.contextTag}
                      </Text>
                    </View>
                  ) : item.isDone ? (
                    <View style={[styles.pill, styles.pillDone]}>
                      <Text style={[styles.pillText, styles.pillDoneText]}>DONE</Text>
                    </View>
                  ) : null}
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color={IOS_REGISTER.labelTertiary}
                  />
                </Pressable>
              ))}
            </View>
          )}
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
    alignItems: 'flex-start',
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
    marginTop: 2,
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
  rowCopy: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontSize: 15,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  rowWhen: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
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
  pillContext: {
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  pillContextText: {
    color: IOS_REGISTER.accentUserAction,
  },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
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

export default FoldStepSheet;
