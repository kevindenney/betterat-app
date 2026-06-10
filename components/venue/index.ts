/**
 * Venue Components Barrel Export
 * All venue tab components for easy importing
 */

// ===========================================================================
// NEW: Apple/Tufte-Inspired Venue Components
// ===========================================================================

// Community area creation
export { CommunityAreaBadge } from './CommunityAreaBadge';

// Tufte-style sparklines
export {
  ConditionsSparkline,
  WindSparkline,
  TideSparkline,
  CurrentSparkline,
  ConditionsBar,
} from './ConditionsSparkline';

// Unified knowledge feed
export { UnifiedKnowledgeFeed } from './UnifiedKnowledgeFeed';

// ===========================================================================
// EXISTING: Legacy Venue Components
// ===========================================================================

// Core Components
export { VenueMapView } from './VenueMapView';
export { VenueDetailsSheet } from './VenueDetailsSheet';
export { VenueHeroCard } from './VenueHeroCard';
export { QuickAccessPanel } from './QuickAccessPanel';
export { MapControls, type MapLayers } from './MapControls';
export { TravelResourceChips } from './TravelResourceChips';

// Phase 1: Live Conditions & Races
export { LiveConditionsCard } from './LiveConditionsCard';
export { UpcomingRacesSection } from './UpcomingRacesSection';

// Phase 2: Tide, Wind & Racing Areas
export { TideCurrentPanel } from './TideCurrentPanel';
export { WindPatternCard } from './WindPatternCard';
export { RacingAreaOverlay, RacingAreaLegend, RacingAreaInfoCard } from './RacingAreaOverlay';

// Phase 3: Fleet Community & Intel
export { FleetCommunityCard } from './FleetCommunityCard';
export { RacingIntelSection } from './RacingIntelSection';
export { VenueComparisonModal, CompareVenuesButton } from './VenueComparisonModal';

// ===========================================================================
// iOS HIG Components (Sprint 3)
// ===========================================================================

// Apple Maps-style venue pill
export { IOSVenuePill } from './IOSVenuePill';

// Widget-style condition cards
export { IOSConditionsWidgets } from './IOSConditionsWidgets';

// iOS-style map controls
export { IOSMapControls, type MapLayers as IOSMapLayers } from './IOSMapControls';

// iOS upcoming races list
export { IOSUpcomingRacesList } from './IOSUpcomingRacesList';

// Tufte live conditions (for compatibility)
export { TufteLiveConditions } from './TufteLiveConditions';

