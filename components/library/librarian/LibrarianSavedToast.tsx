/**
 * <LibrarianSavedToast> — the beat that closes the capture loop.
 *
 * After a resource is filed, the librarian speaks once: a brief, corpus-
 * honest promise that what was just saved will resurface when it's
 * relevant. This is the payoff for the recall promise the ask-prompt
 * already makes — capture should feel answered, not silently logged.
 *
 * Register is locked (librarianTokens): purple, italic editorial serif,
 * book glyph. Never blue, never sparkles, never robot iconography.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { hapticSuccess } from '@/lib/haptics';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import {
  LIBRARIAN_PURPLE,
  LIBRARIAN_PURPLE_INK,
  LIBRARIAN_PURPLE_TINT_18,
  LIBRARIAN_SERIF,
} from './librarianTokens';

const VISIBLE_MS = 3600;

interface Props {
  /** Drives the appearance; flip true to fire the beat. */
  visible: boolean;
  /** The interest the resource was filed under, for the confirmation copy. */
  interestName?: string;
  /** Called when the toast finishes its dwell and should be unmounted. */
  onHide: () => void;
}

export function LibrarianSavedToast({ visible, interestName, onHide }: Props) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    hapticSuccess();
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const t = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onHide();
      });
    }, VISIBLE_MS);

    return () => clearTimeout(t);
  }, [visible, anim, onHide]);

  if (!visible) return null;

  const where = interestName ? ` to ${interestName}` : '';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { bottom: insets.bottom + FLOATING_TAB_BAR_HEIGHT + 16 },
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.glyph}>
          <Ionicons name="book" size={14} color={LIBRARIAN_PURPLE} />
        </View>
        <Text style={styles.text}>
          <Text style={styles.lead}>Librarian </Text>
          <Text style={styles.body}>
            Filed{where}. I&rsquo;ll surface this when something you&rsquo;re
            working on calls for it.
          </Text>
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LIBRARIAN_PURPLE_TINT_18,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  glyph: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(124,77,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  lead: {
    fontWeight: '800',
    color: LIBRARIAN_PURPLE_INK,
    letterSpacing: 0.2,
  },
  body: {
    color: IOS_COLORS.label,
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
  },
});
