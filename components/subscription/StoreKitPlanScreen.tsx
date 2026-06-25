/**
 * StoreKit Plan Screen (native iOS / Android)
 *
 * The Apple-compliant subscription surface. Purchases run through
 * StoreKit / Play Billing via RevenueCat (SubscriptionContext.purchaseProduct),
 * NOT Stripe — Stripe stays on web (see app/subscription/index.tsx dispatcher).
 *
 * Apple Guideline 3.1.2 requires the paywall to surface: subscription name +
 * length + price, a purchase action, Restore Purchases, an auto-renew
 * disclosure, and functional Terms (EULA) + Privacy Policy links.
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
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Zap, Anchor } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import type { SubscriptionProduct } from '@/lib/subscriptions/subscriptionService';
import { IOSListSection } from '@/components/ui/ios/IOSListSection';
import { IOSListItem } from '@/components/ui/ios/IOSListItem';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';

const TERMS_URL = 'https://better.at/terms';
const PRIVACY_URL = 'https://better.at/privacy';

type BillingPeriod = 'monthly' | 'yearly';

const PLAN_META: Record<string, { icon: LucideIcon; color: string }> = {
  Individual: { icon: Zap, color: IOS_COLORS.systemBlue },
  Pro: { icon: Anchor, color: '#5856D6' },
};

function PlanIcon({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  return (
    <View style={[s.planIcon, { backgroundColor: color }]}>
      <Icon size={16} color="#FFFFFF" />
    </View>
  );
}

export default function StoreKitPlanScreen() {
  const router = useRouter();
  const { products, status, loading, purchaseProduct, restorePurchases } = useSubscription();

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const isActive = !!status?.isActive;

  const visiblePlans = products
    .filter((p) => p.billingPeriod === billingPeriod)
    // Stable tier order: Individual before Pro.
    .sort((a, b) => (a.title === 'Individual' ? -1 : 1) - (b.title === 'Individual' ? -1 : 1));

  const handleSubscribe = async (product: SubscriptionProduct) => {
    triggerHaptic('selection');
    setProcessingId(product.id);
    try {
      await purchaseProduct(product.id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restorePurchases();
    } finally {
      setRestoring(false);
    }
  };

  const openUrl = (url: string) => {
    void WebBrowser.openBrowserAsync(url);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.navBar}>
        <Pressable style={s.backButton} onPress={() => router.back()} hitSlop={8}>
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
        {/* Billing period toggle */}
        <View style={s.billingToggle}>
          {(['monthly', 'yearly'] as BillingPeriod[]).map((period) => (
            <Pressable
              key={period}
              style={[s.billingToggleOption, billingPeriod === period && s.billingToggleOptionActive]}
              onPress={() => setBillingPeriod(period)}
            >
              <Text
                style={[s.billingToggleText, billingPeriod === period && s.billingToggleTextActive]}
              >
                {period === 'monthly' ? 'Monthly' : 'Annual'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading && products.length === 0 ? (
          <ActivityIndicator style={{ marginTop: IOS_SPACING.xl }} color={IOS_COLORS.systemBlue} />
        ) : (
          visiblePlans.map((plan) => {
            const meta = PLAN_META[plan.title] ?? { icon: Zap, color: IOS_COLORS.systemBlue };
            const isProcessing = processingId === plan.id;
            const header = plan.isPopular ? `${plan.title.toUpperCase()} · MOST POPULAR` : plan.title.toUpperCase();

            return (
              <IOSListSection key={plan.id} header={header}>
                <IOSListItem
                  title={plan.title}
                  subtitle={plan.description}
                  leadingComponent={<PlanIcon icon={meta.icon} color={meta.color} />}
                  trailingComponent={
                    <View style={s.priceContainer}>
                      <Text style={s.priceText}>{plan.price}</Text>
                      {plan.effectiveMonthly && (
                        <Text style={s.priceSubtext}>{plan.effectiveMonthly}</Text>
                      )}
                    </View>
                  }
                  trailingAccessory="none"
                />

                <IOSListItem
                  title="Includes"
                  subtitle={plan.features.slice(0, 5).map((f) => `• ${f}`).join('\n')}
                  trailingAccessory="none"
                />

                <View style={s.buttonRow}>
                  <Pressable
                    style={[s.planButton, { backgroundColor: meta.color }, isProcessing && s.planButtonProcessing]}
                    onPress={() => handleSubscribe(plan)}
                    disabled={isProcessing || isActive}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={s.planButtonText}>
                        {isActive ? 'Current Plan' : `Subscribe – ${plan.price}`}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </IOSListSection>
            );
          })
        )}

        {/* Restore + manage */}
        <View style={s.secondaryActions}>
          <Pressable onPress={handleRestore} disabled={restoring} hitSlop={8}>
            {restoring ? (
              <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
            ) : (
              <Text style={s.linkText}>Restore Purchases</Text>
            )}
          </Pressable>
        </View>

        {/* Auto-renew disclosure (Apple-required) */}
        <Text style={s.disclosure}>
          Subscriptions automatically renew unless canceled at least 24 hours before the end of the
          current period. Your account is charged for renewal within 24 hours prior to the end of the
          current period. Manage or cancel anytime in your App Store account settings.
        </Text>

        <View style={s.legalRow}>
          <Pressable onPress={() => openUrl(TERMS_URL)} hitSlop={8}>
            <Text style={s.legalLink}>Terms of Use</Text>
          </Pressable>
          <Text style={s.legalDot}>{'·'}</Text>
          <Pressable onPress={() => openUrl(PRIVACY_URL)} hitSlop={8}>
            <Text style={s.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backText: { ...IOS_TYPOGRAPHY.body, color: IOS_COLORS.systemBlue, marginLeft: 2 },
  navTitle: { ...IOS_TYPOGRAPHY.headline, color: IOS_COLORS.label, textAlign: 'center' },
  navSpacer: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: IOS_SPACING.lg },
  billingToggle: {
    flexDirection: 'row',
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.sm,
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
  },
  billingToggleTextActive: { color: IOS_COLORS.label },
  planIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceContainer: { alignItems: 'flex-end' },
  priceText: { ...IOS_TYPOGRAPHY.headline, color: IOS_COLORS.label },
  priceSubtext: { ...IOS_TYPOGRAPHY.caption1, color: IOS_COLORS.secondaryLabel },
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
  planButtonProcessing: { opacity: 0.7 },
  planButtonText: { ...IOS_TYPOGRAPHY.headline, color: '#FFFFFF' },
  secondaryActions: {
    alignItems: 'center',
    marginTop: IOS_SPACING.lg,
  },
  linkText: { ...IOS_TYPOGRAPHY.body, color: IOS_COLORS.systemBlue, fontWeight: '600' },
  disclosure: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: IOS_SPACING.lg,
    paddingHorizontal: IOS_SPACING.lg,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    marginTop: IOS_SPACING.sm,
  },
  legalLink: { ...IOS_TYPOGRAPHY.footnote, color: IOS_COLORS.systemBlue },
  legalDot: { ...IOS_TYPOGRAPHY.footnote, color: IOS_COLORS.tertiaryLabel },
});
