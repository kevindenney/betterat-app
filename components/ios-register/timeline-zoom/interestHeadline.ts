/**
 * D11 — headline metric (per-persona North Star) for the timeline-zoom
 * canvas.
 *
 * Every persona opens the practice surface to answer one question, and
 * it isn't "what capabilities did I work on?" (that's the capability
 * mix). The sailor asks "am I winning?", the nurse "am I on track to
 * graduate?", the entrepreneur "am I earning?", the golfer "am I
 * scoring lower?". D11 gives each persona's success currency the same
 * first-class billing the entrepreneur already got from the D7 money
 * lane, and demotes the capability mix to the *why behind the number*.
 *
 * This module is the per-interest registry the L3/L4 chrome reads from:
 * which interests show a headline, the persona-native eyebrow, and how
 * to compute the figure for the season (L3) and lifetime (L4) scopes.
 *
 * Chrome-first, mirroring `interestMoney.ts`:
 *   - The entrepreneur's figure is computed live from the already-real
 *     D7 finance on the season / dataset — no new data.
 *   - Other personas' figures are carried as a pass-through
 *     `TimelineSeason.headline` / `TimelineDataset.lifetimeHeadline`
 *     value, authored inline in the sample personas today and populated
 *     by the adapter from finishes / attestations / scores in a
 *     follow-up. Real accounts leave those undefined → resolver returns
 *     null → the slot stays hidden, identical to pre-D11.
 *
 * Keyed off the resolved vocab id (`sailing`, `nursing`, `entrepreneur`,
 * `golf`) so it stays in lockstep with interestVocab / interestMoney
 * rather than inventing a parallel matcher.
 */

import type { TimelineSeason, TimelineDataset } from './types';
import { resolveMoneyConfig, formatMoney, resolveLoanTier } from './interestMoney';

export interface HeadlineMetricValue {
  /** Primary figure, pre-formatted: "2nd of 12", "32%", "₹18,400", "14.2". */
  value: string;
  /** One-line context under the figure: "best finish this series". */
  caption: string;
  /** Optional trend vs the prior comparable window. */
  delta?: { direction: 'up' | 'down' | 'flat'; text: string };
  /** Drives tint: positive (green), neutral (ink), caution (amber). */
  tone?: 'positive' | 'neutral' | 'caution';
}

export interface HeadlineMetricConfig {
  /** Eyebrow, persona-native: "FORM" / "PROGRAM" / "EARNINGS" / "HANDICAP". */
  label: string;
  /** Season scope (L3). null → no headline at L3 for this season. */
  resolveSeason: (season: TimelineSeason) => HeadlineMetricValue | null;
  /** Lifetime scope (L4). null → no headline at L4. */
  resolveLifetime: (dataset: TimelineDataset) => HeadlineMetricValue | null;
}

/**
 * Entrepreneur EARNINGS. Two data sources, in priority order:
 *   1. Sample personas carry full D7 finance (in/out per week) on the
 *      season / dataset → headline is the single net figure + loan tier,
 *      with the money lane below as the weekly breakdown (no
 *      double-counting).
 *   2. Real accounts have no synthesised finance — the adapter authors a
 *      turnover headline straight from the `business_outcomes` table onto
 *      `season.headline` / `dataset.lifetimeHeadline`. We pass that
 *      through. (Turnover, not net: the table has revenue only, no cost.)
 * Either way the slot stays hidden when neither source exists.
 */
const ENTREPRENEUR_HEADLINE: HeadlineMetricConfig = {
  label: 'EARNINGS',
  resolveSeason: (season) => {
    const finance = season.finance;
    if (!finance || finance.weekly.length === 0) return season.headline ?? null;
    const config = resolveMoneyConfig('entrepreneur');
    if (!config) return season.headline ?? null;
    const net = finance.weekly.reduce((sum, w) => sum + (w.in - w.out), 0);
    return {
      value: `${formatMoney(net, config)} net`,
      caption: `${formatMoney(finance.workingCapital, config)} working capital`,
      tone: net >= 0 ? 'positive' : 'caution',
    };
  },
  resolveLifetime: (dataset) => {
    const finance = dataset.lifetimeFinance;
    if (!finance) return dataset.lifetimeHeadline ?? null;
    const config = resolveMoneyConfig('entrepreneur');
    if (!config) return dataset.lifetimeHeadline ?? null;
    const tier = resolveLoanTier(finance.totalEarned, config);
    const caption = tier
      ? tier.next
        ? `${tier.current.label} active · ${Math.round(tier.fraction * 100)}% to ${tier.next.label}`
        : `${tier.current.label} — top tier reached`
      : 'lifetime earnings';
    return {
      value: formatMoney(finance.totalEarned, config),
      caption,
      tone: 'positive',
    };
  },
};

/**
 * Pass-through config for personas whose figures are authored as data
 * (finishes, attestations, scores) rather than computed from another
 * lane. The resolver just surfaces the `headline` / `lifetimeHeadline`
 * value the adapter (or a sample persona) put on the season / dataset,
 * or null when none exists — so real accounts with no data show no slot.
 */
function passThroughConfig(label: string): HeadlineMetricConfig {
  return {
    label,
    resolveSeason: (season) => season.headline ?? null,
    resolveLifetime: (dataset) => dataset.lifetimeHeadline ?? null,
  };
}

/** Vocab id → headline config. Absence = no headline slot for that persona. */
const HEADLINE_BY_VOCAB_ID: Record<string, HeadlineMetricConfig> = {
  entrepreneur: ENTREPRENEUR_HEADLINE,
  sailing: passThroughConfig('FORM'),
  nursing: passThroughConfig('PROGRAM'),
  golf: passThroughConfig('HANDICAP'),
};

/** True when the persona's practice surface should show a headline slot. */
export function hasHeadlineMetric(vocabId: string): boolean {
  return vocabId in HEADLINE_BY_VOCAB_ID;
}

/** Headline config for a persona, or null when the slot is off. */
export function resolveHeadlineMetric(vocabId: string): HeadlineMetricConfig | null {
  return HEADLINE_BY_VOCAB_ID[vocabId] ?? null;
}
