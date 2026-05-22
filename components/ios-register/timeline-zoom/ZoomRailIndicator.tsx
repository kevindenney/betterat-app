/**
 * Right-rail stacked-pill zoom indicator.
 *
 * Always visible at the right edge above the taskbar. Active level is filled
 * iOS blue with its label (STEP / WEEK / SEASON / YEARS); inactive pills are
 * number-only on a white-fill base. Tap any pill to jump levels (Frame 11
 * "tap any card · zoom to that step" inverse). Long-press fans the stack open
 * into a labeled menu with a "Snap to current step" escape hatch (Frame 10).
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { ZOOM_LEVEL_LABELS, type ZoomLevel } from './types';

interface ZoomRailIndicatorProps {
  level: ZoomLevel;
  onChange: (next: ZoomLevel) => void;
  onSnapToCurrent?: () => void;
}

const LEVELS: ZoomLevel[] = [1, 2, 3, 4];

export function ZoomRailIndicator({
  level,
  onChange,
  onSnapToCurrent,
}: ZoomRailIndicatorProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View pointerEvents="box-none" style={styles.rail}>
      {menuOpen ? (
        <View style={styles.menu}>
          <Text style={styles.menuEyebrow}>ZOOM TO</Text>
          {LEVELS.map((lvl) => {
            const active = lvl === level;
            return (
              <Pressable
                key={lvl}
                style={styles.menuRow}
                onPress={() => {
                  setMenuOpen(false);
                  onChange(lvl);
                }}
              >
                <View style={[styles.menuChip, active && styles.menuChipActive]}>
                  <Text style={[styles.menuChipNum, active && styles.menuChipNumActive]}>
                    {lvl}
                  </Text>
                </View>
                <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                  {ZOOM_LEVEL_LABELS[lvl].charAt(0) +
                    ZOOM_LEVEL_LABELS[lvl].slice(1).toLowerCase()}
                </Text>
                {active ? (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={IOS_REGISTER.accentUserAction}
                    style={styles.menuCheck}
                  />
                ) : null}
              </Pressable>
            );
          })}
          {onSnapToCurrent ? (
            <Pressable
              style={[styles.menuRow, styles.menuRowFooter]}
              onPress={() => {
                setMenuOpen(false);
                onSnapToCurrent();
              }}
            >
              <Ionicons name="locate" size={16} color={IOS_REGISTER.accentUserAction} />
              <Text style={styles.menuFooterText}>Snap to current step</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.stack}>
        {LEVELS.map((lvl) => {
          const active = lvl === level;
          return (
            <Pressable
              key={lvl}
              onPress={() => onChange(lvl)}
              onLongPress={() => setMenuOpen(true)}
              delayLongPress={250}
              hitSlop={6}
              style={[
                styles.pill,
                active ? styles.pillActive : styles.pillInactive,
                active && lvl === 1 && styles.pillActiveLabeled,
                active && lvl === 2 && styles.pillActiveLabeled,
                active && lvl === 3 && styles.pillActiveLabeled,
                active && lvl === 4 && styles.pillActiveLabeled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Zoom to ${ZOOM_LEVEL_LABELS[lvl].toLowerCase()}`}
            >
              {active ? (
                <View style={styles.pillActiveContent}>
                  <Text style={styles.pillActiveLabelText}>{ZOOM_LEVEL_LABELS[lvl]}</Text>
                  <View style={styles.pillActiveNumberCircle}>
                    <Text style={styles.pillActiveNumberText}>{lvl}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.pillInactiveText}>{lvl}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const PILL_HEIGHT = 26;
const PILL_WIDTH = 26;
const ACTIVE_PILL_WIDTH = 78;

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    right: 8,
    bottom: 84, // sits above the taskbar
    alignItems: 'flex-end',
    gap: 4,
  },
  stack: {
    gap: 2,
    alignItems: 'flex-end',
  },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillInactive: {
    width: PILL_WIDTH,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pillInactiveText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  pillActive: {
    width: ACTIVE_PILL_WIDTH,
    backgroundColor: '#1F1F1F',
    paddingHorizontal: 4,
    paddingLeft: 12,
    flexDirection: 'row',
  },
  pillActiveLabeled: {},
  pillActiveContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  pillActiveLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pillActiveNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: IOS_REGISTER.accentUserAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActiveNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // Long-press menu
  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 0,
    marginBottom: 6,
    minWidth: 188,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  menuEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelTertiary,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  menuChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuChipActive: {
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  menuChipNum: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
  },
  menuChipNumActive: {
    color: '#FFFFFF',
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  menuLabelActive: {
    fontWeight: '600',
  },
  menuCheck: {
    marginLeft: 4,
  },
  menuRowFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
    marginTop: 4,
    paddingTop: 10,
  },
  menuFooterText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
});
