/**
 * Compact zoom scope control for the timeline canvas.
 *
 * Gestures are primary: users pinch in/out and swipe. This button is a
 * secondary escape hatch, so it stays small and out of the content path.
 * The persistent STEP/NEAR/ARC/ALL rail was too hard to read and lived
 * in the thumb/action area; now the always-visible state is just the
 * screen eyebrow, and this opens a temporary scope sheet.
 */

import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { ZOOM_LEVEL_LABELS, ZOOM_LEVEL_SCOPE_LABELS, type ZoomLevel } from './types';

interface ZoomRailIndicatorProps {
  level: ZoomLevel;
  onChange: (next: ZoomLevel) => void;
  onSnapToCurrent?: () => void;
  topOffset?: number;
}

const LEVELS: ZoomLevel[] = [1, 2, 3, 4];
const LEVEL_COPY: Record<ZoomLevel, { title: string; subtitle: string }> = {
  1: { title: ZOOM_LEVEL_SCOPE_LABELS[1], subtitle: 'Plan, do, review, discuss' },
  2: { title: ZOOM_LEVEL_SCOPE_LABELS[2], subtitle: 'Related steps around this one' },
  3: { title: ZOOM_LEVEL_SCOPE_LABELS[3], subtitle: 'Patterns across this season or project' },
  4: { title: ZOOM_LEVEL_SCOPE_LABELS[4], subtitle: 'Long view of your practice' },
};

export function ZoomRailIndicator({
  level,
  onChange,
  onSnapToCurrent,
  topOffset = 92,
}: ZoomRailIndicatorProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    const showDid = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideDid = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
      showDid.remove();
      hideDid.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: topOffset }]}>
      <Pressable
        style={styles.button}
        onPress={() => setSheetOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Current zoom: ${LEVEL_COPY[level].title}. Change zoom level.`}
      >
        <Ionicons name="scan-outline" size={15} color={IOS_REGISTER.label} />
        <Text style={styles.buttonText}>{ZOOM_LEVEL_LABELS[level]}</Text>
      </Pressable>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>View scope</Text>
            <Text style={styles.sheetSub}>Pinch in or out, or choose a scope.</Text>

            {LEVELS.map((lvl) => {
              const active = lvl === level;
              const copy = LEVEL_COPY[lvl];
              return (
                <Pressable
                  key={lvl}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => {
                    setSheetOpen(false);
                    onChange(lvl);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.scopeBadge, active && styles.scopeBadgeActive]}>
                    <Text style={[styles.scopeBadgeText, active && styles.scopeBadgeTextActive]}>
                      {ZOOM_LEVEL_LABELS[lvl]}
                    </Text>
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{copy.title}</Text>
                    <Text style={styles.rowSub}>{copy.subtitle}</Text>
                  </View>
                  {active ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={IOS_REGISTER.accentUserAction}
                    />
                  ) : null}
                </Pressable>
              );
            })}

            {onSnapToCurrent ? (
              <Pressable
                style={styles.snapRow}
                onPress={() => {
                  setSheetOpen(false);
                  onSnapToCurrent();
                }}
              >
                <Ionicons name="locate" size={16} color={IOS_REGISTER.accentUserAction} />
                <Text style={styles.snapText}>Snap to current step</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  buttonText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.label,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 34,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separatorStrong,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.4,
  },
  sheetSub: {
    marginTop: 3,
    marginBottom: 12,
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowActive: {
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  scopeBadge: {
    minWidth: 54,
    paddingHorizontal: 8,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
  },
  scopeBadgeActive: {
    backgroundColor: '#1F1F1F',
  },
  scopeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
  },
  scopeBadgeTextActive: {
    color: '#FFFFFF',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  rowSub: {
    marginTop: 1,
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
  },
  snapRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  snapText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
});
