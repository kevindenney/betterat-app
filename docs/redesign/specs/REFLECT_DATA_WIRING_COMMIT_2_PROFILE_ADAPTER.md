# Reflect Data Wiring Commit 2 Spec: Profile Adapter

## Files

Add:

- `lib/reflect/mapReflectProfile.ts`
- `hooks/useReflectProfileScreenData.ts`
- `lib/reflect/__tests__/mapReflectProfile.test.ts`

## Mapper Code

Add `lib/reflect/mapReflectProfile.ts`:

```ts
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
  const name = profile.displayName || 'BetterAt member';
  const handle = `@${slugifyHandle(name)}`;
  const metaSpans = [
    profile.memberSince ? `Member since ${formatMonthYear(profile.memberSince)}` : null,
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
  if (icon === 'medkit' || icon === 'fitness' || icon === 'book' || icon === 'camera' || icon === 'boat') {
    return icon;
  }
  if (interest.slug === 'nursing') return 'medkit';
  if (interest.slug === 'sail-racing') return 'boat';
  return 'ellipse';
}

function initialsForName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'BA';
}

function slugifyHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'betterat';
}

function formatMonthYear(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
```

## Hook Code

Add `hooks/useReflectProfileScreenData.ts`:

```ts
import { useMemo, useState } from 'react';
import { useInterest } from '@/providers/InterestProvider';
import { useReflectProfile } from '@/hooks/useReflectProfile';
import {
  mapReflectProfileToProfileScreen,
  type ProfilePreferenceState,
} from '@/lib/reflect/mapReflectProfile';

export function useReflectProfileScreenData() {
  const profile = useReflectProfile();
  const { userInterests, currentInterest } = useInterest();
  const isSailing = currentInterest?.slug === 'sail-racing';
  const [windUnit, setWindUnit] = useState<ProfilePreferenceState['windUnit']>(
    isSailing ? 'knots' : 'm/s',
  );
  const [distanceUnit, setDistanceUnit] = useState<ProfilePreferenceState['distanceUnit']>(
    isSailing ? 'nautical' : 'metric',
  );
  const [weeklyDigestOn, setWeeklyDigestOn] = useState(true);
  const [resurfaceOldCapturesOn, setResurfaceOldCapturesOn] = useState(true);
  const [privateModeOn, setPrivateModeOn] = useState(false);

  const props = useMemo(() => {
    if (!profile.data) return null;
    return mapReflectProfileToProfileScreen(
      profile.data,
      userInterests,
      currentInterest,
      {
        windUnit,
        distanceUnit,
        weeklyDigestOn,
        resurfaceOldCapturesOn,
        privateModeOn,
      },
    );
  }, [
    currentInterest,
    distanceUnit,
    privateModeOn,
    profile.data,
    resurfaceOldCapturesOn,
    userInterests,
    weeklyDigestOn,
    windUnit,
  ]);

  return {
    props,
    loading: profile.loading,
    error: profile.error,
    refresh: profile.refresh,
    handlers: {
      setWindUnit,
      setDistanceUnit,
      setWeeklyDigestOn,
      setResurfaceOldCapturesOn,
      setPrivateModeOn,
    },
  };
}

export type UseReflectProfileScreenDataResult = ReturnType<typeof useReflectProfileScreenData>;
```

## Tests

Add `lib/reflect/__tests__/mapReflectProfile.test.ts`:

```ts
import { mapReflectProfileToProfileScreen } from '../mapReflectProfile';
import type { ReflectProfileData } from '@/hooks/useReflectProfile';
import type { Interest } from '@/providers/InterestProvider';

const interests: Interest[] = [
  { id: 'n1', slug: 'nursing', name: 'Nursing', description: null, parent_id: null, type: 'official', status: 'active', visibility: 'public', accent_color: '#0EA5E9', icon_name: 'medkit', organization_id: null, hero_tagline: null, pricing_text: null, web_app_url: null, created_at: '2026-01-01' },
  { id: 's1', slug: 'sail-racing', name: 'Sail Racing', description: null, parent_id: null, type: 'official', status: 'active', visibility: 'public', accent_color: '#2563EB', icon_name: 'boat', organization_id: null, hero_tagline: null, pricing_text: null, web_app_url: null, created_at: '2026-01-01' },
];

it('maps real profile identity instead of Felix fixture copy', () => {
  const data = {
    profile: {
      userId: 'u1',
      displayName: 'Emily Chen',
      email: 'emily@example.com',
      avatarUrl: null,
      avatarInitials: 'EC',
      bio: 'Clinical rotations and simulation lab.',
      location: 'Washington, DC',
      homeClub: null,
      sailingSince: null,
      followerCount: 0,
      followingCount: 0,
    },
    stats: {},
    venuesVisited: [],
    boats: [],
    achievements: [],
    personalRecords: [],
    challenges: [],
    recentActivity: [],
    goals: [],
    insights: [],
    sailorComparisons: [],
    boatsWithMaintenance: [],
    trainingPlans: [],
    venuesWithCoordinates: [],
    seasonRecap: undefined,
    courseRecords: [],
    racePhotos: [],
    raceJournal: [],
  } as unknown as ReflectProfileData;

  const result = mapReflectProfileToProfileScreen(data, interests, interests[0], {
    windUnit: 'm/s',
    distanceUnit: 'metric',
    weeklyDigestOn: true,
    resurfaceOldCapturesOn: false,
    privateModeOn: false,
  });

  expect(result.hero.name).toBe('Emily Chen');
  expect(result.identity.email).toBe('emily@example.com');
  expect(result.interests.find((interest) => interest.id === 'n1')?.kind).toBe('primary');
  expect(result.hero.name).not.toBe('Felix Brennan');
});
```

## Performance Assertion

No new network calls beyond `useReflectProfile()` and `InterestProvider`. Mapping is O(number of user interests).

## Commit Message

```text
feat(redesign): add Reflect Profile real-data adapter

Add the production adapter for the iOS-register Profile segment.

- maps useReflectProfile data into ProfileScreen props
- maps userInterests/currentInterest into Profile interest chips
- preserves local v1 preference toggles without sample identity fixtures
- leaves billing/preferences writeback as documented follow-ups
```

