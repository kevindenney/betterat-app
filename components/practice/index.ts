/**
 * Practice Components
 *
 * Components for the practice session feature.
 */

// Card components
export { PracticeCard } from './PracticeCard';
export type { PracticeCardProps } from './PracticeCard';

// Detail cards
export {
  FocusAreaDetailCard,
  DrillDetailCard,
  CrewDetailCard,
  NotesDetailCard,
  createDetailCardsForPractice,
  renderPracticeDetailCard,
} from './detail-cards';
export type {
  PracticeDetailCardType,
  PracticeDetailCardData,
  RenderPracticeDetailCardOptions,
} from './detail-cards';

// Creation components (legacy)
export { AIRecommendationCard, LogPracticeForm } from './creation';
export type { LogPracticeData } from './creation';

// Tufte-redesigned components
export { TufteSuggestionRow } from './TufteSuggestionRow';
export { TuftePracticeLogForm } from './TuftePracticeLogForm';
export type { LogPracticeData as TufteLogPracticeData } from './TuftePracticeLogForm';
export { TuftePlanStep } from './TuftePlanStep';
export { TufteReviewStep } from './TufteReviewStep';

export { AddStepFab } from './AddStepFab';
export type { AddStepFabProps } from './AddStepFab';
export { AddStepActionSheet } from './AddStepActionSheet';
export type { AddStepActionSheetProps } from './AddStepActionSheet';

// Phase 8 — Fleet view
export { FleetView } from './FleetView';
export type { FleetViewProps, FleetViewTimeMarker } from './FleetView';
export { FleetCaptureCard } from './FleetCaptureCard';
export type { FleetCaptureCardProps } from './FleetCaptureCard';
