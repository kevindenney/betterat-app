import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { ChevronLeft, CreditCard, Lock, Shield, Check, Calendar, User, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { ClubSubscriptionService, CLUB_SUBSCRIPTION_PLANS } from '@/services/ClubSubscriptionService';
import { OnboardingProgress } from '@/components/onboarding';
import { useClubOnboardingState } from '@/hooks/useClubOnboardingState';

const ClubOnboardingPayment = () => {
  const router = useRouter();
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('US');
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'professional' | 'enterprise'>('professional');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  const plans = CLUB_SUBSCRIPTION_PLANS.filter((plan) =>
    plan.id === 'starter' || plan.id === 'professional' || plan.id === 'enterprise'
  );

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || '');
      }
    };
    getCurrentUser();
  }, []);

  const handleContinue = async () => {
    // Basic validation
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
      showAlert('Validation Error', 'Please enter a valid card number');
      return;
    }

    if (!cardName.trim()) {
      showAlert('Validation Error', 'Please enter the cardholder name');
      return;
    }

    if (!expiryDate || expiryDate.length < 5) {
      showAlert('Validation Error', 'Please enter a valid expiry date');
      return;
    }

    if (!cvv || cvv.length < 3) {
      showAlert('Validation Error', 'Please enter a valid CVV');
      return;
    }

    if (!billingAddress || !city || !zipCode) {
      showAlert('Validation Error', 'Please complete the billing address');
      return;
    }

    if (!userId) {
      showAlert('Error', 'User not authenticated');
      return;
    }

    setIsProcessing(true);

    try {
      // In production, you would:
      // 1. Create a Stripe PaymentMethod using Stripe SDK
      // 2. Pass the PaymentMethod ID to the backend
      // For now, we'll use a mock payment method ID

      const mockPaymentMethodId = 'pm_mock_' + Date.now();

      const result = await ClubSubscriptionService.createSubscription({
        userId,
        planId: selectedPlan,
        billingPeriod,
        paymentMethodId: mockPaymentMethodId,
        billingDetails: {
          name: cardName,
          email: userEmail,
          address: {
            line1: billingAddress,
            city,
            postal_code: zipCode,
            country,
          },
        },
      });

      if (result.success) {
        showAlert(
          'Payment Successful',
          `Your subscription to ${plans.find(p => p.id === selectedPlan)?.name} has been activated!`
        );
        // Navigate to payment confirmation screen
        router.push('/(auth)/club-onboarding-payment-confirmation');
      } else {
        showAlert('Payment Failed', result.error || 'Unable to process payment');
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = '';

    for (let i = 0; i < cleaned.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += cleaned[i];
    }

    return formatted.substring(0, 19);
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 3) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  const { updatePayment } = useClubOnboardingState();

  return (
    <View className="flex-1 bg-gray-50">
      {/* Progress Indicator */}
      <View className="px-4 pt-4 bg-white">
        <OnboardingProgress
          currentStep={1}
          totalSteps={3}
          stepLabels={['Payment', 'Verification', 'Complete']}
          color="#DC2626"
          showStepLabels={false}
        />
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
        <View className="items-center mb-6">
          <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-4">
            <CreditCard size={32} color="#2563EB" />
          </View>
          <Text className="text-gray-800 text-2xl font-bold text-center mb-2">Payment Setup</Text>
          <Text className="text-gray-600 text-center">Secure payment for your club subscription</Text>
        </View>

        {/* Plan Selection */}
        <View className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <Text className="text-gray-800 font-bold text-lg mb-3">Subscription Plan</Text>

          <View className="flex-row flex-wrap gap-3">
            {plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                className={`flex-1 min-w-[100px] border rounded-xl p-3 ${
                  selectedPlan === plan.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                } ${plan.popular ? 'relative' : ''}`}
                onPress={() => setSelectedPlan(plan.id as typeof selectedPlan)}
              >
                {plan.popular && (
                  <View className="absolute -top-2 -right-2 bg-blue-500 rounded-full px-2 py-1">
                    <Text className="text-white text-xs font-bold">POPULAR</Text>
                  </View>
                )}
                <Text className="font-bold text-gray-800">{plan.name}</Text>
                <Text className="text-blue-600 font-bold">{billingPeriod === 'monthly' ? plan.monthlyPriceFormatted : plan.annualPriceFormatted}</Text>
                <Text className="text-gray-500 text-xs">{billingPeriod === 'monthly' ? '/month' : '/year'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="mt-4">
            <Text className="text-gray-700 mb-2">Plan Details</Text>
            <View className="bg-blue-50 p-3 rounded-lg">
              {plans.find(p => p.id === selectedPlan)?.features.map((feature, index) => (
                <View key={index} className="flex-row items-center mb-1">
                  <Check size={14} color="#2563EB" className="mr-2" />
                  <Text className="text-gray-700 text-sm">{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Payment Information */}
        <View className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <Text className="text-gray-800 font-bold text-lg mb-3">Payment Information</Text>

          <View className="mb-4">
            <Text className="text-gray-700 mb-2">Card Number</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl bg-gray-50 p-4">
              <TextInput
                className="flex-1"
                placeholder="1234 5678 9012 3456"
                keyboardType="numeric"
                maxLength={19}
                value={cardNumber}
                onChangeText={(text) => setCardNumber(formatCardNumber(text))}
              />
              <CreditCard size={20} color="#6B7280" />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 mb-2">Cardholder Name</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl bg-gray-50 p-4">
              <TextInput
                className="flex-1"
                placeholder="John Smith"
                value={cardName}
                onChangeText={setCardName}
              />
              <User size={20} color="#6B7280" />
            </View>
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-gray-700 mb-2">Expiry Date</Text>
              <View className="flex-row items-center border border-gray-300 rounded-xl bg-gray-50 p-4">
                <TextInput
                  className="flex-1"
                  placeholder="MM/YY"
                  keyboardType="numeric"
                  maxLength={5}
                  value={expiryDate}
                  onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                />
                <Calendar size={20} color="#6B7280" />
              </View>
            </View>

            <View className="flex-1">
              <Text className="text-gray-700 mb-2">CVV</Text>
              <View className="flex-row items-center border border-gray-300 rounded-xl bg-gray-50 p-4">
                <TextInput
                  className="flex-1"
                  placeholder="123"
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  value={cvv}
                  onChangeText={setCvv}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Billing Address */}
        <View className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <Text className="text-gray-800 font-bold text-lg mb-3">Billing Address</Text>

          <View className="mb-4">
            <Text className="text-gray-700 mb-2">Address</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl bg-gray-50 p-4">
              <TextInput
                className="flex-1"
                placeholder="123 Club Street"
                value={billingAddress}
                onChangeText={setBillingAddress}
              />
              <MapPin size={20} color="#6B7280" />
            </View>
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-gray-700 mb-2">City</Text>
              <TextInput
                className="border border-gray-300 rounded-xl bg-gray-50 p-4"
                placeholder="Hong Kong"
                value={city}
                onChangeText={setCity}
              />
            </View>

            <View className="flex-1">
              <Text className="text-gray-700 mb-2">ZIP Code</Text>
              <TextInput
                className="border border-gray-300 rounded-xl bg-gray-50 p-4"
                placeholder="00000"
                keyboardType="numeric"
                value={zipCode}
                onChangeText={setZipCode}
              />
            </View>
          </View>
        </View>

        {/* Security Info */}
        <View className="bg-blue-50 rounded-2xl p-5 mb-6">
          <View className="flex-row items-center mb-2">
            <Shield size={20} color="#2563EB" className="mr-2" />
            <Text className="text-blue-800 font-bold">Secure Payment</Text>
          </View>
          <Text className="text-blue-700 text-sm">
            Your payment information is encrypted and securely processed. 
            We do not store your credit card details.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View className="px-4 pb-6">
        <TouchableOpacity
          className={`py-4 rounded-2xl items-center mb-4 shadow-md ${isProcessing ? 'bg-gray-400' : 'bg-blue-600'}`}
          onPress={handleContinue}
          disabled={isProcessing}
        >
          <Text className="text-white font-bold text-lg">
            {isProcessing
              ? 'Processing...'
              : `Pay ${billingPeriod === 'monthly' ? plans.find(p => p.id === selectedPlan)?.monthlyPriceFormatted : plans.find(p => p.id === selectedPlan)?.annualPriceFormatted} and Continue`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="py-3 items-center"
          onPress={() => router.back()}
          disabled={isProcessing}
        >
          <Text className="text-blue-600 font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ClubOnboardingPayment;
