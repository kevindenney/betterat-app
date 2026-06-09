// @ts-nocheck

import { useAuth } from '@/providers/AuthProvider';
import { useWebDrawer } from '@/providers/WebDrawerProvider';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TufteTokens } from '@/constants/designSystem';
import { NavigationDrawer, getCurrentSectionName } from './NavigationDrawer';
import { TUFTE_BACKGROUND } from '@/components/cards/constants';
import { InterestSwitcher } from '@/components/InterestSwitcher';
import { useVocabulary } from '@/hooks/useVocabulary';

interface NavigationHeaderProps {
  backgroundColor?: string;
  borderBottom?: boolean;
  hidden?: boolean;
  /** Show hamburger menu and drawer navigation (Tufte mode) */
  showDrawer?: boolean;
}

export function NavigationHeader({
  backgroundColor = '#FFFFFF',
  borderBottom = true,
  hidden = false,
  showDrawer = true, // Default to Tufte mode
}: NavigationHeaderProps) {
  // All hooks must be called unconditionally (React Rules of Hooks)
  const { user, userType, isGuest } = useAuth();
  const { toggleDrawer, isDrawerOpen } = useWebDrawer();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { vocabulary } = useVocabulary();
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Get current section name for header (vocabulary-aware). For routes with no
  // matching nav item (e.g. the fleet detail page) the helper falls back to the
  // literal app name — printing a stray "BetterAt" wordmark beside the interest
  // switcher. Suppress that fallback so unmatched routes show only the switcher.
  const sectionName = getCurrentSectionName(pathname, userType, vocabulary);
  const showSectionName = Boolean(sectionName) && sectionName !== 'BetterAt';

  // Allow pages to hide the global header and render their own
  if (hidden) return null;

  // Determine which page we're on
  const isLoginPage = pathname === '/(auth)/login' || pathname === '/login';
  const isSignupPage = pathname === '/(auth)/signup' || pathname === '/signup';
  const isOnboardingPage = pathname === '/(auth)/onboarding' || pathname === '/onboarding';

  return (
    <>
      <View style={[
        styles.navigationHeader,
        {
          backgroundColor: showDrawer ? TUFTE_BACKGROUND : backgroundColor,
          paddingTop: Platform.OS !== 'web' ? insets.top + 8 : 12
        },
        borderBottom && styles.withBorder
      ]}>
        <View style={styles.navigationContent}>
          {/* Left: hamburger (web only — mobile uses the bottom tab bar) +
              interest switcher + section name. Kept together on the left so the
              switcher anchors the chrome the way it does on the TabScreenToolbar
              surfaces, instead of floating to the right when the action slot is
              empty for signed-in users. */}
          <View style={styles.leftGroup}>
            {showDrawer && (user || isGuest) && !isOnboardingPage && Platform.OS === 'web' && (
              <TouchableOpacity
                style={styles.hamburgerButton}
                onPress={toggleDrawer}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isDrawerOpen ? 'Close sidebar' : 'Open sidebar'}
              >
                <Ionicons name={isDrawerOpen ? 'close' : 'menu'} size={24} color="#374151" />
              </TouchableOpacity>
            )}

            {showDrawer && (user || isGuest) && !isOnboardingPage && (
              <View style={styles.centerGroup}>
                <InterestSwitcher />
                {showSectionName && <Text style={styles.sectionTitle}>{sectionName}</Text>}
              </View>
            )}
          </View>

          {/* Right: Navigation Actions (only for unauthenticated non-guest users) */}
          <View style={styles.navigationActions}>
            {!user && !isGuest && (
              <View style={styles.authButtons}>
                {!isLoginPage && (
                  <TouchableOpacity
                    style={styles.signInButton}
                    onPress={() => router.push('/(auth)/login')}
                  >
                    <Text style={styles.signInText}>Sign In</Text>
                  </TouchableOpacity>
                )}

                {!isSignupPage && (
                  <TouchableOpacity
                    style={styles.signUpButton}
                    onPress={() => router.push('/(auth)/signup')}
                  >
                    <Text style={styles.signUpText}>Sign Up / Sign In</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Navigation Drawer (Tufte mode) */}
      {showDrawer && (user || isGuest) && (
        <NavigationDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Header
  navigationHeader: {
    paddingVertical: TufteTokens.spacing.standard,
    paddingHorizontal: TufteTokens.spacing.section,
    zIndex: 1000,
  },
  withBorder: {
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.color,
  },
  navigationContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  centerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navigationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Hamburger Menu (Tufte mode)
  hamburgerButton: {
    padding: 8,
    marginLeft: -8,
  },
  // Section Title (Tufte mode)
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.3,
  },

  // Auth Buttons
  authButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signInButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  signInText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  signUpButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: TufteTokens.borderRadius.subtle,
    backgroundColor: '#3B82F6',
  },
  signUpText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
