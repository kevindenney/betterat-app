import { mapReflectProfileToProfileScreen } from '../mapReflectProfile';
import type { ReflectProfileData } from '@/hooks/useReflectProfile';
import type { Interest } from '@/providers/InterestProvider';

const interests: Interest[] = [
  {
    id: 'n1',
    slug: 'nursing',
    name: 'Nursing',
    description: null,
    parent_id: null,
    type: 'official',
    status: 'active',
    visibility: 'public',
    accent_color: '#0EA5E9',
    icon_name: 'medkit',
    organization_id: null,
    hero_tagline: null,
    pricing_text: null,
    web_app_url: null,
    created_at: '2026-01-01',
  },
  {
    id: 's1',
    slug: 'sail-racing',
    name: 'Sail Racing',
    description: null,
    parent_id: null,
    type: 'official',
    status: 'active',
    visibility: 'public',
    accent_color: '#2563EB',
    icon_name: 'boat',
    organization_id: null,
    hero_tagline: null,
    pricing_text: null,
    web_app_url: null,
    created_at: '2026-01-01',
  },
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

  const result = mapReflectProfileToProfileScreen(
    data,
    interests,
    interests[0],
    {
      windUnit: 'm/s',
      distanceUnit: 'metric',
      weeklyDigestOn: true,
      resurfaceOldCapturesOn: false,
      privateModeOn: false,
    },
  );

  expect(result.hero.name).toBe('Emily Chen');
  expect(result.identity.email).toBe('emily@example.com');
  expect(result.interests.find((interest) => interest.id === 'n1')?.kind).toBe(
    'primary',
  );
  expect(result.hero.name).not.toBe('Felix Brennan');
});
