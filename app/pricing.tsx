/**
 * Pricing Page
 *
 * Updated: 2026-03-15
 * Pricing: Free / Individual $10/mo ($100/yr) / Pro $30/mo ($250/yr)
 * Design: Matches landing/catalog page aesthetic
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { SimpleLandingNav } from '@/components/landing/SimpleLandingNav';
import { ScrollFix } from '@/components/landing/ScrollFix';

type BillingPeriod = 'monthly' | 'yearly';

interface PlanTier {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
  accentColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

const PLANS: PlanTier[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Get started',
    features: [
      'Up to 3 learning interests',
      'Basic timeline management',
      '5 AI queries per month',
      'Document upload',
    ],
    cta: 'Start Free',
    accentColor: '#6B7280',
    iconName: 'rocket-outline',
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: 9,
    yearlyPrice: 89,
    description: 'AI-powered learning',
    features: [
      'Unlimited interests & steps',
      '50,000 AI tokens per month',
      'AI insights & suggestions',
      'Telegram assistant',
      'Progress analytics',
      'Offline mode',
    ],
    cta: 'Go Plus',
    highlighted: true,
    badge: 'MOST POPULAR',
    accentColor: '#007AFF',
    iconName: 'flash-outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 29,
    yearlyPrice: 249,
    description: 'Power user AI',
    features: [
      'Everything in Plus',
      '500,000 AI tokens per month',
      'Priority AI processing',
      'MCP integrations',
      'Priority support',
    ],
    cta: 'Go Pro',
    accentColor: '#7C3AED',
    iconName: 'rocket-outline',
  },
];

export default function PricingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isGuest, user: _user } = useAuth();
  const _params = useLocalSearchParams<{ upgrade?: string }>();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const isDesktop = width >= 768;

  const handleSelectPlan = (planId: string) => {
    if (planId === 'free') {
      if (isGuest) {
        router.push('/(auth)/signup');
      } else {
        router.back();
      }
    } else {
      if (isGuest) {
        router.push(`/(auth)/signup?plan=${planId}`);
      } else {
        router.push('/subscription');
      }
    }
  };

  const getDisplayPrice = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0) return '$0';
    return billingPeriod === 'monthly'
      ? `$${plan.monthlyPrice}`
      : `$${plan.yearlyPrice}`;
  };

  const getPeriodLabel = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0) return '';
    return billingPeriod === 'monthly' ? '/month' : '/year';
  };

  const getAltPrice = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0) return null;
    if (billingPeriod === 'monthly') {
      return `$${plan.yearlyPrice}/year`;
    }
    return `$${plan.monthlyPrice}/month`;
  };

  const getSavings = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0 || billingPeriod === 'monthly') return null;
    const monthlyCost = plan.monthlyPrice * 12;
    const saved = monthlyCost - plan.yearlyPrice;
    if (saved > 0) {
      return `Save $${saved}/year`;
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && <ScrollFix />}
      <SimpleLandingNav />
      {/* Dark header matching catalog page */}
      <View style={[styles.header, { paddingTop: insets.top + 80 }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
          <Text style={styles.headerSubtitle}>
            AI-powered tools to accelerate your learning. Choose the plan that fits your goals.
          </Text>

          {/* Billing toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                billingPeriod === 'monthly' && styles.toggleOptionActive,
              ]}
              onPress={() => setBillingPeriod('monthly')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  billingPeriod === 'monthly' && styles.toggleTextActive,
                ]}
              >
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                billingPeriod === 'yearly' && styles.toggleOptionActive,
              ]}
              onPress={() => setBillingPeriod('yearly')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  billingPeriod === 'yearly' && styles.toggleTextActive,
                ]}
              >
                Yearly
              </Text>
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>Save</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Plans grid */}
        <View style={[styles.section, isDesktop && styles.sectionDesktop]}>
          <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
            {PLANS.map((plan) => {
              const savings = getSavings(plan);
              return (
                <View
                  key={plan.id}
                  style={[
                    styles.card,
                    isDesktop && styles.cardDesktop,
                    plan.highlighted && styles.cardHighlighted,
                  ]}
                >
                  {/* Card header */}
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: plan.accentColor + '15' },
                      ]}
                    >
                      <Ionicons
                        name={plan.iconName}
                        size={24}
                        color={plan.accentColor}
                      />
                    </View>
                    {plan.badge && (
                      <View
                        style={[
                          styles.badgePill,
                          { backgroundColor: plan.accentColor + '15' },
                        ]}
                      >
                        <Text
                          style={[styles.badgeText, { color: plan.accentColor }]}
                        >
                          {plan.badge}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Plan name & description */}
                  <Text style={styles.cardName}>{plan.name}</Text>

                  {/* Price */}
                  <View style={styles.priceRow}>
                    <Text style={styles.priceAmount}>
                      {getDisplayPrice(plan)}
                    </Text>
                    {getPeriodLabel(plan) !== '' && (
                      <Text style={styles.pricePeriod}>
                        {getPeriodLabel(plan)}
                      </Text>
                    )}
                  </View>

                  {/* Alt price & savings */}
                  <View style={styles.altPriceRow}>
                    {getAltPrice(plan) && (
                      <Text style={styles.altPrice}>{getAltPrice(plan)}</Text>
                    )}
                    {savings && (
                      <View style={styles.savingsPill}>
                        <Text style={styles.savingsText}>{savings}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardDescription}>{plan.description}</Text>

                  {/* Divider */}
                  <View style={styles.divider} />

                  {/* Features */}
                  <View style={styles.featuresList}>
                    {plan.features.map((feature, index) => (
                      <View key={index} style={styles.featureRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={plan.accentColor}
                        />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  {/* CTA button */}
                  <TouchableOpacity
                    style={[
                      styles.ctaButton,
                      plan.highlighted
                        ? { backgroundColor: plan.accentColor }
                        : { borderColor: plan.accentColor + '40' },
                    ]}
                    onPress={() => handleSelectPlan(plan.id)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.ctaText,
                        plan.highlighted
                          ? styles.ctaTextHighlighted
                          : { color: plan.accentColor },
                      ]}
                    >
                      {plan.cta}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            All plans include a 14-day money-back guarantee. Cancel anytime.
          </Text>
          <Text style={styles.footerText}>
            Secure payment via Stripe.
          </Text>
        </View>

        {/* Institutional pricing cross-link */}
        <TouchableOpacity
          style={styles.institutionalBanner}
          onPress={() => router.push('/institutions/pricing' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="business-outline" size={20} color="#007AFF" />
          <Text style={styles.institutionalBannerText}>
            Looking for institutional or team plans?{' '}
            <Text style={styles.institutionalBannerLink}>
              View Institutional Pricing →
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header - dark, matching catalog/landing pages
  header: {
    backgroundColor: '#1A1A1A',
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  headerContent: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 24,
    maxWidth: 500,
    marginBottom: 24,
  },

  // Billing toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 3,
    alignSelf: 'flex-start',
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    gap: 6,
  },
  toggleOptionActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  toggleTextActive: {
    color: '#1A1A1A',
  },
  saveBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // padding handled by sections
  },

  section: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    padding: 24,
  },
  sectionDesktop: {
    padding: 40,
  },

  // Grid
  grid: {
    gap: 16,
  },
  gridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },

  // Card - matching InterestCatalogPage style
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        cursor: 'default',
        transition: 'box-shadow 0.2s, transform 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      } as any,
    }),
  },
  cardDesktop: {
    flex: 1,
    flexBasis: 300,
    maxWidth: 380,
  },
  cardHighlighted: {
    borderColor: '#007AFF',
    borderWidth: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(37,99,235,0.15)',
      } as any,
    }),
  },

  // Card header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Card content
  cardName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  priceAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 16,
    color: '#9CA3AF',
    marginLeft: 4,
    fontWeight: '500',
  },
  altPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    minHeight: 20,
  },
  altPrice: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  savingsPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },

  // Features
  featuresList: {
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },

  // CTA button
  ctaButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
  },
  ctaTextHighlighted: {
    color: '#FFFFFF',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 4,
  },
  footerText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // Institutional pricing cross-link
  institutionalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 40,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  institutionalBannerText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  institutionalBannerLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
