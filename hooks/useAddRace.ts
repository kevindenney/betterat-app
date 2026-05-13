/**
 * useAddRace Hook
 *
 * Manages add race dialog state and handlers for creating new races.
 * Supports multiple race types (fleet, distance, match, team).
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { GuestStorageService } from '@/services/GuestStorageService';
import { createLogger } from '@/lib/utils/logger';
import { v4 as uuid } from 'uuid';

const logger = createLogger('useAddRace');

// =============================================================================
// TYPES
// =============================================================================

export interface QuickAddRaceData {
  name: string;
  dateTime: string;
}

/** Course mark extracted from AI or manually added */
export interface CourseMark {
  name: string;
  latitude?: number;
  longitude?: number;
  type: string; // "windward", "leeward", "start", "finish", "wing", "gate"
  color?: string;
  shape?: string;
}

/** Route waypoint for distance races */
export interface RouteWaypoint {
  name: string;
  latitude?: number;
  longitude?: number;
  type: 'start' | 'waypoint' | 'gate' | 'finish' | 'peak';
  required: boolean;
  passingSide?: 'port' | 'starboard' | 'either';
  notes?: string;
  order?: number;
}

export interface RaceFormData {
  name: string;
  date: string;
  time: string;
  raceType: 'fleet' | 'distance' | 'match' | 'team';
  location?: string;
  latitude?: number;
  longitude?: number;
  vhfChannel?: string;
  notes?: string;
  /** Course marks extracted from AI or manually added */
  marks?: CourseMark[];
  /** Route waypoints for distance races */
  routeWaypoints?: RouteWaypoint[];
  /** Racing area polygon coordinates */
  racingAreaPolygon?: { lat: number; lng: number }[];
  fleet?: {
    courseType?: string;
    numberOfLaps?: string;
    expectedFleetSize?: string;
    boatClass?: string;
    /** Selected boat ID from user's boats */
    boatId?: string;
  };
  distance?: {
    totalDistanceNm?: string;
    timeLimitHours?: string;
    startFinishSameLocation?: boolean;
    routeDescription?: string;
  };
  match?: {
    opponentName?: string;
    matchRound?: string;
    totalRounds?: string;
    seriesFormat?: string;
    hasUmpire?: boolean;
  };
  team?: {
    yourTeamName?: string;
    opponentTeamName?: string;
    heatNumber?: string;
    teamSize?: string;
    teamMembers?: string;
  };
}

export interface UseAddRaceParams {
  /** Function to refresh races after creating */
  refetchRaces?: () => void;
  /** Callback when a race is successfully created (receives new race ID) */
  onRaceCreated?: (raceId: string) => void;
}

export interface UseAddRaceReturn {
  /** Whether add race sheet is shown */
  showAddRaceSheet: boolean;
  /** Whether a race is currently being added */
  isAddingRace: boolean;
  /** Whether the family button form is expanded */
  familyButtonExpanded: boolean;
  /** Whether signup prompt should be shown (guest trying to add 2nd race) */
  showSignupPrompt: boolean;
  /** Handler to show add race sheet */
  handleShowAddRaceSheet: (prefill?: AddRacePrefillParams) => void;
  /** Handler to close add race sheet */
  handleCloseAddRaceSheet: () => void;
  /** Handler to navigate to full add race page */
  handleAddRaceNavigation: (prefill?: AddRacePrefillParams) => void;
  /** Handler for quick add race form */
  handleQuickAddRaceSubmit: (data: QuickAddRaceData) => Promise<void>;
  /** Handler for full add race dialog with race type support */
  handleAddRaceDialogSave: (formData: RaceFormData) => Promise<void>;
  /** Setter for showAddRaceSheet */
  setShowAddRaceSheet: React.Dispatch<React.SetStateAction<boolean>>;
  /** Setter for familyButtonExpanded */
  setFamilyButtonExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  /** Setter for showSignupPrompt */
  setShowSignupPrompt: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface AddRacePrefillParams {
  templateId?: string;
  templateTitle?: string;
  templateDescription?: string;
  templateStepType?: string;
  templateModuleIds?: string[];
  templateSuggestedCompetencyIds?: string[];
}

/**
 * Hook for managing add race flow
 */
export function useAddRace({
  refetchRaces,
  onRaceCreated,
}: UseAddRaceParams): UseAddRaceReturn {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isGuest } = useAuth();

  const [showAddRaceSheet, setShowAddRaceSheet] = useState(false);
  const [isAddingRace, setIsAddingRace] = useState(false);
  const [familyButtonExpanded, setFamilyButtonExpanded] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  // Handler to show add race sheet
  // Note: Using page navigation instead of modal due to iOS modal presentation issues
  // The /(tabs)/race/add-tufte page has clean Tufte-style UI with real AI extraction
  const handleShowAddRaceSheet = useCallback((prefill?: AddRacePrefillParams) => {
    router.push({
      pathname: '/(tabs)/race/add-tufte',
      params: prefill
        ? {
          templateId: prefill.templateId,
          templateTitle: prefill.templateTitle,
          templateDescription: prefill.templateDescription,
          templateStepType: prefill.templateStepType,
          templateModuleIds: prefill.templateModuleIds ? JSON.stringify(prefill.templateModuleIds) : undefined,
          templateSuggestedCompetencyIds: prefill.templateSuggestedCompetencyIds
            ? JSON.stringify(prefill.templateSuggestedCompetencyIds)
            : undefined,
        }
        : undefined,
    } as any);
  }, [router]);

  // Handler to close add race sheet
  const handleCloseAddRaceSheet = useCallback(() => {
    setShowAddRaceSheet(false);
  }, []);

  // Handler to navigate to full add race page
  const handleAddRaceNavigation = useCallback((prefill?: AddRacePrefillParams) => {
    router.push({
      pathname: '/(tabs)/race/add-tufte',
      params: prefill
        ? {
          templateId: prefill.templateId,
          templateTitle: prefill.templateTitle,
          templateDescription: prefill.templateDescription,
          templateStepType: prefill.templateStepType,
          templateModuleIds: prefill.templateModuleIds ? JSON.stringify(prefill.templateModuleIds) : undefined,
          templateSuggestedCompetencyIds: prefill.templateSuggestedCompetencyIds
            ? JSON.stringify(prefill.templateSuggestedCompetencyIds)
            : undefined,
        }
        : undefined,
    } as any);
  }, [router]);

  // Handler for quick add race form (simple name + date/time)
  const handleQuickAddRaceSubmit = useCallback(async (data: QuickAddRaceData) => {
    // Guest mode: save to local storage
    if (isGuest || !user?.id) {
      setIsAddingRace(true);
      try {
        // Check if guest already has a race
        const hasRace = await GuestStorageService.hasGuestRace();
        if (hasRace) {
          // Save the new race as "pending" before showing signup prompt
          // This preserves the race data during the authentication flow
          const pendingRace = {
            id: uuid(),
            name: data.name,
            start_date: data.dateTime,
            venue: '',
            created_at: new Date().toISOString(),
          };
          await GuestStorageService.savePendingRace(pendingRace);

          // Show signup prompt - guest can only have one race
          setShowSignupPrompt(true);
          return;
        }

        // Save to local storage
        const guestRace = {
          id: uuid(),
          name: data.name,
          start_date: data.dateTime,
          venue: '',
          created_at: new Date().toISOString(),
        };
        await GuestStorageService.saveGuestRace(guestRace);

        // Refresh guest race query
        queryClient.invalidateQueries({ queryKey: ['guestRace'] });

        // Success - close sheet
        setShowAddRaceSheet(false);
        refetchRaces?.();

        // Notify caller
        onRaceCreated?.(guestRace.id);
      } catch (err) {
        showAlert('Error', err instanceof Error ? err.message : 'Failed to save race');
      } finally {
        setIsAddingRace(false);
      }
      return;
    }

    // Authenticated user: save to Supabase
    setIsAddingRace(true);
    try {
      // Insert into regattas table (what the app displays)
      const { data: newRace, error } = await supabase
        .from('regattas')
        .insert({
          name: data.name,
          start_date: data.dateTime,
          created_by: user.id,
          status: 'upcoming',
        })
        .select()
        .single();

      if (error) {
        logger.error('[useAddRace] Quick add error:', error);
        showAlert('Error', error.message || 'Failed to create race');
        return;
      }

      // Success - close sheet and refresh
      setShowAddRaceSheet(false);
      refetchRaces?.();

      // Notify caller of new race for auto-selection
      if (newRace?.id) {
        onRaceCreated?.(newRace.id);
      }
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'Failed to create race');
    } finally {
      setIsAddingRace(false);
    }
  }, [refetchRaces, onRaceCreated, user?.id, isGuest, queryClient]);

  // Handler for full add race dialog with race type support
  const handleAddRaceDialogSave = useCallback(async (formData: RaceFormData) => {
    // Guest mode: save to local storage
    if (isGuest || !user?.id) {
      setIsAddingRace(true);
      try {
        // Check if guest already has a race
        const hasRace = await GuestStorageService.hasGuestRace();
        if (hasRace) {
          // Save the new race as "pending" before showing signup prompt
          // This preserves the race data during the authentication flow
          const pendingStartTime = `${formData.date}T${formData.time}:00`;
          const pendingRace = {
            id: uuid(),
            name: formData.name,
            start_date: pendingStartTime,
            venue: formData.location || '',
            latitude: formData.latitude,
            longitude: formData.longitude,
            race_type: formData.raceType,
            metadata: {
              venue_name: formData.location,
              course_type: formData.fleet?.courseType,
              number_of_laps: formData.fleet?.numberOfLaps ? parseInt(formData.fleet.numberOfLaps) : undefined,
              expected_fleet_size: formData.fleet?.expectedFleetSize ? parseInt(formData.fleet.expectedFleetSize) : undefined,
              class_name: formData.fleet?.boatClass,
              total_distance_nm: formData.distance?.totalDistanceNm ? parseFloat(formData.distance.totalDistanceNm) : undefined,
              time_limit_hours: formData.distance?.timeLimitHours ? parseFloat(formData.distance.timeLimitHours) : undefined,
              route_description: formData.distance?.routeDescription,
              marks: formData.marks,
              route_waypoints: formData.routeWaypoints,
            },
            created_at: new Date().toISOString(),
          };
          await GuestStorageService.savePendingRace(pendingRace);

          // Show signup prompt - guest can only have one race
          setShowSignupPrompt(true);
          return;
        }

        // Build start_time from date and time
        const startTime = `${formData.date}T${formData.time}:00`;

        // Save to local storage with metadata
        const guestRace = {
          id: uuid(),
          name: formData.name,
          start_date: startTime,
          venue: formData.location || '',
          latitude: formData.latitude,
          longitude: formData.longitude,
          race_type: formData.raceType,
          metadata: {
            venue_name: formData.location,
            course_type: formData.fleet?.courseType,
            number_of_laps: formData.fleet?.numberOfLaps ? parseInt(formData.fleet.numberOfLaps) : undefined,
            expected_fleet_size: formData.fleet?.expectedFleetSize ? parseInt(formData.fleet.expectedFleetSize) : undefined,
            class_name: formData.fleet?.boatClass,
            total_distance_nm: formData.distance?.totalDistanceNm ? parseFloat(formData.distance.totalDistanceNm) : undefined,
            time_limit_hours: formData.distance?.timeLimitHours ? parseFloat(formData.distance.timeLimitHours) : undefined,
            route_description: formData.distance?.routeDescription,
          },
          created_at: new Date().toISOString(),
        };
        await GuestStorageService.saveGuestRace(guestRace);

        // Refresh guest race query
        queryClient.invalidateQueries({ queryKey: ['guestRace'] });

        // Success - close sheet
        setShowAddRaceSheet(false);
        refetchRaces?.();

        // Notify caller
        onRaceCreated?.(guestRace.id);
      } catch (err) {
        showAlert('Error', err instanceof Error ? err.message : 'Failed to save race');
      } finally {
        setIsAddingRace(false);
      }
      return;
    }

    // Authenticated user: save to Supabase
    setIsAddingRace(true);
    try {
      // Build start_time from date and time
      const startTime = `${formData.date}T${formData.time}:00`;

      // Look up class_id from boat if boatId is provided
      let classId: string | null = null;
      let className: string | null = null;

      if (formData.fleet?.boatId) {
        // Get class_id from the selected boat
        const { data: boat } = await supabase
          .from('sailor_boats')
          .select('class_id, boat_classes(name)')
          .eq('id', formData.fleet.boatId)
          .single();

        if (boat?.class_id) {
          classId = boat.class_id;
          className = (boat.boat_classes as any)?.name || formData.fleet.boatClass || null;
        }
      } else if (formData.fleet?.boatClass) {
        // Try to look up class by name if no boat selected
        const { data: boatClass } = await supabase
          .from('boat_classes')
          .select('id, name')
          .ilike('name', formData.fleet.boatClass)
          .limit(1)
          .single();

        if (boatClass) {
          classId = boatClass.id;
          className = boatClass.name;
        } else {
          // Use the class name as-is in metadata
          className = formData.fleet.boatClass;
        }
      }

      // Build metadata with type-specific data
      const metadata: Record<string, any> = {
        venue_name: formData.location,
        class_name: className,
        class_id: classId,
      };

      // Add venue coordinates for weather forecasting
      if (formData.latitude && formData.longitude) {
        metadata.start_coordinates = {
          lat: formData.latitude,
          lng: formData.longitude,
        };
      }

      // Add type-specific fields to metadata
      if (formData.raceType === 'fleet' && formData.fleet) {
        metadata.course_type = formData.fleet.courseType;
        metadata.number_of_laps = formData.fleet.numberOfLaps ? parseInt(formData.fleet.numberOfLaps) : undefined;
        metadata.expected_fleet_size = formData.fleet.expectedFleetSize ? parseInt(formData.fleet.expectedFleetSize) : undefined;
      } else if (formData.raceType === 'distance' && formData.distance) {
        metadata.total_distance_nm = formData.distance.totalDistanceNm ? parseFloat(formData.distance.totalDistanceNm) : undefined;
        metadata.time_limit_hours = formData.distance.timeLimitHours ? parseFloat(formData.distance.timeLimitHours) : undefined;
        metadata.start_finish_same_location = formData.distance.startFinishSameLocation;
        metadata.route_description = formData.distance.routeDescription;
      } else if (formData.raceType === 'match' && formData.match) {
        metadata.opponent_name = formData.match.opponentName;
        metadata.match_round = formData.match.matchRound ? parseInt(formData.match.matchRound) : undefined;
        metadata.total_rounds = formData.match.totalRounds ? parseInt(formData.match.totalRounds) : undefined;
        metadata.series_format = formData.match.seriesFormat;
        metadata.has_umpire = formData.match.hasUmpire;
      } else if (formData.raceType === 'team' && formData.team) {
        metadata.your_team_name = formData.team.yourTeamName;
        metadata.opponent_team_name = formData.team.opponentTeamName;
        metadata.heat_number = formData.team.heatNumber ? parseInt(formData.team.heatNumber) : undefined;
        metadata.team_size = formData.team.teamSize ? parseInt(formData.team.teamSize) : undefined;
        // Parse team members from string format
        if (formData.team.teamMembers) {
          metadata.team_members = formData.team.teamMembers.split(',').map(m => {
            const parts = m.trim().match(/^(.+?)(?:\s*#(\d+))?$/);
            return {
              name: parts?.[1]?.trim() || m.trim(),
              sailNumber: parts?.[2] || '',
            };
          });
        }
      }

      // Insert into regattas table (what the app displays)
      const regattaData: Record<string, any> = {
        name: formData.name,
        start_date: startTime,
        created_by: user.id,
        status: 'upcoming',
        race_type: formData.raceType,
        vhf_channel: formData.vhfChannel || null,
        metadata,
      };

      // Add class_id and boat_id as columns (not just in metadata)
      if (classId) {
        regattaData.class_id = classId;
      }
      if (formData.fleet?.boatId) {
        regattaData.boat_id = formData.fleet.boatId;
      }

      // Add distance racing fields to columns
      if (formData.raceType === 'distance' && formData.distance) {
        regattaData.total_distance_nm = formData.distance.totalDistanceNm ? parseFloat(formData.distance.totalDistanceNm) : null;
        regattaData.time_limit_hours = formData.distance.timeLimitHours ? parseFloat(formData.distance.timeLimitHours) : null;
        regattaData.start_finish_same_location = formData.distance.startFinishSameLocation ?? null;
      }

      // Add expected_fleet_size as column
      if (formData.raceType === 'fleet' && formData.fleet?.expectedFleetSize) {
        regattaData.expected_fleet_size = parseInt(formData.fleet.expectedFleetSize);
      }

      // Add course marks if extracted from AI or manually added
      if (formData.marks && formData.marks.length > 0) {
        regattaData.mark_designations = formData.marks;
        logger.debug('[useAddRace] Adding marks:', formData.marks.length);
      }

      // Add route waypoints for distance races
      if (formData.routeWaypoints && formData.routeWaypoints.length > 0) {
        regattaData.route_waypoints = formData.routeWaypoints;
        logger.debug('[useAddRace] Adding route waypoints:', formData.routeWaypoints.length);
      }

      // Add racing area polygon if drawn
      if (formData.racingAreaPolygon && formData.racingAreaPolygon.length > 0) {
        regattaData.racing_area_polygon = formData.racingAreaPolygon;
        logger.debug('[useAddRace] Adding racing area polygon:', formData.racingAreaPolygon.length, 'points');
      }

      // Add extracted details from AI analysis
      const extractedDetails = (formData as any).extractedDetails;
      if (extractedDetails) {
        logger.debug('[useAddRace] Adding extracted details:', Object.keys(extractedDetails));

        // Entry & Registration
        if (extractedDetails.entryFees) {
          regattaData.entry_fees = extractedDetails.entryFees;
        }
        if (extractedDetails.entryDeadline) {
          regattaData.entry_deadline = extractedDetails.entryDeadline;
        }

        // Crew & Safety
        if (extractedDetails.minimumCrew) {
          regattaData.minimum_crew = extractedDetails.minimumCrew;
        }
        if (extractedDetails.crewRequirements) {
          regattaData.crew_requirements = extractedDetails.crewRequirements;
        }
        if (extractedDetails.safetyRequirements) {
          regattaData.safety_requirements = extractedDetails.safetyRequirements;
        }
        if (extractedDetails.retirementNotification) {
          regattaData.retirement_notification = extractedDetails.retirementNotification;
        }
        if (extractedDetails.insuranceRequirements) {
          regattaData.insurance_requirements = extractedDetails.insuranceRequirements;
        }

        // Schedule
        if (extractedDetails.schedule && extractedDetails.schedule.length > 0) {
          regattaData.schedule = extractedDetails.schedule;
        }

        // Course Details
        if (extractedDetails.prohibitedAreas && extractedDetails.prohibitedAreas.length > 0) {
          regattaData.prohibited_areas = extractedDetails.prohibitedAreas;
        }
        if (extractedDetails.trafficSeparationSchemes) {
          regattaData.traffic_separation_schemes = extractedDetails.trafficSeparationSchemes;
        }
        if (extractedDetails.tideGates && extractedDetails.tideGates.length > 0) {
          regattaData.tide_gates = extractedDetails.tideGates;
        }
        if (extractedDetails.startAreaName) {
          regattaData.start_area_name = extractedDetails.startAreaName;
        }
        if (extractedDetails.startAreaDescription) {
          regattaData.start_area_description = extractedDetails.startAreaDescription;
        }

        // Scoring
        if (extractedDetails.scoringFormulaDescription) {
          regattaData.scoring_formula = extractedDetails.scoringFormulaDescription;
        }
        if (extractedDetails.handicapSystem) {
          regattaData.handicap_systems = extractedDetails.handicapSystem;
        }

        // Motoring (distance races)
        if (extractedDetails.motoringDivisionAvailable !== undefined) {
          regattaData.motoring_division_available = extractedDetails.motoringDivisionAvailable;
        }
        if (extractedDetails.motoringDivisionRules) {
          regattaData.motoring_division_rules = extractedDetails.motoringDivisionRules;
        }

        // Communications
        if (extractedDetails.vhfChannels && extractedDetails.vhfChannels.length > 0) {
          regattaData.vhf_channels = extractedDetails.vhfChannels;
        }

        // Organization
        if (extractedDetails.organizingAuthority) {
          regattaData.organizing_authority = extractedDetails.organizingAuthority;
        }
        if (extractedDetails.eventWebsite) {
          regattaData.event_website = extractedDetails.eventWebsite;
        }
        if (extractedDetails.contactEmail) {
          regattaData.contact_email = extractedDetails.contactEmail;
        }

        // Weather & Conditions
        if (extractedDetails.expectedConditions) {
          regattaData.expected_conditions = extractedDetails.expectedConditions;
        }
        if (extractedDetails.expectedWindDirection) {
          regattaData.expected_wind_direction = extractedDetails.expectedWindDirection;
        }
        if (extractedDetails.expectedWindSpeedMin) {
          regattaData.expected_wind_speed_min = extractedDetails.expectedWindSpeedMin;
        }
        if (extractedDetails.expectedWindSpeedMax) {
          regattaData.expected_wind_speed_max = extractedDetails.expectedWindSpeedMax;
        }

        // Rules
        if (extractedDetails.classRules) {
          regattaData.class_rules = extractedDetails.classRules;
        }

        // Prizes
        if (extractedDetails.prizesDescription) {
          regattaData.prizes_description = extractedDetails.prizesDescription;
        }
      }

      logger.debug('[useAddRace] Creating regatta:', regattaData);

      const { data: newRace, error } = await supabase
        .from('regattas')
        .insert(regattaData)
        .select()
        .single();

      if (error) {
        logger.error('[useAddRace] Create error:', error);
        showAlert('Error', error.message || 'Failed to create race');
        return;
      }

      logger.debug('[useAddRace] Race created successfully:', newRace?.id);

      // Success - close dialog and refresh
      setShowAddRaceSheet(false);
      refetchRaces?.();

      // Notify caller of new race for auto-selection
      if (newRace?.id) {
        onRaceCreated?.(newRace.id);
      }
    } catch (err) {
      logger.error('[useAddRace] Exception:', err);
      showAlert('Error', err instanceof Error ? err.message : 'Failed to create race');
    } finally {
      setIsAddingRace(false);
    }
  }, [refetchRaces, onRaceCreated, user?.id, isGuest, queryClient]);

  return {
    showAddRaceSheet,
    isAddingRace,
    familyButtonExpanded,
    showSignupPrompt,
    handleShowAddRaceSheet,
    handleCloseAddRaceSheet,
    handleAddRaceNavigation,
    handleQuickAddRaceSubmit,
    handleAddRaceDialogSave,
    setShowAddRaceSheet,
    setFamilyButtonExpanded,
    setShowSignupPrompt,
  };
}

export default useAddRace;
