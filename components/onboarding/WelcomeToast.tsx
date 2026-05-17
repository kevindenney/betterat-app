import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';

export interface WelcomeToastProps {
  variant: 'subscription' | 'follow' | 'shared';
  subscriptionSource?: string;
  count?: { steps: number; freeMonths: number; fleetSize: number };
  onDismiss?: () => void;
}

export function WelcomeToast({ variant, subscriptionSource, count, onDismiss }: WelcomeToastProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const title =
    variant === 'subscription'
      ? `You're in ${subscriptionSource ?? 'this blueprint'}`
      : variant === 'follow'
        ? `You're following ${subscriptionSource ?? 'this practitioner'}`
        : `${subscriptionSource ?? 'Someone'} shared this with you`;

  const subline =
    variant === 'subscription' && count
      ? `${count.steps} steps · ${count.freeMonths} months free · ${count.fleetSize}-boat fleet`
      : variant === 'subscription'
        ? 'Your timeline now opens with their first step.'
        : variant === 'follow'
          ? 'Their public settled steps are in Discover.'
          : 'Tap to view their copy, then fork it into your timeline.';

  return (
    <View style={styles.toast}>
      <View style={styles.glyph}>
        <Sparkles size={16} color="#6D28D9" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subline}</Text>
      </View>
      <Pressable
        onPress={() => {
          setHidden(true);
          onDismiss?.();
        }}
        hitSlop={8}
        accessibilityLabel="Dismiss welcome"
      >
        <X size={14} color="#6B7280" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDD6FE',
  },
  glyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDD6FE',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    color: '#5B21B6',
  },
  sub: {
    fontSize: 12,
    color: '#7C3AED',
  },
});
