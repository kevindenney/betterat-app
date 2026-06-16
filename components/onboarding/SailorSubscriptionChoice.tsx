/**
 * SailorSubscriptionChoice
 * Beautiful subscription selection component for sailor onboarding
 * Offers Free, Sailor Pro (trial), and Championship tiers
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { useAuth } from '@/providers/AuthProvider';

interface SubscriptionPlan {
  id: 'free' | 'sailor_pro' | 'championship';
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  ctaText: string;
  ctaSubtext?: string;
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free Sailor',
    price: '$0',
    period: 'forever',
    description: 'Get started with basic race tracking',
    features: [
      'Basic race tracking',
      '3 document uploads',
      'Basic weather info',
      'Community access',
    ],
    ctaText: 'Continue Free',
    ctaSubtext: 'No credit card required',
  },
  {
    id: 'sailor_pro',
    name: 'Sailor Pro',
    price: '$9.99',
    period: '/month',
    description: 'Everything you need to race smarter',
    features: [
      'Unlimited race tracking',
      'Unlimited documents',
      'AI race analysis',
      'Global venue intelligence',
      'Offline mode & cloud backup',
      'Equipment optimization',
      'Performance analytics',
      'Priority support',
    ],
    highlighted: true,
    badge: 'MOST POPULAR',
    ctaText: 'Start 7-Day Free Trial',
    ctaSubtext: 'No credit card required',
  },
  {
    id: 'championship',
    name: 'Championship',
    price: '$24.99',
    period: '/month',
    description: 'For serious racers and campaigns',
    features: [
      'Everything in Sailor Pro',
      'Advanced AI simulation',
      'Weather ensemble forecasts',
      'Monte Carlo predictions',
      'Cross-venue analytics',
      'Cultural adaptation',
      'Championship tools',
      'Dedicated support',
    ],
    badge: 'ADVANCED',
    ctaText: 'Start 7-Day Free Trial',
  },
];

interface SailorSubscriptionChoiceProps {
  onComplete?: (selectedPlan: string) => void;
  showSkip?: boolean;
}

export function SailorSubscriptionChoice({ 
  onComplete,
  showSkip = true 
}: SailorSubscriptionChoiceProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>('sailor_pro');
  const [isProcessing, setIsProcessing] = useState(false);
  const { loading: subscriptionLoading } = useSubscription();
  const { updateUserProfile } = useAuth();

  const handleSelectPlan = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
      
      if (selectedPlan === 'free') {
        // Free plan - just update profile and continue
        await updateUserProfile({
          subscription_tier: 'free',
          subscription_status: 'active',
          onboarding_completed: true,
        });
        
        if (onComplete) {
          onComplete('free');
        } else {
          router.replace('/(tabs)/dashboard');
        }
      } else {
        // Paid plan - start trial
        // For now, we'll create a trial subscription without payment
        // In production, this would integrate with Stripe or in-app purchases
        
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);
        
        await updateUserProfile({
          subscription_tier: selectedPlan,
          subscription_status: 'trialing',
          trial_ends_at: trialEndDate.toISOString(),
          onboarding_completed: true,
        });
        
        showAlert(
          'Trial Started!',
          `You now have 7 days of full access to ${plan?.name}. Explore all premium features!`
        );
        if (onComplete) {
          onComplete(selectedPlan);
        } else {
          router.replace('/(tabs)/dashboard');
        }
      }
    } catch (error: any) {
      console.error('Error selecting plan:', error);
      showAlert('Error', error?.message || 'Failed to set up your subscription. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = async () => {
    try {
      await updateUserProfile({
        subscription_tier: 'free',
        subscription_status: 'active',
        onboarding_completed: true,
      });
      
      if (onComplete) {
        onComplete('free');
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch (error) {
      console.error('Error skipping subscription:', error);
      router.replace('/(tabs)/dashboard');
    }
  };

  const isLoading = isProcessing || subscriptionLoading;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>
          Unlock your full sailing potential with the right tools
        </Text>
      </View>

      {/* Plans */}
      <ScrollView 
        style={styles.plansContainer}
        contentContainerStyle={styles.plansContent}
        showsVerticalScrollIndicator={false}
      >
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          
          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                isSelected && styles.planCardSelected,
                plan.highlighted && styles.planCardHighlighted,
              ]}
              onPress={() => setSelectedPlan(plan.id)}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {plan.badge && (
                <View style={[
                  styles.badge,
                  plan.highlighted ? styles.badgeHighlighted : styles.badgeNormal
                ]}>
                  <Text style={[
                    styles.badgeText,
                    plan.highlighted && styles.badgeTextHighlighted
                  ]}>
                    {plan.badge}
                  </Text>
                </View>
              )}
              
              <View style={styles.planHeader}>
                <View style={styles.planTitleRow}>
                  <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                    {plan.name}
                  </Text>
                  {isSelected && (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedIndicatorText}>✓</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.priceRow}>
                  <Text style={[styles.price, isSelected && styles.priceSelected]}>
                    {plan.price}
                  </Text>
                  <Text style={[styles.period, isSelected && styles.periodSelected]}>
                    {plan.period}
                  </Text>
                </View>
                
                <Text style={[styles.planDescription, isSelected && styles.planDescriptionSelected]}>
                  {plan.description}
                </Text>
              </View>
              
              <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Text style={[styles.featureIcon, isSelected && styles.featureIconSelected]}>
                      ✓
                    </Text>
                    <Text style={[styles.featureText, isSelected && styles.featureTextSelected]}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[styles.ctaButton, isLoading && styles.ctaButtonDisabled]}
          onPress={handleSelectPlan}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.ctaButtonText}>
                {SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.ctaText}
              </Text>
              {SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.ctaSubtext && (
                <Text style={styles.ctaSubtext}>
                  {SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.ctaSubtext}
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>
        
        {showSkip && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={isLoading}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        )}
        
        <Text style={styles.disclaimer}>
          Cancel anytime. Trials automatically convert to paid subscriptions.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  
  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Plans
  plansContainer: {
    flex: 1,
  },
  plansContent: {
    padding: 16,
    paddingBottom: 24,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 20,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#EFF6FF',
  },
  planCardHighlighted: {
    borderColor: '#007AFF',
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 122, 255, 0.2)',
      } as any,
    }),
  },
  
  // Badge
  badge: {
    position: 'absolute',
    top: -1,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  badgeHighlighted: {
    backgroundColor: '#007AFF',
  },
  badgeNormal: {
    backgroundColor: '#64748B',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  badgeTextHighlighted: {
    color: '#FFFFFF',
  },
  
  // Plan Header
  planHeader: {
    marginBottom: 16,
  },
  planTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  planNameSelected: {
    color: '#1D4ED8',
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIndicatorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0F172A',
  },
  priceSelected: {
    color: '#1D4ED8',
  },
  period: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
  },
  periodSelected: {
    color: '#3B82F6',
  },
  planDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  planDescriptionSelected: {
    color: '#3B82F6',
  },
  
  // Features
  featuresContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  featureIcon: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '700',
    marginRight: 10,
    marginTop: 2,
  },
  featureIconSelected: {
    color: '#007AFF',
  },
  featureText: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
    lineHeight: 20,
  },
  featureTextSelected: {
    color: '#1E40AF',
  },
  
  // CTA
  ctaContainer: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  ctaButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  ctaSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  skipButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});

export default SailorSubscriptionChoice;

