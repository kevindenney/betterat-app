export { useSailorDashboardData } from './useSailorDashboardData';
export { useCoachDashboardData } from './useCoachDashboardData';
export { useUserFleets, useFleetOverview, useFleetActivity } from './useFleetData';
export { useFleetSuggestions, useTrendingFleets } from './useFleetDiscovery';
export { useFleetResources } from './useFleetResources';
export { useFleetSharedContent } from './useFleetSharedContent';
export { useRaces } from './useRaces';
export { useRaceTuningRecommendation } from './useRaceTuningRecommendation';
export { useEnrichedRaces } from './useEnrichedRaces';
export { useTidalIntel } from './useTidalIntel';
export { useUnderwaterAnalysis } from './useUnderwaterAnalysis';
export { useTacticalZones, useTacticalZoneLayerConfig } from './useTacticalZones';
export { useClaudeDraft } from './ai/useClaudeDraft';
export { useAIChatSession } from './ai/useAIChatSession';
export { useRaceCommsDraft } from './ai/useRaceCommsDraft';

// Practice Hooks
export { usePracticeSessions } from './usePracticeSessions';
export { usePracticeSession } from './usePracticeSession';
export { usePracticeChecklist } from './usePracticeChecklist';
export type { PracticeChecklistItemWithState, CarryoverItem } from './usePracticeChecklist';
export { useDrillLibrary } from './useDrillLibrary';
export {
  usePracticeSuggestions,
  useSuggestionForSkillArea,
  useRegenerateSuggestions,
} from './usePracticeSuggestions';

// Venue Racing Enhancement Hooks
export { useVenueLiveWeather } from './useVenueLiveWeather';
export type { LiveWeatherData, UseVenueLiveWeatherResult } from './useVenueLiveWeather';

// Race Weather Forecast for Sparklines
export { useRaceWeatherForecast, extractForecastForSparklines } from './useRaceWeatherForecast';
export type {
  RaceWeatherForecastData,
  UseRaceWeatherForecastResult,
  RaceWindowData,
  HourlyDataPoint,
  TideTimeData,
} from './useRaceWeatherForecast';

export { useVenueRaces } from './useVenueRaces';
export type { VenueRace, UseVenueRacesResult } from './useVenueRaces';

export { useVenueRacingAreas } from './useVenueRacingAreas';
export type { VenueRacingArea, RacingAreaGeometry, UseVenueRacingAreasResult } from './useVenueRacingAreas';

export { useVenueFleetInfo, getFrequencyLabel } from './useVenueFleetInfo';
export type { VenueFleet, UseVenueFleetInfoResult } from './useVenueFleetInfo';

export type {
  SailorDashboardData,
} from './useSailorDashboardData';

export type {
  CoachDashboardData,
} from './useCoachDashboardData';

// Equipment Flow for Cross-Race Tracking
export { useEquipmentFlow } from './useEquipmentFlow';
export type { EquipmentIssue } from './useEquipmentFlow';

// Race-Type-Specific Checklists
export { useRaceChecklist } from './useRaceChecklist';
export type { ChecklistItemWithState } from './useRaceChecklist';

// Forecast Check (Weather Snapshots & AI Analysis)
export { useForecastCheck } from './useForecastCheck';
export type { UseForecastCheckOptions, UseForecastCheckReturn } from './useForecastCheck';

// Team Racing Collaboration
export { useTeamRaceEntry } from './useTeamRaceEntry';
export { useTeamChecklist } from './useTeamChecklist';
export type { TeamChecklistItemWithState } from './useTeamChecklist';

// Content Module Preferences (Expanded Race Card)
export { useContentModules } from './useContentModules';
export { useContentPreferences } from './useContentPreferences';
export type { UseContentModulesReturn, UseContentPreferencesReturn } from '@/types/raceCardContent';

// Sailor Discovery - Race Content Sharing
export { useRegattaContent } from './useRegattaContent';
export type { ContentVisibility, TuningSettings, UseRegattaContentReturn } from './useRegattaContent';

// Instagram-style Discovery Feed
export { useDiscoveryFeed } from './useDiscoveryFeed';
export type { FeedItem, FeedItemType, FeedMode, UseDiscoveryFeedResult } from './useDiscoveryFeed';

// Sailor Race Journey (view another sailor's race journey)
export { usePublicSailorRaceJourney } from './usePublicSailorRaceJourney';
export type {
  SailorProfile,
  RaceData,
  RaceResult,
  ChecklistSummary,
  SailorRaceJourneyData,
  UsePublicSailorRaceJourneyResult,
} from './usePublicSailorRaceJourney';

// Past Tuning Settings - AI Suggestions
export { usePastTuningSettings } from './usePastTuningSettings';
export type { UsePastTuningSettingsParams, UsePastTuningSettingsReturn } from './usePastTuningSettings';

// Pre-Race Team Sharing
export { useTeamSharing } from './useTeamSharing';
export type { UseTeamSharingResult, UseTeamSharingParams, RaceShare } from './useTeamSharing';

// Structured Debrief Phase Ratings (legacy)
export { usePhaseRatings, PHASE_KEYS } from './usePhaseRatings';
export type { PhaseRatings, PhaseRating, PhaseKey, UsePhaseRatingsReturn } from './usePhaseRatings';

// Structured Debrief Interview (new guided interview)
export { useDebriefInterview } from './useDebriefInterview';
export type {
  DebriefResponses,
  DebriefResponseValue,
  UseDebriefInterviewParams,
  UseDebriefInterviewReturn,
} from './useDebriefInterview';

// Debrief Sail Context (sail options for debrief questions)
export { useDebriefSailContext, groupSailsByCategory } from './useDebriefSailContext';
export type { SailOption, DebriefSailContext } from './useDebriefSailContext';

// User Settings (Quick Tips, Learning Links toggle)
export { useUserSettings } from './useUserSettings';
export type { UserSettings, UseUserSettingsReturn } from './useUserSettings';

// Sail Products Catalog (for Add Sail modal)
export {
  useSailProducts,
  formatWindRange,
  getWeightCategoryLabel,
  COMMON_SAILMAKERS,
} from './useSailProducts';
export type { SailProduct, SailmakerGroup, UseSailProductsReturn } from './useSailProducts';

// Equipment Templates Catalog (for Add Equipment modal)
export {
  useEquipmentTemplates,
  formatLifespan,
  formatMaintenanceInterval,
  CATEGORY_GROUPS,
  COMMON_MANUFACTURERS,
} from './useEquipmentTemplates';
export type { CategoryGroup, UseEquipmentTemplatesReturn } from './useEquipmentTemplates';

// Interest Event Config (multi-interest event card system)
export { useInterestEventConfig } from './useInterestEventConfig';

// Activity Catalog (templates from orgs & coaches)
export { useActivityCatalog } from './useActivityCatalog';

// Cross-Interest AI Suggestions
export { useAISuggestions } from './useAISuggestions';

// Competency Tracking & Sign-Off Chain
export { useCompetencyProgress } from './useCompetencyProgress';
export { useCompetencyDetail } from './useCompetencyDetail';
