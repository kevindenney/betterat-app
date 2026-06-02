// @ts-nocheck

/**
 * Subscription Service
 * Handles native in-app purchases and subscription lifecycle
 *
 * Updated: 2026-03-15
 * Pricing: Individual $10/mo ($100/yr), Pro $100/mo ($800/yr)
 *
 * NOTE: expo-in-app-purchases was deprecated in SDK 50.
 * Using mock implementation until expo-iap is configured.
 */

import { Platform } from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

// Mock InAppPurchases until expo-iap is properly configured
const InAppPurchases = {
  IAPResponseCode: {
    OK: 0,
    USER_CANCELED: 1,
    ERROR: 2,
  },
  connectAsync: async () => {},
  disconnectAsync: async () => {},
  getProductsAsync: async (_ids: string[]) => ({ results: [], responseCode: 0 }),
  purchaseItemAsync: async (_id: string) => ({ responseCode: 1, results: [], errorCode: null }),
  getPurchaseHistoryAsync: async () => ({ responseCode: 0, results: [] }),
  finishTransactionAsync: async (_purchase: any, _consume: boolean) => {},
  setPurchaseListener: (_callback: any) => {},
};

export interface SubscriptionProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  features: string[];
  isPopular?: boolean;
  billingPeriod: 'monthly' | 'yearly';
  effectiveMonthly?: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  productId: string | null;
  tier: 'free' | 'individual' | 'pro';
  expiresAt: Date | null;
  isTrialing?: boolean;
  trialEndsAt?: Date | null;
  willRenew: boolean;
  platform: 'ios' | 'android' | 'web';
}

export interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
  needsRestore?: boolean;
}

const logger = createLogger('subscriptionService');

/**
 * Stripe Price IDs for web fallback
 * Note: Native uses App Store/Play Store product IDs
 */
const STRIPE_PRICE_IDS = {
  individual_monthly: process.env.EXPO_PUBLIC_STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID || 'price_individual_monthly_10',
  individual_yearly: process.env.EXPO_PUBLIC_STRIPE_INDIVIDUAL_YEARLY_PRICE_ID || 'price_individual_yearly_100',
  pro_monthly: process.env.EXPO_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly_100',
  pro_yearly: process.env.EXPO_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly_800',
};

export const SUBSCRIPTION_PRODUCTS: Record<string, SubscriptionProduct> = {
  individual_monthly: {
    id: Platform.select({
      ios: 'regattaflow_individual_monthly',
      android: 'regattaflow_individual_monthly',
      default: STRIPE_PRICE_IDS.individual_monthly,
    }),
    title: 'Individual',
    description: 'AI-powered race preparation',
    price: '$10/month',
    priceAmountMicros: 10000000,
    priceCurrencyCode: 'USD',
    billingPeriod: 'monthly',
    isPopular: true,
    features: [
      'Unlimited races',
      '50,000 AI tokens per month',
      'AI strategy analysis',
      'Automatic weather updates',
      'Historical race data',
      'Offline mode',
      'Advanced analytics',
      'Cloud backup & sync',
    ],
  },
  individual_yearly: {
    id: Platform.select({
      ios: 'regattaflow_individual_yearly',
      android: 'regattaflow_individual_yearly',
      default: STRIPE_PRICE_IDS.individual_yearly,
    }),
    title: 'Individual',
    description: 'AI-powered race preparation',
    price: '$100/year',
    priceAmountMicros: 100000000,
    priceCurrencyCode: 'USD',
    billingPeriod: 'yearly',
    effectiveMonthly: '$8.33/mo',
    isPopular: true,
    features: [
      'Unlimited races',
      '50,000 AI tokens per month',
      'AI strategy analysis',
      'Automatic weather updates',
      'Historical race data',
      'Offline mode',
      'Advanced analytics',
      'Cloud backup & sync',
    ],
  },
  pro_monthly: {
    id: Platform.select({
      ios: 'regattaflow_pro_monthly',
      android: 'regattaflow_pro_monthly',
      default: STRIPE_PRICE_IDS.pro_monthly,
    }),
    title: 'Pro',
    description: 'Maximum AI power for serious racers',
    price: '$100/month',
    priceAmountMicros: 100000000,
    priceCurrencyCode: 'USD',
    billingPeriod: 'monthly',
    features: [
      'Everything in Individual',
      '500,000 AI tokens per month',
      'Priority AI processing',
      'Team sharing & collaboration',
      'Team analytics dashboard',
      'Priority support',
    ],
  },
  pro_yearly: {
    id: Platform.select({
      ios: 'regattaflow_pro_yearly',
      android: 'regattaflow_pro_yearly',
      default: STRIPE_PRICE_IDS.pro_yearly,
    }),
    title: 'Pro',
    description: 'Maximum AI power for serious racers',
    price: '$800/year',
    priceAmountMicros: 800000000,
    priceCurrencyCode: 'USD',
    billingPeriod: 'yearly',
    effectiveMonthly: '$66.67/mo',
    features: [
      'Everything in Individual',
      '500,000 AI tokens per month',
      'Priority AI processing',
      'Team sharing & collaboration',
      'Team analytics dashboard',
      'Priority support',
    ],
  },
};

/**
 * Subscription Service Class
 * Handles all subscription operations for the sailing platform
 */
export class SubscriptionService {
  private static instance: SubscriptionService;
  private isInitialized = false;
  private availableProducts: SubscriptionProduct[] = [];
  private currentStatus: SubscriptionStatus | null = null;

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Initialize subscription service
   * Sets up in-app purchases and loads available products
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      // Connect to app store
      await InAppPurchases.connectAsync();

      // Load available products
      await this.loadProducts();

      // Set up purchase listener
      this.setupPurchaseListener();

      this.isInitialized = true;

    } catch (error) {

      throw new Error('Failed to initialize subscription service');
    }
  }

  /**
   * Load available subscription products from app stores
   */
  private async loadProducts(): Promise<void> {
    try {
      const productIds = Object.values(SUBSCRIPTION_PRODUCTS).map(p => p.id);
      const { results, responseCode } = await InAppPurchases.getProductsAsync(productIds);

      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        this.availableProducts = results.map(product => {
          const configProduct = Object.values(SUBSCRIPTION_PRODUCTS).find(
            p => p.id === product.productId
          );

          return {
            ...configProduct!,
            price: product.price,
            priceAmountMicros: product.priceAmountMicros,
            priceCurrencyCode: product.priceCurrencyCode,
          };
        });

      } else {
        throw new Error(`Failed to load products: ${responseCode}`);
      }
    } catch (error) {

      throw error;
    }
  }

  /**
   * Set up purchase event listener
   */
  private setupPurchaseListener(): void {
    InAppPurchases.setPurchaseListener(({ responseCode, results }) => {
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        results?.forEach(purchase => {
          this.handlePurchaseComplete(purchase);
        });
      } else {

      }
    });
  }

  /**
   * Handle completed purchase
   */
  private async handlePurchaseComplete(purchase: any): Promise<void> {
    try {

      // Verify purchase with backend
      await this.verifyPurchase(purchase);

      // Update local subscription status
      await this.refreshSubscriptionStatus();

      // Finish the transaction
      await InAppPurchases.finishTransactionAsync(purchase, true);

      showAlert(
        'Subscription Active',
        'Welcome to RegattaFlow! Your subscription is now active and all features are unlocked.'
      );
    } catch (error) {

      showAlert(
        'Purchase Error',
        'There was an issue processing your purchase. Please contact support if the problem persists.'
      );
    }
  }

  /**
   * Verify purchase with backend
   */
  private async verifyPurchase(purchase: any): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('verify-purchase', {
        body: {
          platform: Platform.OS,
          transactionId: purchase.transactionId,
          productId: purchase.productId,
          purchaseToken: purchase.purchaseToken,
          receipt: purchase.transactionReceipt,
        },
      });

      if (error) {
        throw error;
      }

    } catch (error) {

      throw error;
    }
  }

  /**
   * Get available subscription products
   */
  async getAvailableProducts(): Promise<SubscriptionProduct[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.availableProducts;
  }

  /**
   * Purchase a subscription product
   */
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const { responseCode, results, errorCode } = await InAppPurchases.purchaseItemAsync(productId);

      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        const purchase = results?.[0];
        return {
          success: true,
          productId: purchase?.productId,
          transactionId: purchase?.transactionId,
        };
      } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
        return {
          success: false,
          error: 'Purchase cancelled by user',
        };
      } else {
        return {
          success: false,
          error: `Purchase failed: ${errorCode || responseCode}`,
        };
      }
    } catch (error) {

      return {
        success: false,
        error: 'Purchase failed due to technical error',
      };
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<PurchaseResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        if (results && results.length > 0) {
          // Process restored purchases
          for (const purchase of results) {
            await this.verifyPurchase(purchase);
          }

          await this.refreshSubscriptionStatus();

          return {
            success: true,
          };
        } else {
          return {
            success: false,
            error: 'No previous purchases found',
          };
        }
      } else {
        return {
          success: false,
          error: 'Failed to restore purchases',
        };
      }
    } catch (error) {

      return {
        success: false,
        error: 'Failed to restore purchases',
      };
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      if (!this.currentStatus) {
        await this.refreshSubscriptionStatus();
      }
      return this.currentStatus!;
    } catch (error) {

      return this.getDefaultStatus();
    }
  }

  /**
   * Refresh subscription status from backend
   */
  async refreshSubscriptionStatus(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        this.currentStatus = this.getDefaultStatus();
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('subscription_status, subscription_tier')
        .eq('id', user.id)
        .single();

      if (error) {
        throw error;
      }

      // Normalize tier name (handle legacy values)
      let tier: 'free' | 'individual' | 'pro' = 'free';
      const rawTier = data.subscription_tier?.toLowerCase();
      if (rawTier === 'individual' || rawTier === 'basic') {
        tier = 'individual';
      } else if (rawTier === 'pro' || rawTier === 'team' || rawTier === 'championship') {
        tier = 'pro';
      }

      this.currentStatus = {
        isActive: data.subscription_status === 'active',
        productId: data.subscription_tier || null,
        tier,
        expiresAt: data.subscription_expires_at ? new Date(data.subscription_expires_at) : null,
        willRenew: data.subscription_status === 'active',
        platform: data.subscription_platform || Platform.OS,
      };

    } catch (error) {

      this.currentStatus = this.getDefaultStatus();
    }
  }

  /**
   * Get default subscription status for free users
   */
  private getDefaultStatus(): SubscriptionStatus {
    return {
      isActive: false,
      productId: null,
      tier: 'free',
      expiresAt: null,
      willRenew: false,
      platform: Platform.OS as 'ios' | 'android',
    };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<boolean> {
    try {
      // For mobile platforms, users need to cancel through App Store/Play Store
      const message = Platform.select({
        ios: 'To cancel your subscription, go to Settings > Apple ID > Subscriptions on your device.',
        android: 'To cancel your subscription, open the Google Play Store app and go to Subscriptions.',
        default: 'Subscription cancellation is handled through your app store.',
      });

      showConfirm(
        'Cancel Subscription',
        message,
        () => {
          // Open device settings (implementation depends on platform)
          logger.debug('Opening device subscription settings...');
        },
        { confirmText: 'Open Settings' }
      );

      return true;
    } catch (error) {

      return false;
    }
  }

  /**
   * Disconnect from app store
   */
  async disconnect(): Promise<void> {
    try {
      await InAppPurchases.disconnectAsync();
      this.isInitialized = false;

    } catch (error) {

    }
  }
}

// Export singleton instance
export const subscriptionService = SubscriptionService.getInstance();

export default subscriptionService;
