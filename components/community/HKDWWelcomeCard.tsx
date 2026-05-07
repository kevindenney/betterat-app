/**
 * HKDWWelcomeCard
 *
 * Pinned at the top of the post list on /community/2027-hk-dragon-worlds.
 * The community page is the most common landing surface for sailors
 * arriving via the HKDW Firebase auth bridge, and on its own it's a
 * dead end — there's no signpost to the rest of BetterAt. This card
 * gives them three contextual entry points:
 *
 *   1. Their Worlds 2027 prep plan blueprint (auto-subscribes on tap)
 *   2. Their races timeline
 *   3. Their profile
 *
 * Dismissible per device via localStorage; once dismissed it never
 * shows again on that device.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  IOS_COLORS,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_TYPOGRAPHY,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';

const STORAGE_KEY = 'hkdw_welcome_dismissed';
const PREP_PLAN_SLUG = 'dragon-worlds-2027-peak-performance';

interface CardItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  href: string;
}

const ITEMS: CardItem[] = [
  {
    icon: 'compass-outline',
    title: 'Your Worlds 2027 prep plan',
    subtitle: 'Coach-built timeline, 8 steps',
    href: `/blueprint/${PREP_PLAN_SLUG}?auto_subscribe=1`,
  },
  {
    icon: 'flag-outline',
    title: 'Track your races',
    subtitle: 'Plan, debrief, and learn from every race',
    href: '/races',
  },
  {
    icon: 'person-outline',
    title: 'Set up your profile',
    subtitle: 'Boat, sail number, club',
    href: '/account',
  },
];

function readDismissed(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismissed() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}

interface HKDWWelcomeCardProps {
  /** Whether the surrounding page wants this card shown at all. */
  visible: boolean;
}

export function HKDWWelcomeCard({ visible }: HKDWWelcomeCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());

  // Re-check on mount in case storage was written by another tab/session.
  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const onDismiss = useCallback(() => {
    triggerHaptic('selection');
    persistDismissed();
    setDismissed(true);
  }, []);

  const onSelect = useCallback(
    (href: string) => {
      triggerHaptic('impactLight');
      router.push(href as any);
    },
    [router]
  );

  if (!visible || dismissed) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>WELCOME FROM DRAGON WORLDS</Text>
            <Text style={styles.title}>You&apos;re in. Now meet BetterAt.</Text>
          </View>
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss welcome"
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        </View>

        {ITEMS.map((item, idx) => (
          <Pressable
            key={item.href}
            onPress={() => onSelect(item.href)}
            style={({ pressed }) => [
              styles.row,
              idx > 0 && styles.rowBorder,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.iconBubble}>
              <Ionicons name={item.icon} size={20} color={IOS_COLORS.systemBlue} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={IOS_COLORS.tertiaryLabel} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  card: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
    gap: IOS_SPACING.md,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    gap: IOS_SPACING.md,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  rowPressed: {
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${IOS_COLORS.systemBlue}15`,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    fontWeight: '500',
  },
  rowSubtitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
});
