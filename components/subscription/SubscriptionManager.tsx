/**
 * Subscription Manager Component
 * Handles subscription display, upgrade, and management
 *
 * Updated: 2026-03-30
 * Pricing: Free / Plus $9/mo ($89/yr) / Pro $29/mo ($249/yr)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  priceId: string;
  features: string[];
  popular?: boolean;
}

// Web-only stub to completely avoid Stripe React Native imports
const webStripeService = {
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      priceId: '',
      features: ['Up to 3 learning interests', 'Basic timeline management', '5 queries per month']
    },
    {
      id: 'plus',
      name: 'Plus',
      price: 9,
      priceId: process.env.EXPO_PUBLIC_STRIPE_PLUS_MONTHLY_PRICE_ID || 'price_plus_monthly',
      features: [
        'Unlimited interests & steps',
        '50,000 tokens per month',
        'Insights & suggestions',
        'Telegram assistant',
        'Progress analytics',
        'Offline mode',
      ],
      popular: true
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 29,
      priceId: process.env.EXPO_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
      features: [
        'Everything in Plus',
        '500,000 tokens per month',
        'Priority processing',
        'MCP integrations',
        'Priority support',
      ]
    }
  ],
  getSubscriptionStatus: async () => ({ active: false }),
  createCheckoutSession: async (_userId: string, _priceId: string) => ({
    error: 'Web checkout currently routes through support.',
  }),
  createPortalSession: async (_userId: string) => ({
    error: 'Web billing portal currently routes through support.',
  }),
  cancelSubscription: async (_userId: string) => ({
    success: false,
    error: 'Please contact support to cancel from web.',
  }),
  resumeSubscription: async (_userId: string) => ({
    success: false,
    error: 'Please contact support to resume from web.',
  })
};

// Use web service for now to avoid Stripe React Native completely
const stripeService = webStripeService;

interface SubscriptionStatus {
  active: boolean;
  plan?: SubscriptionPlan;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

export const SubscriptionManager: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ active: false });

  useEffect(() => {
    loadSubscriptionStatus();
  }, [loadSubscriptionStatus]);

  const loadSubscriptionStatus = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const status = await stripeService.getSubscriptionStatus(user.id);
      setSubscriptionStatus(status);
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (!user?.id) {
      showAlert('Sign In Required', 'Please sign in to subscribe');
      return;
    }

    if (plan.price === 0) {
      // Free plan
      showAlert('Free Plan', 'You are currently on the free plan');
      return;
    }

    if (subscriptionStatus.plan?.id === plan.id) {
      // Already on this plan
      showAlert('Current Plan', 'You are already subscribed to this plan');
      return;
    }

    setProcessingPlan(plan.id);
    try {
      const result = await stripeService.createCheckoutSession(
        user.id,
        plan.priceId
      );

      if ('url' in result) {
        if (Platform.OS === 'web') {
          window.location.href = result.url;
        } else {
          // For mobile, you'd typically use a WebView or in-app browser
          showAlert('Checkout', 'Opening payment page...');
        }
      } else {
        if (Platform.OS === 'web') {
          void Linking.openURL(
            `mailto:support@regattaflow.com?subject=Subscription%20Checkout%20Request&body=User%20ID%3A%20${encodeURIComponent(user.id)}%0APlan%3A%20${encodeURIComponent(plan.name)}`
          );
        } else {
          showAlert('Error', result.error);
        }
      }
    } catch (error: unknown) {
      showAlert('Error', 'Failed to start checkout process');
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const result = await stripeService.createPortalSession(user.id);

      if ('url' in result) {
        if (Platform.OS === 'web') {
          window.location.href = result.url;
        } else {
          showAlert('Billing Portal', 'Opening billing management...');
        }
      } else {
        if (Platform.OS === 'web') {
          void Linking.openURL(
            `mailto:support@regattaflow.com?subject=Billing%20Portal%20Request&body=User%20ID%3A%20${encodeURIComponent(user.id)}`
          );
        } else {
          showAlert('Error', result.error);
        }
      }
    } catch (error) {
      showAlert('Error', 'Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    showConfirm(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will retain access until the end of the billing period.',
      async () => {
        if (!user?.id) return;

        setLoading(true);
        const result = await stripeService.cancelSubscription(user.id);

        if (result.success) {
          showAlert('Subscription Cancelled', 'Your subscription will end at the current period');
          await loadSubscriptionStatus();
        } else {
          showAlert('Error', result.error || 'Failed to cancel subscription');
        }
        setLoading(false);
      },
      { destructive: true }
    );
  };

  const handleResumeSubscription = async () => {
    if (!user?.id) return;

    setLoading(true);
    const result = await stripeService.resumeSubscription(user.id);

    if (result.success) {
      showAlert('Subscription Resumed', 'Your subscription has been reactivated');
      await loadSubscriptionStatus();
    } else {
      showAlert('Error', result.error || 'Failed to resume subscription');
    }
    setLoading(false);
  };

  const formatPrice = (price: number) => {
    if (price === 0) return '$0';
    return `$${price}/mo`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Web Platform Notice */}
      {Platform.OS === 'web' && (
        <View style={styles.webNotice}>
          <Ionicons name="information-circle" size={20} color="#007AFF" />
          <Text style={styles.webNoticeText}>
            Web billing actions are handled by support. Tap checkout/manage and we will open an email request.
          </Text>
        </View>
      )}

      {/* Current Subscription Status */}
      {subscriptionStatus.active && subscriptionStatus.plan && (
        <View style={styles.currentPlanCard}>
          <View style={styles.currentPlanHeader}>
            <Text style={styles.currentPlanTitle}>Current Plan</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>ACTIVE</Text>
            </View>
          </View>
          <Text style={styles.currentPlanName}>{subscriptionStatus.plan.name}</Text>
          <Text style={styles.currentPlanPrice}>{formatPrice(subscriptionStatus.plan.price)}</Text>

          {subscriptionStatus.currentPeriodEnd && (
            <Text style={styles.periodEnd}>
              {subscriptionStatus.cancelAtPeriodEnd
                ? `Ends: ${subscriptionStatus.currentPeriodEnd.toLocaleDateString()}`
                : `Renews: ${subscriptionStatus.currentPeriodEnd.toLocaleDateString()}`}
            </Text>
          )}

          <View style={styles.currentPlanActions}>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={handleManageBilling}
            >
              <Text style={styles.manageButtonText}>Manage Billing</Text>
            </TouchableOpacity>

            {subscriptionStatus.cancelAtPeriodEnd ? (
              <TouchableOpacity
                style={styles.resumeButton}
                onPress={handleResumeSubscription}
              >
                <Text style={styles.resumeButtonText}>Resume Subscription</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelSubscription}
              >
                <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Plans Grid */}
      <View style={styles.plansContainer}>
        <Text style={styles.sectionTitle}>Choose Your Plan</Text>

        {stripeService.plans.map((plan) => {
          const isCurrentPlan = subscriptionStatus.plan?.id === plan.id;
          const isProcessing = processingPlan === plan.id;

          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                plan.popular && styles.popularCard,
                isCurrentPlan && styles.currentCard
              ]}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}

              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.priceAmount}>{formatPrice(plan.price)}</Text>
                {plan.price > 0 && (
                  <Text style={styles.pricePeriod}>
                    ({plan.id === 'individual' ? '$100/yr' : '$800/yr'})
                  </Text>
                )}
              </View>

              <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.selectButton,
                  isCurrentPlan && styles.currentButton,
                  isProcessing && styles.processingButton
                ]}
                onPress={() => handleSelectPlan(plan)}
                disabled={isCurrentPlan || isProcessing || plan.price === 0}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[
                    styles.selectButtonText,
                    isCurrentPlan && styles.currentButtonText
                  ]}>
                    {isCurrentPlan ? 'Current Plan' : plan.price === 0 ? 'Free Plan' : 'Select Plan'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Features Comparison */}
      <View style={styles.comparisonContainer}>
        <Text style={styles.sectionTitle}>Feature Comparison</Text>
        <View style={styles.comparisonTable}>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonFeature}>Races</Text>
            <Text style={styles.comparisonValue}>3</Text>
            <Text style={styles.comparisonValue}>Unlimited</Text>
            <Text style={styles.comparisonValue}>Unlimited</Text>
          </View>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonFeature}>Tokens</Text>
            <Text style={styles.comparisonValue}>5K/mo</Text>
            <Text style={styles.comparisonValue}>50K/mo</Text>
            <Text style={styles.comparisonValue}>500K/mo</Text>
          </View>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonFeature}>Team Sharing</Text>
            <Ionicons name="close" size={20} color="#FF3B30" />
            <Ionicons name="close" size={20} color="#FF3B30" />
            <Ionicons name="checkmark" size={20} color="#4CAF50" />
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentPlanCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    boxShadow: '0px 2px',
    elevation: 3,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentPlanTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  currentPlanName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  currentPlanPrice: {
    fontSize: 18,
    color: '#007AFF',
    marginTop: 4,
  },
  periodEnd: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  currentPlanActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  manageButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  manageButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#FF3B30',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  resumeButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  plansContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    boxShadow: '0px 2px',
    elevation: 3,
  },
  popularCard: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  currentCard: {
    backgroundColor: '#F0F8FF',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#007AFF',
  },
  pricePeriod: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    marginLeft: 8,
    color: '#333',
    flex: 1,
  },
  selectButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  currentButton: {
    backgroundColor: '#E0E0E0',
  },
  processingButton: {
    opacity: 0.6,
  },
  selectButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  currentButtonText: {
    color: '#666',
  },
  comparisonContainer: {
    padding: 16,
  },
  comparisonTable: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  comparisonFeature: {
    flex: 2,
    fontWeight: '500',
  },
  comparisonValue: {
    flex: 1,
    textAlign: 'center',
    color: '#666',
  },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  webNoticeText: {
    flex: 1,
    color: '#1976D2',
    fontSize: 14,
  },
});
