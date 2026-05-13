/**
 * Detail Cards for Race Timeline
 * Compact cards designed for the vertical scroll detail zone
 *
 * Export components and helpers for the DetailCardPager integration.
 */

import React, { ReactElement } from 'react';
import type { DetailCardType } from '@/constants/navigationAnimations';
import type { DetailCardData } from '@/components/races/navigation/DetailCardPager';
import { detectRaceType } from '@/lib/races/raceDataUtils';

// Imports for render helper - Upcoming race cards
import { ConditionsDetailCard } from './ConditionsDetailCard';
import { CourseDetailCard } from './CourseDetailCard';
import { FleetDetailCard } from './FleetDetailCard';
import { RegulatoryDetailCard } from './RegulatoryDetailCard';
import { StrategyDetailCard } from './StrategyDetailCard';
import { RigDetailCard } from './RigDetailCard';

// Imports for render helper - Completed race cards
import { ResultsDetailCard } from './ResultsDetailCard';
import { AnalysisDetailCard } from './AnalysisDetailCard';
import { FleetInsightsDetailCard } from './FleetInsightsDetailCard';
import { LearningDetailCard } from './LearningDetailCard';

// Component re-exports - Upcoming race cards
export { ConditionsDetailCard } from './ConditionsDetailCard';
export { CourseDetailCard } from './CourseDetailCard';
export { FleetDetailCard } from './FleetDetailCard';
export { RegulatoryDetailCard } from './RegulatoryDetailCard';
export { StrategyDetailCard } from './StrategyDetailCard';
export { RigDetailCard } from './RigDetailCard';

// Component re-exports - Completed race cards
export { ResultsDetailCard } from './ResultsDetailCard';
export { AnalysisDetailCard } from './AnalysisDetailCard';
export { FleetInsightsDetailCard } from './FleetInsightsDetailCard';
export { LearningDetailCard } from './LearningDetailCard';

/**
 * Race result data for completed races
 */
export interface RaceResultData {
  position: number;
  points: number;
  fleetSize: number;
  status?: 'finished' | 'dnf' | 'dns' | 'dsq' | 'ocs' | 'ret';
  seriesPosition?: number;
  totalRaces?: number;
  averagePosition?: number; // For trend calculation
}

/**
 * Race data interface for detail card generation
 */
export interface RaceDataForDetailCards {
  id: string;
  name?: string;
  wind?: {
    direction: string;
    speedMin: number;
    speedMax: number;
  } | null;
  tide?: {
    state: string;
    height?: number;
    direction?: string;
  } | null;
  waves?: {
    height: number;
    period?: number;
  } | null;
  courseName?: string;
  courseType?: string;
  marks?: any[];
  vhfChannel?: string;
  fleetName?: string;
  competitors?: any[];
  rigSettings?: any;
  strategy?: any;

  // Race type fields
  race_type?: 'fleet' | 'distance' | 'match' | 'team';
  total_distance_nm?: number;
  time_limit_hours?: number;
  route_waypoints?: any[];
  number_of_legs?: number;

  // Boat class for rig tuning recommendations
  classId?: string | null;
  className?: string | null;
  boatClass?: string | null;

  // Race status fields
  status?: 'upcoming' | 'completed' | 'in_progress';
  endTime?: string;

  // Result data (for completed races)
  result?: RaceResultData;

  // Analysis data (for completed races)
  hasDebrief?: boolean;
  analysisId?: string;
  analysisSummary?: string;
  analysisInsights?: string[];
  analysisConfidence?: number;

  // Learning data (for completed races)
  keyLearning?: string;
  focusNextRace?: string;

  // Venue and date for forecast fetching (Tufte sparklines)
  venue?: any; // SailingVenue from @/types/venue
  date?: string | null;
  // Race start time for race-window calculations (ISO string with time)
  start_time?: string | null;
}

/**
 * Extended detail card data with race-specific props
 */
export interface RaceDetailCardData extends DetailCardData {
  raceId: string;
  raceData?: RaceDataForDetailCards;
}

/**
 * Check if a race is completed
 */
function isRaceCompleted(raceData: RaceDataForDetailCards): boolean {
  return raceData.status === 'completed' || !!raceData.endTime;
}

/**
 * Create detail cards for completed races (post-race reflection)
 */
function createCompletedRaceCards(raceData: RaceDataForDetailCards): RaceDetailCardData[] {
  return [
    {
      type: 'results' as DetailCardType,
      id: `${raceData.id}-results`,
      title: 'Results',
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'analysis' as DetailCardType,
      id: `${raceData.id}-analysis`,
      title: 'Analysis',
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'fleet_insights' as DetailCardType,
      id: `${raceData.id}-fleet-insights`,
      title: 'Fleet Insights',
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'learning' as DetailCardType,
      id: `${raceData.id}-learning`,
      title: 'Key Takeaway',
      raceId: raceData.id,
      raceData,
    },
  ];
}

/**
 * Check if a race is a distance race based on type or name
 */
function isDistanceRace(raceData: RaceDataForDetailCards): boolean {
  const explicit = raceData.race_type as 'fleet' | 'distance' | undefined;
  const detected = detectRaceType(raceData.name, explicit, raceData.total_distance_nm);
  return detected === 'distance';
}

/**
 * Create detail cards for upcoming fleet races (windward/leeward, triangle, etc.)
 */
function createFleetRaceCards(raceData: RaceDataForDetailCards): RaceDetailCardData[] {
  return [
    {
      type: 'conditions' as DetailCardType,
      id: `${raceData.id}-conditions`,
      title: 'Conditions',
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'strategy' as DetailCardType,
      id: `${raceData.id}-strategy`,
      title: 'Strategy',
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'rig' as DetailCardType,
      id: `${raceData.id}-rig`,
      title: 'Rig Setup',
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'course' as DetailCardType,
      id: `${raceData.id}-course`,
      title: 'Course',
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'fleet' as DetailCardType,
      id: `${raceData.id}-fleet`,
      title: 'Fleet',
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'regulatory' as DetailCardType,
      id: `${raceData.id}-regulatory`,
      title: 'Regulatory',
      raceId: raceData.id,
      raceData,
    },
  ];
}

/**
 * Create detail cards for upcoming distance races (offshore, passage, etc.)
 * Different card order and titles for distance racing context
 */
function createDistanceRaceCards(raceData: RaceDataForDetailCards): RaceDetailCardData[] {
  return [
    {
      type: 'conditions' as DetailCardType,
      id: `${raceData.id}-conditions`,
      title: 'Weather Outlook',  // Longer-term focus for distance races
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'course' as DetailCardType,
      id: `${raceData.id}-course`,
      title: 'Route',  // "Route" instead of "Course" for distance races
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'strategy' as DetailCardType,
      id: `${raceData.id}-strategy`,
      title: 'Passage Planning',  // "Passage Planning" instead of "Strategy"
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'rig' as DetailCardType,
      id: `${raceData.id}-rig`,
      title: 'Boat Prep',  // "Boat Prep" for distance races
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'fleet' as DetailCardType,
      id: `${raceData.id}-fleet`,
      title: 'Fleet',
      raceId: raceData.id,
      raceData,
    },
    {
      type: 'regulatory' as DetailCardType,
      id: `${raceData.id}-regulatory`,
      title: 'Safety & Docs',  // "Safety & Docs" for distance races
      raceId: raceData.id,
      raceData,
    },
  ];
}

/**
 * Create detail cards for upcoming races (pre-race preparation)
 * Automatically selects the appropriate card set based on race type
 */
function createUpcomingRaceCards(raceData: RaceDataForDetailCards): RaceDetailCardData[] {
  if (isDistanceRace(raceData)) {
    return createDistanceRaceCards(raceData);
  }
  return createFleetRaceCards(raceData);
}

/**
 * Create detail cards data array for a race
 * Returns different card sets based on race status:
 * - Completed races: Results, Analysis, Fleet Insights, Learning
 * - Upcoming races: Conditions, Strategy, Rig, Course, Fleet, Regulatory
 */
export function createDetailCardsForRace(
  raceData: RaceDataForDetailCards
): RaceDetailCardData[] {
  const completed = isRaceCompleted(raceData);

  if (completed) {
    return createCompletedRaceCards(raceData);
  }
  return createUpcomingRaceCards(raceData);
}

/**
 * Render options for post-race cards
 */
export interface RenderDetailCardOptions {
  onAddDebrief?: () => void;
  currentUserId?: string | null;
  /** Whether this card is expanded */
  isExpanded?: boolean;
  /** Callback to toggle expansion state */
  onToggle?: () => void;
}

/**
 * Render a detail card based on its type
 * Used by DetailCardPager's renderCard prop
 */
export function renderDetailCardByType(
  card: RaceDetailCardData,
  index: number,
  isActive: boolean,
  onCardPress?: (cardType: DetailCardType) => void,
  options?: RenderDetailCardOptions
): ReactElement {
  const { type, raceId, raceData } = card;
  const { isExpanded, onToggle, onAddDebrief, currentUserId } = options || {};

  const handlePress = onCardPress ? () => onCardPress(type) : undefined;

  // Check if this is a distance race for customizing card display
  const raceIsDistance = raceData ? isDistanceRace(raceData) : false;

  switch (type) {
    // =====================
    // Upcoming Race Cards
    // =====================
    case 'conditions':
      // Calculate expected duration from time_limit_hours if available
      const durationMinutes = raceData?.time_limit_hours
        ? raceData.time_limit_hours * 60
        : raceIsDistance ? 480 : 90;
      return (
        <ConditionsDetailCard
          key={card.id}
          raceId={raceId}
          wind={raceData?.wind}
          tide={raceData?.tide}
          waves={raceData?.waves}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
          isDistanceRace={raceIsDistance}
          customTitle={card.title}
          venue={raceData?.venue}
          raceDate={raceData?.date}
          raceStartTime={(raceData as any)?.start_time}
          expectedDurationMinutes={durationMinutes}
          classId={raceData?.classId}
          className={raceData?.className || raceData?.boatClass}
        />
      );

    case 'strategy':
      return (
        <StrategyDetailCard
          key={card.id}
          raceId={raceId}
          primaryStrategy={raceData?.strategy?.primaryStrategy}
          notes={raceData?.strategy?.notes}
          aiInsight={raceData?.strategy?.aiInsight}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
        />
      );

    case 'rig':
      return (
        <RigDetailCard
          key={card.id}
          raceId={raceId}
          boatClassName={raceData?.rigSettings?.boatClassName}
          settings={raceData?.rigSettings?.settings}
          isAIGenerated={raceData?.rigSettings?.isAIGenerated}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
        />
      );

    case 'course':
      return (
        <CourseDetailCard
          key={card.id}
          raceId={raceId}
          courseName={raceData?.courseName}
          courseType={raceIsDistance ? 'distance' : (raceData?.courseType as any)}
          marks={raceData?.marks}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
          isDistanceRace={raceIsDistance}
          customTitle={card.title}
          totalDistanceNm={raceData?.total_distance_nm}
          timeLimitHours={raceData?.time_limit_hours}
          routeWaypoints={raceData?.route_waypoints}
        />
      );

    case 'fleet':
      return (
        <FleetDetailCard
          key={card.id}
          raceId={raceId}
          fleetName={raceData?.fleetName}
          competitors={raceData?.competitors}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
        />
      );

    case 'regulatory':
      return (
        <RegulatoryDetailCard
          key={card.id}
          raceId={raceId}
          vhfChannel={raceData?.vhfChannel}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
        />
      );

    // =====================
    // Completed Race Cards
    // =====================
    case 'results':
      return (
        <ResultsDetailCard
          key={card.id}
          raceId={raceId}
          result={raceData?.result}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
        />
      );

    case 'analysis':
      return (
        <AnalysisDetailCard
          key={card.id}
          raceId={raceId}
          hasDebrief={raceData?.hasDebrief}
          analysisSummary={raceData?.analysisSummary}
          analysisInsights={raceData?.analysisInsights}
          analysisConfidence={raceData?.analysisConfidence}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
          onAddDebrief={onAddDebrief}
        />
      );

    case 'fleet_insights':
      return (
        <FleetInsightsDetailCard
          key={card.id}
          raceId={raceId}
          currentUserId={currentUserId}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
        />
      );

    case 'learning':
      return (
        <LearningDetailCard
          key={card.id}
          raceId={raceId}
          keyLearning={raceData?.keyLearning}
          focusNextRace={raceData?.focusNextRace}
          source={raceData?.hasDebrief ? 'ai' : undefined}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
        />
      );

    default:
      return (
        <ConditionsDetailCard
          key={card.id}
          raceId={raceId}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onPress={handlePress}
        />
      );
  }
}
