import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Sparkles, X } from 'lucide-react-native';

export interface WelcomeToastProps {
  variant: 'subscription' | 'follow' | 'shared' | 'native-resume';
  subscriptionSource?: string;
  count?: { steps: number; freeMonths: number; fleetSize: number };
  onDismiss?: () => void;
}

export function WelcomeToast({ variant, subscriptionSource, count, onDismiss }: WelcomeToastProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const isNativeResume = variant === 'native-resume';

  const title =
    variant === 'subscription'
      ? `You're subscribed to ${subscriptionSource ?? 'this blueprint'}`
      : variant === 'follow'
        ? `You're following ${subscriptionSource ?? 'this practitioner'}`
        : variant === 'native-resume'
          ? `You're back · ${subscriptionSource ?? 'your blueprint'} loaded`
          : `${subscriptionSource ?? 'Someone'} shared this with you`;

  const subline =
    variant === 'native-resume' && count
      ? `${count.steps} steps · ${count.freeMonths * 30} days free · synced from web`
      : variant === 'native-resume'
        ? 'Synced from web · same step, no re-sign-in'
        : variant === 'subscription' && count
          ? `${count.steps} steps · ${count.freeMonths * 30} days free · ${count.fleetSize} sailors with you`
          : variant === 'subscription'
            ? 'Your timeline now opens with their first step.'
            : variant === 'follow'
              ? 'Their public settled steps are in Discover.'
              : 'Tap to view their copy, then fork it into your timeline.';

  return (
    <View style={[styles.toast, isNativeResume && styles.toastNative]}>
      <View style={[styles.glyph, isNativeResume && styles.glyphGreen]}>
        {isNativeResume ? (
          <CheckCircle2 size={15} color="#FFFFFF" fill="#34C759" />
        ) : (
          <Sparkles size={14} color="#FFFFFF" />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, isNativeResume && styles.titleNative]}>{title}</Text>
        <Text style={[styles.sub, isNativeResume && styles.subNative]}>{subline}</Text>
      </View>
      <Pressable
        onPress={() => {
          setHidden(true);
          onDismiss?.();
        }}
        hitSlop={8}
        accessibilityLabel="Dismiss welcome"
        style={styles.x}
      >
        <X size={14} color="#7C7C82" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(88,86,214,0.10)',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D7D6F4',
  },
  toastNative: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 28,
  },
  glyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#5856D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphGreen: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#34C759',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.1,
    lineHeight: 14,
  },
  titleNative: {
    fontSize: 12,
  },
  sub: {
    fontSize: 10,
    color: '#3F3DAB',
    marginTop: 1,
    letterSpacing: -0.02,
  },
  subNative: {
    color: '#0A6B2A',
  },
  x: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
