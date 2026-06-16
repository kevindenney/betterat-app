/**
 * Signup Prompt Modal
 *
 * Soft conversion nudge shown to guests after they've explored a sample.
 * Vocabulary-aware: pulls the active interest's noun for "Learning Event"
 * (Race / Project / Session / Workout / Clinical) so the copy never feels
 * sailing-flavored when the user picked Design or Knitting.
 *
 * Visual style matches the BetterAt welcome flow (cream background, blue
 * accent, Manrope) — NOT the old dark slate RegattaFlow look.
 */

import React from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useInterest } from '@/providers/InterestProvider';

export type SignupPromptFeature =
  | 'multiple_races'
  | 'ai_analysis'
  | 'cloud_sync'
  | 'post_race_results'
  | 'default';

interface SignupPromptModalProps {
  visible: boolean;
  onClose: () => void;
  feature?: SignupPromptFeature;
  title?: string;
  message?: string;
}

const ACCENT = '#007AFF';
const BRAND_DARK = '#0B1A33';
const CREAM = '#FAF8F5';

export default function SignupPromptModal({
  visible,
  onClose,
  feature = 'default',
  title,
  message,
}: SignupPromptModalProps) {
  const { vocab } = useVocabulary();
  const { currentInterest } = useInterest();

  // Pluralize the interest noun (Race → Races, Project → Projects, etc.)
  // The five vocab values all pluralize cleanly with a trailing "s".
  const eventSingular = vocab('Learning Event').toLowerCase();
  const eventPlural = `${eventSingular}s`;

  // Default content based on the feature being accessed.
  // All copy is interest-neutral or vocab-aware — never sailing-specific.
  const getFeatureContent = () => {
    switch (feature) {
      case 'multiple_races':
        return {
          title: `Save your ${eventPlural}`,
          message: `Create a free account to keep all your ${eventPlural} in one place and pick up where you left off.`,
          benefits: [
            `Unlimited ${eventPlural}`,
            'Sync across all your devices',
            'Never lose your progress',
            'Pick up where you left off',
          ],
          icon: 'sparkles' as const,
        };
      case 'ai_analysis':
        return {
          title: 'Unlock insights',
          message: `Get personalized suggestions and reflections on every ${eventSingular}.`,
          benefits: [
            'Personalized suggestions',
            'Reflection prompts that learn from you',
            'Progress insights over time',
            'A coach in your pocket',
          ],
          icon: 'sparkles' as const,
        };
      case 'cloud_sync':
        return {
          title: 'Sync your progress',
          message: 'Keep your work safe and accessible on every device you use.',
          benefits: [
            'Automatic cloud backup',
            'Access from any device',
            'Never lose your progress',
            'Seamless sync',
          ],
          icon: 'cloud' as const,
        };
      case 'post_race_results':
        return {
          title: 'See your full history',
          message: `Create an account to save and review every ${eventSingular} you've worked on.`,
          benefits: [
            `Full ${eventSingular} history`,
            'Track progress over time',
            `Compare ${eventPlural} side by side`,
            'Share with coaches and peers',
          ],
          icon: 'time' as const,
        };
      default:
        return {
          title: title || 'Save your progress',
          message:
            message ||
            `Sign up free to start your own ${eventPlural} and keep your progress.`,
          benefits: [
            `Unlimited ${eventPlural}`,
            'Sync across devices',
            'Cloud backup',
            'Personalized suggestions',
          ],
          icon: 'sparkles' as const,
        };
    }
  };

  const content = getFeatureContent();

  const handleSignUp = () => {
    onClose();
    const interestParam = currentInterest?.slug ? `?interest=${currentInterest.slug}` : '';
    router.push(`/(auth)/signup${interestParam}` as any);
  };

  const handleSignIn = () => {
    onClose();
    router.push('/(auth)/login');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={BRAND_DARK} />
            </Pressable>

            {/* Brand pill — consistent with welcome flow */}
            <View style={styles.brandPill}>
              <Image
                source={require('@/assets/images/brand-mark.png')}
                style={styles.brandPillMark}
                resizeMode="contain"
              />
              <ThemedText style={styles.brandPillText}>BetterAt</ThemedText>
            </View>

            <View style={styles.iconContainer}>
              <View style={styles.iconRing} />
              <View style={styles.iconCircle}>
                <Ionicons name={content.icon} size={42} color={ACCENT} />
              </View>
            </View>

            <View style={styles.titleContainer}>
              <ThemedText style={styles.title}>{content.title}</ThemedText>
              <ThemedText style={styles.description}>{content.message}</ThemedText>
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsSection}>
            <View style={styles.benefitsList}>
              {content.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="checkmark" size={18} color="#16A34A" />
                  </View>
                  <ThemedText style={styles.benefitText}>{benefit}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/* Trial Card — every signup gets 14 days of Pro free, then chooses
              Free / Plus / Pro. Don't undersell by saying "$0 forever". */}
          <View style={styles.freeCard}>
            <View style={styles.freeBadge}>
              <ThemedText style={styles.freeBadgeText}>14-DAY FREE TRIAL</ThemedText>
            </View>

            <View style={styles.freeCardContent}>
              <ThemedText style={styles.freeCardTitle}>Try Pro free</ThemedText>
              <ThemedText style={styles.freeCardPrice}>14 days</ThemedText>
              <ThemedText style={styles.freeCardSubtext}>
                No credit card required
              </ThemedText>
            </View>

            <View style={styles.tierRow}>
              <ThemedText style={styles.tierRowText}>
                Then keep <ThemedText style={styles.tierRowBold}>Free</ThemedText> ·{' '}
                <ThemedText style={styles.tierRowBold}>Plus $9/mo</ThemedText> ·{' '}
                <ThemedText style={styles.tierRowBold}>Pro $29/mo</ThemedText>
              </ThemedText>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              onPress={handleSignUp}
              accessibilityRole="button"
              accessibilityLabel="Start free trial"
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <ThemedText style={styles.primaryButtonText}>Start free trial</ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Continue as guest"
            >
              <ThemedText style={styles.secondaryButtonText}>Continue as guest</ThemedText>
            </Pressable>
          </View>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <ThemedText style={styles.signInText}>Already have an account? </ThemedText>
            <Pressable onPress={handleSignIn} hitSlop={12} accessibilityRole="link" accessibilityLabel="Log in to existing account">
              <ThemedText style={styles.signInLink}>Log in</ThemedText>
            </Pressable>
          </View>

          {/* Trust Indicators */}
          <View style={styles.trustIndicators}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark" size={14} color="#94A3B8" />
              <ThemedText style={styles.trustText}>Secure</ThemedText>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="lock-closed" size={14} color="#94A3B8" />
              <ThemedText style={styles.trustText}>Privacy first</ThemedText>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="flash" size={14} color="#94A3B8" />
              <ThemedText style={styles.trustText}>Instant setup</ThemedText>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>
              Your current progress will be saved to your account.
            </ThemedText>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    borderRadius: 8,
  },
  closeButtonPressed: {
    opacity: 0.55,
  },

  // Brand pill
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.10)',
  },
  brandPillMark: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  brandPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_DARK,
    letterSpacing: -0.1,
    marginRight: 4,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },

  // Hero icon
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    width: '100%',
    height: 110,
  },
  iconRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.12)',
  },
  iconCircle: {
    width: 76,
    height: 76,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: BRAND_DARK,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.4,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  description: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif' },
    }),
  },

  // Benefits
  benefitsSection: {
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    width: 26,
    height: 26,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    color: BRAND_DARK,
    lineHeight: 22,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Regular' },
      android: { fontFamily: 'Manrope-Regular' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif' },
    }),
  },

  // Free card
  freeCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.18)',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 4px 16px rgba(0, 122, 255, 0.08)' as any },
    }),
  },
  freeBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    left: 0,
    right: 0,
    marginHorizontal: 'auto',
    backgroundColor: '#16A34A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    width: 110,
    alignItems: 'center',
  },
  freeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  freeCardContent: {
    alignItems: 'center',
  },
  freeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_DARK,
    marginBottom: 4,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  freeCardPrice: {
    fontSize: 32,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 4,
    letterSpacing: -0.8,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  freeCardSubtext: {
    fontSize: 13,
    color: '#94A3B8',
  },
  tierRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(11, 26, 51, 0.10)',
    alignItems: 'center',
  },
  tierRowText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  tierRowBold: {
    color: BRAND_DARK,
    fontWeight: '600',
  },

  // Action buttons
  actionButtons: {
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 14,
    ...Platform.select({ web: { outlineStyle: 'none', cursor: 'pointer' } as any }),
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.32,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
      web: { boxShadow: '0 8px 16px rgba(0, 122, 255, 0.32)' as any },
    }),
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    ...Platform.select({
      ios: { fontFamily: 'Manrope-Bold' },
      android: { fontFamily: 'Manrope-Bold' },
      web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: '700' as const },
    }),
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    ...Platform.select({ web: { outlineStyle: 'none', cursor: 'pointer' } as any }),
  },
  secondaryButtonPressed: {
    opacity: 0.55,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },

  // Sign in
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signInText: {
    fontSize: 14,
    color: '#64748B',
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
  },

  // Trust indicators
  trustIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    fontSize: 12,
    color: '#94A3B8',
  },

  // Footer
  footer: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
});
