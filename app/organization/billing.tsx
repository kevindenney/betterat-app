/**
 * Organization Billing Dashboard
 *
 * Admin-only page showing subscription status, seat usage, and management actions.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { OrgSubscriptionService, type OrgSubscription } from '@/services/OrgSubscriptionService';
import { ORG_PLANS, ORG_PLAN_LIST, type OrgPlanId, type OrgBillingPeriod } from '@/lib/subscriptions/orgTiers';
import { isOrgAdminRole } from '@/lib/organizations/adminGate';
import { OrgAdminHeader } from '@/components/organizations/OrgAdminHeader';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

export default function OrganizationBillingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [seats, setSeats] = useState<{ total: number; used: number; available: number } | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<OrgBillingPeriod>('annual');
  const [processingPlan, setProcessingPlan] = useState<OrgPlanId | null>(null);
  const [showPlans, setShowPlans] = useState(false);

  const isDesktop = width >= 768;
  const profile = userProfile as any;
  const orgId = profile?.active_organization_id;
  const userRole = profile?.organization_role;

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        const [sub, seatInfo] = await Promise.all([
          OrgSubscriptionService.getSubscription(orgId),
          OrgSubscriptionService.getAvailableSeats(orgId),
        ]);
        setSubscription(sub);
        setSeats(seatInfo);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [orgId]);

  const handleCheckout = async (planId: OrgPlanId) => {
    if (!orgId) {
      showAlert('Error', 'No active organization found.');
      return;
    }
    setProcessingPlan(planId);
    try {
      const result = await OrgSubscriptionService.createSubscription(orgId, planId, billingPeriod);
      if (result.success && result.checkoutUrl) {
        if (typeof window !== 'undefined') {
          window.location.href = result.checkoutUrl;
        }
      } else {
        showAlert('Checkout Error', result.error || 'Unable to start checkout. Please try again.');
      }
    } catch {
      showAlert('Checkout Error', 'Unable to start checkout. Please try again.');
    } finally {
      setProcessingPlan(null);
    }
  };

  if (!isOrgAdminRole(userRole)) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="lock-closed" size={48} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>Admin Access Required</Text>
        <Text style={styles.emptyText}>
          Only organization admins can view billing information.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const plan = subscription ? ORG_PLANS[subscription.plan_id as keyof typeof ORG_PLANS] : null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#059669';
      case 'trialing': return '#2563EB';
      case 'past_due': return '#DC2626';
      case 'cancelled': return '#9CA3AF';
      default: return '#6B7280';
    }
  };

  const planPicker = (
    <View style={styles.planPicker}>
      {/* Billing period toggle */}
      <View style={styles.billingToggle}>
        <TouchableOpacity
          style={[styles.billingToggleBtn, billingPeriod === 'annual' && styles.billingToggleBtnActive]}
          onPress={() => setBillingPeriod('annual')}
        >
          <Text style={[styles.billingToggleText, billingPeriod === 'annual' && styles.billingToggleTextActive]}>
            Annual
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.billingToggleBtn, billingPeriod === 'monthly' && styles.billingToggleBtnActive]}
          onPress={() => setBillingPeriod('monthly')}
        >
          <Text style={[styles.billingToggleText, billingPeriod === 'monthly' && styles.billingToggleTextActive]}>
            Monthly
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.planGrid, isDesktop && styles.planGridDesktop]}>
        {ORG_PLAN_LIST.map((p) => {
          const isCurrent = subscription?.plan_id === p.id && subscription?.status === 'active';
          const priceText = billingPeriod === 'annual' ? p.annualPriceFormatted : p.monthlyPriceFormatted;
          const priceUnit = billingPeriod === 'annual' ? '/year' : '/month';
          return (
            <View
              key={p.id}
              style={[styles.planCard, p.isPopular && styles.planCardPopular]}
            >
              {p.isPopular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>Most Popular</Text>
                </View>
              )}
              <Text style={[styles.planCardName, { color: p.accentColor }]}>{p.name}</Text>
              <Text style={styles.planCardDesc}>{p.description}</Text>
              <View style={styles.planCardPriceRow}>
                <Text style={styles.planCardPrice}>{priceText}</Text>
                <Text style={styles.planCardPriceUnit}>{priceUnit}</Text>
              </View>
              {billingPeriod === 'annual' && (
                <Text style={styles.planCardSavings}>{p.annualSavings}</Text>
              )}
              <View style={styles.planFeatures}>
                {p.features.map((f) => (
                  <View key={f} style={styles.planFeature}>
                    <Ionicons name="checkmark-circle" size={16} color={p.accentColor} />
                    <Text style={styles.planFeatureText}>{f}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[
                  styles.subscribeBtn,
                  { backgroundColor: p.accentColor },
                  (isCurrent || processingPlan !== null) && styles.subscribeBtnDisabled,
                ]}
                disabled={isCurrent || processingPlan !== null}
                onPress={() => handleCheckout(p.id)}
              >
                {processingPlan === p.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.subscribeBtnText}>
                    {isCurrent ? 'Current Plan' : p.cta}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <OrgAdminHeader
        title="Billing & Subscription"
        subtitle="Manage your organization's subscription and seat allocation."
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, isDesktop && styles.sectionDesktop]}>
          {!subscription ? (
            /* No subscription — choose a plan */
            <>
              <View style={styles.emptyCard}>
                <Ionicons name="card-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Choose a Plan</Text>
                <Text style={styles.emptyText}>
                  Subscribe to provide premium access to your members. Billing is handled
                  securely through Stripe.
                </Text>
              </View>
              {planPicker}
            </>
          ) : (
            <>
              {/* Current Plan Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardLabel}>Current Plan</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subscription.status) + '15' }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(subscription.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(subscription.status) }]}>
                      {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.planName}>{plan?.name || subscription.plan_id}</Text>
                <Text style={styles.planDescription}>{plan?.description || ''}</Text>

                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Billing Period</Text>
                    <Text style={styles.detailValue}>Annual</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Amount</Text>
                    <Text style={styles.detailValue}>
                      {subscription.amount
                        ? `$${(subscription.amount / 100).toLocaleString()}/year`
                        : plan?.price || '—'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Member Tier</Text>
                    <Text style={styles.detailValue}>
                      {subscription.member_tier === 'pro' ? 'Pro' : 'Individual'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Renewal Date</Text>
                    <Text style={styles.detailValue}>{formatDate(subscription.current_period_end)}</Text>
                  </View>
                </View>
              </View>

              {/* Seat Usage Card */}
              {seats && (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Seat Usage</Text>

                  <View style={styles.seatUsageRow}>
                    <Text style={styles.seatUsageNumber}>{seats.used}</Text>
                    <Text style={styles.seatUsageOf}>of</Text>
                    <Text style={styles.seatUsageNumber}>{seats.total}</Text>
                    <Text style={styles.seatUsageLabel}>seats used</Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, (seats.used / seats.total) * 100)}%`,
                          backgroundColor: seats.available > 0 ? '#2563EB' : '#DC2626',
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.seatAvailable}>
                    {seats.available} seat{seats.available !== 1 ? 's' : ''} available
                  </Text>

                  {seats.available === 0 && subscription.plan_id === 'starter' && (
                    <TouchableOpacity
                      style={styles.upsellBtn}
                      onPress={() => router.push('/institutions/pricing')}
                    >
                      <Ionicons name="arrow-up-circle" size={18} color="#7C3AED" />
                      <Text style={styles.upsellBtnText}>Upgrade to Department for more seats</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Actions Card */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Manage</Text>

                <TouchableOpacity style={styles.actionRow}>
                  <Ionicons name="card-outline" size={20} color="#007AFF" />
                  <Text style={styles.actionText}>Manage Payment Method</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <View style={styles.actionDivider} />

                <TouchableOpacity style={styles.actionRow}>
                  <Ionicons name="receipt-outline" size={20} color="#007AFF" />
                  <Text style={styles.actionText}>View Invoices</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <View style={styles.actionDivider} />

                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => setShowPlans((v) => !v)}
                >
                  <Ionicons name="swap-horizontal" size={20} color="#007AFF" />
                  <Text style={styles.actionText}>Change Plan</Text>
                  <Ionicons
                    name={showPlans ? 'chevron-up' : 'chevron-forward'}
                    size={18}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>

              {showPlans && planPicker}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {},
  section: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    padding: 24,
    gap: 16,
  },
  sectionDesktop: {
    padding: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      } as any,
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  planName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    minWidth: 140,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  seatUsageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 12,
  },
  seatUsageNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
  },
  seatUsageOf: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  seatUsageLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  seatAvailable: {
    fontSize: 13,
    color: '#6B7280',
  },
  upsellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#7C3AED10',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  upsellBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 400,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  planPicker: {
    gap: 16,
  },
  billingToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
  },
  billingToggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  billingToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } as any,
    }),
  },
  billingToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  billingToggleTextActive: {
    color: '#1F2937',
  },
  planGrid: {
    gap: 16,
  },
  planGridDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  planCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } as any,
    }),
  },
  planCardPopular: {
    borderColor: '#7C3AED',
    borderWidth: 2,
  },
  popularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#7C3AED15',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planCardName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  planCardDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  planCardPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  planCardPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
  },
  planCardPriceUnit: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  planCardSavings: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginTop: 4,
  },
  planFeatures: {
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  planFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  subscribeBtn: {
    marginTop: 'auto',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  subscribeBtnDisabled: {
    opacity: 0.5,
  },
  subscribeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
