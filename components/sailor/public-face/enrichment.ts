/**
 * Public Face enrichment — demo data for seed sailors
 *
 * The eight-section canonical (Hero / Framing / Concept / Timeline /
 * Capabilities / Practice circle / Published / Where / Events) draws from
 * tables that don't all exist yet (no current_concepts, no capabilities,
 * no published_reflections, no events_log). For the demo phase we hand-
 * craft enrichment for known seed sailors so the canonical shows at full
 * strength; production users without enrichment land in the sparse state
 * (sections absent, never empty placeholders).
 *
 * When the schemas land, replace each `mockEnrichment` block below with a
 * real fetcher. The shape here is intentionally close to what the real
 * fetchers will return.
 */

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import type { CapabilityStatus } from './PublicFacePrimitives';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface PublicFaceEnrichment {
  /** First name for "Where X practises" section header. */
  firstName?: string;
  /** Hero descriptor — overrides the profile.location fallback. */
  descriptor?: string;
  /** Hero meta-pellet row. */
  meta?: { icon?: IconName; text: string }[];
  /** Optional explicit framing line — overrides profile.bio. */
  framing?: { text: string; provenance: string };
  /** Current concept card content. */
  concept?: {
    weekTail?: string;
    text: string;
    stats?: string;
    history?: { primary: string; secondary?: string };
  };
  /** Past concepts the practitioner has worked through (newest first). */
  conceptHistory?: { title: string; capability?: string; closed: string; text?: string }[];
  /** Practice timeline entries — chronological feed. */
  timeline?: { title: string; settled?: boolean; sub: string; when: string }[];
  /** Capabilities (visible 4, all behind link). */
  capabilities?: {
    name: string;
    status: CapabilityStatus;
    evidence: string;
    provenance: string;
  }[];
  capabilitiesTotal?: number;
  /** Practice circle rows. */
  circle?: {
    name: string;
    role: string;
    initials: string;
    markColor?: string;
    tail?: string;
  }[];
  circleTotal?: number;
  /** Published items — newest first. */
  published?: PublishedItem[];
  publishedTotal?: number;
  /** Where X practises — key/value form rows. */
  where?: { k: string; v: string }[];
  /** Events list. */
  events?: {
    dateTop: string;
    dateBottom: string;
    name: string;
    venue: string;
    resultTop: string;
    resultBottom?: string;
  }[];
  eventsTotal?: number;
}

type PublishedItem =
  | { kind: 'reflection'; text: string; provenance: string }
  | { kind: 'thread'; title: string; topic: string; replies: number; when: string };

// =============================================================================
// Lookup
// =============================================================================

const EMPTY: PublicFaceEnrichment = {};

const MARKUS: PublicFaceEnrichment = {
  firstName: 'Markus',
  descriptor: 'Dragon helm · Hong Kong',
  meta: [
    { icon: 'location-outline', text: 'RHKYC' },
    { icon: 'calendar-outline', text: '11 seasons' },
  ],
  framing: {
    text:
      'I race the Dragon out of RHKYC. Most days I’m working on heavy-air ' +
      'decisions — the calls I make before the boats around me make them.',
    provenance: 'Written when joining BetterAt · Feb 2025',
  },
  concept: {
    weekTail: 'WEEK 3',
    text:
      'Holding the boat down through the heavy second beat — and trusting ' +
      'the call when the breeze settles.',
    stats: 'In play across 3 races  ·  2 reflections this week',
    history: { primary: 'Trust the shift', secondary: 'Heavy-air helm work' },
  },
  conceptHistory: [
    {
      title: 'Trust the shift',
      capability: 'Heavy-air helm work',
      closed: 'Closed Mar 2026',
      text:
        'Stopped overcorrecting on a port-tack lift. The technique was just ' +
        'there before the next puff arrived.',
    },
    {
      title: 'Start-line patience',
      capability: 'Decision-making under start-line pressure',
      closed: 'Closed Sep 2025',
      text:
        'The week the start stopped feeling like a decision and started ' +
        'feeling like a position I already held.',
    },
    {
      title: 'Reading shifts on a tight reach',
      capability: 'Tactical reads',
      closed: 'Closed Apr 2025',
      text:
        'Closed in the Buenos Aires bay series before the Hong Kong move.',
    },
  ],
  timeline: [
    {
      title: 'Heavy-air helm work',
      settled: true,
      sub:
        'The conditions where my technique lives. Closed with the trophy ' +
        'synthesis; the concept now references this when it surfaces.',
      when: 'Mar 2026',
    },
    {
      title: 'Decision-making under start-line pressure',
      settled: true,
      sub:
        'Eight reflections, six races, then a Sunday where it stopped ' +
        'feeling like a decision.',
      when: 'Sep 2025',
    },
    {
      title: 'Reading shifts on a tight reach',
      settled: true,
      sub: 'Closed in the bay series before the Hong Kong move.',
      when: 'Apr 2025',
    },
    {
      title: 'Bear-away under spinnaker, on the limit',
      sub:
        'A noted moment, not yet a settled concept. From the South ' +
        'Atlantic Winter 2024 reflections.',
      when: 'Aug 2024',
    },
  ],
  capabilities: [
    {
      name: 'Heavy-air helm work',
      status: 'settled',
      evidence:
        'Kept the boat flat through the third leg without thinking about ' +
        'kept-the-boat-flat. The technique was just there.',
      provenance: 'Most recent evidence · from a reflection · Mar 2026',
    },
    {
      name: 'Reading the starboard layline',
      status: 'practicing',
      evidence:
        'Called it three seconds before Hugo did. Right call. Still ' +
        'surprised it landed.',
      provenance: 'Most recent evidence · from a debrief · last Saturday',
    },
    {
      name: 'Pre-start positioning in a shifty breeze',
      status: 'breakthrough',
      evidence:
        'Didn’t need to look up. I knew where I was relative to the line.',
      provenance: 'Most recent evidence · from a debrief · Apr 2026',
    },
    {
      name: 'Light-air mark roundings',
      status: 'learning',
      evidence:
        'Lost half a length at the leeward gate — I’m still pulling too ' +
        'much string too early.',
      provenance: 'Most recent evidence · from a debrief · Feb 2026',
    },
  ],
  capabilitiesTotal: 9,
  circle: [
    { name: 'Sam Whittaker', initials: 'SW', role: 'Coach · four seasons' },
    {
      name: 'Patricia Cho',
      initials: 'PC',
      role: 'Faculty · settled Decision-making under start-line pressure with Markus',
    },
    {
      name: 'Hugo Mira',
      initials: 'HM',
      role: 'Tactician · Phyloong, RHKYC Dragon fleet',
      tail: 'Mutual',
    },
    {
      name: 'Yvonne Leung',
      initials: 'YL',
      role: 'Peer · Dragon helm, also at RHKYC',
      tail: 'Mutual',
    },
    {
      name: 'Tomás Renart',
      initials: 'TR',
      role: 'Peer · you both follow him',
      tail: 'You follow',
    },
  ],
  circleTotal: 8,
  published: [
    {
      kind: 'reflection',
      text:
        'Most of the boats around me are still trying to win the start. I’m ' +
        'starting to win the third leg by deciding not to try harder.',
      provenance: 'Reflection · 13 May 2026 · 3 returns from his circle',
    },
    {
      kind: 'thread',
      title: 'Halyard tension downwind in chop',
      topic: 'Dragon rigging & tuning',
      replies: 23,
      when: '28 Apr',
    },
    {
      kind: 'reflection',
      text:
        'I used to think the heavy-air days were the hard ones. They’re ' +
        'the honest ones.',
      provenance: 'Reflection · 21 Mar 2026',
    },
    {
      kind: 'thread',
      title: 'Backstay calls in 22kt — how late do you carry it in?',
      topic: 'Heavy-air starts',
      replies: 17,
      when: '9 Mar',
    },
  ],
  publishedTotal: 14,
  where: [
    { k: 'Discipline', v: 'Dragon (one-design keelboat) · helm' },
    { k: 'Home club', v: 'RHKYC · since 2015' },
    { k: 'Also racing at', v: 'YC Argentino · season visits' },
    { k: 'Boat', v: 'Aeolus · HKG 88' },
    { k: 'Seasons active', v: '11 · continuous since 2015' },
    { k: 'Venue waters', v: 'Victoria Harbour · Repulse Bay' },
  ],
  events: [
    {
      dateTop: '17 Apr',
      dateBottom: '2026',
      name: 'Spring Series · Race 5',
      venue: 'RHKYC, Victoria Harbour · Dragon class',
      resultTop: '4th',
      resultBottom: 'of 22',
    },
    {
      dateTop: '26 Mar',
      dateBottom: '2026',
      name: 'Hebe Haven Mid-Week',
      venue: 'Hebe Haven YC · mixed fleet',
      resultTop: '2nd',
      resultBottom: 'of 14',
    },
    {
      dateTop: '21 Feb',
      dateBottom: '2026',
      name: 'Lunar New Year Trophy',
      venue: 'RHKYC · Dragon class',
      resultTop: '5th',
      resultBottom: 'of 18',
    },
  ],
  eventsTotal: 38,
};

const ENRICHMENT_BY_ID: Record<string, PublicFaceEnrichment> = {
  '11111111-1111-1111-1111-000000000001': MARKUS,
};

export function getPublicFaceEnrichment(userId: string): PublicFaceEnrichment {
  return ENRICHMENT_BY_ID[userId] ?? EMPTY;
}
