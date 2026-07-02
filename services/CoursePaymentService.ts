/**
 * Course Payment Service
 * Handles course purchases via Stripe
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { Platform } from 'react-native';

const logger = createLogger('CoursePaymentService');

/**
 * Racing Academy Stripe Price IDs
 * Created: 2026-01-02
 */
export const ACADEMY_STRIPE_PRICE_IDS = {
  singleModule: 'price_1Sl0mWBbfEeOhHXbcvQnBisj',  // $30/year
  bundle: 'price_1Sl0nTBbfEeOhHXbnk5Yh5AE',        // $75/year
};

/**
 * Racing Academy Module Pricing (annual)
 */
export const ACADEMY_MODULE_PRICING = {
  singleModule: {
    price: 3000, // $30.00 in cents
    priceFormatted: '$30',
    period: '/year',
    stripePriceId: ACADEMY_STRIPE_PRICE_IDS.singleModule,
  },
  allModulesBundle: {
    price: 7500, // $75.00 in cents
    priceFormatted: '$75',
    period: '/year',
    savings: 'Save $15',
    stripePriceId: ACADEMY_STRIPE_PRICE_IDS.bundle,
  },
};

export const ACADEMY_MODULES = [
  'starting-line-strategy',
  'wind-shift-tactics',
  'mark-rounding-mastery',
];

export interface CoursePaymentResult {
  success: boolean;
  url?: string;
  sessionId?: string;
  free?: boolean;
  error?: string;
}

export interface EnrollmentStatus {
  isEnrolled: boolean;
  enrollmentId?: string;
  accessType?: 'purchase' | 'subscription' | 'gift' | 'promo';
  enrolledAt?: Date;
  progress?: number;
}

export class CoursePaymentService {
  private readonly supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  
  /**
   * Check if user is enrolled in a course
   */
  async checkEnrollment(userId: string, courseId: string): Promise<EnrollmentStatus> {
    try {
      const { data, error } = await supabase
        .from('learning_enrollments')
        .select('id, access_type, enrolled_at, progress_percent')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .single();

      if (error || !data) {
        return { isEnrolled: false };
      }

      return {
        isEnrolled: true,
        enrollmentId: data.id,
        accessType: data.access_type,
        enrolledAt: new Date(data.enrolled_at),
        progress: data.progress_percent,
      };
    } catch (error) {
      logger.error('Failed to check enrollment:', error);
      return { isEnrolled: false };
    }
  }

  /**
   * Check if user has access to a course (enrolled OR has subscription)
   */
  async checkCourseAccess(userId: string, courseId: string): Promise<boolean> {
    try {
      // First check direct enrollment
      const enrollment = await this.checkEnrollment(userId, courseId);
      if (enrollment.isEnrolled) {
        return true;
      }

      // Check if user has an active subscription that grants course access
      const { data: user } = await supabase
        .from('users')
        .select('subscription_status, subscription_tier')
        .eq('id', userId)
        .single();

      if (user?.subscription_status === 'active') {
        // Get course to check if it requires subscription
        const { data: course } = await supabase
          .from('learning_courses')
          .select('requires_subscription, min_subscription_tier')
          .eq('id', courseId)
          .single();

        if (course?.requires_subscription) {
          // Check if user's tier is sufficient. 'individual' is the live name for
          // the entry paid tier ('basic' is its legacy alias) — without this
          // normalization it falls outside tierOrder (indexOf → -1) and every
          // 'individual' subscriber is denied, even for free-min courses.
          const normalizeTier = (t: string) => (t === 'individual' ? 'basic' : t);
          const tierOrder = ['free', 'basic', 'pro', 'team', 'enterprise'];
          const userTierIndex = tierOrder.indexOf(normalizeTier(user.subscription_tier || 'free'));
          const requiredTierIndex = tierOrder.indexOf(normalizeTier(course.min_subscription_tier || 'free'));

          return userTierIndex >= requiredTierIndex;
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to check course access:', error);
      return false;
    }
  }

  /**
   * Initiate course purchase checkout
   */
  async purchaseCourse(
    userId: string,
    courseId: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<CoursePaymentResult> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      // Default URLs based on platform
      const baseUrl = Platform.OS === 'web' 
        ? window.location.origin 
        : 'betterat://';
      
      const finalSuccessUrl = successUrl || `${baseUrl}/learn/${courseId}?purchase=success`;
      const finalCancelUrl = cancelUrl || `${baseUrl}/learn/${courseId}?purchase=cancelled`;

      logger.debug('Creating course checkout session', { userId, courseId });

      // Call the course-checkout edge function
      const { data, error } = await supabase.functions.invoke('course-checkout', {
        body: {
          courseId,
          userId,
          successUrl: finalSuccessUrl,
          cancelUrl: finalCancelUrl,
        },
      });

      if (error) {
        logger.error('Course checkout error:', error);
        return { success: false, error: error.message };
      }

      // Handle free course enrollment
      if (data.free) {
        return {
          success: true,
          free: true,
        };
      }

      // Return checkout URL for paid course
      if (data.url) {
        return {
          success: true,
          url: data.url,
          sessionId: data.sessionId,
        };
      }

      return { success: false, error: 'No checkout URL returned' };

    } catch (error: any) {
      logger.error('Purchase course error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify a purchase was successful (called after checkout redirect)
   */
  async verifyPurchase(sessionId: string, courseId: string): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return false;
      }

      // Check if enrollment was created
      const { data: enrollment } = await supabase
        .from('learning_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('stripe_checkout_session_id', sessionId)
        .single();

      if (enrollment) {
        return true;
      }

      // If not found by session ID, check by user ID (webhook might have used payment intent)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userEnrollment } = await supabase
          .from('learning_enrollments')
          .select('id')
          .eq('course_id', courseId)
          .eq('user_id', user.id)
          .single();

        return !!userEnrollment;
      }

      return false;
    } catch (error) {
      logger.error('Failed to verify purchase:', error);
      return false;
    }
  }

  /**
   * Get course pricing info
   */
  async getCoursePricing(courseId: string): Promise<{
    price: number | null;
    currency: string;
    isFree: boolean;
    requiresSubscription: boolean;
  }> {
    try {
      const { data: course } = await supabase
        .from('learning_courses')
        .select('price_cents, requires_subscription')
        .eq('id', courseId)
        .single();

      if (!course) {
        return {
          price: null,
          currency: 'usd',
          isFree: false,
          requiresSubscription: false,
        };
      }

      return {
        price: course.price_cents ? course.price_cents / 100 : null,
        currency: 'usd',
        isFree: !course.price_cents || course.price_cents === 0,
        requiresSubscription: course.requires_subscription || false,
      };
    } catch (error) {
      logger.error('Failed to get course pricing:', error);
      return {
        price: null,
        currency: 'usd',
        isFree: false,
        requiresSubscription: false,
      };
    }
  }

  /**
   * Apply promo code to get course access
   */
  async applyPromoCode(
    _userId: string,
    _courseId: string,
    _promoCode: string
  ): Promise<{ success: boolean; error?: string }> {
    // TODO: validate against a promo_codes table. Not yet implemented.
    return { success: false, error: 'Promo codes not yet implemented' };
  }
}

export const coursePaymentService = new CoursePaymentService();
