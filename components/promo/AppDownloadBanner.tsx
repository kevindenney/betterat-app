/**
 * AppDownloadBanner - Promotional banner for app downloads
 *
 * Displays a compelling CTA to open or download BetterAt.
 * Designed for use in embedded web views or promotional contexts.
 *
 * Variants:
 * - default: Card-style banner with gradient background
 * - compact: Slim single-row banner for tight spaces
 * - floating: Bold promotional card with blue gradient
 * - sticky: Fixed bottom banner for embed views (positioned above tab bars)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_SHADOWS,
} from '@/lib/design-tokens-ios';

// App Store URLs. Use the web destination until public store listing URLs are
// configured by the caller via appStoreUrl or replaced with official listings.
const APP_STORE_URL = 'https://better.at';
const PLAY_STORE_URL = 'https://better.at';
const WEB_URL = 'https://better.at';

interface AppDownloadBannerProps {
  /** Headline text */
  headline?: string;
  /** Subheadline text */
  subheadline?: string;
  /** CTA button text */
  ctaText?: string;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
  /** Callback when banner is dismissed */
  onDismiss?: () => void;
  /** Callback when CTA is pressed */
  onPress?: () => void;
  /** Visual variant */
  variant?: 'default' | 'compact' | 'floating' | 'sticky';
  /** Custom app store URL override */
  appStoreUrl?: string;
  /** Bottom offset for sticky variant (to clear tab bars) */
  bottomOffset?: number;
}

export function AppDownloadBanner({
  headline = 'Get BetterAt',
  subheadline = 'Plan, do, reflect, and keep improving across your interests',
  ctaText = 'Open BetterAt',
  dismissible = true,
  onDismiss,
  onPress,
  variant = 'default',
  appStoreUrl,
  bottomOffset = 0,
}: AppDownloadBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const insets = useSafeAreaInsets();

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }

    // Default: open appropriate store or web
    const url = appStoreUrl || (Platform.OS === 'web' ? WEB_URL : Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL);
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open app store:', err);
    });
  }, [onPress, appStoreUrl]);

  if (!isVisible) {
    return null;
  }

  // Sticky variant - fixed bottom banner for embeds
  if (variant === 'sticky') {
    return (
      <View
        style={[
          styles.stickyContainer,
          {
            paddingBottom: Math.max(insets.bottom, bottomOffset),
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)', '#FFFFFF']}
          style={styles.stickyGradientFade}
        />
        <View style={styles.stickyContent}>
          {/* App Icon */}
          <View style={styles.stickyAppIcon}>
            <LinearGradient
              colors={[IOS_COLORS.systemBlue, '#0055DD']}
              style={styles.stickyIconGradient}
            >
              <Ionicons name="boat" size={20} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* Text */}
          <View style={styles.stickyTextContainer}>
            <Text style={styles.stickyHeadline} numberOfLines={1}>
              {headline}
            </Text>
            <Text style={styles.stickySubheadline} numberOfLines={1}>
              {subheadline}
            </Text>
          </View>

          {/* CTA Button */}
          <Pressable
            style={({ pressed }) => [
              styles.stickyButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handlePress}
          >
            <Text style={styles.stickyButtonText}>{ctaText}</Text>
          </Pressable>

          {/* Dismiss */}
          {dismissible && (
            <Pressable
              style={styles.stickyDismiss}
              onPress={handleDismiss}
              hitSlop={12}
            >
              <Ionicons name="close" size={18} color={IOS_COLORS.tertiaryLabel} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (variant === 'compact') {
    return (
      <View style={[styles.compactContainer, IOS_SHADOWS.sm]}>
        <View style={styles.compactContent}>
          <View style={styles.compactIconContainer}>
            <Ionicons name="boat" size={20} color={IOS_COLORS.systemBlue} />
          </View>
          <View style={styles.compactTextContainer}>
            <Text style={styles.compactHeadline} numberOfLines={1}>
              {headline}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.compactButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handlePress}
          >
            <Text style={styles.compactButtonText}>{ctaText}</Text>
          </Pressable>
          {dismissible && (
            <Pressable
              style={styles.compactDismiss}
              onPress={handleDismiss}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={IOS_COLORS.tertiaryLabel} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (variant === 'floating') {
    return (
      <View style={[styles.floatingContainer, IOS_SHADOWS.lg]}>
        <LinearGradient
          colors={['#0066CC', '#004499']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.floatingGradient}
        >
          {dismissible && (
            <Pressable
              style={styles.floatingDismiss}
              onPress={handleDismiss}
              hitSlop={12}
            >
              <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.7)" />
            </Pressable>
          )}

          <View style={styles.floatingIconContainer}>
            <View style={styles.floatingIconBg}>
              <Ionicons name="boat" size={28} color="#0066CC" />
            </View>
          </View>

          <Text style={styles.floatingHeadline}>{headline}</Text>
          <Text style={styles.floatingSubheadline}>{subheadline}</Text>

          <Pressable
            style={({ pressed }) => [
              styles.floatingButton,
              pressed && styles.floatingButtonPressed,
            ]}
            onPress={handlePress}
          >
            <Text style={styles.floatingButtonText}>{ctaText}</Text>
            <Ionicons name="arrow-forward" size={16} color="#0066CC" style={{ marginLeft: 6 }} />
          </Pressable>

          <View style={styles.storeIcons}>
            <Ionicons name="logo-apple" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.storeText}>iOS & Android</Text>
            <Ionicons name="logo-google-playstore" size={14} color="rgba(255,255,255,0.6)" />
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Default variant
  return (
    <View style={[styles.container, IOS_SHADOWS.md]}>
      <LinearGradient
        colors={['#F8FAFF', '#EEF4FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        {dismissible && (
          <Pressable
            style={styles.dismissButton}
            onPress={handleDismiss}
            hitSlop={12}
          >
            <Ionicons name="close" size={20} color={IOS_COLORS.tertiaryLabel} />
          </Pressable>
        )}

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={[IOS_COLORS.systemBlue, '#0055DD']}
              style={styles.iconGradient}
            >
              <Ionicons name="boat" size={24} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* Text content */}
          <View style={styles.textContainer}>
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.subheadline} numberOfLines={2}>
              {subheadline}
            </Text>
          </View>

          {/* CTA Button */}
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handlePress}
          >
            <Text style={styles.ctaText}>{ctaText}</Text>
          </Pressable>
        </View>

        {/* Bottom accent line */}
        <View style={styles.accentLine} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  // Default variant styles
  container: {
    marginHorizontal: IOS_SPACING.lg,
    marginVertical: IOS_SPACING.md,
    borderRadius: IOS_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  gradient: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.xl,
  },
  dismissButton: {
    position: 'absolute',
    top: IOS_SPACING.sm,
    right: IOS_SPACING.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: IOS_RADIUS.md,
    overflow: 'hidden',
  },
  iconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  headline: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  subheadline: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 16,
  },
  ctaButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm + 2,
    borderRadius: IOS_RADIUS.full,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  accentLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: IOS_COLORS.systemBlue,
  },

  // Compact variant styles
  compactContainer: {
    marginHorizontal: IOS_SPACING.md,
    marginVertical: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: IOS_RADIUS.md,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
  },
  compactIconContainer: {
    width: 32,
    height: 32,
    borderRadius: IOS_RADIUS.sm,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTextContainer: {
    flex: 1,
  },
  compactHeadline: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.label,
    fontWeight: '500',
  },
  compactButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.xs + 2,
    borderRadius: IOS_RADIUS.full,
  },
  compactButtonText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  compactDismiss: {
    padding: IOS_SPACING.xs,
  },

  // Floating variant styles
  floatingContainer: {
    marginHorizontal: IOS_SPACING.lg,
    marginVertical: IOS_SPACING.md,
    borderRadius: IOS_RADIUS.xl,
    overflow: 'hidden',
  },
  floatingGradient: {
    paddingHorizontal: IOS_SPACING.xl,
    paddingVertical: IOS_SPACING.xxl,
    alignItems: 'center',
  },
  floatingDismiss: {
    position: 'absolute',
    top: IOS_SPACING.md,
    right: IOS_SPACING.md,
    zIndex: 10,
  },
  floatingIconContainer: {
    marginBottom: IOS_SPACING.md,
  },
  floatingIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHeadline: {
    ...IOS_TYPOGRAPHY.title3,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: IOS_SPACING.xs,
  },
  floatingSubheadline: {
    ...IOS_TYPOGRAPHY.subhead,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginBottom: IOS_SPACING.lg,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: IOS_SPACING.xl,
    paddingVertical: IOS_SPACING.md,
    borderRadius: IOS_RADIUS.full,
    marginBottom: IOS_SPACING.md,
  },
  floatingButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  floatingButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#0066CC',
  },
  storeIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  storeText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: 'rgba(255, 255, 255, 0.6)',
  },

  // Sticky variant styles - fixed bottom banner for embeds
  stickyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    ...IOS_SHADOWS.md,
    // Ensure it's above content but below modals
    zIndex: 100,
  },
  stickyGradientFade: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    height: 20,
    pointerEvents: 'none',
  },
  stickyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm + 2,
    gap: IOS_SPACING.sm,
  },
  stickyAppIcon: {
    width: 36,
    height: 36,
    borderRadius: IOS_RADIUS.sm,
    overflow: 'hidden',
  },
  stickyIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyTextContainer: {
    flex: 1,
    gap: 1,
  },
  stickyHeadline: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  stickySubheadline: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  stickyButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: IOS_RADIUS.full,
    minWidth: 90,
    alignItems: 'center',
  },
  stickyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stickyDismiss: {
    padding: IOS_SPACING.xs,
    marginLeft: IOS_SPACING.xs,
  },
});

export default AppDownloadBanner;
