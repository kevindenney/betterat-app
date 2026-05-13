/**
 * useRacePreparationData Hook
 *
 * Computes derived race preparation data including rig presets,
 * regulatory digest, course outline groups, and status flags.
 * State management is handled separately by useRacePreparation.
 */

import { useMemo } from 'react';
import type { RigPreset, RegulatoryDigestData, RegulatoryAcknowledgements } from '@/lib/races';

interface CourseOutlineGroup {
  group: string;
  description: string;
  courses: { name: string; sequence: string }[];
}

interface ActiveRace {
  series?: string;
}

interface UseRacePreparationDataParams {
  selectedRaceData: any | null;
  selectedRaceMarks: any[];
  regattaAcknowledgements: RegulatoryAcknowledgements;
  activeRace?: ActiveRace | null;
}

interface UseRacePreparationDataReturn {
  rigPresets: RigPreset[];
  isGenericDefaults: boolean;
  regulatoryDigest: RegulatoryDigestData;
  courseOutlineGroups: CourseOutlineGroup[];
  hasStrategyGenerated: boolean;
  hasPostAnalysis: boolean;
  hasCrewReady: boolean;
  hasRegulatoryAcknowledged: boolean;
}

// Default rig presets when none are defined
const DEFAULT_RIG_PRESETS: RigPreset[] = [
  {
    id: 'light',
    label: 'Light Air',
    windRange: '< 8 kn',
    uppers: '12–13 Loos',
    lowers: 'Slack (0–1 turn off)',
    runners: 'Ease for visible sag',
    ram: '+2 cm forward',
    notes: 'Power on: ease lowers and runners to maintain depth and acceleration.',
  },
  {
    id: 'medium',
    label: 'Today',
    windRange: '8–14 kn',
    uppers: '14–16 Loos',
    lowers: 'Mast straight athwartships',
    runners: '≈30 Loos – stay just taut',
    ram: 'Neutral to +1 cm',
    notes: 'Baseline Port Shelter tune; traveller slightly weather, maintain twist in chop.',
  },
  {
    id: 'fresh',
    label: 'Fresh Breeze',
    windRange: '15–20 kn',
    uppers: '17–18 Loos',
    lowers: '+½ turn',
    runners: '35–40 Loos',
    ram: '+3 cm forward',
    notes: 'Flatten sails, move lead aft ½ hole, ease traveller down in gusts.',
  },
];

// Default course outline groups
const DEFAULT_COURSE_OUTLINE_GROUPS: CourseOutlineGroup[] = [
  {
    group: 'Group 1',
    description: 'All marks rounded to port',
    courses: [
      { name: 'Course 1', sequence: 'Start – A – C – A – C – Finish at A' },
      { name: 'Course 2', sequence: 'Start – A – C – A – B – C – Finish at A' },
      { name: 'Course 3', sequence: 'Start – A – C – A – C – A – C – Finish at A' },
      { name: 'Course 4', sequence: 'Start – A – B – C – A – C – A – C – Finish at A' },
      { name: 'Course 5', sequence: 'Start – A – B – C – A – C – A – B – C – Finish at A' },
      { name: 'Course 6', sequence: 'Start – A – B – C – A – B – C – A – B – C – Finish at A' },
      { name: 'Course 7', sequence: 'Start – A – Finish at C' },
      { name: 'Course 8', sequence: 'Start – A – C – A – Finish at C' },
      { name: 'Course 9', sequence: 'Start – A – B – C – A – Finish at C' },
      { name: 'Course 10', sequence: 'Start – A – C – A – C – A – Finish at C' },
      { name: 'Course 11', sequence: 'Start – A – C – A – B – C – A – Finish at C' },
    ],
  },
  {
    group: 'Group 2',
    description: 'Gate C1/C2 (if replaced by single mark, round to port)',
    courses: [
      { name: 'Course 12', sequence: 'Start – A – Finish' },
      { name: 'Course 13', sequence: 'Start – A – C1/C2 – A – Finish' },
      { name: 'Course 14', sequence: 'Start – A – C1/C2 – A – C1/C2 – A – Finish' },
      { name: 'Course 15', sequence: 'Start – A – C1/C2 – A – B – Finish' },
      { name: 'Course 16', sequence: 'Start – A – C1/C2 – A – B – C2 – A – Finish' },
    ],
  },
];

/**
 * Hook for computing derived race preparation data
 */
export function useRacePreparationData({
  selectedRaceData,
  selectedRaceMarks,
  regattaAcknowledgements,
  activeRace,
}: UseRacePreparationDataParams): UseRacePreparationDataReturn {
  // Compute rig presets from race metadata or use defaults
  const rigPresets = useMemo<RigPreset[]>(() => {
    const metadataPresets = selectedRaceData?.metadata?.rig_presets as RigPreset[] | undefined;
    if (Array.isArray(metadataPresets) && metadataPresets.length > 0) {
      return metadataPresets;
    }
    return DEFAULT_RIG_PRESETS;
  }, [selectedRaceData]);

  // Check if using generic defaults (no class-specific tuning)
  const isGenericDefaults = useMemo(() => {
    const metadataPresets = selectedRaceData?.metadata?.rig_presets as RigPreset[] | undefined;
    return !Array.isArray(metadataPresets) || metadataPresets.length === 0;
  }, [selectedRaceData]);

  // Compute regulatory digest from race metadata
  const regulatoryDigest = useMemo<RegulatoryDigestData>(() => {
    const metadata = (selectedRaceData?.metadata || {}) as Record<string, any>;
    return {
      seriesName: metadata.series_name || metadata.event_name || activeRace?.series || 'Corinthian Series',
      venueArea: metadata.venue_area || 'Port Shelter / Clearwater Bay',
      cleanRegatta: metadata.clean_regatta !== false,
      signOnWindow: metadata.sign_on_window || 'Sign-on via SailSys ≥10 minutes before warning signal',
      entryNotes: metadata.entry_requirements || [
        'Single season entry through SailSys for Dragon class',
        'Complete mandatory safety briefing video and quiz',
        'Acknowledge boat safety responsibilities and Club Bye-Laws',
      ],
      courseSelection: metadata.course_reference || 'Courses selected from RHKYC Attachment B (Geometric Courses)',
      safetyNotes: metadata.safety_notes || [
        'Keep clear of commercial traffic; breaches may result in DSQ without hearing',
        'Race Committee may bar future entry for serious safety violations',
      ],
      reference: metadata.nor_reference || 'RHKYC Dragon Class NoR 2025–2026',
    };
  }, [selectedRaceData, activeRace]);

  // Compute course outline groups from race metadata or use defaults
  const courseOutlineGroups = useMemo<CourseOutlineGroup[]>(() => {
    const metadataCourses = selectedRaceData?.metadata?.course_outline as CourseOutlineGroup[] | undefined;
    if (Array.isArray(metadataCourses) && metadataCourses.length > 0) {
      return metadataCourses;
    }
    return DEFAULT_COURSE_OUTLINE_GROUPS;
  }, [selectedRaceData]);

  // Computed preparation status flags
  const hasStrategyGenerated = Boolean(
    selectedRaceData?.metadata?.strategy_generated_at ||
    selectedRaceData?.metadata?.ai_strategy_ready ||
    selectedRaceData?.metadata?.start_strategy_summary
  );

  const hasPostAnalysis = Boolean(
    selectedRaceData?.metadata?.post_race_notes ||
    selectedRaceData?.metadata?.analysis_completed_at
  );

  const hasCrewReady = Boolean(
    selectedRaceData?.metadata?.crew_ready ||
    selectedRaceMarks.length > 0
  );

  const hasRegulatoryAcknowledged =
    regattaAcknowledgements.cleanRegatta &&
    regattaAcknowledgements.signOn &&
    regattaAcknowledgements.safetyBriefing;

  return useMemo(() => ({
    rigPresets,
    isGenericDefaults,
    regulatoryDigest,
    courseOutlineGroups,
    hasStrategyGenerated,
    hasPostAnalysis,
    hasCrewReady,
    hasRegulatoryAcknowledged,
  }), [
    rigPresets,
    isGenericDefaults,
    regulatoryDigest,
    courseOutlineGroups,
    hasStrategyGenerated,
    hasPostAnalysis,
    hasCrewReady,
    hasRegulatoryAcknowledged,
  ]);
}

export default useRacePreparationData;
