/**
 * Upgrade Prompt Component
 *
 * Shown when free users try to access premium features.
 * Contextual messaging based on the feature being accessed.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform as _Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { GatedFeature, SAILOR_TIERS } from '@/lib/subscriptions/sailorTiers';
import type { TierSource } from '@/hooks/useFeatureGate';

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  feature?: GatedFeature;
  context?: string;
  tierSource?: TierSource;
  orgName?: string;
}

interface FeatureContent {
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  benefits: string[];
}

const FEATURE_CONTENT: Record<GatedFeature | 'default', FeatureContent> = {
  unlimited_races: {
    title: 'Upgrade for Unlimited Content',
    message: 'You\'ve reached the free tier limit. Upgrade to Plus for unlimited interests and steps.',
    icon: 'rocket',
    benefits: [
      'Unlimited interests & steps',
      'Full progress history',
      'Cloud sync across devices',
      'Never lose your data',
    ],
  },
  ai_strategy: {
    title: 'AI Insights & Suggestions',
    message: 'Get AI-powered insights, suggestions, and progress analytics.',
    icon: 'analytics',
    benefits: [
      'AI insights & suggestions',
      'Smart recommendations',
      'Performance insights',
      'Progress analytics',
    ],
  },
  team_sharing: {
    title: 'Share with Your Team',
    message: 'Collaborate and share progress with your team.',
    icon: 'people',
    benefits: [
      'Share progress with others',
      'Team collaboration',
      'Task assignments',
      'Real-time updates',
    ],
  },
  weather_automation: {
    title: 'Automatic Updates',
    message: 'Get automatic updates and smart notifications.',
    icon: 'notifications',
    benefits: [
      'Automatic updates',
      'Smart notifications',
      'Progress tracking',
      'Timely reminders',
    ],
  },
  historical_data: {
    title: 'Access Full History',
    message: 'View your complete history and track performance over time.',
    icon: 'time',
    benefits: [
      'Full history',
      'Performance trends',
      'Statistics',
      'Progress tracking',
    ],
  },
  offline_mode: {
    title: 'Offline Access',
    message: 'Access your data even without an internet connection.',
    icon: 'cloud-offline',
    benefits: [
      'Offline access',
      'Auto-sync when online',
      'Never miss updates',
      'Always available',
    ],
  },
  advanced_analytics: {
    title: 'Advanced Analytics',
    message: 'Deep dive into your performance with advanced analytics.',
    icon: 'stats-chart',
    benefits: [
      'Performance analytics',
      'Detailed statistics',
      'Comparison tools',
      'Improvement insights',
    ],
  },
  default: {
    title: 'Upgrade to Plus',
    message: 'Unlock the full BetterAt experience with premium features.',
    icon: 'rocket',
    benefits: [
      'Unlimited interests & steps',
      'AI insights & suggestions',
      'Telegram assistant',
      'Full feature access',
    ],
  },
};

export default function UpgradePrompt({
  visible,
  onClose,
  feature,
  context: _context,
  tierSource,
  orgName,
}: UpgradePromptProps) {
  const content = FEATURE_CONTENT[feature || 'default'];
  const proTier = SAILOR_TIERS.pro;

  // If org-sponsored, show attribution instead of upgrade CTA
  const isOrgSponsored = tierSource === 'organization';

  const handleUpgrade = () => {
    onClose();
    router.push('/pricing?upgrade=pro');
  };

  const handleMaybeLater = () => {
    onClose();
  };

  // Org-sponsored users see a simple attribution modal
  if (isOrgSponsored) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <LinearGradient
          colors={['#0c4a6e', '#0369a1', '#0284c7']}
          style={styles.container}
        >
          <View style={styles.scrollContent}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#f8fafc" />
              </TouchableOpacity>

              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <Ionicons name="shield-checkmark" size={48} color="#22c55e" />
                </View>
              </View>

              <View style={styles.titleContainer}>
                <ThemedText style={styles.title}>Included with Your Membership</ThemedText>
                <ThemedText style={styles.description}>
                  Your access is provided by {orgName || 'your organization'}. You have full access to premium features at no additional cost.
                </ThemedText>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
                <Ionicons name="checkmark-circle" size={20} color="#0c4a6e" />
                <ThemedText style={styles.primaryButtonText}>Got It</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#0c4a6e', '#0369a1', '#0284c7']}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#f8fafc" />
            </TouchableOpacity>

            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name={content.icon} size={48} color="#fbbf24" />
              </View>
            </View>

            <View style={styles.titleContainer}>
              <ThemedText style={styles.title}>{content.title}</ThemedText>
              <ThemedText style={styles.description}>{content.message}</ThemedText>
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsSection}>
            <ThemedText style={styles.benefitsTitle}>What You'll Get</ThemedText>
            <View style={styles.benefitsList}>
              {content.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="checkmark" size={20} color="#22c55e" />
                  </View>
                  <ThemedText style={styles.benefitText}>{benefit}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/* Pro Card */}
          <View style={styles.proCard}>
            <View style={styles.proBadge}>
              <ThemedText style={styles.proBadgeText}>Most Popular</ThemedText>
            </View>

            <View style={styles.proCardContent}>
              <ThemedText style={styles.proCardTitle}>RegattaFlow Pro</ThemedText>
              <View style={styles.priceRow}>
                <ThemedText style={styles.proCardPrice}>{proTier.priceMonthly}</ThemedText>
                <ThemedText style={styles.proCardPeriod}>/month</ThemedText>
              </View>
              <ThemedText style={styles.proCardSubtext}>
                Billed annually at {proTier.priceYearly}/year
              </ThemedText>
            </View>

            <View style={styles.proFeatures}>
              {proTier.features.slice(0, 4).map((feat, index) => (
                <View key={index} style={styles.proFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#fbbf24" />
                  <ThemedText style={styles.proFeatureText}>{feat}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleUpgrade}>
              <Ionicons name="rocket" size={20} color="#0c4a6e" />
              <ThemedText style={styles.primaryButtonText}>Upgrade to Pro</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleMaybeLater}>
              <ThemedText style={styles.secondaryButtonText}>Maybe Later</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Trust Indicators */}
          <View style={styles.trustIndicators}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark" size={16} color="#22c55e" />
              <ThemedText style={styles.trustText}>Cancel anytime</ThemedText>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="card" size={16} color="#22c55e" />
              <ThemedText style={styles.trustText}>Secure payment</ThemedText>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="refresh" size={16} color="#22c55e" />
              <ThemedText style={styles.trustText}>30-day refund</ThemedText>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>
              Join thousands of sailors already using RegattaFlow Pro
            </ThemedText>
          </View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  iconCircle: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#e0f2fe',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },

  // Benefits
  benefitsSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 16,
    textAlign: 'center',
  },
  benefitsList: {
    gap: 14,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 16,
    color: '#e0f2fe',
    lineHeight: 24,
  },

  // Pro Card
  proCard: {
    marginHorizontal: 24,
    marginBottom: 28,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 2,
    borderColor: '#fbbf24',
    borderRadius: 16,
    padding: 20,
    position: 'relative',
  },
  proBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#fbbf24',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0c4a6e',
  },
  proCardContent: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  proCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  proCardPrice: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fbbf24',
  },
  proCardPeriod: {
    fontSize: 16,
    color: '#e0f2fe',
    marginLeft: 4,
  },
  proCardSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  proFeatures: {
    gap: 10,
  },
  proFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proFeatureText: {
    fontSize: 14,
    color: '#e0f2fe',
    flex: 1,
  },

  // Action Buttons
  actionButtons: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbbf24',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0c4a6e',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0f2fe',
  },

  // Trust Indicators
  trustIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  trustItem: {
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    fontSize: 12,
    color: '#bae6fd',
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#7dd3fc',
    textAlign: 'center',
    lineHeight: 20,
  },
});
