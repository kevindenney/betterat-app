import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export interface GuestUpgradeCardProps {
  visible: boolean;
  onCreateAccount: () => void;
  onContinueDemo: () => void;
}

export function GuestUpgradeCard({
  visible,
  onCreateAccount,
  onContinueDemo,
}: GuestUpgradeCardProps) {
  const { width } = useWindowDimensions();

  if (!visible) return null;

  const cardWidth = Math.min(360, width - 32);

  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
      <View style={[styles.card, { width: cardWidth }]}>
        <Text style={styles.title}>Save your progress</Text>
        <Text style={styles.subtitle}>
          Create an account to keep your tour progress and unlock AI race strategy.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={onCreateAccount} activeOpacity={0.82}>
          <Text style={styles.primaryButtonText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onContinueDemo} activeOpacity={0.72}>
          <Text style={styles.secondaryButtonText}>Continue Demo</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.66)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default GuestUpgradeCard;
