/**
 * Subscription Page
 *
 * Updated: 2026-03-30
 * Pricing: Free / Plus $9/mo ($89/yr) / Pro $29/mo ($249/yr)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Zap, Crown, Anchor } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { useTrialStatus } from '@/components/subscription/TrialWarningBanner';
import { IOSListSection } from '@/components/ui/ios/IOSListSection';
import { IOSListItem } from '@/components/ui/ios/IOSListItem';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';

// =============================================================================
// Plan data
// =============================================================================

interface Plan {
  id: string;
  name: string;
  annualPrice: number;
  monthlyEquivalent: string;
  description: string;
  icon: LucideIcon;
  color: string;
  popular?: boolean;
  features: string[];
  limitations?: string[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    annualPrice: 0,
    monthlyEquivalent: '$0',
    description: 'Get started',
    icon: Anchor,
    color: IOS_COLORS.systemGray,
    features: [
      'Up to 3 learning interests',
      'Basic timeline management',
      '5 AI queries per month',
    ],
    limitations: [
      'Unlimited AI insights',
      'Telegram assistant',
      'Advanced analytics',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    annualPrice: 89,
    monthlyEquivalent: '$9/mo',
    description: 'AI-powered learning',
    icon: Zap,
    color: IOS_COLORS.systemBlue,
    popular: true,
    features: [
      'Unlimited interests & steps',
      '50,000 AI tokens per month',
      'AI insights & suggestions',
      'Telegram assistant',
      'Progress analytics',
      'Offline mode',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    annualPrice: 249,
    monthlyEquivalent: '$29/mo',
    description: 'Power user AI',
    icon: Crown,
    color: IOS_COLORS.systemPurple,
    features: [
      'Everything in Plus',
      '500,000 AI tokens per month',
      'Priority AI processing',
      'MCP integrations',
      'Priority support',
    ],
  },
];

// =============================================================================
// Plan icon component (28x28 colored square matching IOSListItem leading icon)
// =============================================================================

function PlanIcon({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  return (
    <View style={[s.planIcon, { backgroundColor: color }]}>
      <Icon size={16} color="#FFFFFF" />
    </View>
  );
}

// =============================================================================
// Main component
// =============================================================================

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const trialStatus = useTrialStatus();

  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  // -- Handlers ----------------------------------------------------------------

  const handleCheckout = async (planId: string) => {
    if (!user?.id) {
      showAlert('Error', 'Please log in to subscribe.');
      return;
    }

    if (planId === 'free') return;

    triggerHaptic('selection');
    setProcessingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          planId,
          userId: user.id,
          successUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/subscription/success`,
          cancelUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/subscription`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        if (typeof window !== 'undefined') {
          window.location.href = data.url;
        }
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      showAlert(
        'Checkout Error',
        'Unable to start checkout. Please try again or contact support.',
      );
    } finally {
      setProcessingPlan(null);
    }
  };

  // -- Derived state -----------------------------------------------------------

  // Normalize tier name for comparison
  const rawTier = userProfile?.subscription_tier?.toLowerCase() || 'free';
  let currentPlan = 'free';
  if (rawTier === 'plus' || rawTier === 'individual' || rawTier === 'basic') {
    currentPlan = 'plus';
  } else if (rawTier === 'pro' || rawTier === 'team' || rawTier === 'championship') {
    currentPlan = 'pro';
  }

  const formatPrice = (plan: Plan) => {
    if (plan.annualPrice === 0) return '$0/yr';
    return `$${plan.annualPrice}/yr`;
  };

  // -- Render ------------------------------------------------------------------

  return (
    <SafeAreaView style={s.container}>
      {/* iOS Navigation Header */}
      <View style={s.navBar}>
        <Pressable
          style={s.backButton}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={28} color={IOS_COLORS.systemBlue} />
          <Text style={s.backText}>Back</Text>
        </Pressable>
        <Text style={s.navTitle}>Choose Plan</Text>
        <View style={s.navSpacer} />
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* -- Trial Banner --------------------------------------------------- */}
        {trialStatus.isOnTrial && (
          <IOSListSection>
            <View
              style={[
                s.trialBanner,
                trialStatus.isExpired
                  ? s.trialBannerExpired
                  : s.trialBannerActive,
              ]}
            >
              <Ionicons
                name={trialStatus.isExpired ? 'warning' : 'gift'}
                size={28}
                color={trialStatus.isExpired ? IOS_COLORS.systemRed : IOS_COLORS.systemOrange}
              />
              <View style={s.trialBannerText}>
                <Text style={s.trialTitle}>
                  {trialStatus.isExpired
                    ? 'Your trial has ended'
                    : `${trialStatus.daysRemaining} days left in your free trial`}
                </Text>
                <Text style={s.trialSubtitle}>
                  {trialStatus.isExpired
                    ? 'Subscribe now to restore access to your events.'
                    : 'Subscribe before your trial ends to keep all features.'}
                </Text>
              </View>
            </View>
          </IOSListSection>
        )}

        {/* -- Plan Sections -------------------------------------------------- */}
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isFree = plan.annualPrice === 0;
          const isPro = plan.id === 'pro';
          const isProcessing = processingPlan === plan.id;

          const sectionHeader = plan.popular
            ? `${plan.name.toUpperCase()} \u00b7 MOST POPULAR`
            : plan.name.toUpperCase();

          const featureBullets = plan.features
            .map((f) => `\u2022 ${f}`)
            .join('\n');

          const limitationBullets = plan.limitations
            ?.map((l) => `\u2022 ${l}`)
            .join('\n');

          return (
            <IOSListSection key={plan.id} header={sectionHeader}>
              {/* Summary row */}
              <IOSListItem
                title={plan.name}
                subtitle={plan.description}
                leadingComponent={<PlanIcon icon={plan.icon} color={plan.color} />}
                trailingComponent={
                  <View style={s.priceContainer}>
                    <Text style={s.priceText}>{formatPrice(plan)}</Text>
                    {plan.monthlyEquivalent !== '$0' && (
                      <Text style={s.priceSubtext}>{plan.monthlyEquivalent}</Text>
                    )}
                  </View>
                }
                trailingAccessory="none"
              />

              {/* Team members highlight (Pro only) */}
              {isPro && (
                <IOSListItem
                  title="Team Collaboration"
                  subtitle="Invite up to 5 team members to share your subscription"
                  leadingIcon="people-outline"
                  leadingIconBackgroundColor={IOS_COLORS.systemPurple}
                  trailingAccessory="none"
                />
              )}

              {/* Compact features row */}
              <IOSListItem
                title="Includes"
                subtitle={featureBullets}
                trailingAccessory="none"
              />

              {/* Compact limitations row (Free only) */}
              {limitationBullets && (
                <IOSListItem
                  title="Not included"
                  titleStyle={s.limitationTitle}
                  subtitle={limitationBullets}
                  subtitleStyle={s.limitationSubtitle}
                  trailingAccessory="none"
                />
              )}

              {/* Inline subscribe button */}
              <View style={s.buttonRow}>
                {isFree && isCurrent ? (
                  <View style={[s.planButton, s.planButtonDisabled]}>
                    <Text style={s.planButtonTextDisabled}>Current Plan</Text>
                  </View>
                ) : isFree ? (
                  <View style={[s.planButton, s.planButtonDisabled]}>
                    <Text style={s.planButtonTextDisabled}>Free Plan</Text>
                  </View>
                ) : isCurrent ? (
                  <View style={[s.planButton, s.planButtonDisabled]}>
                    <Text style={s.planButtonTextDisabled}>Current Plan</Text>
                  </View>
                ) : (
                  <Pressable
                    style={[
                      s.planButton,
                      { backgroundColor: plan.color },
                      isProcessing && s.planButtonProcessing,
                    ]}
                    onPress={() => handleCheckout(plan.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={s.planButtonText}>
                        Subscribe - ${plan.annualPrice}/yr
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </IOSListSection>
          );
        })}

        {/* -- Security footnote ---------------------------------------------- */}
        <Text style={s.securityFootnote}>
          Secure payment via Stripe{' \u00b7 '}Cancel anytime
        </Text>

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },

  // -- Navigation bar ----------------------------------------------------------
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.systemBlue,
    marginLeft: 2,
  },
  navTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  navSpacer: {
    flex: 1,
  },

  // -- Scroll ------------------------------------------------------------------
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: IOS_SPACING.lg,
  },

  // -- Trial banner ------------------------------------------------------------
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    gap: IOS_SPACING.md,
  },
  trialBannerActive: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  trialBannerExpired: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  trialBannerText: {
    flex: 1,
  },
  trialTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  trialSubtitle: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },

  // -- Plan icon ---------------------------------------------------------------
  planIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // -- Price text --------------------------------------------------------------
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  priceSubtext: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
  },

  // -- Limitation styles -------------------------------------------------------
  limitationTitle: {
    color: IOS_COLORS.tertiaryLabel,
  },
  limitationSubtitle: {
    color: IOS_COLORS.tertiaryLabel,
  },

  // -- Inline plan button ------------------------------------------------------
  buttonRow: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  planButton: {
    height: 44,
    borderRadius: IOS_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planButtonDisabled: {
    backgroundColor: IOS_COLORS.systemGray4,
  },
  planButtonProcessing: {
    opacity: 0.7,
  },
  planButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#FFFFFF',
  },
  planButtonTextDisabled: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.secondaryLabel,
  },

  // -- Security footnote -------------------------------------------------------
  securityFootnote: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginTop: IOS_SPACING.lg,
  },
});
