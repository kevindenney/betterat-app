/**
 * Subscription Context
 * Marine-grade subscription state management for BetterAt
 * Provides app-wide access to subscription status and purchase methods
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  subscriptionService,
  SubscriptionProduct,
  SubscriptionStatus,
  PurchaseResult,
} from '@/lib/subscriptions/subscriptionService';
import { useAuth } from '@/providers/AuthProvider';

interface SubscriptionContextType {
  // Subscription status
  status: SubscriptionStatus | null;
  loading: boolean;

  // Available products
  products: SubscriptionProduct[];
  popularProduct: SubscriptionProduct | null;

  // Subscription actions
  purchaseProduct: (productId: string) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
  cancelSubscription: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;

  // Feature access helpers
  hasFeature: (feature: string) => boolean;
  canAccessFeature: (requiredTier: string) => boolean;

  // Trial and upgrade helpers
  isInTrial: boolean;
  daysLeftInTrial: number;
  shouldShowUpgradePrompt: (feature?: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

/**
 * Feature access mapping for subscription tiers
 */
const TIER_FEATURES: Record<string, string[]> = {
  free: [
    'basic_race_tracking',
    'limited_documents', // 3 documents max
    'basic_weather',
  ],
  pro: [
    'unlimited_race_tracking',
    'unlimited_documents',
    'global_venue_intelligence',
    'ai_race_analysis',
    'offline_capabilities',
    'equipment_optimization',
    'performance_analytics',
    'cloud_backup',
  ],
  sailor_pro: [
    'unlimited_race_tracking',
    'unlimited_documents',
    'global_venue_intelligence',
    'ai_race_analysis',
    'offline_capabilities',
    'equipment_optimization',
    'performance_analytics',
    'cloud_backup',
  ],
  championship: [
    'advanced_ai_simulation',
    'weather_ensemble',
    'monte_carlo_predictions',
    'cultural_adaptation',
    'cross_venue_analytics',
    'championship_tools',
    'priority_support',
  ],
  professional: [
    'coach_marketplace',
    'team_management',
    'advanced_analytics',
    'custom_integrations',
    'white_label_options',
  ],
};

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const { user } = useAuth();

  // Initialize subscription service when user changes
  useEffect(() => {
    initializeSubscriptions();
  }, [user]);

  /**
   * Initialize subscription service and load data
   */
  const initializeSubscriptions = async () => {
    try {
      setLoading(true);

      // Initialize subscription service
      await subscriptionService.initialize();

      // Load available products
      const availableProducts = await subscriptionService.getAvailableProducts();
      setProducts(availableProducts);

      // Load subscription status
      await refreshStatus();

    } catch (error) {

      // Set default state on error
      setStatus({
        isActive: false,
        productId: null,
        tier: 'free',
        expiresAt: null,
        isTrialing: false,
        trialEndsAt: null,
        willRenew: false,
        platform: Platform.OS as 'ios' | 'android',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Purchase a subscription product
   */
  const purchaseProduct = async (productId: string): Promise<PurchaseResult> => {
    try {
      setLoading(true);

      const result = await subscriptionService.purchaseProduct(productId);

      if (result.success) {
        // Refresh status after successful purchase
        await refreshStatus();

        // Show success feedback
        const product = products.find(p => p.id === productId);
        showAlert(
          'Welcome to BetterAt!',
          `You now have access to ${product?.title || 'premium features'}. Start exploring your premium features.`
        );
      } else if (result.error && !result.error.includes('cancelled')) {
        // Show error for non-cancellation errors
        showAlert(
          'Purchase Failed',
          result.error || 'Unable to complete purchase. Please try again.'
        );
      }

      return result;
    } catch (error) {

      return {
        success: false,
        error: 'Purchase failed due to technical error',
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Restore previous purchases
   */
  const restorePurchases = async (): Promise<PurchaseResult> => {
    try {
      setLoading(true);

      const result = await subscriptionService.restorePurchases();

      if (result.success) {
        await refreshStatus();
        showAlert(
          'Purchases Restored',
          'Your previous purchases have been successfully restored.'
        );
      } else {
        showAlert(
          'No Purchases Found',
          'No previous purchases were found for this account.'
        );
      }

      return result;
    } catch (error) {

      return {
        success: false,
        error: 'Failed to restore purchases',
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cancel subscription
   */
  const cancelSubscription = async (): Promise<boolean> => {
    try {
      const result = await subscriptionService.cancelSubscription();
      if (result) {
        // Refresh status after cancellation
        setTimeout(() => refreshStatus(), 2000);
      }
      return result;
    } catch (error) {

      return false;
    }
  };

  /**
   * Refresh subscription status
   */
  const refreshStatus = async (): Promise<void> => {
    try {
      const newStatus = await subscriptionService.getSubscriptionStatus();
      setStatus(newStatus);

    } catch (error) {

    }
  };

  /**
   * Check if user has access to a specific feature
   */
  const hasFeature = (feature: string): boolean => {
    if (!status) return false;

    const tierFeatures = TIER_FEATURES[status.tier] || [];
    return tierFeatures.includes(feature);
  };

  /**
   * Check if user can access a feature requiring a specific tier
   */
  const canAccessFeature = (requiredTier: string): boolean => {
    if (!status) return false;

    const tierHierarchy = ['free', 'sailor_pro', 'championship', 'professional'];
    const currentTierIndex = tierHierarchy.indexOf(status.tier);
    const requiredTierIndex = tierHierarchy.indexOf(requiredTier);

    return currentTierIndex >= requiredTierIndex;
  };

  /**
   * Get popular product (yearly sailor pro)
   */
  const popularProduct = products.find(p => p.isPopular) || products[0] || null;

  /**
   * Check if user is in trial period
   */
  const isInTrial = status?.isTrialing || false;

  /**
   * Calculate days left in trial
   */
  const daysLeftInTrial = (): number => {
    if (!isInTrial || !status?.trialEndsAt) return 0;

    const now = new Date();
    const trialEnd = new Date(status.trialEndsAt);
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  };

  /**
   * Determine if should show upgrade prompt
   */
  const shouldShowUpgradePrompt = (feature?: string): boolean => {
    if (!status || status.isActive) return false;

    // Show upgrade for specific features that require premium
    if (feature) {
      return !hasFeature(feature);
    }

    // Show upgrade for free users after some usage
    return status.tier === 'free';
  };

  const value: SubscriptionContextType = {
    status,
    loading,
    products,
    popularProduct,
    purchaseProduct,
    restorePurchases,
    cancelSubscription,
    refreshStatus,
    hasFeature,
    canAccessFeature,
    isInTrial,
    daysLeftInTrial: daysLeftInTrial(),
    shouldShowUpgradePrompt,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Hook to use subscription context
 */
export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

/**
 * Hook for feature access control
 */
export function useFeatureAccess(feature: string, requiredTier?: string) {
  const { hasFeature, canAccessFeature, shouldShowUpgradePrompt } = useSubscription();

  const hasAccess = requiredTier ? canAccessFeature(requiredTier) : hasFeature(feature);
  const needsUpgrade = shouldShowUpgradePrompt(feature);

  return {
    hasAccess,
    needsUpgrade,
    showUpgradePrompt: needsUpgrade && !hasAccess,
  };
}

/**
 * Hook for premium feature components
 */
export function usePremiumFeature(feature: string) {
  const subscription = useSubscription();
  const hasAccess = subscription.hasFeature(feature);

  return {
    ...subscription,
    hasAccess,
    showUpgrade: !hasAccess,
  };
}

export default SubscriptionContext;
