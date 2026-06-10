/**
 * PickerListSheet — bottom modal sheet listing items. Used for both the
 * season picker and the step picker on L3.
 *
 * Generic over row type so each picker can render its own row UI.
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface Props<T> {
  visible: boolean;
  title: string;
  items: T[];
  keyExtractor: (item: T, index: number) => string;
  renderRow: (item: T, isSelected: boolean) => React.ReactNode;
  isSelected: (item: T) => boolean;
  onSelect: (item: T) => void;
  onClose: () => void;
  /** Auto-scroll to the selected row on open. Defaults true. */
  scrollToSelected?: boolean;
  /** When set, each row gets a trailing pencil affordance that fires this callback. */
  onRowEdit?: (item: T) => void;
  /** Inline "+" footer row (e.g. "+ New arc"). */
  footerAction?: { label: string; onPress: () => void };
}

const ROW_HEIGHT_ESTIMATE = 56;

export function PickerListSheet<T>({
  visible,
  title,
  items,
  keyExtractor,
  renderRow,
  isSelected,
  onSelect,
  onClose,
  scrollToSelected = true,
  onRowEdit,
  footerAction,
}: Props<T>) {
  const insets = useSafeAreaInsets();
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    if (!visible || !scrollToSelected) return;
    const idx = items.findIndex(isSelected);
    if (idx <= 0) return;
    // Defer until layout settles.
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, idx * ROW_HEIGHT_ESTIMATE - 60),
        animated: false,
      });
    }, 60);
    return () => clearTimeout(id);
  }, [visible, items, isSelected, scrollToSelected]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 6) }]}>
        <View style={styles.handleBar} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
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
            {items.map((item, idx) => {
              const selected = isSelected(item);
              return (
                <View
                  key={keyExtractor(item, idx)}
                  style={[styles.rowOuter, idx > 0 && styles.rowDivider]}
                >
                  <Pressable
                    onPress={() => onSelect(item)}
                    style={[styles.row, selected && styles.rowSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.rowBody}>{renderRow(item, selected)}</View>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={IOS_REGISTER.accentUserAction}
                      />
                    ) : (
                      <Ionicons
                        name="ellipse-outline"
                        size={22}
                        color={IOS_REGISTER.labelTertiary}
                      />
                    )}
                  </Pressable>
                  {onRowEdit ? (
                    <Pressable
                      onPress={() => onRowEdit(item)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Edit"
                      style={[
                        styles.rowEditBtn,
                        selected && styles.rowSelected,
                      ]}
                    >
                      <Ionicons
                        name="pencil"
                        size={15}
                        color={IOS_REGISTER.labelSecondary}
                      />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
          {footerAction ? (
            <Pressable
              onPress={footerAction.onPress}
              style={styles.footerRow}
              accessibilityRole="button"
              accessibilityLabel={footerAction.label}
            >
              <Ionicons
                name="add"
                size={20}
                color={IOS_REGISTER.accentUserAction}
              />
              <Text style={styles.footerRowText}>{footerAction.label}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
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
    maxHeight: '80%',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
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
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
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
  rowOuter: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowEditBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: IOS_REGISTER.separator,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: IOS_REGISTER.cardBg,
  },
  footerRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
  rowSelected: {
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  rowBody: {
    flex: 1,
  },
  pressed: {
    opacity: 0.55,
  },
});
