/**
 * <MenuRow> — secondary action row inside <UniversalPlusSheet>.
 *
 * Phase 2 · iOS register. Used four times in the sheet for the secondary
 * paths (blueprint, follow, concept-drop, share). Each row is a 32-px tinted
 * icon tile + title/subtitle stack + chevron-right.
 *
 * Canonical: docs/redesign/ios-register/step-loop-integration-canonical.html §1
 * Spec:      docs/redesign/ios-register/phase-2-universal-plus-sheet.md (§ MenuRow)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChevronRight,
  Lightbulb,
  Link2,
  type LucideIcon,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react-native';
import {
  GRAY_5,
  IOS_BLUE,
  IOS_BLUE_TINT,
  IOS_GREEN,
  IOS_GREEN_TINT,
  IOS_PURPLE,
  IOS_PURPLE_TINT,
  LABEL,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

export type MenuRowIcon = 'template' | 'users' | 'bulb' | 'share-3' | 'link';
export type MenuRowTint = 'blue' | 'gray' | 'purple' | 'green';

export interface MenuRowProps {
  icon: MenuRowIcon;
  tint: MenuRowTint;
  title: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
}

const ICON_MAP: Record<MenuRowIcon, LucideIcon> = {
  template: Sparkles,
  users: Users,
  bulb: Lightbulb,
  'share-3': Share2,
  link: Link2,
};

const GRAY_TINT_BG = 'rgba(120, 120, 128, 0.12)' as const;
const GRAY_TINT_FG = '#3C3C43' as const;

const TINT_FG: Record<MenuRowTint, string> = {
  blue: IOS_BLUE,
  gray: GRAY_TINT_FG,
  purple: IOS_PURPLE,
  green: IOS_GREEN,
};

const TINT_BG: Record<MenuRowTint, string> = {
  blue: IOS_BLUE_TINT,
  gray: GRAY_TINT_BG,
  purple: IOS_PURPLE_TINT,
  green: IOS_GREEN_TINT,
};

export function MenuRow({ icon, tint, title, subtitle, onPress, testID }: MenuRowProps) {
  const Icon = ICON_MAP[icon];
  const fg = TINT_FG[tint];
  const bg = TINT_BG[tint];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      testID={testID}
    >
      <View style={[styles.iconTile, { backgroundColor: bg }]}>
        <Icon size={16} color={fg} strokeWidth={2.25} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={16} color={LABEL_3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
  },
  rowPressed: {
    opacity: 0.6,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: LABEL,
    letterSpacing: -0.15,
  },
  subtitle: {
    fontSize: 11.5,
    color: LABEL_3,
    letterSpacing: -0.05,
  },
});
