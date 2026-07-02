// Payment Service for Coach Marketplace
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { CoachingSession } from '../types/coach';
import { createLogger } from '@/lib/utils/logger';

export interface PaymentIntent {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
}

export interface PaymentResult {
  success: boolean;
  payment_intent_id?: string;
  error?: string;
}

const logger = createLogger('PaymentService.native');

const derivePlatformFee = (session: {
  platform_fee?: number | null;
  total_amount?: number | null;
  fee_amount?: number | null;
  coach_payout?: number | null;
}) => {
  if (typeof session.platform_fee === 'number' && !Number.isNaN(session.platform_fee)) {
    return session.platform_fee;
  }
  const total = typeof session.total_amount === 'number' && !Number.isNaN(session.total_amount)
    ? session.total_amount
    : (typeof session.fee_amount === 'number' && !Number.isNaN(session.fee_amount) ? session.fee_amount : 0);
  const payout = typeof session.coach_payout === 'number' && !Number.isNaN(session.coach_payout)
    ? session.coach_payout
    : Math.round(total * 0.85);
  const fee = total - payout;
  return fee > 0 ? fee : 0;
};

export class PaymentService {
  /**
   * Create payment intent for coaching session
   */
  static async createPaymentIntent(sessionId: string): Promise<PaymentIntent> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      // Call backend API to create payment intent
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          userId: session.user.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment intent');
      }

      const { clientSecret, paymentIntentId } = await response.json();

      return {
        client_secret: clientSecret,
        payment_intent_id: paymentIntentId,
        amount: 0, // Will be populated by backend
        currency: 'usd',
      };
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Process payment using Stripe Payment Sheet
   */
  static async processPayment(paymentIntent: PaymentIntent): Promise<PaymentResult> {
    try {
      // Web platform doesn't support Stripe React Native
      if (Platform.OS === 'web') {
        throw new Error('Payment processing not supported on web. Please use mobile app.');
      }

      // Dynamically import Stripe React Native for mobile only
      const { initPaymentSheet, presentPaymentSheet } = await import('@stripe/stripe-react-native');

      // Initialize the payment sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'BetterAt Coach Marketplace',
        paymentIntentClientSecret: paymentIntent.client_secret,
        appearance: {
          colors: {
            primary: '#0066CC',
            background: '#FFFFFF',
            componentBackground: '#F8F8F8',
            componentBorder: '#E0E0E0',
            componentDivider: '#F0F0F0',
            primaryText: '#1A1A1A',
            secondaryText: '#666666',
          },
        },
        defaultBillingDetails: {
          // These would come from user profile
        },
      });

      if (initError) {
        throw new Error(`Payment sheet initialization failed: ${initError.message}`);
      }

      // Present the payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          return { success: false, error: 'Payment cancelled by user' };
        }
        throw new Error(`Payment failed: ${presentError.message}`);
      }

      // Payment succeeded
      return {
        success: true,
        payment_intent_id: paymentIntent.payment_intent_id,
      };
    } catch (error) {
      logger.error('Error processing payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed',
      };
    }
  }

  /**
   * Confirm payment and update session status
   */
  static async confirmPayment(sessionId: string, paymentIntentId: string): Promise<void> {
    try {
      // Get session details
      const { data: session } = await supabase
        .from('coaching_sessions')
        .select(`
          *,
          coach:coach_profiles!coaching_sessions_coach_id_fkey (
            display_name,
            user_id,
            users!coach_profiles_user_id_fkey (
              email,
              full_name
            )
          ),
          sailor:users!coaching_sessions_sailor_id_fkey (
            email,
            full_name
          )
        `)
        .eq('id', sessionId)
        .single();

      // Update session with payment confirmation
      const { error } = await supabase
        .from('coaching_sessions')
        .update({
          payment_status: 'captured',
          stripe_payment_intent_id: paymentIntentId,
          status: 'confirmed',
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Send payment received notification to coach
      if (session?.coach?.users?.email) {
        const { emailService } = await import('./EmailService');
        await emailService.sendCoachNotification({
          coach_name: session.coach.users.full_name || session.coach.display_name || 'Coach',
          coach_email: session.coach.users.email,
          notification_type: 'payment_received',
          sailor_name: session.sailor?.full_name || 'Sailor',
          session_date: session.scheduled_at,
          amount: session.fee_amount || 0,
          currency: session.currency || 'USD',
        });
      }
    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  /**
   * Handle payment refunds (for cancellations)
   */
  static async processRefund(sessionId: string, refundAmount?: number): Promise<void> {
    try {
      const { data: session, error: fetchError } = await supabase
        .from('coaching_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (fetchError) throw fetchError;

      // Calculate refund amount based on cancellation policy
      const calculatedRefundAmount = refundAmount || this.calculateRefundAmount(session);

      if (calculatedRefundAmount === 0) {
        throw new Error('No refund available for this cancellation');
      }

      // In a real implementation, this would call Stripe to create a refund
      // For now, we'll simulate the refund
      await this.simulateRefund(session.stripe_payment_intent_id, calculatedRefundAmount);

      // Update session status
      const { error: updateError } = await supabase
        .from('coaching_sessions')
        .update({
          payment_status: 'refunded',
          status: 'cancelled',
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Calculate coach payouts (called after session completion)
   */
  static async processCoachPayout(sessionId: string): Promise<void> {
    try {
      const { data: session, error } = await supabase
        .from('coaching_sessions')
        .select(`
          *,
          coach_profiles!coaching_sessions_coach_id_fkey(*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      if (session.status !== 'completed') {
        throw new Error('Cannot process payout for incomplete session');
      }

      // Calculate payout amount (85% to coach, 15% platform fee)
      const payoutAmount = session.coach_payout;

      // In a real implementation, this would:
      // 1. Create Stripe Transfer to coach's connected account
      // 2. Update coach earnings tracking
      // 3. Create payout record for accounting
      // 4. Send payout notification to coach

      await this.simulateCoachPayout(session.coach_id, payoutAmount);

      // Update session to mark payout as processed
      const { error: updateError } = await supabase
        .from('coaching_sessions')
        .update({
          // Add payout_processed field to schema if needed
          // payout_processed: true,
          // payout_date: new Date().toISOString(),
        })
        .eq('id', sessionId);

      // Don't throw on update error as payout was successful
      if (updateError) {
        logger.error('Error updating payout status:', updateError);
      }
    } catch (error) {
      logger.error('Error processing coach payout:', error);
      throw error;
    }
  }

  /**
   * Get payment history for a user
   */
  static async getPaymentHistory(userId: string, role: 'student' | 'coach'): Promise<CoachingSession[]> {
    try {
      let query = supabase
        .from('coaching_sessions')
        .select(`
          *,
          coach_profiles!coaching_sessions_coach_id_fkey(first_name, last_name),
          student:auth.users!coaching_sessions_student_id_fkey(email)
        `)
        .in('payment_status', ['captured', 'refunded']);

      if (role === 'student') {
        query = query.eq('student_id', userId);
      } else {
        // For coaches, get sessions where they are the coach
        query = query.eq('coach_id', userId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching payment history:', error);
      throw error;
    }
  }

  /**
   * Get commission tracking data for platform analytics
   */
  static async getCommissionAnalytics(startDate: string, endDate: string) {
    try {
      const { data, error } = await supabase
        .from('coaching_sessions')
        .select(`
          id,
          total_amount,
          fee_amount,
          coach_payout,
          payment_status,
          created_at,
          coach_id
        `)
        .eq('payment_status', 'captured')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const sessions = (data || []).map(session => {
        const totalAmount = typeof session.total_amount === 'number' && !Number.isNaN(session.total_amount) ? session.total_amount : 0;
        const coachPayout = typeof session.coach_payout === 'number' && !Number.isNaN(session.coach_payout) ? session.coach_payout : 0;
        const platformFee = derivePlatformFee({
          ...session,
          total_amount: totalAmount,
          coach_payout: coachPayout,
        });

        return {
          ...session,
          total_amount: totalAmount,
          coach_payout: coachPayout,
          platform_fee: platformFee,
        };
      });

      // Calculate analytics
      const totalRevenue = sessions.reduce((sum, session) => sum + session.total_amount, 0);
      const totalCommissions = sessions.reduce((sum, session) => sum + session.platform_fee, 0);
      const totalPayouts = sessions.reduce((sum, session) => sum + session.coach_payout, 0);
      const sessionCount = sessions.length;
      const uniqueCoaches = new Set(sessions.map(session => session.coach_id)).size;

      return {
        totalRevenue,
        totalCommissions,
        totalPayouts,
        sessionCount,
        uniqueCoaches,
        averageSessionValue: sessionCount > 0 ? totalRevenue / sessionCount : 0,
        commissionRate: totalRevenue > 0 ? (totalCommissions / totalRevenue) * 100 : 0,
      };
    } catch (error) {
      logger.error('Error fetching commission analytics:', error);
      throw error;
    }
  }

  /**
   * Get coach earnings summary
   */
  static async getCoachEarnings(coachId: string, period: 'week' | 'month' | 'year') {
    try {
      const now = new Date();
      const startDate = new Date();

      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      const { data, error } = await supabase
        .from('coaching_sessions')
        .select('*')
        .eq('coach_id', coachId)
        .eq('payment_status', 'captured')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const totalEarnings = data.reduce((sum, session) => sum + session.coach_payout, 0);
      const sessionCount = data.length;
      const averageEarningsPerSession = sessionCount > 0 ? totalEarnings / sessionCount : 0;

      // Calculate pending payouts (completed sessions not yet paid out)
      const pendingPayouts = data
        .filter(session => session.status === 'completed' && !session.payout_processed)
        .reduce((sum, session) => sum + session.coach_payout, 0);

      return {
        totalEarnings,
        sessionCount,
        averageEarningsPerSession,
        pendingPayouts,
        period,
      };
    } catch (error) {
      logger.error('Error fetching coach earnings:', error);
      throw error;
    }
  }

  /**
   * Process bulk payouts for coaches
   */
  static async processBulkPayouts(coachPayouts: { coachId: string; amount: number; sessionIds: string[] }[]) {
    try {
      const results = [];

      for (const payout of coachPayouts) {
        try {
          // In production, this would create actual Stripe transfers
          await this.simulateCoachPayout(payout.coachId, payout.amount);

          // Mark sessions as paid out
          const { error } = await supabase
            .from('coaching_sessions')
            .update({
              payout_processed: true,
              payout_date: new Date().toISOString(),
            })
            .in('id', payout.sessionIds);

          if (error) throw error;

          results.push({
            coachId: payout.coachId,
            success: true,
            amount: payout.amount,
          });
        } catch (error) {
          logger.error(`Payout failed for coach ${payout.coachId}:`, error);
          results.push({
            coachId: payout.coachId,
            success: false,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error processing bulk payouts:', error);
      throw error;
    }
  }

  // Private helper methods

  private static async simulatePaymentIntentCreation(session: CoachingSession): Promise<PaymentIntent> {
    // In production, this would be a call to your backend
    // which would create a real Stripe Payment Intent
    return {
      client_secret: `pi_${Math.random().toString(36).substr(2, 9)}_secret_${Math.random().toString(36).substr(2, 9)}`,
      payment_intent_id: `pi_${Math.random().toString(36).substr(2, 9)}`,
      amount: session.total_amount,
      currency: session.currency.toLowerCase(),
    };
  }

  private static async simulateRefund(paymentIntentId: string, amount: number): Promise<void> {
    // In production, this would call Stripe API:
    // await stripe.refunds.create({
    //   payment_intent: paymentIntentId,
    //   amount: amount,
    // });
    logger.debug(`Simulated refund of ${amount} cents for payment ${paymentIntentId}`);
  }

  private static async simulateCoachPayout(coachId: string, amount: number): Promise<void> {
    // In production, this would call Stripe API:
    // await stripe.transfers.create({
    //   amount: amount,
    //   currency: 'usd',
    //   destination: coach.stripe_account_id,
    // });
    logger.debug(`Simulated payout of ${amount} cents to coach ${coachId}`);
  }

  private static calculateRefundAmount(session: CoachingSession): number {
    const sessionStart = new Date(session.scheduled_start);
    const now = new Date();
    const hoursUntilSession = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Cancellation policy:
    // - More than 24 hours: 100% refund
    // - 12-24 hours: 50% refund
    // - Less than 12 hours: No refund
    if (hoursUntilSession > 24) {
      return session.total_amount;
    } else if (hoursUntilSession > 12) {
      return Math.round(session.total_amount * 0.5);
    } else {
      return 0;
    }
  }
}

export default PaymentService;
