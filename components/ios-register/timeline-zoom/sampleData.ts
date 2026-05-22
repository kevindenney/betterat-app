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
    status: 'plan',
    metaLeft: 'Wed · JHH Bloomberg 4S',
    metaRight: 'Preceptor: A. Ngo, RN',
    whatBody:
      'Take handoff on three HF patients and run the SBAR back, naming volume status changes and the specific telemetry I’d flag.',
    howItems: [
      { label: 'Pre-chart all three in Epic before 6:55', checked: true },
      { label: 'Skim AACN HF pocket card on the train', checked: true },
      { label: 'Use ISBAR template — no improvising', checked: false },
      { label: 'Flag the new lasix order on bed 12 explicitly', checked: false },
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

const SPRING_26: TimelineSeason = {
  id: 'spring26',
  title: "Spring '26 clinical",
  orgChip: { monogram: 'JH', label: 'Johns Hopkins · MSN' },
  dateRange: 'Jan 14 — May 8',
  weekOfTotal: { current: 7, total: 14 },
  weeks: [
    {
      id: 'w7',
      number: 7,
      dateRange: 'May 13 — 19',
      isCurrent: true,
      steps: spring26Steps.filter((s) => s.weekId === 'w7'),
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

export const SAMPLE_DATASET: TimelineDataset = {
  interest: { id: 'nursing', label: 'Nursing' },
  user: { initials: 'ES', color: '#7BA0C4' },
  focusStepId: 's-w7-wed',
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
};
