import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle, XCircle } from 'lucide-react-native';
import { StripeConnectService } from '@/services/StripeConnectService';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export default function CoachOnboardingStripeCallback() {
  const router = useRouter();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your payment setup...');

  useEffect(() => {
    if (user) {
      handleCallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCallback = async () => {
    if (!user) {
      setStatus('error');
      setMessage('User not authenticated');
      setTimeout(() => router.replace('/(auth)/login'), 2000);
      return;
    }

    try {
      // Get the coach profile ID
      const { data: coachProfile, error: profileError } = await supabase
        .from('coach_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !coachProfile) {
        throw new Error('Failed to retrieve coach profile');
      }

      // Refresh the account status to get latest info from Stripe
      await StripeConnectService.refreshAccountStatus(coachProfile.id);

      // Check if the account is ready
      const status = await StripeConnectService.getConnectStatus(coachProfile.id);

      if (status.chargesEnabled && status.detailsSubmitted) {
        setStatus('success');
        setMessage('Payment setup complete! Redirecting...');

        // Update user record to mark onboarding complete
        await supabase
          .from('coach_profiles')
          .update({
            stripe_onboarding_complete: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', coachProfile.id);

        setTimeout(() => {
          router.replace('/(auth)/coach-onboarding-profile-preview');
        }, 2000);
      } else {
        setStatus('error');
        setMessage('Payment setup incomplete. Please complete all required steps.');
        setTimeout(() => {
          router.replace('/(auth)/coach-onboarding-profile-preview');
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error handling Stripe callback:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to verify payment setup');
      setTimeout(() => {
        router.replace('/(auth)/coach-onboarding-profile-preview');
      }, 3000);
    }
  };

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text className="text-gray-800 text-lg font-medium mt-4 text-center">
            {message}
          </Text>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle size={80} color="#10B981" />
          <Text className="text-gray-800 text-2xl font-bold mt-4 text-center">
            Success!
          </Text>
          <Text className="text-gray-600 text-base mt-2 text-center">
            {message}
          </Text>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={80} color="#EF4444" />
          <Text className="text-gray-800 text-2xl font-bold mt-4 text-center">
            Setup Incomplete
          </Text>
          <Text className="text-gray-600 text-base mt-2 text-center">
            {message}
          </Text>
        </>
      )}
    </View>
  );
}
