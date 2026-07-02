/**
 * NavigationDrawer - Tufte-Style Navigation Panel
 *
 * Replaces bottom tab bar to reclaim vertical space for content.
 * Slides in from the left with persona-aware navigation items.
 */

import React, { useRef, useEffect, RefObject } from 'react';
import {
  Animated,
  Dimensions,
  LayoutRectangle,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { TUFTE_BACKGROUND, TUFTE_BACKGROUND_SECONDARY, TUFTE_TEXT } from '@/components/cards/constants';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import {
  type NavItem,
  SAILOR_NAV_ITEMS,
  SAILOR_SECONDARY_ITEMS,
  COACH_NAV_ITEMS,
  CLUB_NAV_ITEMS,
  COMMON_FOOTER_ITEMS,
  getNavItemsForUserType,
  isRouteActive,
} from '@/lib/navigation-config';
import { useVocabulary, type VocabularyMap } from '@/hooks/useVocabulary';
import { useOrganization } from '@/providers/OrganizationProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 320);

interface NavigationDrawerProps {
  visible: boolean;
  onClose: () => void;
  // Layout callbacks for spotlight effects
  onLearnItemLayout?: (layout: LayoutRectangle) => void;
  onVenueItemLayout?: (layout: LayoutRectangle) => void;
  onCoachingItemLayout?: (layout: LayoutRectangle) => void;
  onPricingItemLayout?: (layout: LayoutRectangle) => void;
}

interface NavigationDrawerContentProps {
  visible: boolean;
  onClose: () => void;
  onLearnItemLayout?: (layout: LayoutRectangle) => void;
  onVenueItemLayout?: (layout: LayoutRectangle) => void;
  onCoachingItemLayout?: (layout: LayoutRectangle) => void;
  onPricingItemLayout?: (layout: LayoutRectangle) => void;
  /** Ref to measure layout relative to (for iOS coordinate system fix) */
  measureRelativeTo?: React.RefObject<View>;
}

/**
 * Non-Modal drawer content.
 * Renders the drawer panel with backdrop, without wrapping in a Modal.
 */
export function NavigationDrawerContent({
  visible,
  onClose,
  onLearnItemLayout,
  onVenueItemLayout,
  onCoachingItemLayout,
  onPricingItemLayout,
  measureRelativeTo,
}: NavigationDrawerContentProps) {
  const { userType, userProfile, user, signOut, isGuest } = useAuth();
  const { isFree } = useFeatureGate();
  const { vocabulary } = useVocabulary();
  const { memberships, activeDomain } = useOrganization();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  // Refs for onboarding tour spotlight
  const learnItemRef = useRef<View>(null);
  const venueItemRef = useRef<View>(null);
  const coachingItemRef = useRef<View>(null);
  const pricingItemRef = useRef<View>(null);

  // Helper to measure an item's layout
  const measureItem = (ref: RefObject<View>, callback?: (layout: LayoutRectangle) => void) => {
    if (!callback || !ref.current) return;

    if (Platform.OS === 'web') {
      // Web: use getBoundingClientRect
      const node = ref.current as unknown as { getBoundingClientRect?: () => DOMRect };
      if (node?.getBoundingClientRect) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          callback({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
        }
      }
    } else if (measureRelativeTo?.current) {
      // iOS/Android with measureRelativeTo: use measureLayout for coordinates relative to container
      // This fixes the coordinate system mismatch when drawer is inside OnboardingTour Modal
      ref.current.measureLayout(
        measureRelativeTo.current as any,
        (x, y, width, height) => {
          if (width > 0 && height > 0) {
            callback({ x, y, width, height });
          }
        },
        () => {
          // Fallback to measureInWindow if measureLayout fails
          ref.current?.measureInWindow((x, y, width, height) => {
            if (width > 0 && height > 0) {
              callback({ x, y, width, height });
            }
          });
        }
      );
    } else {
      // Fallback: use measureInWindow (window-global coordinates)
      ref.current.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          callback({ x, y, width, height });
        }
      });
    }
  };

  // Measure menu items when drawer is visible (for onboarding tour)
  useEffect(() => {
    if (!visible) return;

    // Delay to ensure drawer animation is complete (increased for slower devices)
    const timer = setTimeout(() => {
      measureItem(learnItemRef, onLearnItemLayout);
      measureItem(venueItemRef, onVenueItemLayout);
      measureItem(coachingItemRef, onCoachingItemLayout);
      measureItem(pricingItemRef, onPricingItemLayout);
    }, 500);

    return () => clearTimeout(timer);
  }, [visible, onLearnItemLayout, onVenueItemLayout, onCoachingItemLayout, onPricingItemLayout, measureRelativeTo]);

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleNavigation = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  const handleSignOut = async () => {
    onClose();
    try {
      await signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  const isOrgAdmin = React.useMemo(() => {
    const ADMIN_ROLES = new Set(['admin', 'manager', 'owner']);
    return memberships.some(
      (m) => ADMIN_ROLES.has(String(m.role || '').toLowerCase())
        && ['active', 'verified'].includes(String(m.membership_status || m.status || '').toLowerCase())
    );
  }, [memberships]);

  const { primary, secondary } = getNavItemsForUserType(userType ?? null, vocabulary, {
    activeDomain: activeDomain ?? undefined,
    isOrgAdmin,
  });

  const isActive = (route: string) => {
    const normalizedRoute = route.replace('/(tabs)/', '/').replace('/index', '');
    return pathname === normalizedRoute || pathname.startsWith(normalizedRoute + '/');
  };

  const userInitial = isGuest ? 'G' : (userProfile?.full_name || user?.email || 'U').charAt(0).toUpperCase();
  const displayName = isGuest ? 'Guest' : (userProfile?.full_name || 'Sailor');

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
      {/* Backdrop - transparent, handled by tour overlay */}
      <Pressable style={styles.contentBackdrop} onPress={onClose} />

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* User Section */}
        <View style={styles.userSection}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{userInitial}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>
            {!isGuest && user?.email && (
              <Text style={styles.userEmail} numberOfLines={1}>
                {user.email}
              </Text>
            )}
            {isGuest && (
              <Text style={styles.userEmail} numberOfLines={1}>
                Exploring the app
              </Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Primary Navigation */}
        <View style={styles.navSection}>
          {primary.map((item) => {
            const itemRef = item.key === 'learn' ? learnItemRef
              : item.key === 'venue' ? venueItemRef
              : null;

            const navButton = (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.navItem,
                  isActive(item.route) && styles.navItemActive,
                ]}
                onPress={() => handleNavigation(item.route)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isActive(item.route) ? '#007AFF' : TUFTE_TEXT}
                />
                <Text
                  style={[
                    styles.navItemText,
                    isActive(item.route) && styles.navItemTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );

            if (itemRef) {
              return (
                <View
                  key={item.key}
                  ref={itemRef}
                  {...(Platform.OS === 'web' ? {} : { collapsable: false as const })}
                >
                  {navButton}
                </View>
              );
            }

            return navButton;
          })}
        </View>

        {/* Secondary Navigation (Sailors only) */}
        {secondary.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>MORE</Text>
            <View style={styles.navSection}>
              {secondary.map((item) => {
                const itemRef = item.key === 'coaches' ? coachingItemRef : null;

                const navButton = (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.navItem,
                      isActive(item.route) && styles.navItemActive,
                    ]}
                    onPress={() => handleNavigation(item.route)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={isActive(item.route) ? '#007AFF' : TUFTE_TEXT}
                    />
                    <Text
                      style={[
                        styles.navItemText,
                        isActive(item.route) && styles.navItemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );

                if (itemRef) {
                  return (
                    <View
                      key={item.key}
                      ref={itemRef}
                      {...(Platform.OS === 'web' ? {} : { collapsable: false as const })}
                    >
                      {navButton}
                    </View>
                  );
                }

                return navButton;
              })}
            </View>
          </>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Footer */}
        <View style={styles.divider} />
        <View style={styles.navSection}>
          {/* Account - only for authenticated users */}
          {!isGuest && COMMON_FOOTER_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.navItem,
                isActive(item.route) && styles.navItemActive,
              ]}
              onPress={() => handleNavigation(item.route)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={isActive(item.route) ? '#007AFF' : TUFTE_TEXT}
              />
              <Text
                style={[
                  styles.navItemText,
                  isActive(item.route) && styles.navItemTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Plans - visible to guests and free users */}
          {(isGuest || isFree) && (
            <View
              ref={pricingItemRef}
              {...(Platform.OS === 'web' ? {} : { collapsable: false as const })}
            >
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => handleNavigation('/pricing')}
                activeOpacity={0.7}
              >
                <Ionicons name="pricetags-outline" size={20} color={TUFTE_TEXT} />
                <Text style={styles.navItemText}>Plans</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Guest: Sign In / Sign Up buttons */}
          {isGuest ? (
            <>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => handleNavigation('/(auth)/login')}
                activeOpacity={0.7}
              >
                <Ionicons name="log-in-outline" size={20} color="#007AFF" />
                <Text style={[styles.navItemText, styles.signInText]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => handleNavigation('/(auth)/signup')}
                activeOpacity={0.7}
              >
                <Ionicons name="person-add-outline" size={20} color="#007AFF" />
                <Text style={[styles.navItemText, styles.signInText]}>Sign Up</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Upgrade to Pro - for free tier users */}
              {isFree && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => handleNavigation('/pricing?upgrade=pro')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="rocket" size={18} color="#FFFFFF" />
                  <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                </TouchableOpacity>
              )}

              {/* Authenticated: Sign Out button */}
              <TouchableOpacity
                style={styles.navItem}
                onPress={handleSignOut}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                <Text style={[styles.navItemText, styles.signOutText]}>Sign Out</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

export function NavigationDrawer({
  visible,
  onClose,
  onLearnItemLayout,
  onVenueItemLayout,
  onCoachingItemLayout,
  onPricingItemLayout,
}: NavigationDrawerProps) {
  const { userType, userProfile, user, signOut, isGuest } = useAuth();
  const { isFree, tierName } = useFeatureGate();
  const { vocabulary } = useVocabulary();
  const { memberships: drawerMemberships, activeDomain: drawerActiveDomain } = useOrganization();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  // Refs for onboarding tour spotlight
  const learnItemRef = useRef<View>(null);
  const venueItemRef = useRef<View>(null);
  const coachingItemRef = useRef<View>(null);
  const pricingItemRef = useRef<View>(null);

  // Helper to measure an item's layout
  const measureItem = (ref: RefObject<View>, callback?: (layout: LayoutRectangle) => void) => {
    if (!callback || !ref.current) return;

    if (Platform.OS === 'web') {
      const node = ref.current as unknown as { getBoundingClientRect?: () => DOMRect };
      if (node?.getBoundingClientRect) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          callback({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
        }
      }
    } else {
      ref.current.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          callback({ x, y, width, height });
        }
      });
    }
  };

  // Measure menu items when drawer is visible (for onboarding tour)
  useEffect(() => {
    if (!visible) return;

    // Delay to ensure drawer animation is complete
    const timer = setTimeout(() => {
      measureItem(learnItemRef, onLearnItemLayout);
      measureItem(venueItemRef, onVenueItemLayout);
      measureItem(coachingItemRef, onCoachingItemLayout);
      measureItem(pricingItemRef, onPricingItemLayout);
    }, 400);

    return () => clearTimeout(timer);
  }, [visible, onLearnItemLayout, onVenueItemLayout, onCoachingItemLayout, onPricingItemLayout]);

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleNavigation = (route: string) => {
    onClose();
    // Small delay to let drawer close animation start
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  const handleSignOut = async () => {
    onClose();
    try {
      await signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  // Get navigation items based on persona
  const drawerIsOrgAdmin = React.useMemo(() => {
    const ADMIN_ROLES = new Set(['admin', 'manager', 'owner']);
    return drawerMemberships.some(
      (m) => ADMIN_ROLES.has(String(m.role || '').toLowerCase())
        && ['active', 'verified'].includes(String(m.membership_status || m.status || '').toLowerCase())
    );
  }, [drawerMemberships]);

  const { primary, secondary } = getNavItemsForUserType(userType ?? null, vocabulary, {
    activeDomain: drawerActiveDomain ?? undefined,
    isOrgAdmin: drawerIsOrgAdmin,
  });

  // Check if route is active
  const isActive = (route: string) => {
    const normalizedRoute = route.replace('/(tabs)/', '/').replace('/index', '');
    return pathname === normalizedRoute || pathname.startsWith(normalizedRoute + '/');
  };

  // Get current section name for header
  const getCurrentSectionName = () => {
    const allItems = [...primary, ...secondary, ...COMMON_FOOTER_ITEMS];
    const activeItem = allItems.find(item => isActive(item.route));
    return activeItem?.label || 'BetterAt';
  };

  const userInitial = isGuest ? 'G' : (userProfile?.full_name || user?.email || 'U').charAt(0).toUpperCase();
  const displayName = isGuest ? 'Guest' : (userProfile?.full_name || 'Sailor');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: slideAnim }],
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* User Section */}
          <View style={styles.userSection}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{userInitial}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {displayName}
              </Text>
              {!isGuest && user?.email && (
                <Text style={styles.userEmail} numberOfLines={1}>
                  {user.email}
                </Text>
              )}
              {isGuest && (
                <Text style={styles.userEmail} numberOfLines={1}>
                  Exploring the app
                </Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Primary Navigation */}
          <View style={styles.navSection}>
            {primary.map((item) => {
              // Get ref for onboarding tour spotlight
              const itemRef = item.key === 'learn' ? learnItemRef
                : item.key === 'venue' ? venueItemRef
                : null;

              const navButton = (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.navItem,
                    isActive(item.route) && styles.navItemActive,
                  ]}
                  onPress={() => handleNavigation(item.route)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={isActive(item.route) ? '#007AFF' : TUFTE_TEXT}
                  />
                  <Text
                    style={[
                      styles.navItemText,
                      isActive(item.route) && styles.navItemTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );

              // Wrap with ref if needed for onboarding tour
              if (itemRef) {
                return (
                  <View
                    key={item.key}
                    ref={itemRef}
                    {...(Platform.OS === 'web' ? {} : { collapsable: false as const })}
                  >
                    {navButton}
                  </View>
                );
              }

              return navButton;
            })}
          </View>

          {/* Secondary Navigation (Sailors only) */}
          {secondary.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>MORE</Text>
              <View style={styles.navSection}>
                {secondary.map((item) => {
                  // Get ref for onboarding tour spotlight (coaches)
                  const itemRef = item.key === 'coaches' ? coachingItemRef : null;

                  const navButton = (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.navItem,
                        isActive(item.route) && styles.navItemActive,
                      ]}
                      onPress={() => handleNavigation(item.route)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={isActive(item.route) ? '#007AFF' : TUFTE_TEXT}
                      />
                      <Text
                        style={[
                          styles.navItemText,
                          isActive(item.route) && styles.navItemTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );

                  // Wrap with ref if needed for onboarding tour
                  if (itemRef) {
                    return (
                      <View
                        key={item.key}
                        ref={itemRef}
                        {...(Platform.OS === 'web' ? {} : { collapsable: false as const })}
                      >
                        {navButton}
                      </View>
                    );
                  }

                  return navButton;
                })}
              </View>
            </>
          )}

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Footer */}
          <View style={styles.divider} />
          <View style={styles.navSection}>
            {/* Account - only for authenticated users */}
            {!isGuest && COMMON_FOOTER_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.navItem,
                  isActive(item.route) && styles.navItemActive,
                ]}
                onPress={() => handleNavigation(item.route)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isActive(item.route) ? '#007AFF' : TUFTE_TEXT}
                />
                <Text
                  style={[
                    styles.navItemText,
                    isActive(item.route) && styles.navItemTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Plans - visible to guests and free users */}
            {(isGuest || isFree) && (
              <View
                ref={pricingItemRef}
                {...(Platform.OS === 'web' ? {} : { collapsable: false as const })}
              >
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => handleNavigation('/pricing')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pricetags-outline" size={20} color={TUFTE_TEXT} />
                  <Text style={styles.navItemText}>Plans</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Guest: Sign In / Sign Up buttons */}
            {isGuest ? (
              <>
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => handleNavigation('/(auth)/login')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-in-outline" size={20} color="#007AFF" />
                  <Text style={[styles.navItemText, styles.signInText]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => handleNavigation('/(auth)/signup')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-add-outline" size={20} color="#007AFF" />
                  <Text style={[styles.navItemText, styles.signInText]}>Sign Up</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Upgrade to Pro - for free tier users */}
                {isFree && (
                  <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={() => handleNavigation('/pricing?upgrade=pro')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="rocket" size={18} color="#FFFFFF" />
                    <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                  </TouchableOpacity>
                )}

                {/* Authenticated: Sign Out button */}
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={handleSignOut}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                  <Text style={[styles.navItemText, styles.signOutText]}>Sign Out</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Helper to get current section name (exported for header use)
export function getCurrentSectionName(pathname: string, userType: string | null, vocabulary?: VocabularyMap): string {
  const { primary, secondary } = getNavItemsForUserType(userType, vocabulary);
  const allItems = [
    ...primary,
    ...secondary,
    ...COMMON_FOOTER_ITEMS,
  ];

  const normalizedPathname = pathname.replace('/(tabs)/', '/').replace('/index', '');

  for (const item of allItems) {
    const normalizedRoute = item.route.replace('/(tabs)/', '/').replace('/index', '');
    if (normalizedPathname === normalizedRoute || normalizedPathname.startsWith(normalizedRoute + '/')) {
      return item.label;
    }
  }

  return 'BetterAt';
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  contentBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent', // Tour overlay handles darkening
  },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: TUFTE_BACKGROUND,
    ...Platform.select({
      web: {
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 16,
      },
    }),
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: TUFTE_BACKGROUND_SECONDARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: TUFTE_TEXT,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: TUFTE_TEXT,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  navSection: {
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  navItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: TUFTE_TEXT,
    marginLeft: 12,
  },
  navItemTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  signOutText: {
    color: '#DC2626',
  },
  signInText: {
    color: '#007AFF',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0284c7',
    marginBottom: 8,
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default NavigationDrawer;
