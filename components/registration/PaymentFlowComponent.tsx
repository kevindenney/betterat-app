/**
 * Payment Flow Component
 * Handles Stripe payment for race entry fees
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Platform, Linking } from 'react-native';
import { VStack, HStack, Text, Button, Card, Spinner, Divider } from '@/components/ui';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react-native';
import { raceRegistrationService } from '@/services/RaceRegistrationService';
import { supabase } from '@/services/supabase';
import { useStripe } from '@stripe/stripe-react-native';
import { showAlert, showConfirm, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';

interface PaymentFlowProps {
  entryId: string;
  userId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

interface EntryPaymentInfo {
  entry_fee_amount: number;
  entry_fee_currency: string;
  payment_status: string;
  entry_number?: string;
  regatta: {
    event_name: string;
  };
}

export function PaymentFlowComponent({
  entryId,
  userId: _userId,
  onSuccess,
  onCancel,
}: PaymentFlowProps) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<EntryPaymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPaymentInfo = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('race_entries')
        .select(`
          entry_fee_amount,
          entry_fee_currency,
          payment_status,
          entry_number,
          regattas!regatta_id (
            event_name
          )
        `)
        .eq('id', entryId)
        .single();

      if (error) throw error;
      setPaymentInfo(data as any);
    } catch (error: any) {
      console.error('Failed to load payment info:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    void loadPaymentInfo();
  }, [loadPaymentInfo]);

  const handlePayment = async () => {
    try {
      setProcessing(true);
      setError(null);

      // Step 1: Create payment intent
      const intentResult = await raceRegistrationService.createPaymentIntent(entryId);

      if (!intentResult.success || !intentResult.clientSecret || !intentResult.paymentIntentId) {
        throw new Error(intentResult.error || 'Failed to create payment intent');
      }

      // Step 2: Show Stripe payment sheet (mobile) or show web message
      if (Platform.OS === 'web') {
        // For web, direct users to use mobile or contact organizer
        // In a production app, you would implement Stripe Checkout or Elements here
        showAlertWithButtons(
          'Payment Not Available on Web',
          'Please use the BetterAt mobile app to complete payment, or contact the race organizer for alternative payment methods.',
          [
            {
              text: 'Contact Support',
              onPress: () =>
                Linking.openURL(
                  `mailto:info@better.at?subject=${encodeURIComponent('Web Payment Support')}&body=${encodeURIComponent(`Entry: ${entryId}\nEvent: ${paymentInfo?.regatta?.event_name || 'Unknown'}\n\nI need help completing payment on web.`)}`
                ),
            },
            {
              text: 'Skip for Now',
              onPress: handleSkipPayment,
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
        setProcessing(false);
        return;
      }

      // For mobile: Initialize and present Stripe Payment Sheet
      try {
        // Initialize payment sheet
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'BetterAt',
          paymentIntentClientSecret: intentResult.clientSecret,
          returnURL: 'betterat://stripe-redirect',
          appearance: {
            colors: {
              primary: '#2563eb', // primary-600
              background: '#ffffff',
              componentBackground: '#f9fafb', // gray-50
              componentBorder: '#e5e7eb', // gray-200
              componentDivider: '#d1d5db', // gray-300
              primaryText: '#111827', // gray-900
              secondaryText: '#6b7280', // gray-500
              placeholderText: '#9ca3af', // gray-400
            },
          },
          defaultBillingDetails: {
            name: paymentInfo?.regatta?.event_name,
          },
        });

        if (initError) {
          console.error('Payment sheet init error:', initError);
          throw new Error(`Payment initialization failed: ${initError.message}`);
        }

        // Present payment sheet
        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          // User cancelled
          if (presentError.code === 'Canceled') {
            setError('Payment was cancelled');
            setProcessing(false);
            return;
          }
          // Other error
          console.error('Payment sheet present error:', presentError);
          throw new Error(`Payment failed: ${presentError.message}`);
        }

        // Step 3: Payment successful - confirm with backend
        const confirmResult = await raceRegistrationService.confirmPayment(
          entryId,
          intentResult.paymentIntentId
        );

        if (!confirmResult.success) {
          throw new Error(confirmResult.error || 'Failed to confirm payment');
        }

        // Payment successful
        showAlert(
          'Payment Successful',
          'Your race entry has been confirmed! You will receive a confirmation email shortly.'
        );
        onSuccess();
      } catch (stripeError: any) {
        console.error('Stripe payment error:', stripeError);
        throw new Error(stripeError.message || 'Payment processing failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setError(error.message || 'Payment processing failed');
      showAlert('Payment Error', error.message || 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleSkipPayment = async () => {
    showConfirm(
      'Skip Payment',
      'You can pay later, but your entry will remain in "Pending Payment" status until payment is received.',
      () => {
        onSuccess();
      }
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Spinner size="large" />
      </View>
    );
  }

  if (!paymentInfo) {
    return (
      <View style={{ padding: 20 }}>
        <Text color="$error600">Failed to load payment information</Text>
      </View>
    );
  }

  const isFree = paymentInfo.entry_fee_amount === 0;
  const isPaid = paymentInfo.payment_status === 'paid';

  if (isPaid) {
    return (
      <Card backgroundColor="$success50" margin="$4">
        <VStack space="md" padding="$4" alignItems="center">
          <CheckCircle size={48} color="#059669" />
          <Text size="xl" weight="bold" color="$success900">
            Payment Confirmed
          </Text>
          <Text textAlign="center" color="$success800">
            Your race entry has been confirmed and payment received.
          </Text>
          {paymentInfo.entry_number && (
            <Card backgroundColor="white" padding="$3">
              <Text size="sm" color="$gray600">
                Entry Number
              </Text>
              <Text size="lg" weight="bold">
                {paymentInfo.entry_number}
              </Text>
            </Card>
          )}
          <Button onPress={onSuccess} width="100%">
            <Text color="white">Continue</Text>
          </Button>
        </VStack>
      </Card>
    );
  }

  if (isFree) {
    return (
      <Card backgroundColor="$blue50" margin="$4">
        <VStack space="md" padding="$4" alignItems="center">
          <CheckCircle size={48} color="#2563eb" />
          <Text size="xl" weight="bold" color="$blue900">
            No Payment Required
          </Text>
          <Text textAlign="center" color="$blue800">
            This event has no entry fee. Your registration is complete!
          </Text>
          <Button onPress={onSuccess} width="100%">
            <Text color="white">Continue</Text>
          </Button>
        </VStack>
      </Card>
    );
  }

  return (
    <VStack space="lg" padding="$4">
      {/* Payment Summary */}
      <Card>
        <VStack space="md" padding="$4">
          <Text size="xl" weight="bold">
            Payment Summary
          </Text>
          <Divider />
          <HStack justifyContent="space-between">
            <Text color="$gray600">Event</Text>
            <Text weight="semibold">{paymentInfo.regatta?.event_name}</Text>
          </HStack>
          <HStack justifyContent="space-between">
            <Text color="$gray600">Entry Fee</Text>
            <Text weight="semibold">
              {paymentInfo.entry_fee_currency} {paymentInfo.entry_fee_amount.toFixed(2)}
            </Text>
          </HStack>
          <Divider />
          <HStack justifyContent="space-between" alignItems="center">
            <Text size="lg" weight="bold">
              Total Due
            </Text>
            <Text size="xl" weight="bold" color="$primary600">
              {paymentInfo.entry_fee_currency} {paymentInfo.entry_fee_amount.toFixed(2)}
            </Text>
          </HStack>
        </VStack>
      </Card>

      {/* Error Display */}
      {error && (
        <Card backgroundColor="$error50">
          <HStack space="sm" padding="$4" alignItems="center">
            <AlertCircle size={20} color="#dc2626" />
            <Text color="$error600" flex={1}>
              {error}
            </Text>
          </HStack>
        </Card>
      )}

      {/* Payment Info */}
      <Card backgroundColor="$gray50">
        <VStack space="sm" padding="$4">
          <Text size="sm" weight="semibold">
            Secure Payment via Stripe
          </Text>
          <Text size="xs" color="$gray600">
            • Your payment information is encrypted and secure
          </Text>
          <Text size="xs" color="$gray600">
            • You will receive a confirmation email after payment
          </Text>
          <Text size="xs" color="$gray600">
            • Refund policy applies as per event terms
          </Text>
        </VStack>
      </Card>

      {/* Payment Button */}
      <VStack space="md">
        <Button
          onPress={handlePayment}
          isDisabled={processing}
          size="lg"
        >
          {processing ? (
            <Spinner color="white" />
          ) : (
            <HStack space="sm" alignItems="center">
              <CreditCard size={20} color="white" />
              <Text color="white" weight="semibold">
                Pay {paymentInfo.entry_fee_currency} {paymentInfo.entry_fee_amount.toFixed(2)}
              </Text>
            </HStack>
          )}
        </Button>

        <Button
          variant="outline"
          onPress={handleSkipPayment}
          isDisabled={processing}
        >
          <Text>Pay Later</Text>
        </Button>

        {onCancel && (
          <Button
            variant="ghost"
            onPress={onCancel}
            isDisabled={processing}
          >
            <Text>Cancel</Text>
          </Button>
        )}
      </VStack>

      {/* Payment Methods Info */}
      <Card backgroundColor="$blue50">
        <VStack space="xs" padding="$4">
          <Text size="xs" weight="semibold" color="$blue900">
            Accepted Payment Methods
          </Text>
          <Text size="xs" color="$blue800">
            Visa, Mastercard, American Express, and more
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
}
