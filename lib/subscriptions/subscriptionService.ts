/**
 * Subscription Service (native)
 * Handles native in-app purchases and subscription lifecycle via RevenueCat.
 *
 * RevenueCat owns the StoreKit/Play Billing purchase flow, receipt validation,
 * and renewal lifecycle. A RevenueCat webhook keeps the `users` table in sync
 * (subscription_status / subscription_tier / subscription_expires_at /
 * subscription_platform), which is the entitlement source every consumer reads.
 * Purchase/restore also update local status optimistically from CustomerInfo so
 * the UI unlocks before the webhook round-trips.
 *
 * Web uses Stripe — see subscriptionService.web.ts.
 *
 * Pricing: Individual $9/mo ($90/yr), Pro $29/mo ($290/yr)
 */

import { NativeModules, Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

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
 * RevenueCat public SDK keys (safe to ship in the client).
 * Set per-platform in .env — these are NOT secrets.
 */
const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '',
  default: '',
}) as string;
const IS_EXPO_GO =
  (NativeModules as { ExponentConstants?: { appOwnership?: string } } | undefined)?.ExponentConstants
    ?.appOwnership === 'expo';

/**
 * RevenueCat entitlement identifiers (configured in the RevenueCat dashboard).
 * An active "pro" entitlement outranks "individual".
 */
const ENTITLEMENT_PRO = 'pro';
const ENTITLEMENT_INDIVIDUAL = 'individual';

/**
 * Stripe Price IDs for web fallback.
 * Native uses App Store / Play Store product IDs (see SUBSCRIPTION_PRODUCTS).
 */
const STRIPE_PRICE_IDS = {
  individual_monthly: process.env.EXPO_PUBLIC_STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID || 'price_individual_monthly_9',
  individual_yearly: process.env.EXPO_PUBLIC_STRIPE_INDIVIDUAL_YEARLY_PRICE_ID || 'price_individual_yearly_90',
  pro_monthly: process.env.EXPO_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly_29',
  pro_yearly: process.env.EXPO_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly_290',
};

export const SUBSCRIPTION_PRODUCTS: Record<string, SubscriptionProduct> = {
  individual_monthly: {
    id: Platform.select({
      ios: 'betterat_individual_monthly',
      android: 'betterat_individual_monthly',
      default: STRIPE_PRICE_IDS.individual_monthly,
    }) as string,
    title: 'Individual',
    description: 'AI-powered race preparation',
    price: '$9/month',
    priceAmountMicros: 9000000,
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
      ios: 'betterat_individual_yearly',
      android: 'betterat_individual_yearly',
      default: STRIPE_PRICE_IDS.individual_yearly,
    }) as string,
    title: 'Individual',
    description: 'AI-powered race preparation',
    price: '$90/year',
    priceAmountMicros: 90000000,
    priceCurrencyCode: 'USD',
    billingPeriod: 'yearly',
    effectiveMonthly: '$7.50/mo',
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
      ios: 'betterat_pro_monthly',
      android: 'betterat_pro_monthly',
      default: STRIPE_PRICE_IDS.pro_monthly,
    }) as string,
    title: 'Pro',
    description: 'Maximum AI power for serious racers',
    price: '$29/month',
    priceAmountMicros: 29000000,
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
      ios: 'betterat_pro_yearly',
      android: 'betterat_pro_yearly',
      default: STRIPE_PRICE_IDS.pro_yearly,
    }) as string,
    title: 'Pro',
    description: 'Maximum AI power for serious racers',
    price: '$290/year',
    priceAmountMicros: 290000000,
    priceCurrencyCode: 'USD',
    billingPeriod: 'yearly',
    effectiveMonthly: '$24.17/mo',
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

/** Map a RevenueCat product identifier to the SUBSCRIPTION_PRODUCTS config entry. */
function configProductForId(productId: string): SubscriptionProduct | undefined {
  return Object.values(SUBSCRIPTION_PRODUCTS).find((p) => p.id === productId);
}

/**
 * Subscription Service Class
 * Handles all subscription operations on native platforms.
 */
export class SubscriptionService {
  private static instance: SubscriptionService;
  private isConfigured = false;
  private availableProducts: SubscriptionProduct[] = [];
  private currentStatus: SubscriptionStatus | null = null;
  /** product identifier -> RevenueCat package, built from the current offering. */
  private packagesByProductId: Map<string, PurchasesPackage> = new Map();

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Configure RevenueCat and load offerings. Idempotent: safe to call on every
   * auth change — re-runs only logIn + product refresh after the first configure.
   */
  async initialize(): Promise<void> {
    try {
      if (IS_EXPO_GO) {
        logger.warn('RevenueCat native store unavailable in Expo Go; using config-only products');
        this.availableProducts = Object.values(SUBSCRIPTION_PRODUCTS);
        return;
      }

      if (!REVENUECAT_API_KEY) {
        logger.warn('RevenueCat API key missing; falling back to config-only products');
        this.availableProducts = Object.values(SUBSCRIPTION_PRODUCTS);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!this.isConfigured) {
        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
        Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: user?.id ?? null });
        Purchases.addCustomerInfoUpdateListener((info) => {
          this.currentStatus = this.statusFromCustomerInfo(info);
        });
        this.isConfigured = true;
      } else if (user?.id) {
        await Purchases.logIn(user.id);
      }

      await this.loadProducts();
    } catch (error) {
      logger.error('Failed to initialize subscription service', error);
      // Don't throw — the paywall should still render config prices.
      if (this.availableProducts.length === 0) {
        this.availableProducts = Object.values(SUBSCRIPTION_PRODUCTS);
      }
    }
  }

  /**
   * Load offerings from RevenueCat and merge live store prices over config.
   */
  private async loadProducts(): Promise<void> {
    try {
      const offerings = await Purchases.getOfferings();
      const offering: PurchasesOffering | null = offerings.current ?? null;

      this.packagesByProductId.clear();

      if (!offering || offering.availablePackages.length === 0) {
        logger.warn('No RevenueCat offering available; using config products');
        this.availableProducts = Object.values(SUBSCRIPTION_PRODUCTS);
        return;
      }

      const merged: SubscriptionProduct[] = [];
      for (const pkg of offering.availablePackages) {
        const productId = pkg.product.identifier;
        this.packagesByProductId.set(productId, pkg);

        const config = configProductForId(productId);
        if (!config) continue;

        merged.push({
          ...config,
          price: pkg.product.priceString,
          priceAmountMicros: Math.round(pkg.product.price * 1_000_000),
          priceCurrencyCode: pkg.product.currencyCode ?? config.priceCurrencyCode,
        });
      }

      this.availableProducts = merged.length > 0 ? merged : Object.values(SUBSCRIPTION_PRODUCTS);
    } catch (error) {
      logger.error('Failed to load products', error);
      this.availableProducts = Object.values(SUBSCRIPTION_PRODUCTS);
    }
  }

  /**
   * Map RevenueCat CustomerInfo entitlements to our SubscriptionStatus.
   */
  private statusFromCustomerInfo(info: CustomerInfo): SubscriptionStatus {
    const active = info.entitlements.active;
    const pro = active[ENTITLEMENT_PRO];
    const individual = active[ENTITLEMENT_INDIVIDUAL];
    const ent = pro ?? individual;

    if (!ent) {
      return this.getDefaultStatus();
    }

    return {
      isActive: true,
      productId: ent.productIdentifier,
      tier: pro ? 'pro' : 'individual',
      expiresAt: ent.expirationDate ? new Date(ent.expirationDate) : null,
      willRenew: ent.willRenew,
      isTrialing: ent.periodType === 'TRIAL',
      trialEndsAt:
        ent.periodType === 'TRIAL' && ent.expirationDate ? new Date(ent.expirationDate) : null,
      platform: (Platform.OS as 'ios' | 'android'),
    };
  }

  /**
   * Get available subscription products.
   */
  async getAvailableProducts(): Promise<SubscriptionProduct[]> {
    if (this.availableProducts.length === 0) {
      await this.initialize();
    }
    return this.availableProducts;
  }

  /**
   * Purchase a subscription product by its store product identifier.
   */
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    try {
      if (!this.isConfigured) {
        await this.initialize();
      }

      const pkg = this.packagesByProductId.get(productId);
      if (!pkg) {
        return { success: false, error: 'This plan is not available right now.' };
      }

      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);
      this.currentStatus = this.statusFromCustomerInfo(customerInfo);

      return {
        success: this.currentStatus.isActive,
        productId: productIdentifier,
        transactionId: customerInfo.originalAppUserId,
        error: this.currentStatus.isActive ? undefined : 'Purchase did not activate an entitlement.',
      };
    } catch (error) {
      const e = error as { userCancelled?: boolean; message?: string };
      if (e?.userCancelled) {
        return { success: false, error: 'Purchase cancelled by user' };
      }
      logger.error('Purchase failed', error);
      return { success: false, error: e?.message || 'Purchase failed due to technical error' };
    }
  }

  /**
   * Restore previous purchases.
   */
  async restorePurchases(): Promise<PurchaseResult> {
    try {
      if (!this.isConfigured) {
        await this.initialize();
      }

      const info = await Purchases.restorePurchases();
      this.currentStatus = this.statusFromCustomerInfo(info);

      if (this.currentStatus.isActive) {
        return { success: true, productId: this.currentStatus.productId ?? undefined };
      }
      return { success: false, error: 'No previous purchases found' };
    } catch (error) {
      logger.error('Failed to restore purchases', error);
      return { success: false, error: 'Failed to restore purchases' };
    }
  }

  /**
   * Get current subscription status.
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      if (!this.currentStatus) {
        await this.refreshSubscriptionStatus();
      }
      return this.currentStatus!;
    } catch (error) {
      logger.error('Failed to get subscription status', error);
      return this.getDefaultStatus();
    }
  }

  /**
   * Refresh subscription status. Reads the `users` table (kept current by the
   * RevenueCat webhook) as the source of truth, falling back to live
   * CustomerInfo when the SDK is configured.
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
        .select('subscription_status, subscription_tier, trial_ends_at')
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
        expiresAt: data.trial_ends_at ? new Date(data.trial_ends_at) : null,
        willRenew: data.subscription_status === 'active',
        platform: Platform.OS as 'ios' | 'android',
      };
    } catch (error) {
      logger.error('Failed to refresh subscription status', error);
      // Last-resort: ask RevenueCat directly if it's configured.
      if (this.isConfigured) {
        try {
          const info = await Purchases.getCustomerInfo();
          this.currentStatus = this.statusFromCustomerInfo(info);
          return;
        } catch {
          // fall through to default
        }
      }
      this.currentStatus = this.getDefaultStatus();
    }
  }

  /**
   * Get default subscription status for free users.
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
   * Cancel subscription. On native, cancellation happens in the OS store UI.
   */
  async cancelSubscription(): Promise<boolean> {
    try {
      const message = Platform.select({
        ios: 'To cancel your subscription, go to Settings > Apple ID > Subscriptions on your device.',
        android: 'To cancel your subscription, open the Google Play Store app and go to Subscriptions.',
        default: 'Subscription cancellation is handled through your app store.',
      });

      showConfirm(
        'Cancel Subscription',
        message,
        () => {
          logger.debug('Directing user to device subscription settings');
        },
        { confirmText: 'Open Settings' }
      );

      return true;
    } catch (error) {
      logger.error('cancelSubscription failed', error);
      return false;
    }
  }

  /**
   * No-op on RevenueCat (no persistent store connection to tear down).
   */
  async disconnect(): Promise<void> {
    // RevenueCat manages its own connection lifecycle.
  }
}

// Export singleton instance
export const subscriptionService = SubscriptionService.getInstance();

export default subscriptionService;
