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
  timeline?: {
    title: string;
    settled?: boolean;
    sub: string;
    when: string;
    /** Trophy id when settled — taps drill into /profile/[userId]/trophy/[trophyId]. */
    trophyId?: string;
  }[];
  /** Trophies keyed by id — the settled-concept deep page reads from here. */
  trophies?: Record<string, Trophy>;
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
    /** Optional public-face target. Drops the chevron when absent. */
    userId?: string;
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

/**
 * Trophy — the settled-concept deep page model.
 *
 * A trophy is what a practitioner walks away with when a concept settles:
 * a name, the date it closed, the moment-of-realization synthesis they
 * wrote, the journey of practice that earned it, the capabilities it
 * settled, and the people who were part of the practice circle for it.
 */
export interface Trophy {
  /** Display title — "Heavy-air helm work", "Trust the shift". */
  title: string;
  /** When the concept settled — "Mar 2026". */
  settledAt: string;
  /** Closing synthesis — italic-serif body the practitioner wrote at close. */
  synthesis: { text: string; provenance: string };
  /** Capabilities settled by this trophy — chip list. */
  capabilities?: string[];
  /** The journey — 4-8 reflections/debriefs that built up to settling. */
  journey?: { text: string; when: string }[];
  /** Who was part of this practice — subset of the practice circle. */
  circleInThis?: { name: string; role: string; initials: string; userId?: string }[];
  /** Optional follow-up concept — closes the loop with what's being worked on now. */
  grewInto?: { title: string; sub?: string };
}

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
      trophyId: 'heavy-air-helm',
    },
    {
      title: 'Decision-making under start-line pressure',
      settled: true,
      sub:
        'Eight reflections, six races, then a Sunday where it stopped ' +
        'feeling like a decision.',
      when: 'Sep 2025',
      trophyId: 'start-line-patience',
    },
    {
      title: 'Reading shifts on a tight reach',
      settled: true,
      sub: 'Closed in the bay series before the Hong Kong move.',
      when: 'Apr 2025',
      trophyId: 'tight-reach-shifts',
    },
    {
      title: 'Bear-away under spinnaker, on the limit',
      sub:
        'A noted moment, not yet a settled concept. From the South ' +
        'Atlantic Winter 2024 reflections.',
      when: 'Aug 2024',
    },
  ],
  trophies: {
    'heavy-air-helm': {
      title: 'Heavy-air helm work',
      settledAt: 'Mar 2026',
      synthesis: {
        text:
          'The day I stopped fighting the boat. Twenty-two knots, port-tack ' +
          'lift on the second beat, and I didn’t tell my hands what to do — ' +
          'they were already there. The technique wasn’t a thing I was ' +
          'applying anymore. It was the shape of how I sit on the rail.',
        provenance: 'Closing synthesis · 14 Mar 2026 · RHKYC Spring Series Race 4',
      },
      capabilities: ['Heavy-air helm work', 'Reading the starboard layline'],
      journey: [
        {
          text:
            'Kept the boat flat through the third leg without thinking ' +
            'about kept-the-boat-flat. The technique was just there.',
          when: '14 Mar 2026',
        },
        {
          text:
            'Sam told me to stop counting and just feel the puff arrive. ' +
            'Second time I tried it the boat answered.',
          when: '28 Feb 2026',
        },
        {
          text:
            'I’m still overcorrecting on port-tack lifts. The boat tells ' +
            'me before I tell the boat.',
          when: '7 Feb 2026',
        },
        {
          text:
            'Twenty-four knots and I had to remind myself to breathe. ' +
            'Not yet a place I trust myself.',
          when: '21 Jan 2026',
        },
      ],
      circleInThis: [
        {
          name: 'Sam Whittaker',
          role: 'Coach · drilled this with me through the winter',
          initials: 'SW',
          userId: '22222222-2222-2222-2222-000000000001',
        },
        {
          name: 'Hugo Mira',
          role: 'Tactician · crewed Aeolus through three of the closing races',
          initials: 'HM',
          userId: '22222222-2222-2222-2222-000000000003',
        },
      ],
      grewInto: {
        title: 'Holding the boat down through the heavy second beat',
        sub: 'The current concept — what this trophy gave way to.',
      },
    },
    'start-line-patience': {
      title: 'Decision-making under start-line pressure',
      settledAt: 'Sep 2025',
      synthesis: {
        text:
          'The week the start stopped feeling like a decision and started ' +
          'feeling like a position I already held. The work wasn’t to start ' +
          'better. The work was to want different things at the gun.',
        provenance: 'Closing synthesis · 19 Sep 2025 · RHKYC Autumn Series Race 2',
      },
      capabilities: ['Pre-start positioning in a shifty breeze'],
      journey: [
        {
          text:
            'Didn’t need to look up. I knew where I was relative to the line.',
          when: '19 Sep 2025',
        },
        {
          text:
            'Patricia ran me through six start sequences in a half hour. ' +
            'The fifth one I made the call before she finished the question.',
          when: '5 Sep 2025',
        },
        {
          text:
            'Reset everything: stopped trying to win the start, started ' +
            'trying to be where I wanted the second beat from.',
          when: '12 Aug 2025',
        },
      ],
      circleInThis: [
        {
          name: 'Patricia Cho',
          role: 'Faculty · settled this concept with Markus',
          initials: 'PC',
          userId: '22222222-2222-2222-2222-000000000002',
        },
      ],
    },
    'tight-reach-shifts': {
      title: 'Reading shifts on a tight reach',
      settledAt: 'Apr 2025',
      synthesis: {
        text:
          'The reach used to be the recovery leg. After the bay series, ' +
          'it’s where I make up the ground. I stopped looking at the ' +
          'masthead fly and started watching the water two boat-lengths ahead.',
        provenance: 'Closing synthesis · 22 Apr 2025 · YC Argentino bay series',
      },
      capabilities: ['Tactical reads'],
      journey: [
        {
          text:
            'Closed it in the bay series before the Hong Kong move — three ' +
            'races where the reach worked exactly how I wanted it to.',
          when: '22 Apr 2025',
        },
      ],
    },
  },
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
    {
      name: 'Sam Whittaker',
      initials: 'SW',
      role: 'Coach · four seasons',
      userId: '22222222-2222-2222-2222-000000000001',
    },
    {
      name: 'Patricia Cho',
      initials: 'PC',
      role: 'Faculty · settled Decision-making under start-line pressure with Markus',
      userId: '22222222-2222-2222-2222-000000000002',
    },
    {
      name: 'Hugo Mira',
      initials: 'HM',
      role: 'Tactician · Phyloong, RHKYC Dragon fleet',
      tail: 'Mutual',
      userId: '22222222-2222-2222-2222-000000000003',
    },
    {
      name: 'Yvonne Leung',
      initials: 'YL',
      role: 'Peer · Dragon helm, also at RHKYC',
      tail: 'Mutual',
      userId: '22222222-2222-2222-2222-000000000004',
    },
    {
      name: 'Tomás Renart',
      initials: 'TR',
      role: 'Peer · you both follow him',
      tail: 'You follow',
      userId: '22222222-2222-2222-2222-000000000005',
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

const KEVIN_DENNEY: PublicFaceEnrichment = {
  firstName: 'Kevin',
  descriptor: 'Dragon Helm · Hong Kong',
  meta: [
    { icon: 'location-outline', text: 'RHKYC · Middle Island' },
    { icon: 'calendar-outline', text: '1 season' },
    { icon: 'checkmark-outline', text: '82 steps logged' },
  ],
  framing: {
    text:
      'Building a repeatable Dragon racing program — rig-tuning baselines, ' +
      'two-boat testing, and a first-beat decision system for shifty Hong Kong waters.',
    provenance: 'Written when joining BetterAt',
  },
  concept: {
    weekTail: 'Week 3',
    text:
      'Commit to a side before the gun — pick the first shift from the compass ' +
      'numbers, not from the fleet.',
    stats: '6 steps practised against · 2 debriefs',
    history: {
      primary: '3 concepts settled before this one',
      secondary: 'newest: Rig baselines',
    },
  },
  conceptHistory: [
    {
      title: 'Rig baselines',
      capability: 'Rig tuning to conditions',
      closed: 'Closed May 2026',
      text: 'Twelve sessions became one usable tuning matrix for the 8-18 kt band.',
    },
    {
      title: 'Start-line time-and-distance',
      capability: 'Start-line boat handling',
      closed: 'Closed Apr 2026',
      text: 'Held the front row in four of five spring-series starts.',
    },
    {
      title: 'Compass-number journaling',
      capability: 'First-beat strategy',
      closed: 'Closed Mar 2026',
      text: 'Stopped treating the fleet as the signal and made the compass numbers first-class evidence.',
    },
  ],
  timeline: [
    {
      title: 'Rig-tuning baselines',
      settled: true,
      sub: '12 sessions → one-page tuning matrix for 8-18 kt',
      when: 'May 2026',
    },
    {
      title: 'Two-boat testing vs. Wei Lun',
      sub: 'Upwind splits, 40-min windows off Middle Island',
      when: 'May 2026',
    },
    {
      title: 'Start-line time-and-distance',
      settled: true,
      sub: 'Held the front row 4 of 5 starts in the spring series',
      when: 'Apr 2026',
    },
    {
      title: 'Compass-number journaling',
      sub: 'Pre-start shift log, every race day',
      when: 'Mar 2026',
    },
  ],
  capabilities: [
    {
      name: 'Rig tuning to conditions',
      status: 'settled',
      evidence:
        'Matrix says 28 on the uppers at 14 kt — boat speed proved it both ways on the test day.',
      provenance: 'From a two-boat testing debrief · May 2026',
    },
    {
      name: 'Start-line boat handling',
      status: 'settled',
      evidence:
        'Time-and-distance is no longer a guess — I know what 35 seconds looks like.',
      provenance: 'From a race debrief · Apr 2026',
    },
    {
      name: 'First-beat strategy',
      status: 'working',
      evidence:
        'Still ducking the fleet instead of trusting the numbers when the pressure’s on.',
      provenance: 'From this week’s concept · Jun 2026',
    },
    {
      name: 'Crew choreography under spinnaker',
      status: 'emerging',
      evidence: 'Gybe-set worked twice in practice; not yet race-proven.',
      provenance: 'From a practice session log · May 2026',
    },
  ],
  capabilitiesTotal: 9,
  circle: [
    {
      name: 'Wei Lun Cheung',
      initials: 'WL',
      markColor: '#5E81AC',
      role: 'Two-boat testing partner · Dragon helm',
      tail: 'Mutual',
    },
    {
      name: 'Marta Reyes',
      initials: 'MR',
      markColor: '#A3736C',
      role: 'Coach · starts & boat-on-boat',
    },
    {
      name: 'James Tse',
      initials: 'JT',
      markColor: '#7B9E89',
      role: 'Crew · bow, since March',
      tail: 'Mutual',
    },
  ],
  circleTotal: 7,
  published: [
    {
      kind: 'reflection',
      text:
        'The fleet is a rumor. The compass is a fact. Six races of journaling finally made that real.',
      provenance: 'Reflection · on settling Start-line time-and-distance · Apr 2026',
    },
    {
      kind: 'thread',
      title: 'Anyone else find the ebb tide line moves 200m north after 1400?',
      topic: 'Spring Series R4 debrief',
      replies: 7,
      when: 'May 2026',
    },
    {
      kind: 'thread',
      title: 'Posting our 8-18kt tuning matrix — corrections welcome.',
      topic: 'Rig-tuning baselines',
      replies: 12,
      when: 'May 2026',
    },
  ],
  publishedTotal: 11,
  where: [
    { k: 'Home waters', v: 'Middle Island, Hong Kong' },
    { k: 'Club', v: 'RHKYC' },
    { k: 'Class', v: 'Dragon' },
    { k: 'Racing area', v: 'Repulse Bay E course' },
  ],
  events: [
    {
      dateTop: '24',
      dateBottom: 'May',
      name: 'Spring Series · Race 5',
      venue: 'Middle Island',
      resultTop: '4th of 18',
      resultBottom: 'best of season',
    },
    {
      dateTop: '10',
      dateBottom: 'May',
      name: 'Spring Series · Race 4',
      venue: 'Middle Island',
      resultTop: '7th of 19',
    },
    {
      dateTop: '26',
      dateBottom: 'Apr',
      name: 'Spring Series · Race 3',
      venue: 'Repulse Bay',
      resultTop: '11th of 19',
      resultBottom: 'OCS recovered',
    },
  ],
  eventsTotal: 6,
};

const ENRICHMENT_BY_ID: Record<string, PublicFaceEnrichment> = {
  '11111111-1111-1111-1111-000000000001': MARKUS,
  'd67f765e-7fe6-4f79-b514-f1b7f9a1ba3f': KEVIN_DENNEY,
};

export function getPublicFaceEnrichment(userId: string): PublicFaceEnrichment {
  return ENRICHMENT_BY_ID[userId] ?? EMPTY;
}

export function getTrophy(userId: string, trophyId: string): Trophy | undefined {
  return getPublicFaceEnrichment(userId).trophies?.[trophyId];
}
