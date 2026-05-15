/**
 * iOS Register component kit — the visual vocabulary handed off by Claude
 * Design (2026-05). Pure presentational components; pair with IOS_REGISTER
 * tokens from @/lib/design-tokens-ios.
 *
 * See docs/redesign/IOS_MIGRATION_PLAN.md for the surface map and the
 * 12-surface handoff status.
 */

export { SourceGlyph, type SourceGlyphVariant } from './SourceGlyph';
export { WorkingOnPill, type WorkingOnPillKind } from './WorkingOnPill';
export { QuoteCard } from './QuoteCard';
export { BeatCard, BeatBody } from './BeatCard';
export { PermissionRuleCallout } from './PermissionRuleCallout';
export { CoralAIPromptCard } from './CoralAIPromptCard';
export { CrewList, type CrewMember } from './CrewList';
export { ForecastTileGroup, type ForecastTile } from './ForecastTileGroup';
export { ToolbarComposer, type ComposerTool } from './ToolbarComposer';
export { CaptureCard, type CaptureKind } from './CaptureCard';
export { AtmosphericBackground } from './AtmosphericBackground';
export { LogEntry, type LogEntryKind, type LogEntryBeat } from './LogEntry';
export { HeroMicComposer } from './HeroMicComposer';
export { ConceptCard, type ConceptState } from './ConceptCard';
export { ReflectionCard } from './ReflectionCard';
export {
  StepCard,
  type StepCardStatus,
  type StepCardCoverTint,
} from './StepCard';
export {
  RaceCardsScreen,
  type RaceCardItem,
  type ArcSummaryRow,
} from './RaceCardsScreen';
export {
  RaceLogScreen,
  type RaceLogEntryItem,
  type RaceLogSeason,
  type RaceLogFilterChip,
  type RaceLogConceptDot,
  type ReflectSubTab,
} from './RaceLogScreen';
export { LoadingNarration } from './LoadingNarration';
export {
  TrophyScreen,
  TROPHY_BG,
  type TrophyVariant,
  type TrophyContent,
  type TrophySeriesContext,
} from './TrophyScreen';
