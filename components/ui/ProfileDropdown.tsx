/**
 * ProfileDropdown
 *
 * Unified profile avatar + dropdown menu used in both the landing nav
 * and the tab screen toolbar. Shows profile/settings/sign-out for
 * authenticated users, and log-in/sign-up for guests.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { IOS_COLORS, IOS_ANIMATIONS } from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { getDashboardRoute } from '@/lib/utils/userTypeRouting';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ProfileDropdownProps {
  /** Visual variant: 'light' for toolbar (blue avatar), 'dark' for landing nav (translucent white) */
  variant?: 'light' | 'dark';
  /** Avatar size in pixels (default: 30) */
  size?: number;
  /** Current interest slug for signup routing */
  currentInterestSlug?: string;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileDropdown({
  variant = 'light',
  size = 30,
  currentInterestSlug,
}: ProfileDropdownProps) {
  const { user, userProfile, isGuest, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const scale = useSharedValue(1);

  const isLoggedIn = !!user && !isGuest;

  const initials = isGuest
    ? '?'
    : getInitials(userProfile?.full_name || userProfile?.display_name || user?.email);

  const avatarUrl = userProfile?.avatar_url;
  const safeAvatarUrl = useMemo(() => {
    const raw = String(avatarUrl || '').trim();
    if (!raw) return null;
    if (Platform.OS === 'web' && /^(file:|content:|\/data\/|data\/user\/)/i.test(raw)) {
      return null;
    }
    return raw;
  }, [avatarUrl]);
  const showAvatarImage = Boolean(!isGuest && safeAvatarUrl && !imageFailed);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isDark = variant === 'dark';
  const halfSize = size / 2;

  const avatarDynamic = {
    width: size,
    height: size,
    borderRadius: halfSize,
  };

  const handleClose = () => setOpen(false);

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path as any);
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  return (
    <View style={s.container}>
      <AnimatedPressable
        style={[
          !isLoggedIn ? (Platform.OS !== 'web' ? s.avatar : s.signUpBtn) : s.avatar,
          !isLoggedIn
            ? (Platform.OS !== 'web'
                ? [avatarDynamic, isDark ? s.avatarDark : s.avatarGuestLight]
                : (isDark ? s.signUpBtnDark : s.signUpBtnLight))
            : avatarDynamic,
          isLoggedIn && (isDark ? s.avatarDark : s.avatarLight),
          showAvatarImage && s.avatarWithImage,
          animStyle,
        ]}
        accessibilityLabel={!isLoggedIn ? 'Sign up' : 'Profile menu'}
        accessibilityRole="button"
        onPress={() => {
          triggerHaptic('selection');
          setOpen((v) => !v);
        }}
        onPressIn={() => {
          scale.value = withSpring(0.9, IOS_ANIMATIONS.spring.stiff);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, IOS_ANIMATIONS.spring.snappy);
        }}
      >
        {!isLoggedIn ? (
          Platform.OS !== 'web' ? (
            <Ionicons name="person-add-outline" size={size * 0.55} color={isDark ? '#1A1A1A' : '#FFFFFF'} />
          ) : (
            <Text style={[s.signUpText, isDark && s.signUpTextDark]}>Sign Up / Sign In</Text>
          )
        ) : (
          // Always render initials so the avatar isn't a blank circle while
          // an avatar_url image silently loads (or fails to surface its
          // onError). Image, when present, sits on top via absolute fill.
          <>
            <Text
              style={[
                s.avatarText,
                { fontSize: size * 0.43 },
                isDark && s.avatarTextDark,
              ]}
            >
              {initials}
            </Text>
            {showAvatarImage ? (
              <Image
                source={{ uri: safeAvatarUrl! }}
                style={[
                  avatarDynamic,
                  { borderRadius: halfSize, position: 'absolute' },
                ]}
                onError={() => setImageFailed(true)}
              />
            ) : null}
          </>
        )}
      </AnimatedPressable>

      {open && (
        <Pressable style={s.backdrop} onPress={handleClose}>
          <Pressable
            style={[s.dropdown, { top: size + 8 }, !isLoggedIn && s.dropdownGuest]}
            onPress={(e) => e.stopPropagation?.()}
          >
            {isLoggedIn ? (
              <>
                <View style={s.profileHeader}>
                  <View style={s.profileHeaderAvatar}>
                    {showAvatarImage ? (
                      <Image
                        source={{ uri: safeAvatarUrl! }}
                        style={s.profileHeaderAvatarImage}
                      />
                    ) : (
                      <Text style={s.profileHeaderAvatarText}>{initials}</Text>
                    )}
                  </View>
                  <View style={s.profileHeaderText}>
                    <Text style={s.profileHeaderName} numberOfLines={1}>
                      {userProfile?.full_name || userProfile?.display_name || 'Your account'}
                    </Text>
                    {!!user?.email && (
                      <Text style={s.profileHeaderEmail} numberOfLines={1}>
                        {user.email}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={s.headerDivider} />

                <View style={s.menuSection}>
                  <DropdownItem
                    icon="home-outline"
                    label="Home"
                    onPress={() => navigate('/?view=landing')}
                  />
                  <View style={s.itemDivider} />
                  <DropdownItem
                    icon="grid-outline"
                    label="Dashboard"
                    onPress={() => {
                      setOpen(false);
                      const dest = getDashboardRoute(userProfile?.user_type ?? null);
                      router.push(dest as any);
                    }}
                  />
                  <View style={s.itemDivider} />
                  <DropdownItem
                    icon="person-outline"
                    label="My Profile"
                    onPress={() => navigate(`/person/${user!.id}`)}
                  />
                  <View style={s.itemDivider} />
                  <DropdownItem
                    icon="layers-outline"
                    label="Creator Dashboard"
                    onPress={() => navigate('/creator')}
                  />
                  <View style={s.itemDivider} />
                  <DropdownItem
                    icon="settings-outline"
                    label="Settings"
                    onPress={() => navigate('/account')}
                  />
                </View>

                <View style={s.headerDivider} />
                <View style={s.menuSection}>
                  <DropdownItem
                    icon="log-out-outline"
                    label="Sign Out"
                    onPress={handleSignOut}
                    destructive
                  />
                </View>
              </>
            ) : (
              <View style={s.guestMenu}>
                <Text style={s.guestHeading}>Save your progress</Text>
                <Text style={s.guestSubtext}>
                  Create a free account to keep your work safe and pick up where you left off on any device.
                </Text>
                <Pressable
                  style={s.guestPrimaryBtn}
                  onPress={() =>
                    navigate(
                      currentInterestSlug
                        ? `/(auth)/signup?interest=${currentInterestSlug}`
                        : '/(auth)/signup',
                    )
                  }
                >
                  <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
                  <Text style={s.guestPrimaryBtnText}>Create Account</Text>
                </Pressable>
                <Pressable
                  style={s.guestSecondaryBtn}
                  onPress={() =>
                    navigate(
                      `/(auth)/login?returnTo=${encodeURIComponent(pathname)}`,
                    )
                  }
                >
                  <Text style={s.guestSecondaryBtnText}>
                    Already have an account? <Text style={s.guestSecondaryBtnLink}>Log In</Text>
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Internal: dropdown menu item
// ---------------------------------------------------------------------------

function DropdownItem({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered, pressed }: any) => [
        s.menuItemPressable,
        (hovered || pressed) && s.menuItemHover,
      ]}
    >
      <View style={s.menuItemRow}>
        <Text
          style={[s.menuText, destructive && s.menuTextDestructive]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Ionicons
          name={icon as any}
          size={19}
          color={destructive ? IOS_COLORS.systemRed : IOS_COLORS.label}
        />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    position: 'relative',
  },

  // Sign Up button (guest state)
  signUpBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  signUpBtnDark: {
    backgroundColor: '#FFFFFF',
  },
  signUpBtnLight: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  signUpText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  signUpTextDark: {
    color: '#1A1A1A',
  },

  // Avatar variants
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarLight: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  avatarGuestLight: {
    backgroundColor: IOS_COLORS.systemGray3,
  },
  avatarDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  avatarWithImage: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  avatarTextDark: {
    fontWeight: '700',
  },

  // Backdrop
  backdrop: {
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
      },
    }),
  },

  // Dropdown card
  dropdown: {
    position: 'absolute',
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 0,
    minWidth: 260,
    overflow: 'hidden',
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)',
      } as any,
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },

  dropdownGuest: {
    minWidth: 260,
    paddingVertical: 0,
  },

  // Profile header (logged-in)
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
  },
  profileHeaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileHeaderAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileHeaderAvatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  profileHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  profileHeaderName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  profileHeaderEmail: {
    fontSize: 12,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },

  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
  },

  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
    marginLeft: 16,
  },

  menuSection: {
    paddingVertical: 0,
  },

  // Menu items (iOS UIMenu style: label left, icon right)
  menuItemPressable: {
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  menuItemHover: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.label,
    flex: 1,
    marginRight: 12,
  },
  menuTextDestructive: {
    color: IOS_COLORS.systemRed,
    fontWeight: '500',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
  },

  // Guest auth menu
  guestMenu: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  guestHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  guestSubtext: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
    marginBottom: 14,
  },
  guestPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  guestPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  guestSecondaryBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  guestSecondaryBtnText: {
    fontSize: 13,
    color: '#6B7280',
  },
  guestSecondaryBtnLink: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
});

export default ProfileDropdown;
