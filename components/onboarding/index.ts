/**
 * Onboarding Components Barrel Export
 * Unified exports for the new onboarding system
 */

// Onboarding components
export { OnboardingProgressBar } from './OnboardingProgressBar';
export { OnboardingSection } from './OnboardingSection';
export { FreeformInputField } from './FreeformInputField';
export { ExtractedDataPreview, type ExtractedEntity } from './ExtractedDataPreview';
export { QuickPasteOptions } from './QuickPasteOptions';

// Legacy exports (for backward compatibility during migration)
export { OnboardingProgress } from './OnboardingProgress';
export { OnboardingCompletion } from './OnboardingCompletion';
export { OnboardingDataTally } from './OnboardingDataTally';

// Sailor onboarding components
export { SailorSubscriptionChoice } from './SailorSubscriptionChoice';

// Interest selection (first-time onboarding)
export { InterestSelection, type InterestSelectionProps } from './InterestSelection';

// Feature Tour components
export { ContextualHint } from './ContextualHint';
export { TourStep, TourStepIndicator } from './TourStep';
export { TourOverlay } from './FeatureTour';
export { WelcomeCard } from './WelcomeCard';
export { TourBackdrop } from './TourBackdrop';
export { TabSweepCard } from './TabSweepCard';
export { TourPricingCard } from './TourPricingCard';

// Phase 10 — HKDW redeem flow
export { RedeemLanding } from './RedeemLanding';
export type { RedeemLandingProps, RedeemLandingAuthor, RedeemLandingBlueprint } from './RedeemLanding';
export { SmartAppBanner } from './SmartAppBanner';
export type { SmartAppBannerProps } from './SmartAppBanner';
export { InstallSheet } from './InstallSheet';
export type { InstallSheetProps } from './InstallSheet';
export { WelcomeToast } from './WelcomeToast';
export type { WelcomeToastProps } from './WelcomeToast';
export { HkdwStepCard } from './HkdwStepCard';
export type { HkdwStepCardProps } from './HkdwStepCard';
export { BlueprintIndex } from './BlueprintIndex';
export type {
  BlueprintIndexProps,
  BlueprintIndexAuthor,
  BlueprintIndexStep,
} from './BlueprintIndex';
export { FleetPlansView } from './FleetPlansView';
export type {
  FleetPlansViewProps,
  FleetPeer,
  FleetPeerStatus,
} from './FleetPlansView';
export { StepDiscussionView } from './StepDiscussionView';
export type {
  StepDiscussionViewProps,
  StepDiscussionNote,
  StepDiscussionReaction,
} from './StepDiscussionView';
