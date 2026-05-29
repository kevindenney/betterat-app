/**
 * Timeline Zoom — entrepreneur sample (Savitri Devi Munda).
 *
 * The D7 money-lane reference persona from the Phase D spec: a Khunti
 * lac-craft + tasar reeling micro-entrepreneur, SHG member with PRADAN,
 * one MUDRA Shishu loan repaid and Kishore in process. Her season is a
 * production-and-festival cycle ("Diwali run-up"); her lifetime view is
 * loan-tier progression + ₹ earned per season.
 *
 * Hand-authored like the nursing SAMPLE_DATASET — this is in-memory
 * preview data, never touches real accounts. It exists so the L3 money
 * lane and L4 money readout (D7) have somewhere to render before the
 * step_finance schema half lands and a real demo account is seeded.
 *
 * The interest id `entrepreneur` resolves to ENTREPRENEUR_VOCAB and
 * (because hasMoneyLane('entrepreneur') is true) lights up the money
 * surfaces. The season's ISO dates also make the D6 anchor strip show
 * Diwali + wedding-season pegs.
 */

import type {
  Capability,
  LifetimeAnalysis,
  LifetimeFinance,
  SeasonAnalysis,
  SeasonFinance,
  TimelineDataset,
  TimelineSeason,
  TimelineStep,
} from './types';

// Entrepreneur capability palette — production-and-commerce families.
// Hand-assigned (ENTREPRENEUR_VOCAB carries no palette yet), perceptually
// distinct so the river reads cleanly.
const CAP = {
  production: { id: 'production', label: 'Production', color: '#A47A52' },
  marketing:  { id: 'marketing',  label: 'Marketing',  color: '#C46E49' },
  qc:         { id: 'qc',         label: 'Quality',    color: '#5BA46F' },
  money:      { id: 'money',      label: 'Money',      color: '#C99632' },
  compliance: { id: 'compliance', label: 'Compliance', color: '#7E6FC8' },
  training:   { id: 'training',   label: 'Training',   color: '#2F8FB0' },
} satisfies Record<string, Capability>;

function bricksFor(colors: string[]) {
  return colors.map((capabilityColor) => ({ capabilityColor }));
}

// Current season — "Diwali run-up '25". 11-week production cycle, the
// SHG ramping output toward peak festival demand. Focused week is 7.
const diwaliSteps: TimelineStep[] = [
  {
    id: 'e-w7-mon',
    title: 'Diwali order — 200 lac bangles for Ranchi buyer',
    preTitle: 'SOM · UTPAADAN',
    dayOfWeek: 'mon',
    weekId: 'ew7',
    seasonId: 'diwali25',
    status: 'do',
    capabilities: [CAP.production, CAP.money],
  },
  {
    id: 'e-w7-wed',
    title: 'First ₹5000 sales week — haat day stall',
    preTitle: 'BUDH · HAAT',
    dayOfWeek: 'wed',
    weekId: 'ew7',
    seasonId: 'diwali25',
    status: 'reflected',
    capabilities: [CAP.marketing, CAP.money],
  },
  {
    id: 'e-w6-thu',
    title: 'Trained 3 SHG sisters in natural-dye finishing',
    preTitle: 'GURU · PRASHIKSHAN',
    dayOfWeek: 'thu',
    weekId: 'ew6',
    seasonId: 'diwali25',
    status: 'done',
    capabilities: [CAP.training, CAP.qc],
  },
  {
    id: 'e-w6-sat',
    title: 'Quality-check tasar reel batch — reject 12 skeins',
    preTitle: 'SHANI · QC',
    dayOfWeek: 'sat',
    weekId: 'ew6',
    seasonId: 'diwali25',
    status: 'done',
    capabilities: [CAP.qc],
  },
  {
    id: 'e-w5-tue',
    title: 'GST Q3 filing prep with PRADAN field officer',
    preTitle: 'MANGAL · ANUPALAN',
    dayOfWeek: 'tue',
    weekId: 'ew5',
    seasonId: 'diwali25',
    status: 'done',
    capabilities: [CAP.compliance, CAP.money],
  },
];

// Weekly cash flow — ₹ in (sales) / ₹ out (raw lac, dye, transport).
// The arc ramps toward the Diwali peak around weeks 7-9, with a lean
// early stretch while working capital is tied up in raw material.
const DIWALI_FINANCE: SeasonFinance = {
  weekly: [
    { weekNumber: 1,  in: 1200,  out: 3400 },
    { weekNumber: 2,  in: 2100,  out: 2600 },
    { weekNumber: 3,  in: 3800,  out: 2200 },
    { weekNumber: 4,  in: 5200,  out: 2800 },
    { weekNumber: 5,  in: 4600,  out: 3100 },
    { weekNumber: 6,  in: 6800,  out: 2400 },
    { weekNumber: 7,  in: 9400,  out: 3600 },
    { weekNumber: 8,  in: 12200, out: 4100 },
    { weekNumber: 9,  in: 14800, out: 3900 },
    { weekNumber: 10, in: 8600,  out: 2600 },
    { weekNumber: 11, in: 5200,  out: 2100 },
  ],
  workingCapital: 18400,
};

const DIWALI_ANALYSIS: SeasonAnalysis = {
  weeklyCapabilities: [
    { weekNumber: 1,  bands: [{ capabilityColor: CAP.production.color, volume: 4 }, { capabilityColor: CAP.compliance.color, volume: 1 }] },
    { weekNumber: 2,  bands: [{ capabilityColor: CAP.production.color, volume: 4 }, { capabilityColor: CAP.qc.color, volume: 1 }] },
    { weekNumber: 3,  bands: [{ capabilityColor: CAP.production.color, volume: 3 }, { capabilityColor: CAP.marketing.color, volume: 2 }] },
    { weekNumber: 4,  bands: [{ capabilityColor: CAP.production.color, volume: 3 }, { capabilityColor: CAP.training.color, volume: 2 }] },
    { weekNumber: 5,  bands: [{ capabilityColor: CAP.compliance.color, volume: 2 }, { capabilityColor: CAP.money.color, volume: 2 }, { capabilityColor: CAP.production.color, volume: 2 }] },
    { weekNumber: 6,  bands: [{ capabilityColor: CAP.qc.color, volume: 3 }, { capabilityColor: CAP.training.color, volume: 2 }] },
    { weekNumber: 7,  bands: [{ capabilityColor: CAP.marketing.color, volume: 3 }, { capabilityColor: CAP.money.color, volume: 3 }, { capabilityColor: CAP.production.color, volume: 2 }] },
    { weekNumber: 8,  bands: [{ capabilityColor: CAP.marketing.color, volume: 4 }, { capabilityColor: CAP.production.color, volume: 3 }] },
    { weekNumber: 9,  bands: [{ capabilityColor: CAP.marketing.color, volume: 4 }, { capabilityColor: CAP.money.color, volume: 2 }] },
    { weekNumber: 10, bands: [{ capabilityColor: CAP.money.color, volume: 3 }, { capabilityColor: CAP.qc.color, volume: 1 }] },
    { weekNumber: 11, bands: [{ capabilityColor: CAP.money.color, volume: 2 }, { capabilityColor: CAP.compliance.color, volume: 1 }] },
  ],
  phases: [
    { id: 'p-make',    label: 'Production',    startWeek: 1, endWeek: 4,  color: CAP.production.color },
    { id: 'p-ready',   label: 'QC + training', startWeek: 5, endWeek: 6,  color: CAP.qc.color },
    { id: 'p-sell',    label: 'Diwali rush',   startWeek: 7, endWeek: 9,  color: CAP.marketing.color },
    { id: 'p-tally',   label: 'Tally',         startWeek: 10, endWeek: 11, color: CAP.money.color },
  ],
  markers: [
    { id: 'em-5k', weekNumber: 7, kind: 'trophy', label: 'first ₹5000 week', capabilityColor: CAP.money.color },
  ],
  peers: [
    {
      id: 'vimla',
      initials: 'VM',
      name: 'Vimla',
      color: '#C46E49',
      role: 'SHG sister',
      firstWeek: 1,
      weeklyAppearances: Array.from({ length: 11 }, (_, i) => ({ weekNumber: i + 1, count: 2 })),
    },
    {
      id: 'pradan',
      initials: 'RP',
      name: 'Ranjit (PRADAN)',
      color: '#7E6FC8',
      role: 'field officer',
      firstWeek: 5,
      weeklyAppearances: [
        { weekNumber: 5, count: 2 }, { weekNumber: 8, count: 1 }, { weekNumber: 10, count: 1 },
      ],
    },
    {
      id: 'sunita',
      initials: 'SU',
      name: 'Sunita',
      color: '#5BA46F',
      role: 'SHG sister',
      firstWeek: 2,
      weeklyAppearances: [
        { weekNumber: 2, count: 1 }, { weekNumber: 4, count: 2 }, { weekNumber: 6, count: 1 },
        { weekNumber: 7, count: 1 }, { weekNumber: 9, count: 1 },
      ],
    },
  ],
  reflections: [
    { id: 'er-w5', weekNumber: 5, quote: 'books match the haat receipts', capabilityColor: CAP.money.color },
    { id: 'er-w7', weekNumber: 7, quote: 'first ₹5000 week', capabilityColor: CAP.money.color },
  ],
  librarianPrompt: {
    eyebrow: 'This season · what your books noticed',
    body:
      "You're past the Diwali peak. Sales tripled from Week 4 to Week 9, and you trained three sisters along the way. Working capital is the tightest before the festival — worth planning the raw-lac buy earlier next cycle?",
    primaryCta: { label: 'Open a season check-in', intent: 'open-season-check-in' },
    secondaryCta: { label: 'Not now' },
  },
};

const DIWALI_25: TimelineSeason = {
  id: 'diwali25',
  title: 'Diwali run-up · 2025',
  orgChip: { monogram: 'PR', label: 'PRADAN · Khunti SHG' },
  dateRange: 'Sep 15 — Nov 30',
  startDateISO: '2025-09-15',
  endDateISO: '2025-11-30',
  weekOfTotal: { current: 7, total: 11 },
  analysis: DIWALI_ANALYSIS,
  finance: DIWALI_FINANCE,
  weeks: [
    {
      id: 'ew7',
      number: 7,
      dateRange: 'Oct 27 — Nov 2',
      isCurrent: true,
      steps: diwaliSteps.filter((s) => s.weekId === 'ew7'),
      contextStrip:
        'The Diwali rush is on — sales have tripled since Week 4. Two more buyer orders to fill.',
    },
    {
      id: 'ew6',
      number: 6,
      dateRange: 'Oct 20 — 26',
      steps: diwaliSteps.filter((s) => s.weekId === 'ew6'),
    },
    {
      id: 'ew5',
      number: 5,
      dateRange: 'Oct 13 — 19',
      steps: diwaliSteps.filter((s) => s.weekId === 'ew5'),
    },
  ],
  bricks: bricksFor([
    CAP.production.color, CAP.production.color, CAP.compliance.color, CAP.production.color,
    CAP.qc.color,         CAP.training.color,   CAP.marketing.color,  CAP.money.color,
    CAP.marketing.color,  CAP.production.color, CAP.marketing.color,  CAP.money.color,
    CAP.qc.color,         CAP.marketing.color,  CAP.money.color,      CAP.compliance.color,
  ]),
};

const WEDDING_24: TimelineSeason = {
  id: 'wedding24',
  title: 'Wedding season · 2024–25',
  dateRange: 'Nov 2024 — Feb 2025',
  archived: true,
  weeks: [],
  bricks: bricksFor([
    CAP.production.color, CAP.production.color, CAP.marketing.color, CAP.qc.color,
    CAP.production.color, CAP.marketing.color, CAP.money.color,     CAP.production.color,
    CAP.marketing.color, CAP.money.color,      CAP.qc.color,        CAP.marketing.color,
    CAP.money.color,
  ]),
};

const LAC_24: TimelineSeason = {
  id: 'lac24',
  title: 'Lac season · 2024',
  dateRange: 'Oct 2024 — Mar 2025',
  archived: true,
  weeks: [],
  bricks: bricksFor([
    CAP.production.color, CAP.qc.color,        CAP.production.color, CAP.compliance.color,
    CAP.production.color, CAP.marketing.color, CAP.production.color, CAP.money.color,
    CAP.qc.color,         CAP.production.color, CAP.marketing.color,
  ]),
};

const LAC_23: TimelineSeason = {
  id: 'lac23',
  title: 'Lac season · 2023 (first)',
  dateRange: 'Oct 2023 — Mar 2024',
  archived: true,
  weeks: [],
  bricks: bricksFor([
    CAP.production.color, CAP.production.color, CAP.qc.color, CAP.production.color,
    CAP.compliance.color, CAP.production.color, CAP.marketing.color, CAP.production.color,
  ]),
};

// Lifetime money — ₹ earned per season, growing as the enterprise
// matures. Total drives the MUDRA loan ladder: Shishu repaid, Kishore
// active, partway toward Tarun.
const LIFETIME_FINANCE: LifetimeFinance = {
  perSeason: [
    { seasonId: 'lac23',    label: 'Lac ’23',  net: 22000 },
    { seasonId: 'lac24',    label: 'Lac ’24',  net: 38000 },
    { seasonId: 'wedding24', label: 'Wed ’24', net: 60000 },
    { seasonId: 'diwali25', label: 'Diwali ’25', net: 90000 },
  ],
  totalEarned: 210000,
};

const LIFETIME_ENTREPRENEUR: LifetimeAnalysis = {
  sessions: [
    { sessionIndex: 1, seasonId: 'lac23',     label: 'Lac ’23',    dominantCapabilityColor: CAP.production.color, dominantCapabilityLabel: 'Production', volume: 8 },
    { sessionIndex: 2, seasonId: 'lac24',     label: 'Lac ’24',    dominantCapabilityColor: CAP.production.color, dominantCapabilityLabel: 'Production', volume: 11 },
    { sessionIndex: 3, seasonId: 'wedding24', label: 'Wed ’24',    dominantCapabilityColor: CAP.marketing.color,  dominantCapabilityLabel: 'Marketing',  volume: 13, isRace: true },
    { sessionIndex: 4, seasonId: 'diwali25',  label: 'Diwali ’25', dominantCapabilityColor: CAP.money.color,      dominantCapabilityLabel: 'Money',      volume: 16, isRace: true },
  ],
  peers: [
    {
      id: 'vimla',
      initials: 'VM',
      name: 'Vimla',
      color: '#C46E49',
      role: 'SHG sister',
      firstSessionIndex: 1,
      sessionAppearances: [
        { sessionIndex: 1, count: 6 }, { sessionIndex: 2, count: 8 },
        { sessionIndex: 3, count: 9 }, { sessionIndex: 4, count: 11 },
      ],
    },
    {
      id: 'pradan',
      initials: 'RP',
      name: 'Ranjit (PRADAN)',
      color: '#7E6FC8',
      role: 'field officer',
      firstSessionIndex: 2,
      sessionAppearances: [
        { sessionIndex: 2, count: 2 }, { sessionIndex: 3, count: 2 }, { sessionIndex: 4, count: 3 },
      ],
    },
    {
      id: 'sunita',
      initials: 'SU',
      name: 'Sunita',
      color: '#5BA46F',
      role: 'SHG sister',
      firstSessionIndex: 2,
      sessionAppearances: [
        { sessionIndex: 2, count: 3 }, { sessionIndex: 3, count: 4 }, { sessionIndex: 4, count: 5 },
      ],
    },
  ],
  reflections: [
    { id: 'elr-s2', sessionIndex: 2, quote: 'Shishu loan repaid', capabilityColor: CAP.money.color },
    { id: 'elr-s4', sessionIndex: 4, quote: 'first ₹5000 week', capabilityColor: CAP.money.color },
  ],
  trophies: [
    { id: 'etr-s2', sessionIndex: 2, label: 'Shishu repaid', capabilityColor: CAP.money.color },
    { id: 'etr-s4', sessionIndex: 4, label: '₹5k week', capabilityColor: CAP.money.color },
  ],
  librarianPrompt: {
    eyebrow: 'Across your seasons · what your books noticed',
    body:
      'Three seasons in, your earnings have quadrupled and you’ve trained sisters every cycle. Shishu is repaid and Kishore is active. Worth a reflection on what the next loan tier would unlock?',
    primaryCta: { label: 'Start a reflection', intent: 'start-reflection' },
    secondaryCta: { label: 'Not now' },
  },
};

export const SAMPLE_DATASET_ENTREPRENEUR: TimelineDataset = {
  interest: { id: 'entrepreneur', label: 'Home enterprise' },
  user: { initials: 'SM', color: '#C99632' },
  focusStepId: 'e-w7-mon',
  currentSeasonId: 'diwali25',
  stepCounter: { current: 7, total: 11 },
  weekCounter: { current: 7, total: 11 },
  totalSeasons: 4,
  totalSteps: 48,
  sinceDate: "Oct '23",
  sinceTimestamp: '2023-10-01T00:00:00.000Z',
  lifetimeVisionStatement:
    'Build a lac-craft enterprise that trains every woman in the SHG and qualifies for a Tarun loan by 2027.',
  seasons: [DIWALI_25, WEDDING_24, LAC_24, LAC_23],
  capabilityFilters: [
    { id: 'all',        label: 'All' },
    { id: 'production', label: 'Production', icon: 'construct-outline',     color: CAP.production.color },
    { id: 'marketing',  label: 'Marketing',  icon: 'megaphone-outline',     color: CAP.marketing.color },
    { id: 'money',      label: 'Money',      icon: 'cash-outline',          color: CAP.money.color },
    { id: 'qc',         label: 'Quality',    icon: 'checkmark-done-outline', color: CAP.qc.color },
  ],
  lifetime: LIFETIME_ENTREPRENEUR,
  lifetimeFinance: LIFETIME_FINANCE,
};
