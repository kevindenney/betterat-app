import type { YachtClubOrganization } from '@/services/YachtClubClaimService';

export const YACHT_CLUB_DEMO_SLUG = 'harborview-yacht-club-demo';
export const YACHT_CLUB_DEMO_NAME = 'Harborview Yacht Club Demo';
export const YACHT_CLUB_DEMO_CITY = 'Hong Kong waters';
export const YACHT_CLUB_DEMO_COUNTRY = 'Hong Kong';
export const YACHT_CLUB_DEMO_TAGLINE = 'Dragon club in Hong Kong waters';
export const YACHT_CLUB_DEMO_LOCATION = {
  lat: 22.2385,
  lng: 114.2895,
};

export const YACHT_CLUB_DEMO_STATS = [
  { value: '32', label: 'Sample members' },
  { value: '3', label: 'Sample fleets' },
  { value: '6', label: 'Upcoming events' },
  { value: '5', label: 'Club contacts' },
] as const;

export const YACHT_CLUB_DEMO_FOCUS = 'Spring training block with Dragons, juniors, and member race nights.';

export const YACHT_CLUB_DEMO_PROFILE = [
  { label: 'Public email', value: 'membership@harborview.example' },
  { label: 'Home waters', value: YACHT_CLUB_DEMO_CITY },
  { label: 'Primary class', value: 'Dragon' },
  { label: 'Public since', value: 'May 2026' },
  { label: 'Membership', value: '32 sample members' },
] as const;

export const YACHT_CLUB_DEMO_SURFACES = [
  { key: 'calendar', label: 'Club calendar', detail: 'Race nights, work parties, and notices', route: '/(tabs)/calendar' },
  { key: 'races', label: 'Races', detail: 'Weekly points, weekend starts, and regattas', route: '/(tabs)/races' },
  { key: 'fleets', label: 'Fleets', detail: 'Dragons, cruisers, and juniors', route: '/organization/cohorts' },
  { key: 'classes', label: 'Major races / classes', detail: 'Dragon, J/70, and club regatta paths', route: '/catalog-race' },
  { key: 'programs', label: 'Programs', detail: 'Junior clinics, coaching, and learn-to-sail', route: '/organization/templates' },
  { key: 'social', label: 'Social calendar', detail: 'Dinners, launch weekends, and bar nights', route: '/(tabs)/events' },
  { key: 'membership', label: 'Membership', detail: 'Who can join, fees, and the claim path', route: '/organization/members' },
] as const;

export const YACHT_CLUB_DEMO_FLEETS = [
  { name: 'Harborview Dragons', note: 'Tuesday and weekend training' },
  { name: 'Harborview Cruisers', note: 'Family and social fleet' },
  { name: 'Harborview Juniors', note: 'Youth development and clinic days' },
] as const;

export const YACHT_CLUB_DEMO_CALENDAR = [
  { title: 'Wednesday evening race', detail: 'Weekly harbor short-course' },
  { title: 'Sunday fleet clinic', detail: 'Starts, tacks, and mark roundings' },
  { title: 'Saturday junior practice', detail: 'Intro racing and boathandling' },
  ] as const;

export const YACHT_CLUB_DEMO_RACES = [
  { title: 'Harbor Series', detail: 'Weekly points through the summer' },
  { title: 'Weekend start practice', detail: 'Short line, repeat starts, fleet tuning' },
  { title: 'Founders Cup', detail: 'One-design club regatta with mixed fleets' },
  ] as const;

export const YACHT_CLUB_DEMO_MAJOR_CLASSES = [
  { title: 'Dragon', detail: 'Primary keelboat fleet' },
  { title: 'J/70', detail: 'One-design regatta path' },
  { title: 'Etchells', detail: 'Guest class and training nights' },
  ] as const;

export const YACHT_CLUB_DEMO_PROGRAMS = [
  { title: 'Junior sailing', detail: 'Weekends, clinics, and holiday blocks' },
  { title: 'Women on the water', detail: 'Skills nights and race support' },
  { title: 'Race coach clinic', detail: 'Tactics, starts, and debriefs' },
  ] as const;

export const YACHT_CLUB_DEMO_SOCIAL_CALENDAR = [
  { title: 'Friday bar night', detail: 'Members and guests after 18:00' },
  { title: 'Commodore dinner', detail: 'Monthly formal club dinner' },
  { title: 'Launch weekend', detail: 'Season opening and volunteer thank-you' },
  ] as const;

export const YACHT_CLUB_DEMO_MEMBERSHIP = [
  { title: '32 sample members', detail: 'Illustrates public member count and profile depth' },
  { title: 'Free placeholder', detail: 'Claimable only for the real club' },
  { title: 'Claim review', detail: 'BetterAt admin approval before official status' },
  ] as const;

export function isYachtClubDemoSlug(slug: string | null | undefined): boolean {
  return String(slug || '').trim().toLowerCase() === YACHT_CLUB_DEMO_SLUG;
}

export function getYachtClubDemoOrganization(): YachtClubOrganization {
  return {
    id: '00000000-0000-4000-8000-0000000000da',
    name: YACHT_CLUB_DEMO_NAME,
    slug: YACHT_CLUB_DEMO_SLUG,
    organization_type: 'yacht_club',
    status: 'placeholder',
    official: false,
    claim_status: 'unclaimed',
    confidence: 'high',
    source: 'betterat_demo',
    source_summary: 'Synthetic demo organization for yacht-club product walkthroughs.',
    source_urls: [],
    aliases: ['Harborview Demo', 'Demo Yacht Club', 'BetterAt Yacht Club Demo'],
    risk_flags: ['synthetic-demo', 'not-claimable'],
    clubspot_apac_entry_refs: 0,
    clubspot_worlds_entry_refs: 0,
    total_entry_refs: 0,
    pricing_tier: 'club_free',
  };
}

export const YACHT_CLUB_DEMO_TIERS = [
  {
    tier: 'club_free',
    label: 'Free',
    price: '$0',
    cadence: 'per month',
    audience: 'For clubs getting onto BetterAt',
    description: 'Public placeholder, claim flow, and a simple starter club page.',
    includes: ['Claimable placeholder page', 'Open map handoff', 'Basic org review', 'Public discovery listing'],
    highlight: true,
  },
  {
    tier: 'club_plus',
    label: 'Club Plus',
    price: '$49',
    cadence: 'per month',
    audience: 'For official club presence',
    description: 'Claimed club profile with member-facing content and light admin control.',
    includes: ['Member updates', 'Public fleet list', 'Priority claim review', 'Named club contacts'],
  },
  {
    tier: 'club_pro',
    label: 'Regatta Pro',
    price: '$149',
    cadence: 'per month',
    audience: 'For active fleets and regattas',
    description: 'Fleet lens, event publishing, and stronger operational tools for busy clubs.',
    includes: ['Fleet-scoped lens', 'Event publishing', 'Club analytics', 'Atlas activity view'],
  },
  {
    tier: 'enterprise',
    label: 'Institutional',
    price: 'Custom',
    cadence: '',
    audience: 'For schools, hospitals, and enterprise orgs',
    description: 'Reserved for institutional customers outside the yacht-club path.',
    includes: ['Custom onboarding', 'Institutional pricing', 'Dedicated support', 'SSO and procurement'],
  },
] as const;

export const YACHT_CLUB_DEMO_FEATURES = [
  'Public page with map, identity, and a clear claim path for real clubs',
  'Linked club surfaces for calendar, races, fleets, classes, programs, social, and membership',
  'Claim review queue for BetterAt admins',
  'Tiered pricing that keeps the club default free',
  'Example fleets, calendars, and membership details so the club page feels complete',
] as const;
