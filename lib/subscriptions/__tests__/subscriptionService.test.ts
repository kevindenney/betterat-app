/* eslint-disable import/first, @typescript-eslint/no-require-imports */
// Mock react-native Platform before any imports
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (opts: any) => opts.ios ?? opts.default },
  Alert: { alert: jest.fn() },
}));

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
    functions: { invoke: jest.fn() },
  },
}));
jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  LOG_LEVEL: { WARN: 'WARN' },
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    logIn: jest.fn(),
    getOfferings: jest.fn().mockResolvedValue({ current: null, all: {} }),
    getCustomerInfo: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

import { supabase } from '@/services/supabase';
import { mockSupabaseResponse } from '../../../test/helpers/supabaseMock';

const fromMock = supabase.from as jest.Mock;
const getUserMock = supabase.auth.getUser as jest.Mock;

function chainBuilder(result: { data: any; error: any }) {
  const b: Record<string, any> = {};
  const chain = ['select', 'eq', 'order', 'limit', 'range', 'filter'];
  for (const m of chain) b[m] = jest.fn().mockReturnValue(b);
  b.single = jest.fn().mockResolvedValue(result);
  b.maybeSingle = jest.fn().mockResolvedValue(result);
  b.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return b;
}

describe('subscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton's internal state between tests
    // We need a fresh require for each test since the module caches state
  });

  describe('refreshSubscriptionStatus — tier normalization', () => {
    it.each([
      ['basic', 'individual'],
      ['individual', 'individual'],
      ['team', 'pro'],
      ['championship', 'pro'],
      ['pro', 'pro'],
      [null, 'free'],
      ['unknown_tier', 'free'],
    ])('normalizes "%s" to "%s"', async (rawTier, expectedTier) => {
      getUserMock.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      const builder = chainBuilder(
        mockSupabaseResponse({
          subscription_status: rawTier ? 'active' : null,
          subscription_tier: rawTier,
          subscription_expires_at: '2026-12-31T00:00:00Z',
          subscription_platform: 'ios',
        }),
      );
      fromMock.mockReturnValue(builder);

      // Use a fresh instance to avoid state leaking between tests
      const { SubscriptionService } = require('../subscriptionService');
      const instance = new SubscriptionService();

      await instance.refreshSubscriptionStatus();
      const status = await instance.getSubscriptionStatus();

      expect(status.tier).toBe(expectedTier);
    });

    it('defaults to free status when no user is authenticated', async () => {
      getUserMock.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { SubscriptionService } = require('../subscriptionService');
      const instance = new SubscriptionService();

      await instance.refreshSubscriptionStatus();
      const status = await instance.getSubscriptionStatus();

      expect(status.tier).toBe('free');
      expect(status.isActive).toBe(false);
    });
  });

  describe('purchaseProduct — package resolution', () => {
    it('fails gracefully when the product has no RevenueCat package', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

      const { SubscriptionService } = require('../subscriptionService');
      const instance = new SubscriptionService();

      // No API key in test env → SDK stays unconfigured and offerings are empty,
      // so no package maps to this product id.
      const result = await instance.purchaseProduct('betterat_individual_monthly');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not available/i);
    });

    it('surfaces a user cancellation from the SDK', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

      const Purchases = require('react-native-purchases').default;
      const pkg = { product: { identifier: 'betterat_pro_monthly' } };
      Purchases.purchasePackage.mockRejectedValueOnce({ userCancelled: true });

      const { SubscriptionService } = require('../subscriptionService');
      const instance = new SubscriptionService();
      // Seed the internal package map so purchase reaches the SDK call.
      (instance as any).isConfigured = true;
      (instance as any).packagesByProductId.set('betterat_pro_monthly', pkg);

      const result = await instance.purchaseProduct('betterat_pro_monthly');

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });
});
