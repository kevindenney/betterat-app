/**
 * Timeline Zoom — sample data.
 *
 * Mirrors Emily's MSN clinical year from Section A of the handoff so the
 * four levels show the same dataset at different depths. Spring '26 is the
 * current season; Fall '25 / Summer '25 / Spring '25 / Fall '24 are archived
 * lanes in L4.
 */

import type {
  Capability,
  LifetimeAnalysis,
  SeasonAnalysis,
  TimelineDataset,
  TimelineSeason,
  TimelineStep,
} from './types';

// Capability palette — coral-system semantics, but doubles as L4 brick fill.
export const CAPABILITY_PALETTE = {
  cardio:       { id: 'cardio',  label: 'Cardio',     color: '#A04CC4' }, // purple
  pharm:        { id: 'pharm',   label: 'Pharm',      color: '#5BA46F' }, // green
  comm:         { id: 'comm',    label: 'Comm',       color: '#2F8FB0' }, // teal
  assess:       { id: 'assess',  label: 'Assess',     color: '#C4474A' }, // red
  sbar:         { id: 'sbar',    label: 'SBAR',       color: '#1F77B4' }, // blue
  diuretic:     { id: 'diuretic',label: 'Diuretic',   color: '#5BA46F' }, // green
  procedural:   { id: 'proc',    label: 'Procedural', color: '#A47A52' }, // brown
} satisfies Record<string, Capability>;

const PALETTE = CAPABILITY_PALETTE;

const COHORT_AVATARS = [
  { id: 'mr', initials: 'MR', color: '#5BA46F' },
  { id: 'jk', initials: 'JK', color: '#7BA0C4' },
  { id: 'as', initials: 'AS', color: '#C4474A' },
];

// Spring '26 clinical — current season, 14 weeks, focused week is 7.
const spring26Steps: TimelineStep[] = [
  {
    id: 's-w7-mon',
    title: 'Telemetry interpretation — afib rhythms',
    preTitle: 'MON · CLINICAL',
    dayOfWeek: 'mon',
    weekId: 'w7',
    seasonId: 'spring26',
    status: 'reflected',
    capabilities: [PALETTE.cardio, PALETTE.assess],
    from: { source: 'Adult Health I · M4' },
    cohortAvatars: COHORT_AVATARS.slice(0, 2),
    cohortLabel: '2 cohort',
  },
  {
    id: 's-w7-wed',
    title: 'HF handoff in 4-South',
    preTitle: 'TODAY · 7AM PRE-SHIFT',
    dayOfWeek: 'wed',
    weekId: 'w7',
    seasonId: 'spring26',
    status: 'do',
    subStep: { current: 3, total: 5, label: 'next up' },
    peerQuote: {
      author: 'A. Ngo',
      when: 'this morning',
      body: 'You named the lasix before I asked — that was the moment I knew you were ready.',
      avatarInitials: 'AN',
      avatarColor: '#5BA46F',
    },
    metaLeft: 'Wed · JHH Bloomberg 4S',
    metaRight: 'Preceptor: A. Ngo, RN',
    whatBody:
      'Take handoff on three HF patients and run the SBAR back, naming volume status changes and the specific telemetry I’d flag.',
    howItems: [
      { id: 'how-1', label: 'Pre-chart all three in Epic before 6:55', checked: true },
      { id: 'how-2', label: 'Skim AACN HF pocket card on the train', checked: true },
      { id: 'how-3', label: 'Use ISBAR template — no improvising', checked: false },
      { id: 'how-4', label: 'Flag the new lasix order on bed 12 explicitly', checked: false },
    ],
    capabilities: [
      { id: 'cardio-a', label: 'Cardio assessment', color: '#A04CC4' },
      { id: 'sbar', label: 'SBAR handoff', color: '#1F77B4' },
      { id: 'diuretic', label: 'Diuretic monitoring', color: '#5BA46F' },
    ],
    from: { source: 'Adult Health I · Module 4', suggestedBy: 'Dr. K Murphy' },
    cohortAvatars: COHORT_AVATARS,
    cohortLabel: '2 cohort',
    discussCount: 3,
  },
  {
    id: 's-w6-wed',
    title: 'Pre-op skin assessment, vascular surgery',
    preTitle: 'WED · CLINICAL',
    dayOfWeek: 'wed',
    weekId: 'w6',
    seasonId: 'spring26',
    status: 'done',
    capabilities: [PALETTE.assess],
  },
  {
    id: 's-w6-fri',
    title: 'Difficult discharge teaching, low health literacy',
    preTitle: 'FRI · SIM',
    dayOfWeek: 'fri',
    weekId: 'w6',
    seasonId: 'spring26',
    status: 'reflect',
    capabilities: [PALETTE.comm],
  },
  {
    id: 's-w5-tue',
    title: 'High-alert med double-check workflow',
    preTitle: 'TUE',
    dayOfWeek: 'tue',
    weekId: 'w5',
    seasonId: 'spring26',
    status: 'done',
    capabilities: [PALETTE.pharm],
  },
  {
    id: 's-w5-thu',
    title: 'Peripheral IV — second attempt criteria',
    preTitle: 'THU · SIM',
    dayOfWeek: 'thu',
    weekId: 'w5',
    seasonId: 'spring26',
    status: 'done',
    capabilities: [PALETTE.procedural],
  },
];

// Build deterministic brick lanes per season so L4 lays out consistently.
function bricksFor(colors: string[]) {
  return colors.map((capabilityColor) => ({ capabilityColor }));
}

// Capability-mix band authored from a palette entry. Carries id + label
// (not just color) so the L3 takeaway headline and the tappable chip row
// can name the family — color alone leaves both blank.
function band(
  cap: { id: string; label: string; color: string },
  volume: number,
) {
  return {
    capabilityId: cap.id,
    capabilityLabel: cap.label,
    capabilityColor: cap.color,
    volume,
  };
}

// Spring '26 analysis layer — hand-authored to match the canonical
// "REFLECTING ON NOW" surface (Screen 09). Drives the capability river
// + peer journey + librarian prompt on L3.
//
// Capability arc: weeks 1-3 procedural (orientation, IV, vitals),
// weeks 4-6 assessment ramping, weeks 7-10 cardio dominance, weeks
// 11-14 synthesis (comm + pharm). Volume peaks mid-season around
// the cardio block.
const SPRING_26_ANALYSIS: SeasonAnalysis = {
  weeklyCapabilities: [
    { weekNumber: 1,  bands: [band(PALETTE.procedural, 4), band(PALETTE.assess, 1)] },
    { weekNumber: 2,  bands: [band(PALETTE.procedural, 3), band(PALETTE.comm, 1)] },
    { weekNumber: 3,  bands: [band(PALETTE.procedural, 3), band(PALETTE.assess, 2)] },
    { weekNumber: 4,  bands: [band(PALETTE.assess, 4), band(PALETTE.procedural, 2)] },
    { weekNumber: 5,  bands: [band(PALETTE.assess, 3), band(PALETTE.pharm, 2), band(PALETTE.procedural, 1)] },
    { weekNumber: 6,  bands: [band(PALETTE.assess, 3), band(PALETTE.comm, 2)] },
    { weekNumber: 7,  bands: [band(PALETTE.cardio, 4), band(PALETTE.sbar, 2), band(PALETTE.assess, 1)] },
    { weekNumber: 8,  bands: [band(PALETTE.cardio, 3), band(PALETTE.diuretic, 2)] },
    { weekNumber: 9,  bands: [band(PALETTE.cardio, 3), band(PALETTE.sbar, 1)] },
    { weekNumber: 10, bands: [band(PALETTE.cardio, 2), band(PALETTE.comm, 2)] },
    { weekNumber: 11, bands: [band(PALETTE.comm, 3), band(PALETTE.pharm, 2)] },
    { weekNumber: 12, bands: [band(PALETTE.comm, 2), band(PALETTE.assess, 2)] },
    { weekNumber: 13, bands: [band(PALETTE.pharm, 3), band(PALETTE.comm, 1)] },
    { weekNumber: 14, bands: [band(PALETTE.assess, 2), band(PALETTE.comm, 1)] },
  ],
  phases: [
    { id: 'p-entry',      label: 'wk 1 · entry', startWeek: 1,  endWeek: 1,  color: PALETTE.procedural.color },
    { id: 'p-procedural', label: 'Procedural',   startWeek: 2,  endWeek: 3,  color: PALETTE.procedural.color },
    { id: 'p-assess',     label: 'Assessment',   startWeek: 4,  endWeek: 6,  color: PALETTE.assess.color },
    { id: 'p-cardio',     label: 'Cardio block', startWeek: 7,  endWeek: 10, color: PALETTE.cardio.color },
    { id: 'p-synthesis',  label: 'Synthesis',    startWeek: 11, endWeek: 13, color: PALETTE.comm.color },
    { id: 'p-finale',     label: 'finale',       startWeek: 14, endWeek: 14, color: PALETTE.assess.color },
  ],
  markers: [
    { id: 'm-cardio-aha', weekNumber: 7, kind: 'trophy', label: 'named the lasix', capabilityColor: PALETTE.cardio.color },
  ],
  peers: [
    {
      id: 'ngo',
      initials: 'AN',
      color: '#5BA46F',
      role: 'preceptor',
      firstWeek: 1,
      weeklyAppearances: Array.from({ length: 14 }, (_, i) => ({ weekNumber: i + 1, count: 2 })),
    },
    {
      id: 'rivera',
      initials: 'MR',
      color: '#7BA0C4',
      role: 'cohort',
      firstWeek: 2,
      weeklyAppearances: [
        { weekNumber: 2, count: 1 }, { weekNumber: 3, count: 1 }, { weekNumber: 4, count: 2 },
        { weekNumber: 5, count: 2 }, { weekNumber: 6, count: 1 }, { weekNumber: 7, count: 2 },
        { weekNumber: 8, count: 1 }, { weekNumber: 9, count: 2 }, { weekNumber: 10, count: 1 },
        { weekNumber: 11, count: 1 }, { weekNumber: 12, count: 2 }, { weekNumber: 13, count: 1 },
      ],
    },
    {
      id: 'kim',
      initials: 'JK',
      color: '#A47A52',
      role: 'cohort',
      firstWeek: 1,
      weeklyAppearances: [
        { weekNumber: 1, count: 1 }, { weekNumber: 3, count: 1 }, { weekNumber: 5, count: 2 },
        { weekNumber: 6, count: 1 }, { weekNumber: 7, count: 1 }, { weekNumber: 8, count: 2 },
        { weekNumber: 10, count: 1 }, { weekNumber: 12, count: 1 },
      ],
    },
    {
      id: 'murphy',
      initials: 'KM',
      color: '#A04CC4',
      role: 'faculty',
      firstWeek: 4,
      weeklyAppearances: [
        { weekNumber: 4, count: 1 }, { weekNumber: 7, count: 2 }, { weekNumber: 11, count: 1 },
      ],
    },
  ],
  reflections: [
    {
      id: 'r-w5',
      weekNumber: 5,
      quote: 'vitals before story',
      capabilityColor: PALETTE.assess.color,
    },
    {
      id: 'r-w7',
      weekNumber: 7,
      quote: 'named the lasix',
      capabilityColor: PALETTE.cardio.color,
    },
  ],
  librarianPrompt: {
    eyebrow: 'This arc · the librarian noticed',
    body:
      "You're halfway through Spring '26. Cardio has tightened around assessment + handoff; procedural has cooled off since Week 4. Dr. Murphy joins again next week. What do you want this arc to add up to?",
    primaryCta: { label: 'Open an arc check-in', intent: 'open-season-check-in' },
    secondaryCta: { label: 'Not now' },
  },
};

const SPRING_26: TimelineSeason = {
  id: 'spring26',
  title: "Spring '26 clinical",
  orgChip: { monogram: 'JH', label: 'Johns Hopkins · MSN' },
  dateRange: 'Jan 14 — May 8',
  weekOfTotal: { current: 7, total: 14 },
  analysis: SPRING_26_ANALYSIS,
  weeks: [
    {
      id: 'w7',
      number: 7,
      dateRange: 'May 13 — 19',
      isCurrent: true,
      steps: spring26Steps.filter((s) => s.weekId === 'w7'),
      contextStrip:
        "Spring '26 has been cardio-heavy. Next two weeks: one HF handoff + two pharm sessions.",
      planningHint: {
        eyebrow: 'The librarian noticed',
        body:
          "Lasix-flow practice hasn't appeared in the nearby run since Week 4.",
        emphasisLine: 'Slot a session before Friday?',
        supportingLine: "A. Ngo's walkthrough would fit that gap.",
        primaryCta: { label: "Accept A. Ngo's offer", intent: 'accept-suggestion' },
        secondaryCta: { label: 'Not now' },
      },
    },
    {
      id: 'w6',
      number: 6,
      dateRange: 'May 6 — 12',
      steps: spring26Steps.filter((s) => s.weekId === 'w6'),
    },
    {
      id: 'w5',
      number: 5,
      dateRange: 'Apr 29 — May 5',
      steps: spring26Steps.filter((s) => s.weekId === 'w5'),
    },
  ],
  bricks: bricksFor([
    PALETTE.cardio.color, PALETTE.sbar.color,    PALETTE.assess.color,  PALETTE.pharm.color,
    PALETTE.cardio.color, PALETTE.comm.color,    PALETTE.cardio.color,  PALETTE.assess.color,
    PALETTE.pharm.color,  PALETTE.cardio.color,  PALETTE.comm.color,    PALETTE.cardio.color,
    PALETTE.assess.color, PALETTE.procedural.color, PALETTE.cardio.color, PALETTE.sbar.color,
    PALETTE.cardio.color, PALETTE.assess.color,  PALETTE.cardio.color,  PALETTE.pharm.color,
    PALETTE.comm.color,   PALETTE.cardio.color,  PALETTE.assess.color,
  ]),
  headline: {
    value: '6 of 8 signed',
    caption: 'rotation competencies attested by preceptor',
    delta: { direction: 'up', text: '+2 this rotation' },
    tone: 'positive',
  },
};

const FALL_25: TimelineSeason = {
  id: 'fall25',
  title: "Fall '25 fundamentals",
  dateRange: 'Sep 3 — Dec 12',
  archived: true,
  weeks: [],
  bricks: bricksFor([
    PALETTE.procedural.color, PALETTE.assess.color, PALETTE.procedural.color, PALETTE.comm.color,
    PALETTE.procedural.color, PALETTE.assess.color, PALETTE.comm.color,       PALETTE.procedural.color,
    PALETTE.assess.color,     PALETTE.procedural.color, PALETTE.comm.color,    PALETTE.procedural.color,
    PALETTE.procedural.color, PALETTE.comm.color,   PALETTE.procedural.color, PALETTE.assess.color,
    PALETTE.procedural.color, PALETTE.assess.color,  PALETTE.procedural.color, PALETTE.comm.color,
    PALETTE.procedural.color, PALETTE.assess.color,  PALETTE.procedural.color, PALETTE.comm.color,
    PALETTE.procedural.color, PALETTE.assess.color,  PALETTE.procedural.color, PALETTE.comm.color,
    PALETTE.procedural.color, PALETTE.assess.color,  PALETTE.procedural.color, PALETTE.comm.color,
    PALETTE.procedural.color, PALETTE.assess.color,  PALETTE.procedural.color, PALETTE.comm.color,
    PALETTE.procedural.color, PALETTE.comm.color,
  ]),
};

const SUMMER_25: TimelineSeason = {
  id: 'summer25',
  title: "Summer '25 NCLEX prep",
  dateRange: 'Jun 8 — Aug 24',
  archived: true,
  weeks: [],
  bricks: bricksFor([
    PALETTE.assess.color, PALETTE.assess.color, PALETTE.comm.color,    PALETTE.assess.color,
    PALETTE.assess.color, PALETTE.assess.color, PALETTE.comm.color,    PALETTE.assess.color,
    PALETTE.assess.color, PALETTE.comm.color,   PALETTE.assess.color,  PALETTE.comm.color,
    PALETTE.assess.color, PALETTE.assess.color, PALETTE.comm.color,    PALETTE.assess.color,
    PALETTE.comm.color,   PALETTE.assess.color, PALETTE.comm.color,    PALETTE.assess.color,
    PALETTE.assess.color, PALETTE.comm.color,
  ]),
};

const SPRING_25: TimelineSeason = {
  id: 'spring25',
  title: "Spring '25 pre-licensure",
  dateRange: 'Jan 16 — May 9',
  archived: true,
  weeks: [],
  bricks: bricksFor([
    PALETTE.procedural.color, PALETTE.comm.color,    PALETTE.assess.color,  PALETTE.comm.color,
    PALETTE.procedural.color, PALETTE.assess.color,  PALETTE.comm.color,    PALETTE.procedural.color,
    PALETTE.assess.color,     PALETTE.comm.color,    PALETTE.procedural.color, PALETTE.assess.color,
    PALETTE.comm.color,       PALETTE.procedural.color, PALETTE.assess.color, PALETTE.comm.color,
    PALETTE.procedural.color, PALETTE.assess.color,  PALETTE.comm.color,    PALETTE.procedural.color,
    PALETTE.assess.color,     PALETTE.comm.color,    PALETTE.procedural.color, PALETTE.assess.color,
    PALETTE.comm.color,       PALETTE.procedural.color, PALETTE.assess.color, PALETTE.comm.color,
    PALETTE.procedural.color, PALETTE.assess.color,  PALETTE.comm.color,
  ]),
};

const FALL_24: TimelineSeason = {
  id: 'fall24',
  title: "Fall '24 — first semester",
  dateRange: 'Sep 5 — Dec 14',
  archived: true,
  weeks: [],
  bricks: bricksFor([
    PALETTE.procedural.color, PALETTE.comm.color,    PALETTE.procedural.color, PALETTE.assess.color,
    PALETTE.comm.color,       PALETTE.procedural.color, PALETTE.comm.color,    PALETTE.assess.color,
    PALETTE.procedural.color, PALETTE.comm.color,    PALETTE.procedural.color, PALETTE.assess.color,
    PALETTE.comm.color,       PALETTE.procedural.color, PALETTE.comm.color,    PALETTE.assess.color,
    PALETTE.procedural.color, PALETTE.comm.color,    PALETTE.procedural.color, PALETTE.assess.color,
    PALETTE.comm.color,       PALETTE.procedural.color, PALETTE.comm.color,    PALETTE.assess.color,
    PALETTE.procedural.color, PALETTE.comm.color,    PALETTE.procedural.color, PALETTE.assess.color,
  ]),
};

// Lifetime analysis layer — drives L4 (Screen 10 · REFLECTING ON A LIFE).
// Five sessions oldest → newest (Fall '24 first, Spring '26 last). Capability
// arc shows Emily evolving from procedural-heavy first semester →
// assessment/NCLEX prep → return to procedural in Fall '25 → cardio
// dominance in Spring '26 (the current rotation). Two trophies and two
// italic-serif reflections track the inflection points.
const LIFETIME_SAMPLE: LifetimeAnalysis = {
  sessions: [
    { sessionIndex: 1, seasonId: 'fall24',   label: "Fall '24",   dominantCapabilityColor: PALETTE.procedural.color, volume: 28 },
    { sessionIndex: 2, seasonId: 'spring25', label: "Spring '25", dominantCapabilityColor: PALETTE.procedural.color, volume: 31 },
    { sessionIndex: 3, seasonId: 'summer25', label: "Summer '25", dominantCapabilityColor: PALETTE.assess.color,     volume: 22, isRace: true },
    { sessionIndex: 4, seasonId: 'fall25',   label: "Fall '25",   dominantCapabilityColor: PALETTE.procedural.color, volume: 37 },
    { sessionIndex: 5, seasonId: 'spring26', label: "Spring '26", dominantCapabilityColor: PALETTE.cardio.color,     volume: 23 },
  ],
  peers: [
    {
      id: 'ngo',
      initials: 'AN',
      color: '#5BA46F',
      role: 'preceptor',
      firstSessionIndex: 4,
      sessionAppearances: [
        { sessionIndex: 4, count: 6 },
        { sessionIndex: 5, count: 8 },
      ],
    },
    {
      id: 'kim',
      initials: 'JK',
      color: '#A47A52',
      role: 'cohort',
      firstSessionIndex: 1,
      sessionAppearances: [
        { sessionIndex: 1, count: 3 },
        { sessionIndex: 2, count: 4 },
        { sessionIndex: 3, count: 2 },
        { sessionIndex: 4, count: 5 },
        { sessionIndex: 5, count: 3 },
      ],
    },
    {
      id: 'murphy',
      initials: 'KM',
      color: '#A04CC4',
      role: 'faculty',
      firstSessionIndex: 2,
      sessionAppearances: [
        { sessionIndex: 2, count: 2 },
        { sessionIndex: 4, count: 1 },
        { sessionIndex: 5, count: 2 },
      ],
    },
    {
      id: 'rivera',
      initials: 'MR',
      color: '#7BA0C4',
      role: 'cohort',
      firstSessionIndex: 4,
      sessionAppearances: [
        { sessionIndex: 4, count: 3 },
        { sessionIndex: 5, count: 5 },
      ],
    },
  ],
  reflections: [
    {
      id: 'lr-s3',
      sessionIndex: 3,
      quote: 'passed NCLEX',
      capabilityColor: PALETTE.assess.color,
    },
    {
      id: 'lr-s5',
      sessionIndex: 5,
      quote: 'first solo handoff',
      capabilityColor: PALETTE.cardio.color,
    },
  ],
  trophies: [
    { id: 'tr-s3', sessionIndex: 3, label: 'NCLEX', capabilityColor: PALETTE.assess.color },
    { id: 'tr-s4', sessionIndex: 4, label: 'Dean’s List', capabilityColor: PALETTE.procedural.color },
  ],
  librarianPrompt: {
    eyebrow: 'Across your practice · the librarian noticed',
    body:
      "Since Fall '24 you've drifted from procedural toward cardio + assessment. Your two milestones both came from assessment-heavy work. Worth a reflection on what you're becoming?",
    primaryCta: { label: 'Start a reflection', intent: 'start-reflection' },
    secondaryCta: { label: 'Not now' },
  },
};

export const SAMPLE_DATASET: TimelineDataset = {
  interest: { id: 'nursing', label: 'Nursing' },
  user: { initials: 'ES', color: '#7BA0C4' },
  focusStepId: 's-w7-wed',
  nowStepId: 's-w7-wed',
  currentSeasonId: 'spring26',
  stepCounter: { current: 27, total: 41 },
  weekCounter: { current: 7, total: 14 },
  totalSeasons: 5,
  totalSteps: 142,
  sinceDate: "Sep '24",
  seasons: [SPRING_26, FALL_25, SUMMER_25, SPRING_25, FALL_24],
  capabilityFilters: [
    { id: 'all',    label: 'All' },
    { id: 'cardio', label: 'Cardio', icon: 'heart-outline',     color: PALETTE.cardio.color },
    { id: 'pharm',  label: 'Pharm',  icon: 'medkit-outline',    color: PALETTE.pharm.color },
    { id: 'comm',   label: 'Comm',   icon: 'chatbubble-outline',color: PALETTE.comm.color },
    { id: 'assess', label: 'Assess', icon: 'pulse-outline',     color: PALETTE.assess.color },
  ],
  lifetime: LIFETIME_SAMPLE,
  lifetimeHeadline: {
    value: '32% through MSN',
    caption: '14 months to NCLEX · 28 of 86 competencies attested',
    tone: 'neutral',
  },
};
