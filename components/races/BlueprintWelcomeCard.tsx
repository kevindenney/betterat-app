/**
 * BlueprintWelcomeCard
 *
 * One-shot welcome card shown at the top of the Sail Racing timeline after a
 * sailor lands via the auto-subscribe flow (e.g. HKDW "Open my Worlds 2027
 * prep plan" CTA → BetterAt blueprint page → timeline).
 *
 * Visibility is gated on an AsyncStorage flag set by `app/blueprint/[slug].tsx`
 * after auto-subscribe completes. Dismissing or tapping the CTA clears the
 * flag so the card never reappears for that user.
 *
 * Frigade-style: embedded, dismissible, single concrete action under 30s
 * (add a boat with a sail number — also unblocks Worlds 2027 eligibility).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BLUEPRINT_WELCOME_KEY_PREFIX = 'betterat_blueprint_welcome:';
const DRAGON_WORLDS_SLUG = 'dragon-worlds-2027-peak-performance';

interface Props {
  /** Only render when the active interest is sail-racing. */
  enabled: boolean;
}

export function BlueprintWelcomeCard({ enabled }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  // Check the AsyncStorage flag on mount. We scope to the Dragon Worlds
  // blueprint for now since that's the only auto-subscribe origin in flight;
  // generalize later if more blueprints opt in.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    AsyncStorage.getItem(`${BLUEPRINT_WELCOME_KEY_PREFIX}${DRAGON_WORLDS_SLUG}`)
      .then((value) => {
        if (!cancelled && value) setVisible(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    try {
      await AsyncStorage.removeItem(`${BLUEPRINT_WELCOME_KEY_PREFIX}${DRAGON_WORLDS_SLUG}`);
    } catch {}
  }, []);

  const handleAddBoat = useCallback(async () => {
    await dismiss();
    router.push('/(tabs)/boat/add' as any);
  }, [dismiss, router]);

  if (!enabled || !visible) return null;

  return (
    <View style={styles.card}>
      <View style={styles.iconBubble}>
        <Ionicons name="sparkles" size={16} color="#4630EB" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Welcome to your Worlds 2027 plan</Text>
        <Text style={styles.subtitle}>
          Add your sail number to confirm eligibility.
        </Text>
        <Pressable
          onPress={handleAddBoat}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add your boat and sail number"
        >
          <Text style={styles.ctaText}>Add your boat</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
        </Pressable>
      </View>
      <Pressable
        onPress={dismiss}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss welcome card"
      >
        <Ionicons name="close" size={18} color="#9CA3AF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(70, 48, 235, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(70, 48, 235, 0.22)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(70, 48, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1B4D',
  },
  subtitle: {
    fontSize: 13,
    color: '#4B4870',
    lineHeight: 18,
    marginBottom: 6,
  },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4630EB',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default BlueprintWelcomeCard;
