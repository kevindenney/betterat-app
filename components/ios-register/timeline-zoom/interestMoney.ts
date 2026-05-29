/**
 * D7 — money lane config for the timeline-zoom canvas.
 *
 * For some personas money *is* the practice. A Jharkhand lac-craft
 * entrepreneur reads her season as ₹ in / ₹ out / working capital and
 * her lifetime as loan-tier progression (MUDRA Shishu → Kishore →
 * Tarun) — that's the dignity surface, not an afterthought lane. A
 * sailor or a nurse doesn't want money on their practice timeline at
 * all. So the money lane is opt-in per interest.
 *
 * This module is the per-interest registry the L3/L4 chrome reads
 * from: which interests show money, how to render the currency, and
 * how a lifetime ₹ total maps to a loan-tier ladder. It carries no
 * data — the finance figures themselves live on the season
 * (`TimelineSeason.finance`) / dataset (`lifetimeFinance`), populated
 * by the adapter (sample data today; real `step_finance` rows once the
 * D7 schema half lands).
 *
 * Keyed off the resolved vocab id (`entrepreneur`, `sailing`,
 * `nursing`, …) so it stays in lockstep with interestVocab /
 * interestAnchors rather than inventing a parallel matcher.
 */

export interface MoneyConfig {
  /** Currency symbol rendered before the amount ("₹", "$"). */
  symbol: string;
  /**
   * Grouping style for the integer part. Indian grouping lakhs/crores
   * (1,00,000) reads as native to an Indian entrepreneur; western
   * grouping (100,000) is the fallback for everyone else.
   */
  grouping: 'indian' | 'western';
  /**
   * Loan-tier ladder, ascending by the lifetime ₹-earned threshold at
   * which a tier is considered "reached". Drives the L4 loan-tier
   * progression readout. Empty when the persona has no financing arc.
   */
  loanLadder: LoanTier[];
}

export interface LoanTier {
  /** Short ladder label ("Shishu", "Kishore", "Tarun"). */
  label: string;
  /** Lifetime ₹-earned (major units) at/above which this tier is reached. */
  reachedAt: number;
  /** Optional one-line context ("MUDRA · up to ₹50k"). */
  detail?: string;
}

/**
 * MUDRA loan ladder — the three Pradhan Mantri MUDRA Yojana tiers an
 * SHG micro-entrepreneur graduates through. Thresholds are demo-tuned
 * to the ₹ scale the entrepreneur sample earns per season, not the
 * real loan ceilings (those gate eligibility, not lifetime turnover).
 */
const MUDRA_LADDER: LoanTier[] = [
  { label: 'Shishu', reachedAt: 0, detail: 'MUDRA · up to ₹50k' },
  { label: 'Kishore', reachedAt: 75_000, detail: 'MUDRA · ₹50k–₹5L' },
  { label: 'Tarun', reachedAt: 300_000, detail: 'MUDRA · ₹5L–₹10L' },
];

const ENTREPRENEUR_MONEY: MoneyConfig = {
  symbol: '₹',
  grouping: 'indian',
  loanLadder: MUDRA_LADDER,
};

/** Vocab id → money config. Absence = money lane off for that persona. */
const MONEY_BY_VOCAB_ID: Record<string, MoneyConfig> = {
  entrepreneur: ENTREPRENEUR_MONEY,
};

/** True when the persona's practice surface should show a money lane. */
export function hasMoneyLane(vocabId: string): boolean {
  return vocabId in MONEY_BY_VOCAB_ID;
}

/** Money config for a persona, or null when the lane is off. */
export function resolveMoneyConfig(vocabId: string): MoneyConfig | null {
  return MONEY_BY_VOCAB_ID[vocabId] ?? null;
}

/**
 * Group an integer string per the config's convention. Indian grouping
 * puts the first comma after the last three digits, then every two
 * digits ("12,34,567"); western groups every three ("1,234,567").
 */
function groupInteger(digits: string, grouping: MoneyConfig['grouping']): string {
  if (grouping === 'western') {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  // Indian: last 3 digits, then groups of 2.
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail;
}

/**
 * Format a major-unit amount for display ("₹12,500", "-₹3,200",
 * "₹1.2L" when compact). Negative amounts keep the sign before the
 * symbol so a money lane's out-flow reads "-₹3,200".
 *
 * `compact` collapses large numbers into lakh/crore (Indian) or k/M
 * (western) suffixes for tight chips; full form is used in the readout.
 */
export function formatMoney(
  amount: number,
  config: MoneyConfig,
  opts: { compact?: boolean } = {},
): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(Math.round(amount));

  if (opts.compact) {
    if (config.grouping === 'indian') {
      if (abs >= 10_000_000) return `${sign}${config.symbol}${trimDecimal(abs / 10_000_000)}Cr`;
      if (abs >= 100_000) return `${sign}${config.symbol}${trimDecimal(abs / 100_000)}L`;
      if (abs >= 1_000) return `${sign}${config.symbol}${trimDecimal(abs / 1_000)}k`;
    } else {
      if (abs >= 1_000_000) return `${sign}${config.symbol}${trimDecimal(abs / 1_000_000)}M`;
      if (abs >= 1_000) return `${sign}${config.symbol}${trimDecimal(abs / 1_000)}k`;
    }
  }

  return `${sign}${config.symbol}${groupInteger(String(abs), config.grouping)}`;
}

/** One decimal place, but drop a trailing ".0" so "1.0L" reads "1L". */
function trimDecimal(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export interface LoanTierProgress {
  /** The tier the lifetime total currently sits in. */
  current: LoanTier;
  /** The next tier to reach, or null when already at the top. */
  next: LoanTier | null;
  /** 0–1 progress from the current tier's floor toward the next. 1 at top. */
  fraction: number;
}

/**
 * Map a lifetime ₹-earned total onto the persona's loan ladder. Returns
 * null when the persona has no ladder. `fraction` drives a thin
 * progress bar in the L4 readout ("Shishu repaid, 60% toward Kishore").
 */
export function resolveLoanTier(
  totalEarned: number,
  config: MoneyConfig,
): LoanTierProgress | null {
  const ladder = config.loanLadder;
  if (ladder.length === 0) return null;

  let currentIndex = 0;
  for (let i = 0; i < ladder.length; i++) {
    if (totalEarned >= ladder[i]!.reachedAt) currentIndex = i;
  }
  const current = ladder[currentIndex]!;
  const next = ladder[currentIndex + 1] ?? null;
  if (!next) return { current, next: null, fraction: 1 };

  const span = next.reachedAt - current.reachedAt;
  const into = totalEarned - current.reachedAt;
  const fraction = span <= 0 ? 0 : Math.max(0, Math.min(1, into / span));
  return { current, next, fraction };
}
