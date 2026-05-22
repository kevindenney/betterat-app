/**
 * useStudioPayouts
 *
 * Data shape for Creator Studio · Payouts (Frame 6 — independent author).
 * Stubbed to demo-shaped data (Noor Khoury, Berlin) until real Stripe
 * Connect aggregations land. Institutional authors render a different
 * empty-state — see app/studio/payouts.tsx for that branch.
 *
 * TODO when wiring real data:
 *   - Pull next-payout / lifetime / subscribers from Stripe Connect
 *     balance + transfers APIs (or a materialised view on top)
 *   - Weekly earnings series from a 12-week aggregation by week_start
 *   - Earnings by blueprint from `blueprint_transactions` joined to blueprints
 *   - Recent transactions feed from `transactions` with viewer-scoped RLS
 *   - Bank account from Stripe Connect account details
 */

export interface PayoutWeek {
  weekStart: string;     // "Mar 4"
  amount: number;
}

export interface BlueprintEarning {
  id: string;
  title: string;
  subtitle: string;       // "€9 / month · 842 subscribers"
  renewalsLabel: string;  // "63 renewals" or "—"
  newCountLabel: string;  // "9 new"
  amount: number;
  currency: string;
  gradient: [string, string];
}

export interface PayoutTransaction {
  id: string;
  fromInitials: string;
  fromName: string;
  fromOrgChip: string | null;        // "JH student"
  blueprintLabel: string;            // "Drawing daily · subscribed"
  ageLabel: string;                  // "11m"
  amount: number;                    // negative for refund/cancellation
  currency: string;
  gradient: [string, string];
}

export interface StudioPayoutsData {
  loading: boolean;
  isIndependent: boolean;            // false → render the institutional banner
  currency: string;
  currencySymbol: string;
  scheduleLabel: string;             // "Payouts weekly on Wednesdays · 7-day rolling reserve"
  nextPayout: {
    amount: number;
    dateLabel: string;
    renewalsCount: number;
    firstTimeCount: number;
    deltaWeekPct: number | null;
  };
  lifetime: { amount: number; sinceLabel: string };
  activeSubscribers: { count: number; weeklyDelta: number };
  weeklySeries: PayoutWeek[];
  blueprintEarnings: BlueprintEarning[];
  recentTransactions: PayoutTransaction[];
  totalTransactionCount: number;
  bank: {
    flag: string;                    // "SE" — country code
    flagGradient: [string, string];  // brand-ish stripe colors
    typeLabel: string;               // "SEPA"
    accountMasked: string;           // "DE89 ··· 4521"
    bankName: string;                // "Sparkasse"
    connectLabel: string;            // "Stripe Connect"
  };
}

const DEMO_SERIES: PayoutWeek[] = [
  { weekStart: 'Mar 4', amount: 690 },
  { weekStart: 'Mar 11', amount: 800 },
  { weekStart: 'Mar 18', amount: 920 },
  { weekStart: 'Mar 25', amount: 640 },
  { weekStart: 'Apr 1', amount: 1020 },
  { weekStart: 'Apr 8', amount: 1140 },
  { weekStart: 'Apr 15', amount: 1060 },
  { weekStart: 'Apr 22', amount: 940 },
  { weekStart: 'Apr 29', amount: 1220 },
  { weekStart: 'May 6', amount: 1300 },
  { weekStart: 'May 13', amount: 1340 },
  { weekStart: 'May 20', amount: 1480 },
];

const DEMO_BLUEPRINTS: BlueprintEarning[] = [
  {
    id: 'drawing-daily',
    title: 'Drawing daily · 30 days of line',
    subtitle: '€9 / month · 842 subscribers',
    renewalsLabel: '63 renewals',
    newCountLabel: '9 new',
    amount: 1422,
    currency: 'EUR',
    gradient: ['#B8855A', '#5C3F22'],
  },
  {
    id: 'composition',
    title: 'Composition for non-designers',
    subtitle: '€18 once · 312 owners',
    renewalsLabel: '—',
    newCountLabel: '3 new',
    amount: 48,
    currency: 'EUR',
    gradient: ['#7C6E5A', '#3D352B'],
  },
  {
    id: 'sketchbook',
    title: 'Sketchbook habit · monthly',
    subtitle: '€6 / month · 130 subscribers',
    renewalsLabel: '24 renewals',
    newCountLabel: '2 new',
    amount: 678,
    currency: 'EUR',
    gradient: ['#5A8DB8', '#28406B'],
  },
];

const DEMO_TRANSACTIONS: PayoutTransaction[] = [
  {
    id: 't-shaw',
    fromInitials: 'ES',
    fromName: 'E. Shaw',
    fromOrgChip: 'JH student',
    blueprintLabel: 'Drawing daily · subscribed',
    ageLabel: '11m',
    amount: 9,
    currency: 'EUR',
    gradient: ['#7A6A8E', '#4E6A85'],
  },
  {
    id: 't-lina',
    fromInitials: 'LC',
    fromName: 'Lina C.',
    fromOrgChip: null,
    blueprintLabel: 'Composition · purchased',
    ageLabel: '38m',
    amount: 18,
    currency: 'EUR',
    gradient: ['#B85A66', '#7A6A8E'],
  },
  {
    id: 't-jw',
    fromInitials: 'JW',
    fromName: 'J. Whitcombe',
    fromOrgChip: null,
    blueprintLabel: 'Drawing daily · renewed',
    ageLabel: '1h',
    amount: 9,
    currency: 'EUR',
    gradient: ['#6E8B5A', '#5A8B8B'],
  },
  {
    id: 't-okoye',
    fromInitials: 'MO',
    fromName: 'M. Okoye',
    fromOrgChip: null,
    blueprintLabel: 'Drawing daily · subscribed',
    ageLabel: '2h',
    amount: 9,
    currency: 'EUR',
    gradient: ['#5A8DB8', '#4E6A85'],
  },
  {
    id: 't-hpark',
    fromInitials: 'HP',
    fromName: 'H. Park',
    fromOrgChip: null,
    blueprintLabel: 'Sketchbook habit · cancelled',
    ageLabel: '3h',
    amount: -6,
    currency: 'EUR',
    gradient: ['#8B6E5A', '#B8855A'],
  },
  {
    id: 't-avila',
    fromInitials: 'RA',
    fromName: 'R. Avila',
    fromOrgChip: null,
    blueprintLabel: 'Drawing daily · renewed',
    ageLabel: '4h',
    amount: 9,
    currency: 'EUR',
    gradient: ['#8A5AB8', '#5A8B8B'],
  },
];

export function useStudioPayouts(): StudioPayoutsData {
  return {
    loading: false,
    isIndependent: true,
    currency: 'EUR',
    currencySymbol: '€',
    scheduleLabel: 'Payouts weekly on Wednesdays · 7-day rolling reserve',
    nextPayout: {
      amount: 2148.4,
      dateLabel: 'Wed May 27',
      renewalsCount: 87,
      firstTimeCount: 14,
      deltaWeekPct: 18,
    },
    lifetime: { amount: 38420, sinceLabel: 'Aug 2024' },
    activeSubscribers: { count: 1284, weeklyDelta: 73 },
    weeklySeries: DEMO_SERIES,
    blueprintEarnings: DEMO_BLUEPRINTS,
    recentTransactions: DEMO_TRANSACTIONS,
    totalTransactionCount: 114,
    bank: {
      flag: 'SE',
      flagGradient: ['#FFD230', '#FF6C00'],
      typeLabel: 'SEPA',
      accountMasked: 'DE89 ··· 4521',
      bankName: 'Sparkasse',
      connectLabel: 'Stripe Connect',
    },
  };
}
