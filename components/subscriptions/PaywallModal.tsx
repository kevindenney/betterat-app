/**
 * Paywall Modal Component
 * Marine-grade subscription paywall for premium sailing features
 * Contextual upgrade prompts with professional design
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { router } from 'expo-router';

import type { TierSource } from '@/hooks/useFeatureGate';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  feature?: string;
  title?: string;
  description?: string;
  benefits?: string[];
  tierSource?: TierSource;
  orgName?: string;
}

export default function PaywallModal({
  visible,
  onClose,
  feature,
  title,
  description,
  benefits,
  tierSource,
  orgName,
}: PaywallModalProps) {
  const [purchasing, setPurchasing] = useState(false);
  const { popularProduct, purchaseProduct } = useSubscription();

  // Org-sponsored users see attribution instead of paywall
  if (tierSource === 'organization') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#334155']}
          style={styles.container}
        >
          <View style={styles.scrollContent}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#f8fafc" />
              </TouchableOpacity>
              <View style={styles.titleContainer}>
                <ThemedText style={styles.title}>Included with Your Membership</ThemedText>
                <ThemedText style={styles.description}>
                  Your premium access is provided by {orgName || 'your organization'}. No additional payment needed.
                </ThemedText>
              </View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                <ThemedText style={styles.primaryButtonText}>Got It</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    );
  }

  // Default content based on feature
  const getFeatureContent = () => {
    switch (feature) {
      case 'ai_race_analysis':
        return {
          title: '🧠 Race Strategy',
          description: 'Tactical recommendations and Monte Carlo race simulations',
          benefits: [
            'Tactical recommendations during races',
            'Monte Carlo simulation with 1000+ scenarios',
            'Optimal course routing based on conditions',
            'Equipment setup optimization',
            'Performance prediction and analysis',
          ],
        };
      case 'global_venue_intelligence':
        return {
          title: '🌍 Global Venue Intelligence',
          description: 'Access intelligence for 147+ sailing venues worldwide',
          benefits: [
            'Venue-specific tactical knowledge',
            'Local weather and condition patterns',
            'Cultural adaptation and protocols',
            'Historical racing data and insights',
            'Equipment recommendations by venue',
          ],
        };
      case 'offline_capabilities':
        return {
          title: '📱 Offline Racing Mode',
          description: 'Full functionality without internet connection',
          benefits: [
            'Download race strategies for offline use',
            'Cached weather and venue data',
            'GPS tracking without connectivity',
            'Sync when connection restored',
            'Emergency-grade reliability',
          ],
        };
      case 'performance_analytics':
        return {
          title: '📊 Performance Analytics',
          description: 'Track your racing improvement with detailed analytics',
          benefits: [
            'Cross-venue performance comparison',
            'Long-term trend analysis',
            'Equipment correlation insights',
            'Goal tracking and progress reports',
            'Export data for coaching sessions',
          ],
        };
      default:
        return {
          title: title || '⭐ Premium Features',
          description: description || 'Unlock the full potential of RegattaFlow',
          benefits: benefits || [
            'Unlimited race tracking and strategy',
            'Global venue intelligence',
            'Race analysis',
            'Offline capabilities',
            'Performance analytics',
          ],
        };
    }
  };

  const content = getFeatureContent();

  const handlePurchase = async () => {
    if (!popularProduct) return;

    try {
      setPurchasing(true);
      const result = await purchaseProduct(popularProduct.id);

      if (result.success) {
        onClose();
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setPurchasing(false);
    }
  };

  const handleViewAllPlans = () => {
    onClose();
    router.push('/legacy');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#334155']}
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

            <View style={styles.titleContainer}>
              <ThemedText style={styles.title}>{content.title}</ThemedText>
              <ThemedText style={styles.description}>{content.description}</ThemedText>
            </View>
          </View>

          {/* Feature Preview */}
          <View style={styles.previewContainer}>
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons name="lock-closed" size={32} color="#f59e0b" />
                <ThemedText style={styles.previewTitle}>Premium Feature</ThemedText>
              </View>
              <ThemedText style={styles.previewText}>
                This feature requires a RegattaFlow Pro subscription to unlock the full potential
                of professional sailing strategy and analysis.
              </ThemedText>
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

          {/* Popular Plan Card */}
          {popularProduct && (
            <View style={styles.planCard}>
              <View style={styles.popularBadge}>
                <ThemedText style={styles.popularBadgeText}>Most Popular</ThemedText>
              </View>

              <View style={styles.planHeader}>
                <ThemedText style={styles.planTitle}>{popularProduct.title}</ThemedText>
                <ThemedText style={styles.planPrice}>{popularProduct.price}</ThemedText>
                {popularProduct.trialPeriod && (
                  <ThemedText style={styles.trialText}>
                    {popularProduct.trialPeriod}-day free trial
                  </ThemedText>
                )}
              </View>

              <View style={styles.planFeatures}>
                {popularProduct.features.slice(0, 4).map((feature, index) => (
                  <View key={index} style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#0ea5e9" />
                    <ThemedText style={styles.planFeatureText}>{feature}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handlePurchase}
              disabled={purchasing || !popularProduct}
            >
              {purchasing ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Ionicons name="rocket" size={20} color="#ffffff" />
                  <ThemedText style={styles.primaryButtonText}>
                    Start {popularProduct?.trialPeriod || 7}-Day Trial
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleViewAllPlans}
            >
              <ThemedText style={styles.secondaryButtonText}>
                View All Plans
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Trust Indicators */}
          <View style={styles.trustIndicators}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark" size={16} color="#22c55e" />
              <ThemedText style={styles.trustText}>Cancel anytime</ThemedText>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="refresh" size={16} color="#22c55e" />
              <ThemedText style={styles.trustText}>30-day money back</ThemedText>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="people" size={16} color="#22c55e" />
              <ThemedText style={styles.trustText}>10,000+ sailors</ThemedText>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>
              Join thousands of sailors who've improved their racing with RegattaFlow Pro
            </ThemedText>
          </View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const { width: _width } = Dimensions.get('window');

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
    paddingBottom: 32,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 16,
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
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },

  // Preview
  previewContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  previewCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  previewHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f59e0b',
    marginTop: 8,
  },
  previewText: {
    fontSize: 16,
    color: '#e2e8f0',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Benefits
  benefitsSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  benefitsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 20,
    textAlign: 'center',
  },
  benefitsList: {
    gap: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 16,
    color: '#e2e8f0',
    lineHeight: 24,
  },

  // Plan Card
  planCard: {
    marginHorizontal: 24,
    marginBottom: 32,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderWidth: 2,
    borderColor: '#0ea5e9',
    borderRadius: 16,
    padding: 24,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#0ea5e9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  planTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0ea5e9',
    marginBottom: 4,
  },
  trialText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  planFeatures: {
    gap: 12,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    fontSize: 14,
    color: '#e2e8f0',
    flex: 1,
  },

  // Action Buttons
  actionButtons: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    boxShadow: '0px 4px',
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0ea5e9',
  },

  // Trust Indicators
  trustIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  trustItem: {
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
