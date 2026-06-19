/**
 * CollapsibleModule — a single white "card module" for the L3 arc view.
 *
 * The arc used to stack seven undifferentiated analysis sections in one
 * column, which read as busy. Each section now lives in its own card that
 * rests collapsed (icon · label · one-line headline · chevron) and expands
 * on tap to reveal its chart/chips body. This gives the arc a calm resting
 * state — the reader opens only the lens they want.
 *
 * Charts inside the body need a pixel width. Because the body is inset by the
 * card's padding it is narrower than the full-bleed analysis block, so the
 * module measures its OWN body width and hands it to render-prop children:
 *   <CollapsibleModule …>{(w) => <SomeChart width={w} />}</CollapsibleModule>
 * Static children (text, chips) can be passed as normal nodes.
 */

import React, { ReactNode, useCallback, useState } from 'react';
import {
  LayoutAnimation,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

const AZURE = '#007AFF';
const LILAC = '#7C6BB0';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface CollapsibleModuleProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  /** Eyebrow line, e.g. "CAPABILITIES". */
  label: string;
  /** One-line summary, shown collapsed (truncated) and again atop the body. */
  headline?: ReactNode;
  defaultOpen?: boolean;
  /** No chevron, never collapses — used for the always-open Aim card. */
  alwaysOpen?: boolean;
  tint?: 'default' | 'lilac';
  /** Static nodes, or a render-prop given the measured body width (for charts). */
  children?: ReactNode | ((bodyWidth: number) => ReactNode);
}

export function CollapsibleModule({
  icon,
  iconColor,
  label,
  headline,
  defaultOpen = false,
  alwaysOpen = false,
  tint = 'default',
  children,
}: CollapsibleModuleProps) {
  const [open, setOpen] = useState(alwaysOpen || defaultOpen);
  const [bodyW, setBodyW] = useState(0);
  const expanded = alwaysOpen || open;
  const accent = iconColor ?? (tint === 'lilac' ? LILAC : AZURE);

  const toggle = useCallback(() => {
    if (alwaysOpen) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }, [alwaysOpen]);

  const onBodyLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = Math.max(0, Math.round(e.nativeEvent.layout.width));
      if (w !== bodyW) setBodyW(w);
    },
    [bodyW],
  );

  return (
    <View style={[styles.mod, tint === 'lilac' && styles.modLilac]}>
      <Pressable
        style={styles.bar}
        onPress={toggle}
        disabled={alwaysOpen}
        accessibilityRole={alwaysOpen ? undefined : 'button'}
        accessibilityState={alwaysOpen ? undefined : { expanded }}
        accessibilityLabel={`${label}${expanded ? ', expanded' : ', collapsed'}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${accent}1A` }]}>
          <Ionicons name={icon} size={13} color={accent} />
        </View>
        <View style={styles.barText}>
          <Text style={styles.label}>{label}</Text>
          {headline && !expanded ? (
            typeof headline === 'string' ? (
              <Text style={styles.headlineCollapsed} numberOfLines={1}>
                {headline}
              </Text>
            ) : (
              <View style={styles.headlineCollapsedWrap}>{headline}</View>
            )
          ) : null}
        </View>
        {alwaysOpen ? null : (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={IOS_REGISTER.labelTertiary}
          />
        )}
      </Pressable>

      {expanded ? (
        <View style={styles.body} onLayout={onBodyLayout}>
          <View style={styles.hair} />
          {typeof children === 'function' ? children(bodyW) : children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mod: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.16)',
    borderRadius: 16,
    marginTop: 11,
    marginHorizontal: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  modLilac: {
    backgroundColor: 'rgba(124,107,176,0.05)',
    borderColor: 'rgba(124,107,176,0.22)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barText: { flex: 1, minWidth: 0 },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
  },
  headlineCollapsed: {
    fontFamily: fontFamily.serif,
    fontSize: 13.5,
    lineHeight: 18,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  headlineCollapsedWrap: { marginTop: 2 },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  hair: {
    height: 0.5,
    backgroundColor: 'rgba(60,60,67,0.12)',
    marginBottom: 14,
  },
});
