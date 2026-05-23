/**
 * SelectActionBar — bottom-anchored bulk-edit toolbar (Frame 12).
 *
 * Renders absolutely above the right-rail zoom indicator. Five action
 * buttons (Move, Tag, Reschedule, Archive, Delete) plus a step counter
 * and Cancel. Move/Tag/Reschedule are placeholder buttons for now —
 * they fire `onUnsupportedAction(actionId)` so the caller can show a
 * "coming soon" toast. Archive and Delete are real and fire their own
 * callbacks.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface SelectActionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onArchive: () => void;
  onDelete: () => void;
  /** When provided, the "Move" button opens the move-to-season sheet
   * instead of routing through onUnsupportedAction. */
  onMove?: () => void;
  /** When provided, the "Tag" button opens TagBulkSheet. */
  onTag?: () => void;
  /** When provided, the "Schedule" button opens ScheduleBulkSheet. */
  onSchedule?: () => void;
  onUnsupportedAction: (actionId: 'move' | 'tag' | 'reschedule') => void;
}

interface ActionSpec {
  id: 'move' | 'tag' | 'reschedule' | 'archive' | 'delete';
  label: string;
  icon: keyof typeof import('@expo/vector-icons/Ionicons').glyphMap;
  destructive?: boolean;
}

const ACTIONS: ActionSpec[] = [
  { id: 'move', label: 'Move', icon: 'arrow-forward-outline' },
  { id: 'tag', label: 'Tag', icon: 'pricetag-outline' },
  { id: 'reschedule', label: 'Schedule', icon: 'calendar-outline' },
  { id: 'archive', label: 'Archive', icon: 'archive-outline' },
  { id: 'delete', label: 'Delete', icon: 'trash-outline', destructive: true },
];

export function SelectActionBar({
  selectedCount,
  onCancel,
  onArchive,
  onDelete,
  onMove,
  onTag,
  onSchedule,
  onUnsupportedAction,
}: SelectActionBarProps) {
  const noneSelected = selectedCount === 0;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.counterRow}>
          <Text style={styles.counter}>
            {noneSelected
              ? 'Tap items to select'
              : `${selectedCount} selected`}
          </Text>
          <Pressable hitSlop={8} onPress={onCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
        <View style={styles.actionsRow}>
          {ACTIONS.map((a) => {
            const disabled = noneSelected;
            const onPress = () => {
              if (a.id === 'archive') onArchive();
              else if (a.id === 'delete') onDelete();
              else if (a.id === 'move' && onMove) onMove();
              else if (a.id === 'tag' && onTag) onTag();
              else if (a.id === 'reschedule' && onSchedule) onSchedule();
              else onUnsupportedAction(a.id);
            };
            return (
              <Pressable
                key={a.id}
                onPress={onPress}
                disabled={disabled}
                style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
                hitSlop={4}
              >
                <Ionicons
                  name={a.icon}
                  size={20}
                  color={
                    disabled
                      ? IOS_REGISTER.labelTertiary
                      : a.destructive
                        ? '#FF3B30'
                        : IOS_REGISTER.label
                  }
                />
                <Text
                  style={[
                    styles.actionLabel,
                    disabled && styles.actionLabelDisabled,
                    a.destructive && !disabled && styles.actionLabelDestructive,
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Sits above the app's bottom tab bar (~80px) with breathing room.
    // The previous 24px tucked the action row entirely behind the
    // Practice/Library/Atlas/Discover/Profile bar — counter row was
    // visible, actions weren't.
    bottom: 96,
    alignItems: 'center',
    zIndex: 100,
  },
  bar: {
    width: '94%',
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  counter: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  cancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 10,
  },
  actionBtnDisabled: {
    opacity: 0.55,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  actionLabelDisabled: {
    color: IOS_REGISTER.labelTertiary,
  },
  actionLabelDestructive: {
    color: '#FF3B30',
  },
});
