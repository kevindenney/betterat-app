/**
 * TourPricingCard — Full-screen pricing modal for the tour's final step.
 *
 * Shows 3 tier cards (Free / Individual / Team) with key features,
 * a trial CTA, and a secondary "Continue with Free" button.
 *
 * Reusable outside the tour (e.g., from Settings > "Plans & Pricing").
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SAILOR_TIERS, type SailorTier } from '@/lib/subscriptions/sailorTiers';

const TIER_ORDER: SailorTier[] = ['free', 'plus', 'pro'];

const TIER_COLORS: Partial<Record<SailorTier, string>> = {
  free: '#64748B',
  plus: '#007AFF',
  pro: '#7C3AED',
};

const TIER_DISPLAY_FEATURES: Partial<Record<SailorTier, string[]>> = {
  free: [
    'Up to 3 learning interests',
    'Basic timeline management',
    '5 AI queries/month',
  ],
  plus: [
    'Unlimited interests & steps',
    '50,000 AI tokens/month',
    'AI insights & suggestions',
    'Telegram assistant',
  ],
  pro: [
    'Everything in Plus',
    '500,000 AI tokens/month',
    'Priority AI processing',
  ],
};

export interface TourPricingCardProps {
  visible: boolean;
  /** Called when user taps "Start 14-day free trial" */
  onStartTrial: () => void;
  /** Called when user taps "Continue with Free" */
  onContinueFree: () => void;
  /** If true, hide the backdrop (for standalone use outside the tour) */
  standalone?: boolean;
  /**
   * When provided, renders a dismiss (X) button so the sheet can be closed
   * without choosing a plan — used when opened from Settings, where this is a
   * browse-only view, not a required onboarding gate.
   */
  onClose?: () => void;
}

export function TourPricingCard({
  visible,
  onStartTrial,
  onContinueFree,
  standalone = false,
  onClose,
}: TourPricingCardProps) {
  const { width, height } = useWindowDimensions();

  if (!visible) return null;

  const cardWidth = Math.min(400, width - 32);

  const content = (
    <View style={[styles.card, { width: cardWidth, maxHeight: height * 0.85 }]}>
      {onClose && (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color="#64748B" />
        </TouchableOpacity>
      )}
      <Text style={styles.title}>Choose your plan</Text>
      <Text style={styles.subtitle}>
        Start with a 14-day free trial of all features.
      </Text>

      <ScrollView
        style={styles.tiersScroll}
        contentContainerStyle={styles.tiersContainer}
        showsVerticalScrollIndicator={false}
      >
        {TIER_ORDER.map((tierId) => {
          const tier = SAILOR_TIERS[tierId];
          const color = TIER_COLORS[tierId] ?? '#64748B';
          const features = TIER_DISPLAY_FEATURES[tierId] ?? [];
          const isPopular = tier.isPopular;

          return (
            <View
              key={tierId}
              style={[
                styles.tierCard,
                isPopular && styles.tierCardPopular,
                isPopular && { borderColor: color },
              ]}
            >
              {isPopular && (
                <View style={[styles.popularBadge, { backgroundColor: color }]}>
                  <Text style={styles.popularBadgeText}>Most Popular</Text>
                </View>
              )}
              <Text style={[styles.tierName, { color }]}>{tier.name}</Text>
              <Text style={styles.tierPrice}>
                {tier.priceYearly ? `${tier.priceYearly}/yr` : 'Free'}
              </Text>
              {tier.priceMonthly && (
                <Text style={styles.tierPriceMonthly}>
                  {tier.priceMonthly}/mo
                </Text>
              )}
              <View style={styles.featureList}>
                {features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={color}
                      style={styles.featureIcon}
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={styles.trialButton}
        onPress={onStartTrial}
        activeOpacity={0.8}
      >
        <Text style={styles.trialButtonText}>Start 14-day free trial</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.freeButton}
        onPress={onContinueFree}
        activeOpacity={0.7}
      >
        <Text style={styles.freeButtonText}>Continue with Free plan</Text>
      </TouchableOpacity>

      <Text style={styles.trustLine}>
        Cancel anytime. No credit card required.
      </Text>
    </View>
  );

  if (standalone) {
    return content;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.backdrop}
    >
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  tiersScroll: {
    width: '100%',
    flexGrow: 0,
  },
  tiersContainer: {
    gap: 12,
    paddingBottom: 4,
  },
  tierCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    position: 'relative',
  },
  tierCardPopular: {
    borderWidth: 2,
    backgroundColor: '#F8FAFF',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  tierPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 1,
  },
  tierPriceMonthly: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 10,
  },
  featureList: {
    gap: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    marginRight: 6,
  },
  featureText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  trialButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  trialButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  freeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 4,
    width: '100%',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  freeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    padding: 4,
  },
  trustLine: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
