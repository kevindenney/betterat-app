/**
 * Step Loop iOS Register — Phase 0 shared chrome primitives.
 *
 * Per docs/redesign/ios-register/phase-0-shared-chrome.md. Gated behind
 * the `PRACTICE_STEP_LOOP_IOS_REGISTER` feature flag at consumer sites;
 * the primitives themselves are flag-agnostic.
 */

export { StatePill } from './StatePill';
export type { StatePillProps, StatePillStat, StatePillVariant } from './StatePill';

export { StepStrip } from './StepStrip';
export type { StepStripIcon, StepStripProps } from './StepStrip';

export { TopHeader } from './TopHeader';
export type { TopHeaderProps } from './TopHeader';

export { PhaseTabs } from './PhaseTabs';
export type { PhaseId, PhaseState, PhaseTabsProps } from './PhaseTabs';

export { StepCard } from './StepCard';
export type { StepCardProps } from './StepCard';

// v3 screen-designs Phase B — step cover identity deck (gated by
// STEP_IDENTITY_DECK_V3 at consumer sites; the primitives are flag-agnostic).
export { IdentityDeck } from './IdentityDeck';
export type { IdentityDeckProps, IdentityDeckStateVariant } from './IdentityDeck';

export { PeerReflectionQuote } from './PeerReflectionQuote';
export type { PeerReflectionQuoteProps } from './PeerReflectionQuote';
