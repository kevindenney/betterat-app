/**
 * ProfileDropdown
 *
 * Role-and-context switcher. The popover descends from the avatar in every
 * screen's top header and stays focused on fast identity/context actions:
 *
 *   - Tap avatar: identity, public profile front door, context switcher,
 *     Practice, Inbox, Account & settings, Help, Sign out
 *   - Tap unread badge: jump straight to Inbox without opening the menu
 *   - Durable settings (units, notifications, subscription, connected
 *     services, location, subscribed blueprints) live in Account & settings
 *
 * The variants share one component; section visibility is driven by
 * useProfileMenuData().
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useProfileMenuData, OrgMembership } from '@/hooks/useProfileMenuData';
import { useInterest } from '@/providers/InterestProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { IOS_COLORS, IOS_ANIMATIONS, IOS_TOUCH } from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { useInboxCount } from '@/hooks/useInboxCount';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ProfileDropdownProps {
  /** Visual variant: 'light' for toolbar (blue avatar), 'dark' for landing nav (translucent white) */
  variant?: 'light' | 'dark';
  /** Avatar size in pixels (default: 30) */
  size?: number;
  /** Horizontal dropdown anchor. Use 'left' when the avatar sits near the leading screen edge. */
  menuAlign?: 'left' | 'right';
  /** Current interest slug for signup routing */
  currentInterestSlug?: string;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function ProfileDropdown({
  variant = 'light',
  size = 30,
  menuAlign = 'right',
  currentInterestSlug,
}: ProfileDropdownProps) {
  const { user, userProfile, isGuest, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const scale = useSharedValue(1);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // On native the inline-absolute menu is trapped in the chrome's stacking
  // context, so later sibling overlays (e.g. Atlas's "Nearby" pill) paint on
  // top of it. Rendering the open menu in a Modal lets it escape that context
  // and overlay everything; we measure the avatar to re-anchor it. Web already
  // escapes via position:fixed, so it keeps the inline path.
  const containerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; right: number } | null>(null);

  const openMenu = () => {
    if (Platform.OS === 'web') {
      setOpen(true);
      return;
    }
    const node = containerRef.current;
    if (!node) {
      setOpen(true);
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      setAnchor({ top: y + h + 8, left: x, right: windowWidth - (x + w) });
      setOpen(true);
    });
  };
  const menu = useProfileMenuData();
  const homeVenue = useUserHomeVenue();
  const { currentInterest, switchInterest, userInterests } = useInterest();
  const { setActiveOrganizationId } = useOrganization();
  const { data: inboxCount = 0 } = useInboxCount();

  // Boats only exist for the sailing interest (see AccountModalContent's
  // isSailingInterest gate), so don't promise "boats" to other interests.
  const interestSlug = String(currentInterest?.slug || '').toLowerCase();
  const isSailingInterest = interestSlug === 'sail-racing' || interestSlug.includes('sail');
  const accountSubtitle = isSailingInterest
    ? 'Subscription · boats · notifications · privacy'
    : 'Subscription · notifications · privacy';

  const isLoggedIn = !!user && !isGuest;

  const displayName =
    userProfile?.full_name || userProfile?.display_name || user?.email || 'Your account';
  const initials = isGuest ? '?' : getInitials(displayName);

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
  const avatarDynamic = { width: size, height: size, borderRadius: halfSize };
  const nativeMenuTop = anchor?.top ?? size + 8;
  const nativeMenuMaxHeight = Math.max(240, windowHeight - nativeMenuTop - 16);

  const handleClose = () => setOpen(false);
  const navigate = (path: string) => {
    setOpen(false);
    router.push(path as any);
  };
  const openInbox = () => {
    triggerHaptic('selection');
    setOpen(false);
    router.push('/(tabs)/inbox' as any);
  };
  const handleSignOut = () => {
    setOpen(false);
    showConfirm(
      'Sign Out',
      'Are you sure you want to sign out?',
      async () => {
        try {
          await signOut();
        } catch (error) {
          console.error('[ProfileDropdown] Sign out error:', error);
          showAlert('Error', 'Failed to sign out. Please try again.');
        }
      },
      { destructive: true, confirmText: 'Sign Out' },
    );
  };
  const handleHelp = () => {
    setOpen(false);
    showAlert('Support', 'Email us at info@better.at');
  };
  // Switch the active workspace to an org and then align the interest.
  // An org with no interest mapping can't be switched-to, so fall back to
  // opening its page instead.
  const handleSwitchToOrg = async (org: OrgMembership) => {
    setOpen(false);
    await setActiveOrganizationId(org.org_id);
    if (!org.interest_slug) {
      if (org.org_slug) router.push(`/org/${org.org_slug}` as any);
      return;
    }
    try {
      await switchInterest(org.interest_slug);
    } catch {
      /* switch failures are non-fatal; menu just stays put */
    }
  };
  // "Personal" is the absence of an active org. If the user has a personal
  // interest, align to it too; the workspace switch should still happen even
  // when every interest is covered by an org.
  const handleSwitchToPersonal = async () => {
    setOpen(false);
    await setActiveOrganizationId(null);
    const orgSlugs = new Set(
      menu.memberships.map((m) => m.interest_slug).filter(Boolean) as string[],
    );
    const personal = userInterests.find((i) => !orgSlugs.has(i.slug));
    if (!personal) return;
    try {
      await switchInterest(personal.slug);
    } catch {
      /* non-fatal */
    }
  };

  const menuBody = isLoggedIn ? (
    <LoggedInMenu
      displayName={displayName}
      email={user?.email ?? null}
      initials={initials}
      showAvatarImage={showAvatarImage}
      safeAvatarUrl={safeAvatarUrl}
      menu={menu}
      inboxCount={inboxCount}
      userId={user?.id ?? null}
      accountSubtitle={accountSubtitle}
      currentInterestName={currentInterest?.name ?? null}
      homeVenueName={homeVenue?.venue ?? null}
      onNavigate={navigate}
      onSignOut={handleSignOut}
      onHelp={handleHelp}
      onSwitchToOrg={handleSwitchToOrg}
      onSwitchToPersonal={handleSwitchToPersonal}
    />
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
        onPress={() => navigate(`/(auth)/login?returnTo=${encodeURIComponent(pathname)}`)}
      >
        <Text style={s.guestSecondaryBtnText}>
          Already have an account? <Text style={s.guestSecondaryBtnLink}>Log In</Text>
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View ref={containerRef} style={s.container}>
      <AnimatedPressable
        style={[
          !isLoggedIn ? (Platform.OS !== 'web' ? s.avatar : s.signUpBtn) : s.avatar,
          !isLoggedIn
            ? Platform.OS !== 'web'
              ? [avatarDynamic, isDark ? s.avatarDark : s.avatarGuestLight]
              : isDark
              ? s.signUpBtnDark
              : s.signUpBtnLight
            : avatarDynamic,
          isLoggedIn && (isDark ? s.avatarDark : s.avatarLight),
          showAvatarImage && s.avatarWithImage,
          animStyle,
        ]}
        accessibilityLabel={!isLoggedIn ? 'Sign up' : 'Profile menu'}
        accessibilityRole="button"
        onPress={() => {
          triggerHaptic('selection');
          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
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
            <Ionicons
              name="person-add-outline"
              size={size * 0.55}
              color={isDark ? '#1A1A1A' : '#FFFFFF'}
            />
          ) : (
            <Text style={[s.signUpText, isDark && s.signUpTextDark]}>Sign Up / Sign In</Text>
          )
        ) : (
          <>
            <Text
              style={[s.avatarText, { fontSize: size * 0.43 }, isDark && s.avatarTextDark]}
            >
              {initials}
            </Text>
            {showAvatarImage ? (
              <Image
                source={{ uri: safeAvatarUrl! }}
                style={[avatarDynamic, { borderRadius: halfSize, position: 'absolute' }]}
                onError={() => setImageFailed(true)}
              />
            ) : null}
            {menu.hasActiveOrg && menu.activeOrg ? (
              <View style={s.orgPip}>
                <Text style={s.orgPipText}>{menu.activeOrg.org_short_name}</Text>
              </View>
            ) : null}
          </>
        )}
      </AnimatedPressable>

      {/* Inbox unread badge — separate press target. Tapping the avatar opens
          this menu; tapping the red badge deep-links straight to Inbox. */}
      {isLoggedIn && !FEATURE_FLAGS.CONTEXT_SWITCHER_V1 && inboxCount > 0 ? (
        <Pressable
          style={s.inboxBadge}
          onPress={openInbox}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${formatBadgeCount(inboxCount)} unread inbox items`}
        >
          <Text style={s.inboxBadgeText}>{formatBadgeCount(inboxCount)}</Text>
        </Pressable>
      ) : null}

      {open &&
        (Platform.OS === 'web' ? (
          <Pressable style={s.backdrop} onPress={handleClose}>
            <Pressable
              style={[
                s.dropdown,
                menuAlign === 'left' ? s.dropdownLeft : s.dropdownRight,
                { top: size + 8 },
                !isLoggedIn && s.dropdownGuest,
              ]}
              onPress={(e) => e.stopPropagation?.()}
            >
              <ScrollView
                style={{ maxHeight: Math.max(240, windowHeight - size - 24) }}
                contentContainerStyle={s.menuScrollContent}
              >
                {menuBody}
              </ScrollView>
            </Pressable>
          </Pressable>
        ) : (
          <Modal
            transparent
            visible
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent
          >
            <Pressable style={s.modalBackdrop} onPress={handleClose}>
              <Pressable
                style={[
                  s.dropdown,
                  s.dropdownModal,
                  { top: anchor?.top ?? size + 8 },
                  { maxHeight: nativeMenuMaxHeight },
                  menuAlign === 'left'
                    ? { left: anchor?.left ?? 8 }
                    : { right: anchor?.right ?? 8 },
                  !isLoggedIn && s.dropdownGuest,
                ]}
                onPress={(e) => e.stopPropagation?.()}
              >
                <ScrollView
                  style={{ maxHeight: nativeMenuMaxHeight }}
                  contentContainerStyle={s.menuScrollContent}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {menuBody}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Logged-in menu — composed from sub-blocks per the design's three variants
// ---------------------------------------------------------------------------

function LoggedInMenu({
  displayName,
  email,
  initials,
  showAvatarImage,
  safeAvatarUrl,
  menu,
  inboxCount,
  userId,
  accountSubtitle,
  currentInterestName,
  homeVenueName,
  onNavigate,
  onSignOut,
  onHelp,
  onSwitchToOrg,
  onSwitchToPersonal,
}: {
  displayName: string;
  email: string | null;
  initials: string;
  showAvatarImage: boolean;
  safeAvatarUrl: string | null;
  menu: ReturnType<typeof useProfileMenuData>;
  inboxCount: number;
  userId: string | null;
  accountSubtitle: string;
  currentInterestName: string | null;
  homeVenueName: string | null;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  onHelp: () => void;
  onSwitchToOrg: (org: OrgMembership) => void;
  onSwitchToPersonal: () => void;
}) {
  // Always a full session sign-out (see handleSignOut → signOut()), so the
  // label must not name an org — "Sign out of {org}" wrongly read as
  // org-scoped (it's not; switching context is the roles section above).
  const signOutLabel = 'Sign out';
  const slim = FEATURE_FLAGS.CONTEXT_SWITCHER_V1;

  return (
    <View style={s.popInner}>
      <IdentityRow
        displayName={displayName}
        email={email}
        initials={initials}
        showAvatarImage={showAvatarImage}
        safeAvatarUrl={safeAvatarUrl}
      />

      <PublicFaceStrip
        currentInterestName={currentInterestName}
        homeVenueName={homeVenueName}
        onViewProfile={() => onNavigate(userId ? `/profile/${userId}?preview=1` : '/settings/public-face')}
        onEditProfile={() => onNavigate('/settings/public-face')}
      />

      {!slim ? (
        <RolesSection
          memberships={menu.memberships}
          activeOrg={menu.activeOrg}
          onSwitchToOrg={onSwitchToOrg}
          onSwitchToPersonal={onSwitchToPersonal}
          onJoinOrg={() => onNavigate('/(tabs)/library?zone=orgs')}
        />
      ) : null}

      {!slim && (menu.isAdmin || menu.isAuthor) && (
        <RoleShortcuts menu={menu} onNavigate={onNavigate} />
      )}

      <View style={s.linkSection}>
        {!slim ? (
          <>
            <DropdownItem
              icon="checkmark-circle"
              label="My Practice"
              onPress={() => onNavigate('/(tabs)/practice')}
              trailing="chevron"
            />
            <ItemDivider />
            <DropdownItem
              icon="mail"
              label="Inbox"
              onPress={() => onNavigate('/(tabs)/inbox')}
              trailing={inboxCount > 0 ? 'count' : 'none'}
              count={inboxCount}
              countTone={inboxCount > 0 ? 'coral' : 'neutral'}
            />
            <ItemDivider />
          </>
        ) : null}
        <DropdownItem
          icon="settings"
          label="Account & settings"
          subtitle={accountSubtitle}
          onPress={() => onNavigate('/account')}
          trailing="chevron"
        />
      </View>

      <SectionDivider />

      <View style={s.linkSection}>
        <DropdownItem
          icon="help-circle"
          label="Help & feedback"
          onPress={onHelp}
          trailing="chevron"
        />
        <DropdownItem
          icon="log-out"
          label={signOutLabel}
          onPress={onSignOut}
          destructive
        />
      </View>
    </View>
  );
}

function IdentityRow({
  displayName,
  email,
  initials,
  showAvatarImage,
  safeAvatarUrl,
}: {
  displayName: string;
  email: string | null;
  initials: string;
  showAvatarImage: boolean;
  safeAvatarUrl: string | null;
}) {
  return (
    <View style={s.who}>
      <View style={s.whoAvatar}>
        {showAvatarImage ? (
          <Image source={{ uri: safeAvatarUrl! }} style={s.whoAvatarImg} />
        ) : (
          <Text style={s.whoAvatarText}>{initials}</Text>
        )}
      </View>
      <View style={s.whoText}>
        <Text style={s.whoName} numberOfLines={1}>
          {displayName}
        </Text>
        {!!email && (
          <Text style={s.whoEmail} numberOfLines={1}>
            {email}
          </Text>
        )}
      </View>
    </View>
  );
}

function PublicFaceStrip({
  currentInterestName,
  homeVenueName,
  onViewProfile,
  onEditProfile,
}: {
  currentInterestName: string | null;
  homeVenueName: string | null;
  onViewProfile: () => void;
  onEditProfile: () => void;
}) {
  const descriptor = [currentInterestName, homeVenueName].filter(Boolean).join(' · ');
  const slim = FEATURE_FLAGS.CONTEXT_SWITCHER_V1;
  return (
    <View style={s.publicFaceStrip}>
      <Text style={s.publicFaceKicker}>Your public face</Text>
      <Text style={s.publicFaceDesc} numberOfLines={2}>
        {descriptor ? `${descriptor} — what peers and orgs see.` : 'What peers and orgs see.'}
      </Text>
      <Pressable
        onPress={onViewProfile}
        accessibilityRole="button"
        accessibilityLabel="View and edit profile"
        style={s.publicFaceRow}
      >
        <Ionicons name="eye" size={18} color="#A67C52" style={{ marginRight: 12 }} />
        <Text style={s.publicFaceTitle} numberOfLines={1}>
          View & edit profile
        </Text>
        {!slim ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.();
              onEditProfile();
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit public profile"
            hitSlop={8}
            style={s.publicFaceEdit}
          >
            <Text style={s.publicFaceEditText}>Edit</Text>
          </Pressable>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
      </Pressable>
    </View>
  );
}

function RolesSection({
  memberships,
  activeOrg,
  onSwitchToOrg,
  onSwitchToPersonal,
  onJoinOrg,
}: {
  memberships: OrgMembership[];
  activeOrg: OrgMembership | null;
  onSwitchToOrg: (org: OrgMembership) => void;
  onSwitchToPersonal: () => void;
  onJoinOrg: () => void;
}) {
  return (
    <View style={s.roles}>
      <Text style={s.rolesKey}>Workspace</Text>
      {memberships.map((m) => (
        <RoleCard
          key={m.org_id}
          membership={m}
          current={activeOrg?.org_id === m.org_id}
          onPress={() => onSwitchToOrg(m)}
        />
      ))}
      <PersonalRoleCard active={!activeOrg} onPress={onSwitchToPersonal} />
      <Pressable style={s.joinRow} onPress={onJoinOrg}>
        <Ionicons name="add" size={14} color={IOS_COLORS.systemBlue} />
        <Text style={s.joinText}>Join another organization</Text>
      </Pressable>
    </View>
  );
}

function RoleCard({
  membership,
  current,
  onPress,
}: {
  membership: OrgMembership;
  current: boolean;
  onPress: () => void;
}) {
  const pillTone = membership.is_admin
    ? 'admin'
    : membership.is_faculty
    ? 'faculty'
    : 'member';
  const pillLabel = membership.is_admin
    ? 'Admin'
    : membership.is_faculty
    ? 'Faculty'
    : 'Member';
  return (
    <Pressable
      style={[s.roleCard, current && s.roleCardOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${membership.org_name}`}
    >
      <View style={s.roleMono}>
        <Text style={s.roleMonoText}>{membership.org_short_name}</Text>
      </View>
      <View style={s.roleLabel}>
        <Text style={s.roleOrgName} numberOfLines={1}>
          {membership.org_name}
        </Text>
        <Text style={s.roleSub} numberOfLines={1}>
          {membership.is_admin
            ? 'Administrator'
            : membership.is_faculty
            ? 'Faculty · author · mentor'
            : 'Member'}
        </Text>
      </View>
      <View style={[s.rolePill, pillToneStyles[pillTone]]}>
        <Text style={[s.rolePillText, pillToneTextStyles[pillTone]]}>{pillLabel}</Text>
      </View>
      {current && (
        <Ionicons name="checkmark" size={16} color={IOS_COLORS.systemBlue} style={s.roleCheck} />
      )}
    </Pressable>
  );
}

function PersonalRoleCard({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[s.roleCard, active && s.roleCardOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Switch to personal practice"
    >
      <View style={[s.roleMono, s.roleMonoSolo]}>
        <Text style={s.roleMonoTextSolo}>·</Text>
      </View>
      <View style={s.roleLabel}>
        <Text style={s.roleOrgName}>Personal</Text>
        <Text style={s.roleSub}>For your own practice</Text>
      </View>
      <View style={[s.rolePill, pillToneStyles.you]}>
        <Text style={[s.rolePillText, pillToneTextStyles.you]}>You</Text>
      </View>
      {active && (
        <Ionicons name="checkmark" size={16} color={IOS_COLORS.systemBlue} style={s.roleCheck} />
      )}
    </Pressable>
  );
}

function RoleShortcuts({
  menu,
  onNavigate,
}: {
  menu: ReturnType<typeof useProfileMenuData>;
  onNavigate: (path: string) => void;
}) {
  return (
    <>
      <View style={s.linkSection}>
        {menu.isAdmin && menu.activeOrg && (
          <>
            <DropdownItem
              icon="business-outline"
              label={`${menu.activeOrg.org_name.split(' ').slice(0, 2).join(' ')} admin`}
              onPress={() => onNavigate(`/admin/${menu.activeOrg!.org_id}`)}
              tone="admin"
              trailing="chevron"
            />
            <ItemDivider />
            <DropdownItem
              icon="people-outline"
              label="People"
              onPress={() => onNavigate(`/admin/${menu.activeOrg!.org_id}/people`)}
              trailing="count"
              count={menu.counts.seats}
            />
            <ItemDivider />
            <DropdownItem
              icon="card-outline"
              label="Billing & seats"
              onPress={() => onNavigate(`/admin/${menu.activeOrg!.org_id}/billing`)}
              trailing="chevron"
            />
            <ItemDivider />
            <DropdownItem
              icon="shield-half-outline"
              label="SSO & security"
              onPress={() => onNavigate(`/admin/${menu.activeOrg!.org_id}/sso`)}
              trailing="chevron"
            />
            <SectionDivider />
          </>
        )}
        {menu.isAuthor && (
          <>
            <DropdownItem
              icon="create-outline"
              label="Creator Studio"
              onPress={() => onNavigate('/studio')}
              tone="studio"
              trailing="count"
              count={menu.counts.authoredBlueprints}
              countLabel="blueprint"
            />
            {!menu.isAdmin && (
              <>
                <ItemDivider />
                <DropdownItem
                  icon="people-outline"
                  label="Cohorts I mentor"
                  onPress={() => onNavigate('/mentor/cohorts')}
                  trailing="count"
                  count={menu.counts.cohortsMentored}
                />
                <ItemDivider />
                <DropdownItem
                  icon="chatbubbles-outline"
                  label="Subscriber threads"
                  onPress={() => onNavigate('/studio')}
                  trailing="count"
                  count={menu.counts.subscriberThreads}
                  countTone={menu.counts.subscriberThreads > 0 ? 'coral' : 'neutral'}
                />
              </>
            )}
          </>
        )}
      </View>
      <SectionDivider />
    </>
  );
}

// ---------------------------------------------------------------------------
// Reusable bits
// ---------------------------------------------------------------------------

type Tone = 'neutral' | 'studio' | 'admin' | 'author-mode';
type Trailing = 'chevron' | 'count' | 'none';

function DropdownItem({
  icon,
  label,
  subtitle,
  onPress,
  destructive,
  tone = 'neutral',
  trailing = 'chevron',
  count,
  countTone = 'neutral',
  countLabel,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  tone?: Tone;
  trailing?: Trailing;
  count?: number;
  countTone?: 'neutral' | 'coral';
  countLabel?: string;
}) {
  const labelColor = destructive
    ? IOS_COLORS.systemRed
    : tone === 'studio'
    ? '#6B5BBF'
    : tone === 'admin'
    ? '#28406B'
    : tone === 'author-mode'
    ? IOS_COLORS.systemBlue
    : IOS_COLORS.label;
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered, pressed }: any) => [
        s.menuItemPressable,
        (hovered || pressed) && s.menuItemHover,
      ]}
    >
      <View style={s.menuItemRow}>
        <Ionicons
          name={icon as any}
          size={18}
          color={labelColor}
          style={{ marginRight: 12 }}
        />
        <View style={s.menuTextCol}>
          <Text style={[s.menuText, { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
          {subtitle ? (
            <Text style={s.menuSubtext} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing === 'count' && typeof count === 'number' && count >= 0 ? (
          <View style={[s.countPill, countTone === 'coral' && s.countPillCoral]}>
            <Text style={[s.countPillText, countTone === 'coral' && s.countPillTextCoral]}>
              {countLabel ? `${count} ${countLabel}${count === 1 ? '' : 's'}` : String(count)}
            </Text>
          </View>
        ) : null}
        {trailing === 'chevron' && (
          <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
        )}
      </View>
    </Pressable>
  );
}

function ItemDivider() {
  return <View style={s.itemDivider} />;
}

function SectionDivider() {
  return <View style={s.sectionDivider} />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pillToneStyles = StyleSheet.create({
  admin: { backgroundColor: 'rgba(40, 64, 107, 0.12)' },
  faculty: { backgroundColor: 'rgba(107, 91, 191, 0.14)' },
  member: { backgroundColor: 'rgba(60, 60, 67, 0.10)' },
  you: { backgroundColor: 'rgba(60, 60, 67, 0.10)' },
});

const pillToneTextStyles = StyleSheet.create({
  admin: { color: '#28406B' },
  faculty: { color: '#6B5BBF' },
  member: { color: '#3C3C43' },
  you: { color: '#3C3C43' },
});

const s = StyleSheet.create({
  // High zIndex + Android elevation so the open dropdown stacks above
  // sibling top-row icons (+, interest pill) and any content rendered
  // by the surrounding header. Without this the dropdown can be drawn
  // *under* later siblings on Android, and on iOS it can lose to
  // higher-elevation cards in the body.
  container: {
    position: 'relative',
    zIndex: 9999,
    ...Platform.select({ android: { elevation: 24 } }),
  },

  // Guest sign-up button variants (unchanged)
  signUpBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  signUpBtnDark: { backgroundColor: '#FFFFFF' },
  signUpBtnLight: { backgroundColor: IOS_COLORS.systemBlue },
  signUpText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  signUpTextDark: { color: '#1A1A1A' },

  // Avatar
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  avatarLight: { backgroundColor: IOS_COLORS.systemBlue, overflow: 'hidden' },
  avatarGuestLight: { backgroundColor: IOS_COLORS.systemGray3 },
  avatarDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  avatarWithImage: { backgroundColor: 'transparent', borderWidth: 0 },
  avatarText: { color: '#FFFFFF', fontWeight: '600', letterSpacing: 0.2 },
  avatarTextDark: { fontWeight: '700' },

  // Org pip — tiny badge on the avatar showing the active org short name
  orgPip: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#28406B',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgPipText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },

  // Inbox unread badge — top-right of the avatar (org pip sits bottom-right,
  // so the two never collide).
  inboxBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.systemRed,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  inboxBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Backdrop + dropdown card
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
  dropdown: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 0,
    width: 308,
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
      android: { elevation: 12 },
    }),
  },
  dropdownLeft: { left: 0 },
  dropdownRight: { right: 0 },
  dropdownGuest: { width: 260 },

  // Native Modal path: full-screen backdrop so a tap outside closes the menu,
  // and the dropdown re-anchored to the measured avatar window position.
  modalBackdrop: {
    flex: 1,
  },
  dropdownModal: {
    position: 'absolute',
  },
  menuScrollContent: {
    paddingBottom: 8,
  },

  popInner: { paddingVertical: 8 },

  // Identity row (".who" in the design)
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  whoAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  whoAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  whoAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  whoText: { flex: 1, minWidth: 0 },
  whoName: {
    fontSize: 15,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
  },
  whoEmail: { fontSize: 12, color: IOS_COLORS.secondaryLabel, marginTop: 2 },
  // Public profile strip
  publicFaceStrip: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: 'rgba(166, 124, 82, 0.18)',
    overflow: 'hidden',
  },
  publicFaceKicker: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: '700',
    color: '#A67C52',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingHorizontal: 12,
    paddingTop: 10,
    marginBottom: 2,
  },
  publicFaceDesc: {
    fontSize: 12,
    color: '#8A6D4F',
    lineHeight: 16,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  publicFaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: IOS_TOUCH.minHeight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(166, 124, 82, 0.16)',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  publicFaceTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  publicFaceEdit: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    marginLeft: 8,
    marginRight: 6,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  publicFaceEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.systemBlue,
  },

  // Roles section (org member)
  roles: { paddingTop: 4, paddingBottom: 6 },
  rolesKey: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
  },
  roleCardOn: {
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    borderColor: 'rgba(0, 122, 255, 0.30)',
  },
  roleMono: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleMonoSolo: { backgroundColor: IOS_COLORS.systemGray4 },
  roleMonoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  roleMonoTextSolo: { color: IOS_COLORS.label, fontSize: 16, fontWeight: '600' },
  roleLabel: { flex: 1, minWidth: 0 },
  roleOrgName: { fontSize: 13, fontWeight: '600', color: IOS_COLORS.label },
  roleSub: { fontSize: 11, color: IOS_COLORS.secondaryLabel, marginTop: 1 },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  rolePillText: { fontSize: 10, fontFamily: fontFamily.mono, fontWeight: '500', letterSpacing: 0.3 },
  roleCheck: { marginLeft: 2 },

  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: IOS_TOUCH.minHeight,
    gap: 4,
    marginTop: 2,
    marginLeft: 16,
  },
  joinText: { fontSize: 12.5, color: IOS_COLORS.systemBlue, fontWeight: '500' },

  // Link sections
  linkSection: {},
  menuItemPressable: { ...Platform.select({ web: { cursor: 'pointer' } as any }) },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: IOS_TOUCH.minHeight,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemHover: { backgroundColor: IOS_COLORS.tertiarySystemFill },
  menuTextCol: { flex: 1, minWidth: 0, marginRight: 8 },
  menuText: { fontSize: 14, fontWeight: '500' },
  menuSubtext: { fontSize: 11.5, color: IOS_COLORS.secondaryLabel, marginTop: 2 },

  // Count badge
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(60, 60, 67, 0.08)',
  },
  countPillCoral: { backgroundColor: IOS_COLORS.systemRed },
  countPillText: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    fontVariant: ['tabular-nums'],
  },
  countPillTextCoral: { color: '#FFFFFF' },

  // Dividers
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
    marginLeft: 46,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
    marginVertical: 6,
  },

  // Guest auth menu (unchanged behavior)
  guestMenu: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  guestHeading: {
    fontSize: 17,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  guestSubtext: { fontSize: 13, lineHeight: 18, color: '#6B7280', marginBottom: 14 },
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
  guestPrimaryBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  guestSecondaryBtn: { alignItems: 'center', paddingVertical: 4 },
  guestSecondaryBtnText: { fontSize: 13, color: '#6B7280' },
  guestSecondaryBtnLink: { color: IOS_COLORS.systemBlue, fontWeight: '600' },
});

export default ProfileDropdown;
