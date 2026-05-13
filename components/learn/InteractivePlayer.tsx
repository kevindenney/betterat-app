/**
 * Interactive Player Component
 * Registry for interactive lesson components
 * Dynamically loads the appropriate interactive component based on componentName
 */

import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import interactive components
import { StartingSequenceInteractive } from './interactives/StartingSequenceInteractive';
import { SetCourseInteractive } from './interactives/SetCourseInteractive';
import { LineBiasInteractive } from './interactives/LineBiasInteractive';
import { FavoredEndInteractive } from './interactives/FavoredEndInteractive';
import { TimedRunInteractive } from './interactives/TimedRunInteractive';
import { PositioningInteractive } from './interactives/PositioningInteractive';
import { StartingStrategiesInteractive } from './interactives/StartingStrategiesInteractive';
import { RightOfWayInteractive } from './interactives/RightOfWayInteractive';
import { WhatIsSailboatRacingInteractive } from './interactives/WhatIsSailboatRacingInteractive';
import { TypesOfRacesInteractive } from './interactives/TypesOfRacesInteractive';
import { MarkRoomInteractive } from './interactives/MarkRoomInteractive';
import { StartingBasicsInteractive } from './interactives/StartingBasicsInteractive';
import { UpwindTacticsInteractive } from './interactives/UpwindTacticsInteractive';
import { DownwindBasicsInteractive } from './interactives/DownwindBasicsInteractive';
import { RaceDocumentsBasicsInteractive } from './interactives/RaceDocumentsBasicsInteractive';
import { RaceDocumentsAdvancedInteractive } from './interactives/RaceDocumentsAdvancedInteractive';
import { ShroudTensionSimulator } from './interactives/ShroudTensionSimulator';
import { HelmBalanceInteractive } from './interactives/HelmBalanceInteractive';
import { MainsailControlsInteractive } from './interactives/MainsailControlsInteractive';
// Weather interactives
import { WeatherAnalysisInteractive } from './interactives/WeatherAnalysisInteractive';
import { CurrentReadingInteractive } from './interactives/CurrentReadingInteractive';
import { WindShiftPredictionInteractive } from './interactives/WindShiftPredictionInteractive';
// Tactics interactives
import { LaylineCalculatorInteractive } from './interactives/LaylineCalculatorInteractive';
import { FleetPositioningInteractive } from './interactives/FleetPositioningInteractive';
import { MarkRoundingTacticsInteractive } from './interactives/MarkRoundingTacticsInteractive';
// Equipment interactives
import { SailSelectionInteractive } from './interactives/SailSelectionInteractive';
import { SafetyGearCheckInteractive } from './interactives/SafetyGearCheckInteractive';
// Rules interactives
import { NORQuizInteractive } from './interactives/NORQuizInteractive';
import { SIInterpreterInteractive } from './interactives/SIInterpreterInteractive';
import { CourseSignalsInteractive } from './interactives/CourseSignalsInteractive';
// Distance racing interactives
import { RouteBriefingInteractive } from './interactives/RouteBriefingInteractive';
import { WeatherRoutingInteractive } from './interactives/WeatherRoutingInteractive';
// Launch phase strategy interactives
import { DecodingWindInteractive } from './interactives/DecodingWindInteractive';
import { PerfectStartInteractive } from './interactives/PerfectStartInteractive';
import { FirstBeatInteractive } from './interactives/FirstBeatInteractive';
import { RacingInCurrentInteractive } from './interactives/RacingInCurrentInteractive';
// Team racing interactives
import { TeamRacingScoringInteractive } from './interactives/TeamRacingScoringInteractive';
import { TeamRacingCallsInteractive } from './interactives/TeamRacingCallsInteractive';
import { TeamRacingTacticsInteractive } from './interactives/TeamRacingTacticsInteractive';
import { TeamRacingUmpireSignalsInteractive } from './interactives/TeamRacingUmpireSignalsInteractive';
import { TeamRacingOverviewInteractive } from './interactives/TeamRacingOverviewInteractive';
import { TeamRacingComparisonInteractive } from './interactives/TeamRacingComparisonInteractive';
import { TeamRacingCourseInteractive } from './interactives/TeamRacingCourseInteractive';
import { TeamRacingReadTheRaceInteractive } from './interactives/TeamRacingReadTheRaceInteractive';
import { TeamRacingCommsInteractive } from './interactives/TeamRacingCommsInteractive';
import { TeamRacingCoveringInteractive } from './interactives/TeamRacingCoveringInteractive';
import { TeamRacingStartInteractive } from './interactives/TeamRacingStartInteractive';

interface InteractivePlayerProps {
  componentName: string;
  onComplete?: () => void;
}

// Component registry
const INTERACTIVE_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'StartingSequenceInteractive': StartingSequenceInteractive,
  'SetCourseInteractive': SetCourseInteractive,
  'LineBiasInteractive': LineBiasInteractive,
  'FavoredEndInteractive': FavoredEndInteractive,
  'TimedRunInteractive': TimedRunInteractive,
  'PositioningInteractive': PositioningInteractive,
  'StartingStrategiesInteractive': StartingStrategiesInteractive,
  'RightOfWayInteractive': RightOfWayInteractive,
  'WhatIsSailboatRacingInteractive': WhatIsSailboatRacingInteractive,
  'TypesOfRacesInteractive': TypesOfRacesInteractive,
  'MarkRoomInteractive': MarkRoomInteractive,
  'StartingBasicsInteractive': StartingBasicsInteractive,
  'UpwindTacticsInteractive': UpwindTacticsInteractive,
  'DownwindBasicsInteractive': DownwindBasicsInteractive,
  'RaceDocumentsBasicsInteractive': RaceDocumentsBasicsInteractive,
  'RaceDocumentsAdvancedInteractive': RaceDocumentsAdvancedInteractive,
  'ShroudTensionSimulator': ShroudTensionSimulator,
  'HelmBalanceInteractive': HelmBalanceInteractive,
  'MainsailControlsInteractive': MainsailControlsInteractive,
  // Weather interactives
  'WeatherAnalysisInteractive': WeatherAnalysisInteractive,
  'CurrentReadingInteractive': CurrentReadingInteractive,
  'WindShiftPredictionInteractive': WindShiftPredictionInteractive,
  // Tactics interactives
  'LaylineCalculatorInteractive': LaylineCalculatorInteractive,
  'FleetPositioningInteractive': FleetPositioningInteractive,
  'MarkRoundingTacticsInteractive': MarkRoundingTacticsInteractive,
  // Equipment interactives
  'SailSelectionInteractive': SailSelectionInteractive,
  'SafetyGearCheckInteractive': SafetyGearCheckInteractive,
  // Rules interactives
  'NORQuizInteractive': NORQuizInteractive,
  'SIInterpreterInteractive': SIInterpreterInteractive,
  'CourseSignalsInteractive': CourseSignalsInteractive,
  // Distance racing interactives
  'RouteBriefingInteractive': RouteBriefingInteractive,
  'WeatherRoutingInteractive': WeatherRoutingInteractive,
  // Launch phase strategy interactives
  'DecodingWindInteractive': DecodingWindInteractive,
  'PerfectStartInteractive': PerfectStartInteractive,
  'FirstBeatInteractive': FirstBeatInteractive,
  'RacingInCurrentInteractive': RacingInCurrentInteractive,
  // Team racing interactives
  'TeamRacingScoringInteractive': TeamRacingScoringInteractive,
  'TeamRacingCallsInteractive': TeamRacingCallsInteractive,
  'TeamRacingTacticsInteractive': TeamRacingTacticsInteractive,
  'TeamRacingUmpireSignalsInteractive': TeamRacingUmpireSignalsInteractive,
  'TeamRacingOverviewInteractive': TeamRacingOverviewInteractive,
  'TeamRacingComparisonInteractive': TeamRacingComparisonInteractive,
  'TeamRacingCourseInteractive': TeamRacingCourseInteractive,
  'TeamRacingReadTheRaceInteractive': TeamRacingReadTheRaceInteractive,
  'TeamRacingCommsInteractive': TeamRacingCommsInteractive,
  'TeamRacingCoveringInteractive': TeamRacingCoveringInteractive,
  'TeamRacingStartInteractive': TeamRacingStartInteractive,
};

export function InteractivePlayer({ componentName, onComplete }: InteractivePlayerProps) {
  // Check if component exists in registry
  const Component = INTERACTIVE_COMPONENTS[componentName];

  if (!Component) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder}>
          <Ionicons name="code-working" size={64} color="#3B82F6" />
          <Text style={styles.title}>Interactive Lesson</Text>
          <Text style={styles.componentName}>{componentName || 'Not specified'}</Text>
          <Text style={styles.note}>
            This interactive component will be available in Phase 4
          </Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Interactive components are being ported from BetterAt Sail Racing and will include:
            </Text>
            <Text style={styles.infoItem}>• Starting Sequence (5-4-1-0)</Text>
            <Text style={styles.infoItem}>• Line Bias Reading</Text>
            <Text style={styles.infoItem}>• Favored End Calculation</Text>
            <Text style={styles.infoItem}>• Timed Run Approach</Text>
            <Text style={styles.infoItem}>• Positioning & Defense</Text>
            <Text style={styles.infoItem}>• Advanced Strategies</Text>
          </View>
        </View>
      </View>
    );
  }

  // Render the interactive component
  return (
    <View style={styles.container}>
      <Component onComplete={onComplete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  componentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    fontFamily: 'monospace',
    marginTop: 8,
  },
  note: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginTop: 24,
    width: '100%',
    maxWidth: 400,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }),
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 20,
  },
  infoItem: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    paddingLeft: 8,
  },
});

