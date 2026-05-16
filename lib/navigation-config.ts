/**
 * Navigation Configuration - Single source of truth for navigation items
 *
 * Shared between:
 * - app/(tabs)/_layout.tsx (tab bar config)
 * - components/navigation/NavigationDrawer.tsx (mobile drawer)
 * - components/navigation/WebSidebarNav.tsx (web sidebar)
 */

import type { Ionicons } from '@expo/vector-icons';
import type { UserCapabilities } from '@/providers/AuthProvider';
import type { VocabularyMap } from '@/lib/vocabulary';

// =============================================================================
// TYPES
// =============================================================================

export type TabConfig = {
  name: string;
  title: string;
  icon: string;
  iconFocused?: string;
  isMenuTrigger?: boolean;
  emoji?: string;
};

export interface NavItem {
  key: string;
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export type WorkspaceNavContext = {
  organizationType?: string | null;
  activeDomain?: string | null;
  isOrgAdmin?: boolean;
};

const isProgramWorkspace = (
  organizationType?: string | null,
  activeDomain?: string | null
): boolean => {
  const domain = String(activeDomain || '').toLowerCase().trim();
  if (domain === 'sailing') return false;
  if (domain === 'nursing' || domain === 'drawing' || domain === 'fitness' || domain === 'health-and-fitness' || domain === 'lac-craft-business') return true;
  return organizationType === 'institution';
};

/**
 * Get the route to the user's primary timeline / event tab.
 *
 * - Org admins in a program workspace land on `/(tabs)/events`.
 * - Learners (sailing, nursing, etc.) land on `/(tabs)/practice`, the canonical
 *   product route. `/(tabs)/races` remains the legacy implementation route and
 *   compatibility alias while the route tree is migrated.
 *
 * This helper centralizes the route literal so the future rename tracked as
 * audit finding E5 only needs to touch one place.
 */
export const getEventTabRoute = (workspaceContext?: WorkspaceNavContext): string => {
  if (
    workspaceContext?.isOrgAdmin &&
    isProgramWorkspace(workspaceContext.organizationType, workspaceContext.activeDomain)
  ) {
    return '/(tabs)/events';
  }
  return '/(tabs)/practice';
};

// =============================================================================
// TAB CONFIGURATION (for tab bar / bottom nav)
// =============================================================================

/**
 * Get the vocabulary-aware event tab title.
 * Maps "Learning Event" vocabulary term to a short tab label.
 */
const getEventTabTitle = (
  vocabulary?: VocabularyMap,
  activeDomain?: string | null
): string => {
  const domain = String(activeDomain || '').toLowerCase().trim();
  const defaultLabel = domain === 'sailing' ? 'Race' : 'Practice';
  if (!vocabulary) return defaultLabel;
  const term = vocabulary['Learning Event'];
  if (!term) return defaultLabel;
  // Use the first word for short tab labels (e.g., "Clinical Shift" → "Shift")
  const words = term.split(' ');
  return words.length > 1 ? words[words.length - 1] : term;
};

/**
 * Get tabs for a user based on their type, capabilities, and vocabulary.
 * For sailors with coaching capability, adds coach tabs to sailor tabs.
 * The vocabulary parameter adapts tab labels to the current interest.
 */
export const getTabsForUserType = (
  userType: string | null,
  isGuest: boolean = false,
  capabilities?: UserCapabilities,
  vocabulary?: VocabularyMap,
  workspaceContext?: WorkspaceNavContext
): TabConfig[] => {
  const eventTitle = getEventTabTitle(vocabulary, workspaceContext?.activeDomain);

  // Guests get full learner-style tabs (same as logged-in learners)
  if (isGuest) {
    return [
      { name: 'races', title: eventTitle, icon: 'flag-outline', iconFocused: 'flag' },
      { name: 'playbook', title: 'Playbook', icon: 'book-outline', iconFocused: 'book' },
      { name: 'discover', title: 'Discover', icon: 'compass-outline', iconFocused: 'compass' },
      { name: 'reflect', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
    ];
  }

  // Club/institution admins get their own dedicated tabs (unchanged)
  if (userType === 'club') {
    if (isProgramWorkspace(workspaceContext?.organizationType, workspaceContext?.activeDomain)) {
      return [
        { name: 'events', title: 'Workspace', icon: 'grid-outline', iconFocused: 'grid' },
        { name: 'members', title: 'People', icon: 'people-outline', iconFocused: 'people' },
        { name: 'programs', title: 'Programs & Placements', icon: 'school-outline', iconFocused: 'school' },
        { name: 'profile', title: 'Org', icon: 'business-outline', iconFocused: 'business' },
        { name: 'settings', title: 'Settings', icon: 'cog-outline', iconFocused: 'cog' },
      ];
    }

    return [
      { name: 'events', title: 'Events', icon: 'calendar-outline', iconFocused: 'calendar' },
      { name: 'members', title: 'Members', icon: 'people-outline', iconFocused: 'people' },
      { name: 'race-management', title: 'Programs & Placements', icon: 'flag-outline', iconFocused: 'flag' },
      { name: 'profile', title: 'Club', icon: 'business-outline', iconFocused: 'business' },
      { name: 'settings', title: 'Settings', icon: 'cog-outline', iconFocused: 'cog' },
    ];
  }

  // Legacy coach users now get the same tabs as learners (coach persona deprecated)
  // Existing coaches with hasCoaching capability still get coaching tabs below.

  // Learners (sailors, nurses, artists, athletes — including those with coaching capability)
  if (userType === 'sailor' || userType === 'coach') {
    const tabs: TabConfig[] = [
      { name: 'races', title: eventTitle, icon: 'flag-outline', iconFocused: 'flag' },
      { name: 'playbook', title: 'Playbook', icon: 'book-outline', iconFocused: 'book' },
      { name: 'discover', title: 'Discover', icon: 'compass-outline', iconFocused: 'compass' },
      { name: 'reflect', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
    ];

    // Add coaching tabs if user has coaching capability
    if (capabilities?.hasCoaching) {
      tabs.push(
        { name: 'clients', title: 'Clients', icon: 'people-outline', iconFocused: 'people' },
        { name: 'schedule', title: 'Schedule', icon: 'calendar-outline', iconFocused: 'calendar' },
        { name: 'earnings', title: 'Earnings', icon: 'cash-outline', iconFocused: 'cash' },
      );
    }

    return tabs;
  }

  // No tabs for non-logged-in users
  return [];
};

// =============================================================================
// SIDEBAR / DRAWER NAVIGATION ITEMS
// =============================================================================

// Navigation items by persona (used by NavigationDrawer and WebSidebarNav)
export const SAILOR_NAV_ITEMS: NavItem[] = [
  { key: 'races', label: 'Race', route: '/(tabs)/practice', icon: 'flag-outline' },
  { key: 'playbook', label: 'Playbook', route: '/(tabs)/playbook', icon: 'book-outline' },
  { key: 'discover', label: 'Discover', route: '/(tabs)/discover', icon: 'compass-outline' },
  { key: 'reflect', label: 'Profile', route: '/(tabs)/reflect', icon: 'person-circle-outline' },
];

export const SAILOR_SECONDARY_ITEMS: NavItem[] = [
  { key: 'search', label: 'Search', route: '/(tabs)/search', icon: 'search-outline' },
];

export const COACH_NAV_ITEMS: NavItem[] = [
  { key: 'clients', label: 'Clients', route: '/(tabs)/clients', icon: 'people-outline' },
  { key: 'schedule', label: 'Schedule', route: '/(tabs)/schedule', icon: 'calendar-outline' },
  { key: 'earnings', label: 'Earnings', route: '/(tabs)/earnings', icon: 'cash-outline' },
];

export const CLUB_NAV_ITEMS: NavItem[] = [
  { key: 'events', label: 'Events', route: '/(tabs)/events', icon: 'calendar-outline' },
  { key: 'members', label: 'Members', route: '/(tabs)/members', icon: 'people-outline' },
  { key: 'racing', label: 'Programs & Placements', route: '/(tabs)/programs', icon: 'flag-outline' },
  { key: 'club', label: 'Club', route: '/(tabs)/profile', icon: 'business-outline' },
];

export const COMMON_FOOTER_ITEMS: NavItem[] = [
  { key: 'settings', label: 'Settings', route: '/(tabs)/settings', icon: 'settings-outline' },
  { key: 'account', label: 'Account', route: '/account', icon: 'person-outline' },
];

export const LEARNER_FOOTER_ITEMS: NavItem[] = [];

export const INSTITUTION_FOOTER_ITEMS: NavItem[] = [
  { key: 'settings', label: 'Org Admin', route: '/organization/members', icon: 'settings-outline' },
  { key: 'account', label: 'Organization', route: '/(tabs)/profile', icon: 'business-outline' },
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get primary and secondary nav items based on user type.
 * Used by both NavigationDrawer and WebSidebarNav.
 * When vocabulary is provided, the first sailor nav item label is adapted.
 */
export function getNavItemsForUserType(
  userType: string | null,
  vocabulary?: VocabularyMap,
  workspaceContext?: WorkspaceNavContext
): {
  primary: NavItem[];
  secondary: NavItem[];
} {
  const _normalizedDomain = String(workspaceContext?.activeDomain || '').toLowerCase().trim();

  switch (userType) {
    case 'coach':
      return { primary: COACH_NAV_ITEMS, secondary: LEARNER_FOOTER_ITEMS };
    case 'club':
      if (isProgramWorkspace(workspaceContext?.organizationType, workspaceContext?.activeDomain)) {
        return {
          primary: [
            { key: 'events', label: 'Workspace', route: '/(tabs)/events', icon: 'grid-outline' },
            { key: 'members', label: 'People', route: '/(tabs)/members', icon: 'people-outline' },
            { key: 'programs', label: 'Programs & Placements', route: '/(tabs)/programs', icon: 'school-outline' },
            { key: 'organization', label: 'Organization', route: '/(tabs)/profile', icon: 'business-outline' },
          ],
          secondary: INSTITUTION_FOOTER_ITEMS,
        };
      }
      return { primary: CLUB_NAV_ITEMS, secondary: COMMON_FOOTER_ITEMS };
    case 'sailor':
    default: {
      const eventTitle = getEventTabTitle(vocabulary, workspaceContext?.activeDomain);
      const primary = SAILOR_NAV_ITEMS.map((item) =>
        item.key === 'races'
          ? { ...item, label: eventTitle }
          : item
      );
      const secondary = [...SAILOR_SECONDARY_ITEMS, ...LEARNER_FOOTER_ITEMS];
      if (workspaceContext?.isOrgAdmin) {
        secondary.push({
          key: 'org-admin',
          label: 'Org Admin',
          route: '/organization/members',
          icon: 'business-outline',
        });
      }
      return { primary, secondary };
    }
  }
}

/**
 * Check if a route is active based on the current pathname.
 */
export function isRouteActive(route: string, pathname: string): boolean {
  const normalizedRoute = route.replace('/(tabs)/', '/').replace('/index', '');
  return pathname === normalizedRoute || pathname.startsWith(normalizedRoute + '/');
}

// =============================================================================
// SERIES VOCABULARY (Phase I — per-interest label for the canonical Series strip)
// =============================================================================

/**
 * Per-interest Series vocabulary input.
 *
 * The canonical Series strip says "Season" for sailing, "Term" for nursing,
 * "Workshop" for drawing, "Block" for fitness, and falls back to the generic
 * "Series" for anything else. We accept a minimal input so the helper can be
 * called from any surface that has either a full Interest record or just a
 * slug string.
 *
 * v1 keeps this as a static lookup. A richer signature that consults
 * `vocab('Period')` (so a nursing tenant can override Term → Rotation) is
 * planned for a later commit per PHASE_I_SERIES_FEATURE_INTEGRATION_SPEC.md.
 */
export type SeriesLabelInput = { slug?: string | null } | string | null | undefined;

function resolveSeriesSlug(input: SeriesLabelInput): string {
  if (!input) return '';
  if (typeof input === 'string') return input.toLowerCase().trim();
  return String(input.slug || '').toLowerCase().trim();
}

export function getSeriesLabel(input: SeriesLabelInput): string {
  const slug = resolveSeriesSlug(input);
  if (slug === 'sailing' || slug === 'sail-racing') return 'Season';
  if (slug === 'nursing') return 'Term';
  if (slug === 'drawing') return 'Workshop';
  if (slug === 'fitness' || slug === 'health-and-fitness') return 'Block';
  return 'Series';
}

export function getSeriesLabelPlural(input: SeriesLabelInput): string {
  const singular = getSeriesLabel(input);
  return singular.endsWith('s') ? singular : `${singular}s`;
}
