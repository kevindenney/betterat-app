/**
 * /(tabs)/atlas — Atlas tab live route
 *
 * Phase 11 wiring of the canonical Atlas surface as the centered fifth tab:
 *   Practice · Library · Atlas · Discover · Profile
 *
 * Gated on FEATURE_FLAGS.ATLAS_IOS_REGISTER via the navigation-config
 * insertion. The Tabs.Screen entry in (tabs)/_layout.tsx is unconditional
 * (Expo Router needs the screen registered so the route file resolves);
 * the flag controls whether the tab button is visible in the tab bar.
 *
 * Current data source: F1 (Felix · Causeway Bay overview) with static
 * sample pins. Real MapLibre tiles, atlas_pois, peer-steps RPC, and the
 * universal empty-state formula (home_geography/base/active_locations/
 * peers/next_event resolvers) land in Phase A1 — see
 * docs/redesign/ios-register/atlas-tab-brief.md.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  AtlasScreen,
  type AtlasFrameId,
} from '@/components/ios-register/atlas/AtlasScreen';
import { DiscoverNearbyContent } from '@/components/discover/DiscoverNearbyContent';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { getAtlasStepData } from '@/lib/atlasRaceStep';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useWebDrawer } from '@/providers/WebDrawerProvider';
import { useAtlasNextEvent } from '@/hooks/useAtlasNextEvent';
import { AtlasPickerBus } from '@/services/AtlasPickerBus';
import {
  createStep as createTimelineStep,
  getUserTimeline,
  updateStepMetadata,
} from '@/services/TimelineStepService';
import { supabase } from '@/services/supabase';
import type {
  AtlasLocalKnowledgeSharing,
  AtlasStepData,
  StepMetadata,
  StepPlanData,
  StepSpatialAnchor,
  StepSpatialAnchorSource,
  SubStep,
} from '@/types/step-detail';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import {
  YACHT_CLUB_DEMO_CITY,
  YACHT_CLUB_DEMO_COUNTRY,
  YACHT_CLUB_DEMO_NAME,
  isYachtClubDemoSlug,
} from '@/services/YachtClubDemoService';

// Interest-aware variant selection. Per the brief's "Universal empty-state
// formula" + per-persona empty states. The mapping below is the v1 lookup;
// Phase A1 replaces it with interest registry resolvers.
function pickFrameForInterest(slug: string | null): AtlasFrameId {
  const s = (slug ?? '').toLowerCase();
  if (s === 'nursing' || s === 'msn' || s === 'msn-nursing') return 'f4';
  if (
    s === 'entrepreneur' ||
    s === 'micro-entrepreneur' ||
    s === 'home-entrepreneur' ||
    s === 'small-business' ||
    s === 'lac-craft-business' ||
    s.includes('craft') ||
    s.includes('artisan')
  ) {
    return 'f7';
  }
  // Sailing, drawing, fitness, default → sailor first-run shape (F1)
  return 'f1';
}

// Build the top subtitle line from the current interest. Falls back to the
// frame-specific default if no interest is resolved (e.g. guest with no
// selection yet).
function buildSubtitle(slug: string | null, name: string | null): string | undefined {
  if (!slug) return undefined;
  const s = slug.toLowerCase();
  if (s === 'nursing' || s === 'msn' || s === 'msn-nursing') {
    return `${name ?? 'Nursing'} · labs, wards, and shift sites`;
  }
  if (s === 'sailing' || s === 'sail-racing' || s === 'sail') {
    return `${name ?? 'Sailing'} · race areas, clubs, and marks`;
  }
  if (
    s === 'entrepreneur' ||
    s === 'micro-entrepreneur' ||
    s === 'home-entrepreneur' ||
    s === 'small-business' ||
    s === 'lac-craft-business' ||
    s.includes('craft') ||
    s.includes('artisan')
  ) {
    return `${name ?? 'Entrepreneur'} · markets, suppliers, and mentor routes`;
  }
  // For interests without a curated empty-state yet (drawing, fitness, etc.)
  // we surface just the interest name — Atlas still renders a sailor-shape
  // frame, but the subtitle reads honest.
  return `${name ?? 'Atlas'} · places where practice is happening`;
}

function isSailingInterestSlug(slug: string | null): boolean {
  const s = (slug ?? '').toLowerCase();
  return s === 'sailing' || s === 'sail-racing' || s === 'sail';
}

// Per-interest home geography for the Nearby sheet. The sailing home venue
// lives in sailor_profiles and is meaningless (often wrong-continent) for a
// non-sailing interest, so each curated interest gets its own anchor. Nursing
// is centered on Baltimore (the JHSON clinical-site cluster). Interests
// without a curated anchor return null and fall through to the sailing home
// venue only when they are themselves sailing.
function nearbyAnchorForInterest(
  slug: string | null,
): { lat: number; lng: number; label: string } | null {
  if (slug === 'nursing') {
    return { lat: 39.297, lng: -76.591, label: 'Baltimore' };
  }
  return null;
}

function atlasInterestSlugForFrame(
  frame: AtlasFrameId,
  currentInterestSlug: string | null,
): string | null {
  // f2/f3/f6 are explicit sailing entry points (race-course planning + the
  // from-plan handoff), reached via requestedFrame/isFromPlan — always sailing.
  if (frame === 'f2' || frame === 'f3' || frame === 'f6') {
    return 'sail-racing';
  }
  // f1 is the sailor first-run *shape*, but pickFrameForInterest also routes
  // interests without a curated frame (drawing, fitness, default) here. Only
  // claim sail-racing when the active interest is actually sailing, or when
  // none is resolved (guest first-run keeps the showcase). Otherwise a Drawing
  // user inherited the sailing next-event banner + a sail-racing step on drop.
  if (frame === 'f1') {
    if (!currentInterestSlug) return 'sail-racing';
    return isSailingInterestSlug(currentInterestSlug) ? 'sail-racing' : currentInterestSlug;
  }
  if (frame === 'f4' || frame === 'f5') {
    return 'nursing';
  }
  if (frame === 'f7') {
    return currentInterestSlug;
  }
  return currentInterestSlug;
}

type OrgContext = {
  name: string;
  city: string | null;
  country: string | null;
  /**
   * Primary location coords from `organization_locations` (lowest
   * sort_order). When present, the Atlas tab flies the camera here
   * after navigating from /organizations/[slug]'s "Open map" button.
   */
  lat: number | null;
  lng: number | null;
};

// Single-letter avatar from the signed-in user. Prefers user_metadata.
// full_name, then user_metadata.name, then the local part of email; falls
// back to "?" so the chrome never renders an empty disc.
function deriveAvatarInitial(user: { email?: string; user_metadata?: Record<string, unknown> | null } | null): string {
  if (!user) return '?';
  const meta = user.user_metadata ?? {};
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : undefined;
  const name = typeof meta.name === 'string' ? meta.name : undefined;
  const source = (fullName || name || user.email || '').trim();
  if (!source) return '?';
  return source.charAt(0).toUpperCase();
}

const BASE_RACE_SUBSTEP_LABELS = ['Start setup', 'Line approach', 'First beat'];

function normalizeSubStepLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function makeSubStep(text: string, sortOrder: number): SubStep {
  return {
    id: `atlas_ss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    sort_order: sortOrder,
    completed: false,
  };
}

function deriveRaceStepTitle(eventLabel?: string | null): string {
  return eventLabel?.trim() || 'Upcoming race';
}

function deriveRacePlanFocusSubStep(planFocus?: string | null): string | null {
  const focus = planFocus?.trim().toLowerCase();
  if (!focus) return null;
  if (focus.includes('start setup')) return 'Start setup';
  if (focus.includes('line approach')) return 'Line approach';
  if (focus.includes('first beat')) return 'First beat';
  if (focus.includes('gate exit')) return 'Gate exit';
  if (focus.includes('final run')) return 'Final run';
  return null;
}

function mergeRacePlanSubSteps(
  existing: SubStep[] | undefined,
  planFocus?: string | null,
): SubStep[] {
  const nextLabels = [...BASE_RACE_SUBSTEP_LABELS];
  const focused = deriveRacePlanFocusSubStep(planFocus);
  if (focused && !nextLabels.some((label) => normalizeSubStepLabel(label) === normalizeSubStepLabel(focused))) {
    nextLabels.push(focused);
  }

  const existingByKey = new Map(
    (existing ?? []).map((subStep) => [normalizeSubStepLabel(subStep.text), subStep] as const),
  );

  const merged = nextLabels.map((label, index) => {
    const prior = existingByKey.get(normalizeSubStepLabel(label));
    return prior
      ? { ...prior, text: prior.text || label, sort_order: index }
      : makeSubStep(label, index);
  });

  const leftovers = (existing ?? []).filter(
    (subStep) =>
      !nextLabels.some(
        (label) => normalizeSubStepLabel(label) === normalizeSubStepLabel(subStep.text),
      ) && subStep.text.trim().length > 0,
  );

  return [
    ...merged,
    ...leftovers.map((subStep, index) => ({
      ...subStep,
      sort_order: merged.length + index,
    })),
  ];
}

function buildDefaultLocalKnowledgeSharing(
  existing?: AtlasLocalKnowledgeSharing,
): AtlasLocalKnowledgeSharing {
  return {
    audiences:
      existing?.audiences && existing.audiences.length > 0
        ? existing.audiences
        : ['crew', 'fleet', 'followers', 'following', 'public'],
    share_marks: existing?.share_marks ?? true,
    share_notes: existing?.share_notes ?? true,
    share_track: existing?.share_track ?? false,
  };
}

function mapCourseSourceToAnchorSource(
  source?: AtlasStepData['course_source'],
): StepSpatialAnchorSource {
  if (source === 'official') return 'official';
  if (source === 'community') return 'public';
  return 'manual';
}

function buildRaceSpatialAnchors(args: {
  eventLabel?: string | null;
  courseSource?: AtlasStepData['course_source'];
}): StepSpatialAnchor[] {
  const eventLabel = args.eventLabel?.trim() || 'Race 5';
  const source = mapCourseSourceToAnchorSource(args.courseSource);
  return [
    {
      id: 'atlas_anchor_pin',
      label: 'PIN',
      kind: 'line-end',
      lat: 22.2819,
      lng: 114.1772,
      note: `Pin-end of the ${eventLabel} start line.`,
      source,
      visibility: 'private',
    },
    {
      id: 'atlas_anchor_cb',
      label: 'CB',
      kind: 'line-end',
      lat: 22.2813,
      lng: 114.1849,
      note: `Committee-boat end of the ${eventLabel} start line.`,
      source,
      visibility: 'private',
    },
    {
      id: 'atlas_anchor_1',
      label: '1',
      kind: 'race-mark',
      lat: 22.2874,
      lng: 114.1808,
      note: `Windward mark for ${eventLabel}.`,
      source,
      visibility: 'private',
    },
    {
      id: 'atlas_anchor_2',
      label: '2',
      kind: 'race-mark',
      lat: 22.2832,
      lng: 114.1807,
      note: `Leeward mark for ${eventLabel}.`,
      source,
      visibility: 'private',
    },
    {
      id: 'atlas_anchor_3a',
      label: '3A',
      kind: 'gate-mark',
      lat: 22.2852,
      lng: 114.1785,
      note: `Port gate mark for ${eventLabel}.`,
      source,
      visibility: 'private',
    },
    {
      id: 'atlas_anchor_3b',
      label: '3B',
      kind: 'gate-mark',
      lat: 22.2852,
      lng: 114.1829,
      note: `Starboard gate mark for ${eventLabel}.`,
      source,
      visibility: 'private',
    },
    {
      id: 'atlas_anchor_start_line',
      label: 'Start line',
      kind: 'start-line',
      geometry: {
        type: 'line',
        coordinates: [
          [114.1772, 22.2819],
          [114.1849, 22.2813],
        ],
      },
      note: `Start line for ${eventLabel}.`,
      source,
      visibility: 'private',
    },
    {
      id: 'atlas_anchor_leg_1',
      label: 'Leg 1',
      kind: 'route-leg',
      geometry: {
        type: 'line',
        coordinates: [
          [114.1772, 22.2819],
          [114.1808, 22.2874],
        ],
      },
      note: 'Start to windward mark.',
      source,
      visibility: 'private',
    },
    {
      id: 'atlas_anchor_leg_2',
      label: 'Gate',
      kind: 'route-leg',
      geometry: {
        type: 'line',
        coordinates: [
          [114.1785, 22.2852],
          [114.1829, 22.2852],
        ],
      },
      note: 'Gate span between 3A and 3B.',
      source,
      visibility: 'private',
    },
    {
      id: 'atlas_anchor_leg_3',
      label: 'Run to leeward',
      kind: 'route-leg',
      geometry: {
        type: 'line',
        coordinates: [
          [114.1785, 22.2852],
          [114.1807, 22.2832],
        ],
      },
      note: 'Downwind return to the leeward mark.',
      source,
      visibility: 'private',
    },
  ];
}

async function findExistingAtlasRaceStep(args: {
  userId: string;
  interestId: string;
  eventId?: string | null;
  eventLabel?: string | null;
}): Promise<TimelineStepRecord | null> {
  const steps = await getUserTimeline(args.userId, args.interestId);
  const raceTitle = deriveRaceStepTitle(args.eventLabel);

  const matching = [...steps]
    .filter((step) => step.user_id === args.userId)
    .reverse()
    .find((step) => {
      const metadata = (step.metadata ?? {}) as StepMetadata;
      const atlas = getAtlasStepData(metadata);
      if (!atlas?.race_course_context) return false;
      if (args.eventId && atlas.next_event?.event_id === args.eventId) return true;
      return step.title.trim().toLowerCase() === raceTitle.toLowerCase();
    });

  return matching ?? null;
}

export default function AtlasTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentInterest, userInterests, switchInterest } = useInterest();
  const homeVenue = useUserHomeVenue();
  const { isDrawerOpen, openDrawer } = useWebDrawer();
  // On web the global nav lives in each screen's toolbar; Atlas renders
  // edge-to-edge with no toolbar, so when the sidebar drawer is collapsed
  // there's no way back out. Surface a floating menu affordance that
  // reopens the drawer. Native ignores this (drawer is a web-only concept).
  const showWebNavButton = Platform.OS === 'web' && !isDrawerOpen;
  const avatarInitial = deriveAvatarInitial(user as any);
  // Nearby list-sheet — the optional list affordance over Atlas's pins.
  // Atlas already plots nearby orgs + peer-steps as map pins; this opens
  // the same data as a scannable list (Apple-Maps "nearby" pattern).
  const [nearbyOpen, setNearbyOpen] = useState(false);
  // ?fromPlan=1 — PlanWhereCard pushed us here expecting a location result.
  // The commit-mode "Use this location" CTA emits to AtlasPickerBus and
  // router.back()s instead of starting an add-step flow.
  const params = useLocalSearchParams<{
    fromPlan?: string;
    orgSlug?: string;
    frame?: string;
    lat?: string;
    lng?: string;
  }>();
  const isFromPlan = params.fromPlan === '1';
  const orgSlug = typeof params.orgSlug === 'string' ? params.orgSlug.trim() : '';
  const requestedFrame =
    typeof params.frame === 'string' && ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'].includes(params.frame)
      ? (params.frame as AtlasFrameId)
      : null;
  // ?lat=…&lng=… — Plan-tab Where card links the viewer to Atlas focused
  // on the step's venue ("see what's nearby"). Parsed once from params;
  // F1 reads it via the AtlasScreen `initialFocus` prop.
  const [orgContext, setOrgContext] = React.useState<OrgContext | null>(null);
  const initialFocus = React.useMemo(() => {
    // Explicit lat/lng URL params win when present (e.g. coming from
    // a step's "see what's nearby"). Otherwise fall back to the org's
    // primary location resolved from organization_locations.
    const lat = parseFloat(String(params.lat ?? ''));
    const lng = parseFloat(String(params.lng ?? ''));
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    if (orgContext?.lat != null && orgContext?.lng != null) {
      return { lat: orgContext.lat, lng: orgContext.lng };
    }
    return null;
  }, [params.lat, params.lng, orgContext]);

  React.useEffect(() => {
    let cancelled = false;
    if (!orgSlug) {
      setOrgContext(null);
      return () => {
        cancelled = true;
      };
    }

    if (isYachtClubDemoSlug(orgSlug)) {
      setOrgContext({
        name: YACHT_CLUB_DEMO_NAME,
        city: YACHT_CLUB_DEMO_CITY,
        country: YACHT_CLUB_DEMO_COUNTRY,
        lat: null,
        lng: null,
      });
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        let orgQuery = await supabase
          .from('organizations')
          .select('id, name, slug, global_clubs(city, country)')
          .eq('slug', orgSlug)
          .maybeSingle();
        if (orgQuery.error || !orgQuery.data) {
          orgQuery = await supabase
            .from('organizations')
            .select('id, name, slug')
            .eq('slug', orgSlug)
            .maybeSingle();
        }
        if (cancelled || !orgQuery.data) return;

        const raw = orgQuery.data as any;
        const gc = Array.isArray(raw.global_clubs)
          ? raw.global_clubs[0] ?? null
          : raw.global_clubs ?? null;

        // Primary location row from organization_locations (lowest
        // sort_order). When found, the Atlas tab flies the camera
        // here on next paint — same mechanism the search flow uses.
        let lat: number | null = null;
        let lng: number | null = null;
        if (raw.id) {
          const { data: locRow } = await supabase
            .from('organization_locations')
            .select('lat, lng')
            .eq('organization_id', String(raw.id))
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (locRow) {
            const la = Number((locRow as Record<string, unknown>).lat);
            const ln = Number((locRow as Record<string, unknown>).lng);
            if (Number.isFinite(la) && Number.isFinite(ln) && (la !== 0 || ln !== 0)) {
              lat = la;
              lng = ln;
            }
          }
        }

        if (cancelled) return;
        setOrgContext({
          name: String(raw.name || orgSlug),
          city: gc?.city ? String(gc.city) : null,
          country: gc?.country ? String(gc.country) : null,
          lat,
          lng,
        });
      } catch {
        if (!cancelled) setOrgContext(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  // FloatingTabBar floats above the home-indicator safe area; clear both
  // plus a small buffer so the BottomSheet CTAs aren't covered.
  const tabBarSpace = FLOATING_TAB_BAR_HEIGHT + insets.bottom + 12;

  const frame = useMemo(
    () =>
      isFromPlan
        ? 'f6'
        : requestedFrame
          ? requestedFrame
          : orgSlug
            ? 'f1'
            : pickFrameForInterest(currentInterest?.slug ?? null),
    [isFromPlan, requestedFrame, orgSlug, currentInterest?.slug],
  );
  const atlasInterestSlug = useMemo(
    () => atlasInterestSlugForFrame(frame, currentInterest?.slug ?? null),
    [frame, currentInterest?.slug],
  );
  const nextEvent = useAtlasNextEvent(atlasInterestSlug);
  const subtitleOverride = useMemo(
    () => {
      if (orgContext) {
        const location = orgContext.city || orgContext.country;
        return location ? `${orgContext.name} · ${location}` : orgContext.name;
      }
      const contextInterest =
        userInterests.find((interest) => interest.slug === atlasInterestSlug) ??
        currentInterest;
      return buildSubtitle(
        atlasInterestSlug ?? contextInterest?.slug ?? null,
        contextInterest?.name ?? null,
      );
    },
    [atlasInterestSlug, currentInterest, orgContext, userInterests],
  );

  const handleOpenOrg = useCallback(
    (slug: string) => {
      router.push(`/organizations/${slug}` as any);
    },
    [router],
  );

  const handleOpenOrgLens = useCallback(
    (slug: string) => {
      router.push({ pathname: '/(tabs)/atlas', params: { orgSlug: slug } } as any);
    },
    [router],
  );

  const handlePrimary = useCallback(
    async (pin?: {
      lat: number;
      lng: number;
      place?: string;
      suggestedTitle?: string;
      suggestedCategory?: string;
      suggestedInterestSlug?: string;
      metadata?: Record<string, unknown>;
    }) => {
      // Round-trip mode — PlanWhereCard pushed here expecting a result.
      // Emit to the picker bus and pop back; PlanWhereCard's awaiting
      // listener applies the coords to the step's location field.
      if (isFromPlan) {
        if (pin) AtlasPickerBus.emit({ lat: pin.lat, lng: pin.lng, place: pin.place });
        else AtlasPickerBus.cancel();
        if (router.canGoBack()) router.back();
        return;
      }
      // When Atlas already has a dropped pin, create the step directly
      // and open the new step detail. The Practice route is on the
      // timeline-zoom cutover path, so routing through it loses the
      // add-step handoff.
      if (!pin) {
        router.push('/(tabs)/practice');
        return;
      }

      if (!user?.id) {
        showAlert('Sign in required', 'You need to be signed in to create a step from Atlas.');
        return;
      }
      const targetInterestSlug =
        pin?.suggestedInterestSlug ??
        atlasInterestSlug ??
        currentInterest?.slug ??
        null;
      const targetInterest =
        (targetInterestSlug
          ? userInterests.find((interest) => interest.slug === targetInterestSlug)
          : null) ??
        currentInterest;

      if (!targetInterest?.id) {
        showAlert('Choose an interest', 'Pick an interest before you create a step from Atlas.');
        return;
      }

      try {
        const locationName = pin.place ?? `Pinned location (${pin.lat.toFixed(3)}, ${pin.lng.toFixed(3)})`;
        const isSailingAtlas =
          frame === 'f1' || frame === 'f2' || frame === 'f3' || frame === 'f6';
        const incomingMetadata = ((pin?.metadata ?? {}) as Record<string, unknown>) ?? {};
        const {
          atlas: incomingAtlasRaw,
          plan: incomingPlanRaw,
          ...restIncomingMetadata
        } = incomingMetadata as Record<string, unknown> & {
          atlas?: AtlasStepData;
          plan?: StepPlanData;
        };
        const incomingAtlas = (incomingAtlasRaw ?? {}) as AtlasStepData;
        const incomingPlan = (incomingPlanRaw ?? {}) as StepPlanData;
        const isRaceCoursePlan = frame === 'f2';

        if (isRaceCoursePlan) {
          const raceTitle = deriveRaceStepTitle(nextEvent?.label);
          const planFocus = incomingAtlas.race_course_context?.plan_focus ?? pin?.suggestedTitle ?? null;
          const existing = await findExistingAtlasRaceStep({
            userId: user.id,
            interestId: targetInterest.id,
            eventId: nextEvent?.event_id ?? null,
            eventLabel: nextEvent?.label ?? null,
          });

          const nextPlan: StepPlanData = {
            ...(((existing?.metadata ?? {}) as StepMetadata).plan ?? {}),
            what_will_you_do:
              (((existing?.metadata ?? {}) as StepMetadata).plan?.what_will_you_do?.trim()
                ? ((existing?.metadata ?? {}) as StepMetadata).plan?.what_will_you_do
                : raceTitle),
            how_sub_steps: mergeRacePlanSubSteps(
              (((existing?.metadata ?? {}) as StepMetadata).plan?.how_sub_steps ?? undefined),
              planFocus,
            ),
            where_location: {
              name: locationName,
              lat: pin.lat,
              lng: pin.lng,
            },
            spatial_anchors:
              incomingPlan.spatial_anchors && incomingPlan.spatial_anchors.length > 0
                ? incomingPlan.spatial_anchors
                : buildRaceSpatialAnchors({
                    eventLabel: nextEvent?.label ?? raceTitle,
                    courseSource: incomingAtlas.course_source ?? 'draft',
                  }),
            target_event_kind: nextEvent?.event_kind ?? null,
            target_event_id: nextEvent?.event_id ?? null,
            ...(incomingPlan ?? {}),
          };

          const nextAtlas: AtlasStepData = {
            ...(getAtlasStepData((existing?.metadata ?? {}) as StepMetadata) ?? {}),
            ...(incomingAtlas ?? {}),
            origin: 'atlas_race_course',
            frame,
            interest_slug: targetInterest.slug,
            next_event: nextEvent
              ? {
                  label: nextEvent.label,
                  when: nextEvent.when,
                  where: nextEvent.where,
                  event_kind: nextEvent.event_kind,
                  event_id: nextEvent.event_id,
                }
              : null,
            course_source: incomingAtlas.course_source ?? 'draft',
            local_knowledge_sharing: buildDefaultLocalKnowledgeSharing(
              incomingAtlas.local_knowledge_sharing,
            ),
            race_course_context: {
              ...(getAtlasStepData((existing?.metadata ?? {}) as StepMetadata)?.race_course_context ?? {}),
              ...(incomingAtlas.race_course_context ?? {}),
            },
            live_tracking: {
              ...(getAtlasStepData((existing?.metadata ?? {}) as StepMetadata)?.live_tracking ?? {}),
              status:
                getAtlasStepData((existing?.metadata ?? {}) as StepMetadata)?.live_tracking?.status ??
                'idle',
              provider:
                getAtlasStepData((existing?.metadata ?? {}) as StepMetadata)?.live_tracking?.provider ??
                'betterat_phone_gps',
            },
            local_knowledge_notes:
              getAtlasStepData((existing?.metadata ?? {}) as StepMetadata)?.local_knowledge_notes ?? [],
          };

          if (existing) {
            await updateStepMetadata(existing.id, {
              plan: nextPlan,
              atlas: nextAtlas,
            });
            if (targetInterest.slug !== currentInterest?.slug) {
              await switchInterest(targetInterest.slug);
            }
            router.push({ pathname: '/step/[id]', params: { id: existing.id, origin: 'atlas' } } as any);
            return;
          }

          const createdRaceStep = await createTimelineStep({
            user_id: user.id,
            interest_id: targetInterest.id,
            title: raceTitle,
            description: [nextEvent?.where, nextEvent?.when].filter(Boolean).join(' · ') || null,
            category: 'sailing',
            status: 'pending',
            visibility: 'private',
            source_type: 'manual',
            location_name: locationName,
            location_lat: pin.lat,
            location_lng: pin.lng,
            metadata: {
              atlas: nextAtlas,
              plan: nextPlan,
              ...restIncomingMetadata,
            },
          });
          if (targetInterest.slug !== currentInterest?.slug) {
            await switchInterest(targetInterest.slug);
          }
          router.push({ pathname: '/step/[id]', params: { id: createdRaceStep.id, origin: 'atlas' } } as any);
          return;
        }

        // Atlas long-press creates a *draft*: no placeholder title and no
        // implicit creation-time `starts_at`. The user types a title and
        // picks a date on /step/[id]; if the source already supplied a
        // suggestion (e.g. a course-context pin), keep it.
        const defaultTitle = pin?.suggestedTitle ?? null;
        const defaultCategory =
          pin?.suggestedCategory ??
          (isSailingAtlas ? 'sailing' : 'general');
        const created = await createTimelineStep({
          user_id: user.id,
          interest_id: targetInterest.id,
          title: defaultTitle,
          category: defaultCategory,
          status: 'pending',
          visibility: 'private',
          source_type: 'manual',
          starts_at: null,
          location_name: locationName,
          location_lat: pin.lat,
          location_lng: pin.lng,
          metadata: {
            atlas: {
              origin: 'atlas_pin_drop',
              frame,
              interest_slug: targetInterest.slug,
              course_source: incomingAtlas.course_source,
              next_event: nextEvent
                ? {
                    label: nextEvent.label,
                    when: nextEvent.when,
                    where: nextEvent.where,
                    event_kind: nextEvent.event_kind,
                    event_id: nextEvent.event_id,
                  }
                : null,
              live_tracking: {
                status: 'idle',
                provider: 'betterat_phone_gps',
              },
              local_knowledge_notes: [],
              local_knowledge_sharing: buildDefaultLocalKnowledgeSharing(
                incomingAtlas.local_knowledge_sharing,
              ),
            },
            plan: {
              where_location: { name: locationName, lat: pin.lat, lng: pin.lng },
              target_event_kind: nextEvent?.event_kind ?? null,
              target_event_id: nextEvent?.event_id ?? null,
              ...incomingPlan,
            },
            ...restIncomingMetadata,
          },
        });
        if (targetInterest.slug !== currentInterest?.slug) {
          await switchInterest(targetInterest.slug);
        }
        // Open the freshly-created step's Plan surface directly. Routing
        // through the timeline (?selected=&level=1) was unreliable: the new
        // step isn't in the timeline query cache when the canvas captures
        // its mount-only initialLevel, so it stranded the user at L2 instead
        // of the step. /step/[id] loads by id with no timeline-cache race —
        // and it's the natural "plan this" destination. Mirrors the F2
        // race-course path above.
        router.push({ pathname: '/step/[id]', params: { id: created.id, origin: 'atlas' } } as any);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not create a step from this pin.';
        showAlert('Step creation failed', message);
      }
    },
    [
      atlasInterestSlug,
      currentInterest,
      frame,
      isFromPlan,
      nextEvent,
      router,
      switchInterest,
      user?.id,
      userInterests,
    ],
  );

  const handleSecondary = useCallback(() => {
    // F1 "Open Race" is an in-tab frame change, not a tab switch. Updating
    // Atlas params in place avoids same-route push fallthrough.
    if (frame === 'f1') {
      router.setParams({ frame: 'f2' } as any);
      return;
    }
    // F4: "Skip" → no-op (stays on Atlas).
    if (frame === 'f4') return;
    router.push('/(tabs)/practice');
  }, [frame, router]);

  const handleAvatarPress = useCallback(() => {
    // /account is the canonical account modal; /(tabs)/profile is a
    // legacy stub with placeholder "John Sailor" data.
    router.push('/account');
  }, [router]);

  const handleStepPress = useCallback(
    (stepId: string) => {
      // /step/[id] is the canonical Plan/Do/Reflect/Discuss surface.
      // /practice/step/[id] is the HKDW blueprint preview and 404s for
      // arbitrary user-created timeline_steps.
      router.push({ pathname: '/step/[id]', params: { id: stepId, origin: 'atlas' } } as any);
    },
    [router],
  );

  // Nearby list anchors on whatever the map is centered on (an explicit
  // lat/lng focus or an org context). Failing that it falls back to a
  // per-interest home geography — Baltimore for nursing — and only reads the
  // sailing home venue when the active interest is actually sailing. Reading
  // the sailing home venue inside a non-sailing frame is what put a Hong Kong
  // map + yacht clubs inside the nursing Atlas. DiscoverNearbyContent owns
  // the no-venue empty state.
  const interestAnchor = nearbyAnchorForInterest(atlasInterestSlug);
  const sailingHome = isSailingInterestSlug(atlasInterestSlug) ? homeVenue : null;
  const nearbyLat = initialFocus?.lat ?? interestAnchor?.lat ?? sailingHome?.lat ?? null;
  const nearbyLng = initialFocus?.lng ?? interestAnchor?.lng ?? sailingHome?.lng ?? null;
  const nearbyLabel =
    orgContext?.name ?? interestAnchor?.label ?? sailingHome?.venue ?? null;

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <View style={styles.surface}>
        <AtlasScreen
          frame={frame}
          embedded
          subtitleOverride={subtitleOverride}
          nextEvent={nextEvent}
          avatarInitial={avatarInitial}
          useMapLibre={FEATURE_FLAGS.ATLAS_MAPLIBRE_CANVAS}
          initialCommitMode={isFromPlan}
          onPrimaryAction={handlePrimary}
          onSecondaryAction={handleSecondary}
          onStepPress={handleStepPress}
          onAvatarPress={handleAvatarPress}
          onOrgPress={handleOpenOrg}
          onOrgLensPress={handleOpenOrgLens}
          focusOrgSlug={orgSlug || null}
          initialFocus={initialFocus}
          bottomSheetOffset={tabBarSpace}
        />

        {/* Web nav escape hatch — Atlas hides the sidebar toolbar, so when
            the drawer is collapsed this is the only way back to the rest of
            the app. Top-left, mirrors where a hamburger normally sits. */}
        {showWebNavButton && !nearbyOpen ? (
          <Pressable
            style={[styles.navPill, { top: insets.top + 12 }]}
            onPress={openDrawer}
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
          >
            <Ionicons name="menu" size={18} color={IOS_COLORS.label} />
            <Text style={styles.navPillText}>Menu</Text>
          </Pressable>
        ) : null}

        {/* Nearby list entry — a right-edge pill below the Atlas top chrome
            (aligns with the top-chrome-consolidation direction rather than
            competing with the bottom sheet). Hidden while open. */}
        {!nearbyOpen && !isFromPlan ? (
          <Pressable
            style={[styles.nearbyPill, { top: insets.top + 96 }]}
            onPress={() => setNearbyOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Show what's nearby as a list"
          >
            <Ionicons name="list" size={16} color={IOS_COLORS.label} />
            <Text style={styles.nearbyPillText}>Nearby</Text>
          </Pressable>
        ) : null}

        {/* Full-bleed nearby list over the map, with a floating back pill —
            mirrors the consolidation's Library/Watch full-bleed zones. */}
        {nearbyOpen ? (
          <View style={styles.nearbyOverlay}>
            <DiscoverNearbyContent
              homeVenueLat={nearbyLat}
              homeVenueLng={nearbyLng}
              homeVenueLabel={nearbyLabel}
              interestSlug={atlasInterestSlug}
              toolbarOffset={insets.top + 44}
              onStepFocus={(lat, lng) => {
                // Fly the map to the tapped sailor's step, then drop back
                // to the chart. AtlasScreen re-derives its camera focus
                // from these lat/lng params (initialFocus → searchFocus).
                router.setParams({ lat: String(lat), lng: String(lng) } as never);
                setNearbyOpen(false);
              }}
            />
            <Pressable
              style={[styles.backPill, { top: insets.top + 4 }]}
              onPress={() => setNearbyOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Back to the map"
            >
              <Ionicons name="chevron-back" size={18} color={IOS_COLORS.label} />
              <Text style={styles.backPillText}>Atlas</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  surface: {
    flex: 1,
  },
  nearbyPill: {
    position: 'absolute',
    right: IOS_SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  navPill: {
    position: 'absolute',
    left: IOS_SPACING.md,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  navPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  nearbyPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  nearbyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  backPill: {
    position: 'absolute',
    left: IOS_SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  backPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
});
