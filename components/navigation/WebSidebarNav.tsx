/**
 * WebSidebarNav - Persistent sidebar navigation for web
 *
 * Apple HIG-style sidebar with:
 * - Sidebar toggle button (collapse/expand)
 * - Primary nav items (persona-aware, from shared config)
 * - Secondary items (all "More" menu items flattened)
 * - Footer: Sign In/Sign Up for guests
 *
 * Profile/Account access is via the profile avatar button in the toolbar.
 * Plan upgrades are available in the profile dropdown menu.
 * Only rendered on web when USE_WEB_SIDEBAR_LAYOUT feature flag is enabled.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { BetterAtLogo } from '@/components/BetterAtLogo';
import { useAuth } from '@/providers/AuthProvider';
import { useWebDrawer } from '@/providers/WebDrawerProvider';

import { IOS_COLORS } from '@/lib/design-tokens-ios';
import {
  type NavItem,
  getNavItemsForUserType,
  isRouteActive,
} from '@/lib/navigation-config';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useOrganization } from '@/providers/OrganizationProvider';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export const WEB_SIDEBAR_WIDTH = 280;

interface WebSidebarNavProps {
  onClose?: () => void;
}

function WebSidebarNav({ onClose }: WebSidebarNavProps) {
  const { userType, isGuest } = useAuth();
  const { isPinned, toggleDrawer } = useWebDrawer();
  const { vocabulary } = useVocabulary();
  const { memberships, activeDomain } = useOrganization();
  const pathname = usePathname();
  const router = useRouter();

  const isOrgAdmin = React.useMemo(() => {
    const ADMIN_ROLES = new Set(['admin', 'manager', 'owner']);
    return memberships.some(
      (m) => ADMIN_ROLES.has(String(m.role || '').toLowerCase())
        && ['active', 'verified'].includes(String(m.membership_status || m.status || '').toLowerCase())
    );
  }, [memberships]);

  const navItems = getNavItemsForUserType(userType ?? null, vocabulary, {
    activeDomain: activeDomain ?? undefined,
    isOrgAdmin,
  });
  // Phase 0 of the iOS register migration renames tab 1 to "Practice"
  // universally — overriding the sailing "Race" default and any
  // vocabulary-derived event term ("Clinical", "Shift", "Session"). Same
  // override as app/(tabs)/_layout.tsx; keeps the sidebar in sync with the
  // bottom tab bar. See docs/redesign/ios-register/phase-0-shared-chrome.md.
  const primary = FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER
    ? navItems.primary.map((item) =>
        item.key === 'races' ? { ...item, label: 'Practice' } : item,
      )
    : navItems.primary;
  const { secondary } = navItems;

  const handleNavigation = (route: string) => {
    router.push(route as Parameters<typeof router.push>[0]);
    // Don't auto-close if pinned
    if (!isPinned) {
      onClose?.();
    }
  };

  // Handle sidebar toggle — toggleDrawer atomically unpins + closes in one batch
  const handleToggleSidebar = () => {
    toggleDrawer();
  };

  const renderNavItem = (item: NavItem) => {
    const active = isRouteActive(item.route, pathname);
    const navItem = (
      <TouchableOpacity
        key={item.key}
        style={[styles.navItem, active && styles.navItemActive]}
        onPress={() => handleNavigation(item.route)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={item.icon}
          size={20}
          color={active ? IOS_COLORS.systemBlue : IOS_COLORS.label}
        />
        <Text style={[styles.navItemText, active && styles.navItemTextActive]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );

    return navItem;
  };

  return (
    <View style={styles.container}>
      {/* Header with home link and sidebar toggle */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.push('/?view=landing' as Parameters<typeof router.push>[0])}
          style={({ pressed, hovered }) => [
            styles.homeLink,
            (hovered as boolean) && styles.homeLinkHover,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel="Go to homepage"
          accessibilityRole="link"
        >
          <BetterAtLogo size={24} variant="filled" />
          <Text style={styles.homeTitle}>BetterAt</Text>
        </Pressable>
        <Pressable
          onPress={handleToggleSidebar}
          style={({ pressed, hovered }) => [
            styles.sidebarToggle,
            (hovered as boolean) && styles.sidebarToggleHover,
            pressed && styles.sidebarTogglePressed,
          ]}
          accessibilityLabel="Hide sidebar"
          accessibilityRole="button"
        >
          {/* Apple-style sidebar icon: rectangle with left panel */}
          <View style={styles.sidebarIcon}>
            <View style={styles.sidebarIconLeft} />
            <View style={styles.sidebarIconRight} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary Navigation */}
        <View style={styles.navSection}>
          {primary.map(renderNavItem)}
        </View>

        {/* Secondary Navigation */}
        {secondary.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>MORE</Text>
            <View style={styles.navSection}>
              {secondary.map(renderNavItem)}
            </View>
          </>
        )}

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Footer - Auth actions (guests only; logged-in users sign out via Account modal) */}
        {isGuest && (
          <>
            <View style={styles.divider} />
            <View style={styles.navSection}>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => handleNavigation('/(auth)/login')}
                activeOpacity={0.7}
              >
                <Ionicons name="log-in-outline" size={20} color={IOS_COLORS.systemBlue} />
                <Text style={[styles.navItemText, styles.signInText]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => handleNavigation('/(auth)/signup')}
                activeOpacity={0.7}
              >
                <Ionicons name="person-add-outline" size={20} color={IOS_COLORS.systemBlue} />
                <Text style={[styles.navItemText, styles.signInText]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

export default WebSidebarNav;

const styles = StyleSheet.create({
  container: {
    width: WEB_SIDEBAR_WIDTH,
    backgroundColor: IOS_COLORS.systemBackground,
    height: '100%',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: IOS_COLORS.separator,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  homeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  homeLinkHover: {
    backgroundColor: IOS_COLORS.secondarySystemBackground,
  },
  homeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
  },
  // Apple-style sidebar toggle button (matches macOS window chrome)
  sidebarToggle: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  sidebarToggleHover: {
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderColor: IOS_COLORS.opaqueSeparator,
  },
  sidebarTogglePressed: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  // Custom sidebar icon (rectangle with left panel - matches Apple's sidebar.left)
  sidebarIcon: {
    width: 16,
    height: 12,
    flexDirection: 'row',
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.secondaryLabel,
    overflow: 'hidden',
  },
  sidebarIconLeft: {
    width: 5,
    height: '100%',
    backgroundColor: IOS_COLORS.secondaryLabel,
  },
  sidebarIconRight: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
    minHeight: '100%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  navSection: {
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 1,
    minHeight: 44,
  },
  navItemActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  navItemText: {
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.label,
    marginLeft: 12,
  },
  navItemTextActive: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  signInText: {
    color: IOS_COLORS.systemBlue,
  },
});
