import type { Ionicons } from '@expo/vector-icons';
import type {
  ProfileHero,
  ProfileIdentityFields,
  ProfileInterest,
  ProfilePlan,
  ProfilePreferencesFields,
  ProfileReflectFields,
} from '@/components/ios-register/ProfileScreen';
import type { ReflectProfileData } from '@/hooks/useReflectProfile';
import type { Interest } from '@/providers/InterestProvider';

export interface ProfileScreenData {
  hero: ProfileHero;
  interests: ProfileInterest[];
  identity: ProfileIdentityFields;
  preferences: ProfilePreferencesFields;
  reflect: ProfileReflectFields;
  plan: ProfilePlan;
}

export interface ProfilePreferenceState {
  windUnit: 'knots' | 'm/s' | 'mph';
  distanceUnit: 'nautical' | 'metric';
  weeklyDigestOn: boolean;
  resurfaceOldCapturesOn: boolean;
  privateModeOn: boolean;
}

export function mapReflectProfileToProfileScreen(
  data: ReflectProfileData,
  userInterests: Interest[],
  currentInterest: Interest | null,
  preferenceState: ProfilePreferenceState,
): ProfileScreenData {
  const profile = data.profile;
  // Spec adjustment: memberSince lives on data.stats.memberSince in the
  // repo's existing ReflectProfileData shape, not data.profile.memberSince
  // as the spec assumed. Reading from stats avoids changing the public
  // type's shape outside this commit. See commit message.
  const memberSince = data.stats?.memberSince ?? null;
  const name = profile.displayName || 'BetterAt member';
  const handle = `@${slugifyHandle(name)}`;
  const metaSpans = [
    memberSince ? `Member since ${formatMonthYear(memberSince)}` : null,
    profile.location,
  ].filter((value): value is string => Boolean(value));

  return {
    hero: {
      initials: profile.avatarInitials || initialsForName(name),
      name,
      handle,
      metaSpans,
    },
    interests: userInterests.map((interest) => ({
      id: interest.id,
      label: interest.name,
      icon: iconForInterest(interest),
      kind: interest.id === currentInterest?.id ? 'primary' : 'standard',
    })),
    identity: {
      name,
      handle,
      email: profile.email ?? '',
      bio: profile.bio ?? undefined,
    },
    preferences: {
      notificationsValue: 'Activity & weekly',
      windUnit: preferenceState.windUnit,
      distanceUnit: preferenceState.distanceUnit,
      appearanceValue: 'System',
      languageValue: 'English',
    },
    reflect: {
      captureStyleValue: 'Voice first',
      weeklyDigestOn: preferenceState.weeklyDigestOn,
      resurfaceOldCapturesOn: preferenceState.resurfaceOldCapturesOn,
      privateModeOn: preferenceState.privateModeOn,
    },
    plan: {
      name: 'Current plan',
      sub: 'Manage billing from Account',
      badge: '+',
    },
  };
}

function iconForInterest(interest: Interest): keyof typeof Ionicons.glyphMap {
  const icon = interest.icon_name;
  if (
    icon === 'medkit' ||
    icon === 'fitness' ||
    icon === 'book' ||
    icon === 'camera' ||
    icon === 'boat'
  ) {
    return icon;
  }
  if (interest.slug === 'nursing') return 'medkit';
  if (interest.slug === 'sail-racing') return 'boat';
  return 'ellipse';
}

function initialsForName(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'BA'
  );
}

function slugifyHandle(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'betterat'
  );
}

function formatMonthYear(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
