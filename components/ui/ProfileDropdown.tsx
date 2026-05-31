/**
 * ProfileDropdown
 *
 * Role-and-context switcher (Frames 1–3 of the Creator Studio & Org Admin
 * design pass). The popover descends from the avatar in every screen's top
 * header and shapes itself to who's looking at it:
 *
 *   - Solo subscriber (Felix): identity · plan card · Profile/Notifications/
 *     Subscribed/Start authoring · Help · Sign out
 *   - Faculty + author (Dr. Murphy at Hopkins): identity · roles · Creator
 *     Studio/Cohorts/Threads · standard utility · Sign out of Hopkins
 *   - Org admin (Dean Park): identity · roles · Hopkins admin/People/Billing/
 *     SSO · Creator Studio · standard utility · Sign out of Hopkins
 *
 * The variants share one component; section visibility is driven by
 * useProfileMenuData().
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
import { useProfileMenuData, OrgMembership } from '@/hooks/useProfileMenuData';
import { useInterest } from '@/providers/InterestProvider';
import { IOS_COLORS, IOS_ANIMATIONS } from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { HomeVenuePickerSheet } from '@/components/discover/HomeVenuePickerSheet';

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

export function ProfileDropdown({
  variant = 'light',
  size = 30,
  menuAlign = 'right',
  currentInterestSlug,
}: ProfileDropdownProps) {
  const { user, userProfile, isGuest, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const scale = useSharedValue(1);
  const menu = useProfileMenuData();
  const homeVenue = useUserHomeVenue();
  const { switchInterest, userInterests } = useInterest();

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

  const handleClose = () => setOpen(false);
  const navigate = (path: string) => {
    setOpen(false);
    router.push(path as any);
  };
  const openVenuePicker = () => {
    setOpen(false);
    setVenuePickerOpen(true);
  };
  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };
  // Switch the active context to an org by switching to that org's interest
  // (active-org is derived from the active interest; see useProfileMenuData).
  // An org with no interest mapping can't be switched-to, so fall back to
  // opening its page instead.
  const handleSwitchToOrg = async (org: OrgMembership) => {
    setOpen(false);
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
  // "Personal" isn't its own interest — it's the absence of an org mapping.
  // Switching to it means jumping to the user's first interest not covered
  // by any org membership.
  const handleSwitchToPersonal = async () => {
    setOpen(false);
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

  return (
    <View style={s.container}>
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

      {open && (
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
            {isLoggedIn ? (
              <LoggedInMenu
                displayName={displayName}
                email={user?.email ?? null}
                initials={initials}
                showAvatarImage={showAvatarImage}
                safeAvatarUrl={safeAvatarUrl}
                menu={menu}
                homeVenueName={homeVenue?.venue ?? null}
                onNavigate={navigate}
                onOpenVenuePicker={openVenuePicker}
                onSignOut={handleSignOut}
                onSwitchToOrg={handleSwitchToOrg}
                onSwitchToPersonal={handleSwitchToPersonal}
              />
            ) : (
              <View style={s.guestMenu}>
                <Text style={s.guestHeading}>Save your progress</Text>
                <Text style={s.guestSubtext}>
                  Create a free account to keep your work safe and pick up where you left off on
                  any device.
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
                    navigate(`/(auth)/login?returnTo=${encodeURIComponent(pathname)}`)
                  }
                >
                  <Text style={s.guestSecondaryBtnText}>
                    Already have an account?{' '}
                    <Text style={s.guestSecondaryBtnLink}>Log In</Text>
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      )}

      <HomeVenuePickerSheet
        visible={venuePickerOpen}
        onDismiss={() => setVenuePickerOpen(false)}
        onSaved={() => setVenuePickerOpen(false)}
      />
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
  homeVenueName,
  onNavigate,
  onOpenVenuePicker,
  onSignOut,
  onSwitchToOrg,
  onSwitchToPersonal,
}: {
  displayName: string;
  email: string | null;
  initials: string;
  showAvatarImage: boolean;
  safeAvatarUrl: string | null;
  menu: ReturnType<typeof useProfileMenuData>;
  homeVenueName: string | null;
  onNavigate: (path: string) => void;
  onOpenVenuePicker: () => void;
  onSignOut: () => void;
  onSwitchToOrg: (org: OrgMembership) => void;
  onSwitchToPersonal: () => void;
}) {
  const signOutLabel = menu.activeOrg
    ? `Sign out of ${menu.activeOrg.org_name.split(' ').slice(0, 2).join(' ')}`
    : 'Sign out';

  return (
    <View style={s.popInner}>
      <IdentityRow
        displayName={displayName}
        email={email}
        initials={initials}
        showAvatarImage={showAvatarImage}
        safeAvatarUrl={safeAvatarUrl}
        onEditProfile={() => onNavigate('/settings/edit-profile')}
      />

      {menu.hasActiveOrg ? (
        <RolesSection
          memberships={menu.memberships}
          activeOrg={menu.activeOrg}
          onSwitchToOrg={onSwitchToOrg}
          onSwitchToPersonal={onSwitchToPersonal}
          onJoinOrg={() => onNavigate('/(tabs)/library?zone=orgs')}
        />
      ) : (
        <PlanCardMini plan={menu.plan} />
      )}

      {(menu.isAdmin || menu.isAuthor) && (
        <RoleShortcuts menu={menu} onNavigate={onNavigate} />
      )}

      <View style={s.linkSection}>
        <DropdownItem
          icon="person-outline"
          label="Profile & settings"
          onPress={() => onNavigate('/account')}
          trailing="chevron"
        />
        {homeVenueName ? (
          <>
            <ItemDivider />
            <DropdownItem
              icon="location-outline"
              label={homeVenueName}
              onPress={onOpenVenuePicker}
              trailing="chevron"
            />
          </>
        ) : null}
        {!menu.isAuthor && !menu.isAdmin && (
          <>
            <ItemDivider />
            <DropdownItem
              icon="git-branch-outline"
              label="Subscribed blueprints"
              onPress={() => onNavigate('/library')}
              trailing="count"
              count={menu.counts.subscribedBlueprints}
            />
          </>
        )}

        {menu.isSolo && !menu.isAuthor && (
          <>
            <SectionDivider />
            <DropdownItem
              icon="create-outline"
              label="Start authoring a blueprint"
              onPress={() => onNavigate('/studio?empty=true')}
              tone="author-mode"
              trailing="chevron"
            />
          </>
        )}
      </View>

      <SectionDivider />

      <View style={s.linkSection}>
        {FEATURE_FLAGS.WHATSAPP_CONNECT_V3 ? (
          <DropdownItem
            icon="chatbubbles-outline"
            label="Connected services"
            onPress={() => onNavigate('/account/connected-services')}
            trailing="chevron"
          />
        ) : null}
        <DropdownItem
          icon="help-circle-outline"
          label="Help & feedback"
          onPress={() => onNavigate('/help')}
          trailing="chevron"
        />
        <DropdownItem
          icon="log-out-outline"
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
  onEditProfile,
}: {
  displayName: string;
  email: string | null;
  initials: string;
  showAvatarImage: boolean;
  safeAvatarUrl: string | null;
  onEditProfile: () => void;
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
      <Pressable
        onPress={onEditProfile}
        accessibilityLabel="Edit profile"
        accessibilityRole="button"
        hitSlop={8}
        style={({ hovered, pressed }: any) => [
          s.whoEditButton,
          (hovered || pressed) && s.whoEditButtonActive,
        ]}
      >
        <Ionicons name="pencil-outline" size={16} color={IOS_COLORS.tertiaryLabel} />
      </Pressable>
    </View>
  );
}

function PlanCardMini({
  plan,
}: {
  plan: ReturnType<typeof useProfileMenuData>['plan'];
}) {
  if (!plan) return null;
  return (
    <View style={s.planCardMini}>
      <View style={s.planBadge}>
        <Text style={s.planBadgeText}>+</Text>
      </View>
      <View style={s.planCol}>
        <Text style={s.planName}>{plan.label}</Text>
        {!!plan.renewsAt && (
          <Text style={s.planSub}>
            Renews {plan.renewsAt}
            {plan.pricePerYear != null ? ` · $${plan.pricePerYear} / yr` : ''}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
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
      <Text style={s.rolesKey}>Signed in at</Text>
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
      style={({ pressed }: any) => [s.roleCard, current && s.roleCardOn, pressed && s.roleCardPressed]}
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
      style={({ pressed }: any) => [s.roleCard, active && s.roleCardOn, pressed && s.roleCardPressed]}
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
              onPress={() => onNavigate(`/admin/${menu.activeOrg!.org_id}/security`)}
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
                  onPress={() => onNavigate('/studio/threads')}
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
        <Text style={[s.menuText, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
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
  orgPipText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700', letterSpacing: 0.2 },

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
  whoName: { fontSize: 15, fontWeight: '600', color: IOS_COLORS.label },
  whoEmail: { fontSize: 12, color: IOS_COLORS.secondaryLabel, marginTop: 2 },
  whoEditButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  whoEditButtonActive: { backgroundColor: IOS_COLORS.tertiarySystemFill },

  // Plan card mini (solo subscriber)
  planCardMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
  },
  planBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBadgeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  planCol: { flex: 1, minWidth: 0 },
  planName: { fontSize: 13, fontWeight: '600', color: IOS_COLORS.label },
  planSub: { fontSize: 11, color: IOS_COLORS.secondaryLabel, marginTop: 1 },

  // Roles section (org member)
  roles: { paddingTop: 4, paddingBottom: 6 },
  rolesKey: {
    fontSize: 11,
    fontWeight: '600',
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
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
  },
  roleCardOn: {
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    borderColor: 'rgba(0, 122, 255, 0.30)',
  },
  roleCardPressed: { opacity: 0.6 },
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
    fontWeight: '700',
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
  rolePillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  roleCheck: { marginLeft: 2 },

  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  menuItemHover: { backgroundColor: IOS_COLORS.tertiarySystemFill },
  menuText: { fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8 },

  // Count badge
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(60, 60, 67, 0.08)',
  },
  countPillCoral: { backgroundColor: 'rgba(255, 107, 107, 0.15)' },
  countPillText: { fontSize: 11, fontWeight: '600', color: IOS_COLORS.secondaryLabel },
  countPillTextCoral: { color: '#C84747' },

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
  guestHeading: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 4 },
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
