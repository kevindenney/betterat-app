/**
 * Subscription Page
 *
 * Updated: 2026-06-17
 * Pricing: Free / Plus $9/mo ($89/yr)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Zap, Anchor } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';

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
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  icon: LucideIcon;
  color: string;
  popular?: boolean;
  priceIds?: {
    monthly: string;
    yearly: string;
  };
  features: string[];
  limitations?: string[];
}

type BillingPeriod = 'monthly' | 'yearly';

interface CurrentSubscription {
  status: string;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const STRIPE_PRICE_IDS = {
  plus_monthly: process.env.EXPO_PUBLIC_STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID || '',
  plus_yearly: process.env.EXPO_PUBLIC_STRIPE_INDIVIDUAL_YEARLY_PRICE_ID || '',
};

async function getCheckoutErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      if (typeof payload?.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    } catch {
      // Fall through to generic handling when the function response isn't JSON.
    }
  }

  if (error instanceof Error && error.message.trim()) {
    if (!/non-2xx/i.test(error.message)) {
      return error.message;
    }
  }

  return 'Unable to start checkout. Please try again or contact support.';
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
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
    monthlyPrice: 9,
    annualPrice: 89,
    description: 'AI-powered learning',
    icon: Zap,
    color: IOS_COLORS.systemBlue,
    popular: true,
    priceIds: {
      monthly: STRIPE_PRICE_IDS.plus_monthly,
      yearly: STRIPE_PRICE_IDS.plus_yearly,
    },
    features: [
      'Unlimited interests & steps',
      'Unlimited AI insights & suggestions',
      'Telegram assistant',
      'Progress analytics',
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
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentSubscription = async () => {
      if (!user?.id) {
        if (!cancelled) setCurrentSubscription(null);
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, price_id, current_period_end, cancel_at_period_end')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setCurrentSubscription(null);
        return;
      }

      setCurrentSubscription({
        status: data.status,
        priceId: data.price_id ?? null,
        currentPeriodEnd: data.current_period_end ?? null,
        cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
      });
    };

    void loadCurrentSubscription();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // -- Handlers ----------------------------------------------------------------

  const handleCheckout = async (plan: Plan) => {
    if (!user?.id) {
      showAlert('Error', 'Please log in to subscribe.');
      return;
    }

    if (plan.id === 'free') return;

    const priceId = plan.priceIds?.[billingPeriod];

    triggerHaptic('selection');
    setProcessingPlan(`${plan.id}-${billingPeriod}`);
    try {
      // Stripe Checkout requires absolute http(s) return URLs. On web we use the
      // current origin; on native there's no window, so fall back to the web base.
      const origin =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '';

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          ...(priceId
            ? { priceId }
            : {
                plan: plan.id === 'plus' ? 'individual' : plan.id,
                billingPeriod,
              }),
          userId: user.id,
          successUrl: `${origin}/subscription/success`,
          cancelUrl: `${origin}/subscription`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // window.location is read-only on native (RN polyfills window but throws
        // on assignment). Branch by platform: redirect on web, in-app browser on native.
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = data.url;
        } else {
          await WebBrowser.openBrowserAsync(data.url);
        }
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      const message = await getCheckoutErrorMessage(error);
      console.error('Checkout error:', error);
      showAlert('Checkout Error', message);
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleManageBilling = async (targetPriceId?: string | null) => {
    if (!user?.id) {
      showAlert('Error', 'Please log in to manage billing.');
      return;
    }

    setBillingPortalLoading(true);
    try {
      const origin =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '';

      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          userId: user.id,
          returnUrl: `${origin}/subscription`,
          ...(targetPriceId ? { targetPriceId } : {}),
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No billing portal URL returned');

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = data.url;
      } else {
        await WebBrowser.openBrowserAsync(data.url);
      }
    } catch (error) {
      const message = await getCheckoutErrorMessage(error);
      console.error('Billing portal error:', error);
      showAlert('Billing Error', message);
    } finally {
      setBillingPortalLoading(false);
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

  const getCurrentBillingPeriodForPlan = (plan: Plan): BillingPeriod | null => {
    if (!currentSubscription?.priceId || !plan.priceIds) return null;
    if (currentSubscription.priceId === plan.priceIds.monthly) return 'monthly';
    if (currentSubscription.priceId === plan.priceIds.yearly) return 'yearly';
    return null;
  };

  const formatPeriodEndDate = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const billingPeriodLabel = (value: BillingPeriod | null) => {
    if (value === 'yearly') return 'annual';
    if (value === 'monthly') return 'monthly';
    return 'billing';
  };

  const billingPeriodDisplayLabel = (value: BillingPeriod | null) => {
    if (value === 'yearly') return 'Annual';
    if (value === 'monthly') return 'Monthly';
    return 'Billing';
  };

  const activePaidPlan = PLANS.find((plan) => plan.id === currentPlan && plan.monthlyPrice > 0) ?? null;
  const activeBillingPeriod = activePaidPlan ? getCurrentBillingPeriodForPlan(activePaidPlan) : null;
  const currentPeriodEndLabel = formatPeriodEndDate(currentSubscription?.currentPeriodEnd ?? null);
  const isScheduledToCancel = !!currentSubscription?.cancelAtPeriodEnd;
  const isBillingCadencePreview =
    !!activePaidPlan && !!activeBillingPeriod && billingPeriod !== activeBillingPeriod;
  const activeBillingPeriodLabel = billingPeriodLabel(activeBillingPeriod);

  useEffect(() => {
    if (activeBillingPeriod) {
      setBillingPeriod(activeBillingPeriod);
    }
  }, [activeBillingPeriod]);

  const getBillingToggleOptionLabel = (value: BillingPeriod) => {
    if (!activePaidPlan || !activeBillingPeriod) {
      return billingPeriodDisplayLabel(value);
    }

    if (value === activeBillingPeriod) {
      return `Current ${billingPeriodDisplayLabel(value)}`;
    }

    return `Switch to ${billingPeriodDisplayLabel(value)}`;
  };

  const formatPrice = (plan: Plan) => {
    if (plan.monthlyPrice === 0) return '$0';
    return billingPeriod === 'monthly'
      ? `$${plan.monthlyPrice}/mo`
      : `$${plan.annualPrice}/yr`;
  };

  const formatPriceSubtext = (plan: Plan) => {
    if (plan.monthlyPrice === 0) return null;
    return billingPeriod === 'monthly'
      ? `$${plan.annualPrice}/yr available`
      : `$${(plan.annualPrice / 12).toFixed(2)}/mo`;
  };

  const formatCheckoutLabel = (plan: Plan) => {
    if (billingPeriod === 'monthly') return `Subscribe - $${plan.monthlyPrice}/mo`;
    return `Subscribe - $${plan.annualPrice}/yr`;
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
        {activePaidPlan && (
          <IOSListSection>
            <View style={s.billingNoticeCard}>
              <View style={s.billingNoticeHeader}>
                <Text style={s.billingNoticeTitle}>
                  {isScheduledToCancel ? 'Subscription ends soon' : 'Billing is managed in Stripe'}
                </Text>
                <Text
                  style={[
                    s.billingNoticeBadge,
                    isScheduledToCancel && s.billingNoticeBadgeWarning,
                  ]}
                >
                  {isScheduledToCancel
                    ? currentPeriodEndLabel
                      ? `Cancels ${currentPeriodEndLabel}`
                      : 'Cancels at period end'
                    : activeBillingPeriod === 'yearly'
                      ? 'Annual'
                      : 'Monthly'}
                </Text>
              </View>
              <Text style={s.billingNoticeBody}>
                {isScheduledToCancel
                  ? currentPeriodEndLabel
                    ? `Your paid access stays on until ${currentPeriodEndLabel}. Open Stripe Billing to resume renewal before that date.`
                    : 'Your paid access stays on until the end of the current billing period. Open Stripe Billing to resume renewal before then.'
                  : 'Cancel, resume, switch billing period, update your card, and review invoices in Stripe Billing.'}
              </Text>
              {isBillingCadencePreview && (
                <Text style={s.billingNoticeState}>
                  You are currently on {billingPeriodLabel(activeBillingPeriod)} billing. Keep{' '}
                  {billingPeriodLabel(billingPeriod)} selected, then use the button below to make
                  that change in Stripe.
                </Text>
              )}
              {isScheduledToCancel ? (
                <Text style={s.billingNoticeState}>
                  {currentPeriodEndLabel
                    ? `This subscription will not renew automatically. Resume it in Stripe before ${currentPeriodEndLabel} if you want to keep Plus active.`
                    : 'This subscription will not renew automatically. Resume it in Stripe before period end if you want to keep Plus active.'}
                </Text>
              ) : currentPeriodEndLabel ? (
                <Text style={s.billingNoticeState}>
                  Your current {activeBillingPeriod ?? 'billing'} period renews on {currentPeriodEndLabel}.
                </Text>
              ) : null}
            </View>
          </IOSListSection>
        )}

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

        {/* -- Billing toggle ------------------------------------------------ */}
        {activePaidPlan && activeBillingPeriod && (
          <View style={s.billingToggleContext}>
            <Text style={s.billingToggleEyebrow}>Billing period</Text>
            <View style={s.billingPeriodSummaryRow}>
              <View style={[s.billingPeriodSummaryCard, s.billingPeriodSummaryCurrent]}>
                <Text style={s.billingPeriodSummaryLabel}>Current</Text>
                <Text style={s.billingPeriodSummaryValue}>
                  {billingPeriodDisplayLabel(activeBillingPeriod)}
                </Text>
              </View>
              <View
                style={[
                  s.billingPeriodSummaryCard,
                  isBillingCadencePreview
                    ? s.billingPeriodSummaryTarget
                    : s.billingPeriodSummaryIdle,
                ]}
              >
                <Text style={s.billingPeriodSummaryLabel}>
                  {isBillingCadencePreview ? 'Switch target' : 'Selection'}
                </Text>
                <Text style={s.billingPeriodSummaryValue}>
                  {isBillingCadencePreview
                    ? billingPeriodDisplayLabel(billingPeriod)
                    : 'No change selected'}
                </Text>
              </View>
            </View>
            <Text style={s.billingToggleHelper}>
              {isBillingCadencePreview
                ? `Current plan: ${activeBillingPeriodLabel}. The control below is only choosing the Stripe switch target.`
                : `Current plan: ${activeBillingPeriodLabel}. Select the other option below only if you want to switch in Stripe.`}
            </Text>
          </View>
        )}
        <View style={s.billingToggle}>
          <Pressable
            style={[
              s.billingToggleOption,
              billingPeriod === 'monthly' && s.billingToggleOptionActive,
            ]}
            onPress={() => setBillingPeriod('monthly')}
          >
            <Text
              style={[
                s.billingToggleText,
                billingPeriod === 'monthly' && s.billingToggleTextActive,
              ]}
            >
              {getBillingToggleOptionLabel('monthly')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              s.billingToggleOption,
              billingPeriod === 'yearly' && s.billingToggleOptionActive,
            ]}
            onPress={() => setBillingPeriod('yearly')}
          >
            <Text
              style={[
                s.billingToggleText,
                billingPeriod === 'yearly' && s.billingToggleTextActive,
              ]}
            >
              {getBillingToggleOptionLabel('yearly')}
            </Text>
          </Pressable>
        </View>

        {/* -- Plan Sections -------------------------------------------------- */}
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isFree = plan.monthlyPrice === 0;
          const isProcessing = processingPlan === `${plan.id}-${billingPeriod}`;
          const currentBillingForPlan = getCurrentBillingPeriodForPlan(plan);
          const isCurrentCadence = isCurrent && currentBillingForPlan === billingPeriod;
          const canManageCurrentPaidPlan = isCurrent && !isFree;
          const targetPriceId =
            canManageCurrentPaidPlan && !isCurrentCadence
              ? plan.priceIds?.[billingPeriod] ?? null
              : null;
          const priceSubtext = formatPriceSubtext(plan);

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
                    {priceSubtext && <Text style={s.priceSubtext}>{priceSubtext}</Text>}
                  </View>
                }
                trailingAccessory="none"
              />

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
                ) : canManageCurrentPaidPlan ? (
                  <>
                    <Pressable
                      style={[
                        s.planButton,
                        s.planButtonSecondary,
                        billingPortalLoading && s.planButtonProcessing,
                      ]}
                      onPress={() => handleManageBilling(targetPriceId)}
                      disabled={billingPortalLoading}
                    >
                      {billingPortalLoading ? (
                        <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
                      ) : (
                        <Text style={s.planButtonTextSecondary}>
                          {!isCurrentCadence
                            ? billingPeriod === 'yearly'
                              ? isScheduledToCancel
                                ? 'Resume + switch from Monthly to Annual in Stripe'
                                : 'Switch from Monthly to Annual in Stripe'
                              : isScheduledToCancel
                                ? 'Resume + switch from Annual to Monthly in Stripe'
                                : 'Switch from Annual to Monthly in Stripe'
                            : isScheduledToCancel
                              ? 'Resume in Stripe'
                            : isCurrentCadence
                            ? 'Open Stripe Billing'
                            : 'Open Stripe Billing'}
                        </Text>
                      )}
                    </Pressable>
                    <Text style={s.manageBillingHint}>
                      {isScheduledToCancel
                        ? currentPeriodEndLabel
                          ? !isCurrentCadence
                            ? `Your subscription is set to end on ${currentPeriodEndLabel}. This button opens Stripe in the ${billingPeriodLabel(billingPeriod)} switch flow so you can resume renewal and change cadence there.`
                            : `Your subscription is set to end on ${currentPeriodEndLabel}. This button opens Stripe so you can resume renewal, switch cadence, or update your card.`
                          : !isCurrentCadence
                            ? `Your subscription is set to end at period end. This button opens Stripe in the ${billingPeriodLabel(billingPeriod)} switch flow so you can resume renewal and change cadence there.`
                            : 'Your subscription is set to end at period end. This button opens Stripe so you can resume renewal, switch cadence, or update your card.'
                        : !isCurrentCadence && currentBillingForPlan
                          ? `You are currently on ${billingPeriodLabel(currentBillingForPlan)} billing. This button opens Stripe so you can switch to ${billingPeriodLabel(billingPeriod)} there.`
                          : 'Use Stripe Billing to cancel, switch monthly or annual, update your card, or review invoices.'}
                    </Text>
                  </>
                ) : (
                  <Pressable
                    style={[
                      s.planButton,
                      { backgroundColor: plan.color },
                      isProcessing && s.planButtonProcessing,
                    ]}
                    onPress={() => handleCheckout(plan)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={s.planButtonText}>{formatCheckoutLabel(plan)}</Text>
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

  // -- Billing toggle ----------------------------------------------------------
  billingNoticeCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    gap: IOS_SPACING.xs,
  },
  billingNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: IOS_SPACING.sm,
  },
  billingNoticeTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
    flex: 1,
  },
  billingNoticeBadge: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.systemBlue,
    backgroundColor: IOS_COLORS.systemBlue + '15',
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: 4,
    borderRadius: IOS_RADIUS.pill,
    overflow: 'hidden',
  },
  billingNoticeBadgeWarning: {
    color: IOS_COLORS.systemOrange,
    backgroundColor: IOS_COLORS.systemOrange + '18',
  },
  billingNoticeBody: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },
  billingNoticeState: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.label,
    lineHeight: 18,
  },
  billingToggleContext: {
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.xs,
  },
  billingToggleEyebrow: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  billingPeriodSummaryRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.xs,
  },
  billingPeriodSummaryCard: {
    flex: 1,
    borderRadius: IOS_RADIUS.md,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderWidth: 1,
  },
  billingPeriodSummaryCurrent: {
    backgroundColor: IOS_COLORS.systemBlue + '10',
    borderColor: IOS_COLORS.systemBlue + '25',
  },
  billingPeriodSummaryTarget: {
    backgroundColor: IOS_COLORS.systemGreen + '10',
    borderColor: IOS_COLORS.systemGreen + '25',
  },
  billingPeriodSummaryIdle: {
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderColor: IOS_COLORS.separator,
  },
  billingPeriodSummaryLabel: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  billingPeriodSummaryValue: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  billingToggleHelper: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  billingToggle: {
    flexDirection: 'row',
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.xs,
    marginBottom: IOS_SPACING.md,
    padding: 3,
    borderRadius: IOS_RADIUS.md,
    backgroundColor: IOS_COLORS.systemGray5,
  },
  billingToggleOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: IOS_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs,
  },
  billingToggleOptionActive: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    shadowColor: IOS_COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  billingToggleText: {
    ...IOS_TYPOGRAPHY.subhead,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  billingToggleTextActive: {
    color: IOS_COLORS.label,
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
  planButtonSecondary: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemBlue,
  },
  planButtonProcessing: {
    opacity: 0.7,
  },
  planButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#FFFFFF',
  },
  planButtonTextSecondary: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.systemBlue,
  },
  planButtonTextDisabled: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.secondaryLabel,
  },
  manageBillingHint: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginTop: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.sm,
  },

  // -- Security footnote -------------------------------------------------------
  securityFootnote: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginTop: IOS_SPACING.lg,
  },
});
