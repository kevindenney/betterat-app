/**
 * WindShiftStrategyWizard
 *
 * Multi-step wizard for developing wind shift strategy for race preparation.
 * Transforms raw forecast data into actionable shift strategy.
 *
 * Steps:
 * 1. Current Conditions - Pull live forecast, show wind direction/speed
 * 2. Shift Pattern Analysis - AI identifies: oscillating, persistent, or building/dying
 * 3. Thermal Effects - For coastal venues, overlay sea breeze timing
 * 4. Strategy Brief - AI-generated "Wind Playbook"
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Wind,
  Sun,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Compass,
  Sparkles,
  BookOpen,
  ArrowRight,
  RotateCw,
  Thermometer,
  Navigation,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useForecastCheck } from '@/hooks/useForecastCheck';
import { TinySparkline } from '@/components/shared/charts/TinySparkline';
import type { ChecklistToolProps } from '@/lib/checklists/toolRegistry';
import type { SailingVenue } from '@/lib/types/global-venues';

// iOS System Colors
const IOS_COLORS = {
  blue: '#007AFF',
  purple: '#AF52DE',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  yellow: '#FFCC00',
  teal: '#5AC8FA',
  gray: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  gray4: '#3A3A3C',
  gray5: '#2C2C2E',
  background: '#F2F2F7',
  secondaryBackground: '#FFFFFF',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C4399',
  separator: '#3C3C4349',
};

type WizardStep = 'loading' | 'conditions' | 'shift_pattern' | 'thermal' | 'strategy_brief';

interface WindShiftStrategyWizardProps extends ChecklistToolProps {
  venue?: SailingVenue | null;
  raceDate?: string | null;
  raceName?: string;
  raceStartTime?: string;
  raceDurationHours?: number;
  onStrategyCapture?: (data: Record<string, string>) => void;
}

// Shift pattern types
type ShiftPattern = 'oscillating' | 'persistent_left' | 'persistent_right' | 'building' | 'dying' | 'stable';

// Thermal effect assessment
interface ThermalAssessment {
  hasSeaBreeze: boolean;
  expectedOnset: string | null;
  expectedDirection: string | null;
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
}

export function WindShiftStrategyWizard({
  item: _item,
  regattaId,
  boatId: _boatId,
  onComplete,
  onCancel,
  venue,
  raceDate,
  raceName,
  raceStartTime,
  raceDurationHours,
  onStrategyCapture,
}: WindShiftStrategyWizardProps) {
  const router = useRouter();

  // Use existing forecast check hook for wind data
  const {
    currentForecast,
    isLoadingForecast,
    forecastError: _forecastError,
  } = useForecastCheck({
    regattaId,
    venue: venue || null,
    raceDate: raceDate || null,
    raceStartTime: raceStartTime || null,
    expectedDurationMinutes: raceDurationHours ? raceDurationHours * 60 : undefined,
  });

  // State
  const [step, setStep] = useState<WizardStep>('loading');
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [strategyBrief, setStrategyBrief] = useState<string | null>(null);

  // Determine initial step once forecast loads
  useEffect(() => {
    if (!isLoadingForecast && currentForecast) {
      setStep('conditions');
    } else if (!isLoadingForecast && !currentForecast) {
      setStep('conditions');
    }
  }, [isLoadingForecast, currentForecast]);

  // Analyze wind shift pattern from hourly data
  const shiftAnalysis = useMemo((): {
    pattern: ShiftPattern;
    description: string;
    expectedShifts: number;
    avgMagnitude: number;
    recommendation: string;
  } => {
    if (!currentForecast?.hourlyWind || currentForecast.hourlyWind.length < 3) {
      return {
        pattern: 'stable',
        description: 'Insufficient data to analyze shifts',
        expectedShifts: 0,
        avgMagnitude: 0,
        recommendation: 'Focus on boat speed and fleet positioning',
      };
    }

    const directions = currentForecast.hourlyWind.map(h => {
      // Convert cardinal to degrees for analysis
      const cardinalMap: Record<string, number> = {
        'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
        'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
        'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
        'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5,
      };
      return cardinalMap[h.direction || 'N'] || 0;
    });

    const speeds = currentForecast.hourlyWind.map(h => h.value);

    // Calculate direction changes
    const dirChanges: number[] = [];
    for (let i = 1; i < directions.length; i++) {
      let diff = directions[i] - directions[i - 1];
      // Normalize to -180 to 180
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      dirChanges.push(diff);
    }

    // Calculate speed changes
    const speedChanges: number[] = [];
    for (let i = 1; i < speeds.length; i++) {
      speedChanges.push(speeds[i] - speeds[i - 1]);
    }

    // Determine pattern
    const avgDirChange = dirChanges.reduce((a, b) => a + b, 0) / dirChanges.length;
    const totalDirChange = dirChanges.reduce((a, b) => a + b, 0);
    const avgSpeedChange = speedChanges.reduce((a, b) => a + b, 0) / speedChanges.length;
    const signChanges = dirChanges.filter((d, i) => i > 0 && d * dirChanges[i - 1] < 0).length;

    let pattern: ShiftPattern;
    let description: string;
    let recommendation: string;

    if (avgSpeedChange > 2) {
      pattern = 'building';
      description = 'Wind is expected to build through the race';
      recommendation = 'Be patient early, conditions will improve. Conservative start, aggressive later.';
    } else if (avgSpeedChange < -2) {
      pattern = 'dying';
      description = 'Wind is expected to decrease through the race';
      recommendation = 'Get ahead early while there\'s pressure. Protect your position later.';
    } else if (Math.abs(totalDirChange) > 30) {
      pattern = totalDirChange > 0 ? 'persistent_right' : 'persistent_left';
      description = `Wind is expected to persistently shift ${totalDirChange > 0 ? 'right (veer)' : 'left (back)'}`;
      recommendation = `Get to the ${totalDirChange > 0 ? 'right' : 'left'} side early and ride the shift.`;
    } else if (signChanges >= 2) {
      pattern = 'oscillating';
      description = 'Wind is oscillating with regular shifts';
      recommendation = 'Play the shifts! Tack on headers, sail the lifts. Stay in phase with the wind.';
    } else {
      pattern = 'stable';
      description = 'Wind direction appears relatively stable';
      recommendation = 'Focus on boat speed and fleet positioning rather than hunting for shifts.';
    }

    return {
      pattern,
      description,
      expectedShifts: signChanges,
      avgMagnitude: Math.abs(avgDirChange),
      recommendation,
    };
  }, [currentForecast]);

  // Assess thermal/sea breeze potential
  const thermalAssessment = useMemo((): ThermalAssessment => {
    // This would ideally use venue-specific data (coastal location, orientation)
    // For now, provide generic guidance based on time of day and temperature

    if (!currentForecast?.raceWindow) {
      return {
        hasSeaBreeze: false,
        expectedOnset: null,
        expectedDirection: null,
        confidence: 'low',
        recommendation: 'Unable to assess thermal effects without forecast data',
      };
    }

    const startHour = parseInt(raceStartTime?.split(':')[0] || '12', 10);
    const temp = currentForecast.raceWindow.airTemperature || 20;

    // Sea breeze typically develops in afternoon with sufficient heating
    const isAfternoon = startHour >= 12 && startHour <= 17;
    const isWarm = temp > 18;

    // Check if this appears to be a coastal venue (simplified check)
    const isCoastal = venue?.name?.toLowerCase().includes('bay') ||
                      venue?.name?.toLowerCase().includes('harbor') ||
                      venue?.name?.toLowerCase().includes('harbour') ||
                      venue?.name?.toLowerCase().includes('sea') ||
                      venue?.name?.toLowerCase().includes('coast');

    if (isCoastal && isAfternoon && isWarm) {
      return {
        hasSeaBreeze: true,
        expectedOnset: `${Math.max(12, startHour)}:00 - ${Math.min(16, startHour + 2)}:00`,
        expectedDirection: 'Typically onshore (perpendicular to coast)',
        confidence: isWarm && isAfternoon ? 'medium' : 'low',
        recommendation: 'Watch for sea breeze development. Wind may shift onshore and build during the afternoon.',
      };
    }

    return {
      hasSeaBreeze: false,
      expectedOnset: null,
      expectedDirection: null,
      confidence: 'medium',
      recommendation: 'Thermal effects likely minimal. Focus on synoptic wind pattern.',
    };
  }, [currentForecast, venue, raceStartTime]);

  // Generate AI strategy brief
  const generateStrategyBrief = useCallback(async () => {
    setIsGeneratingStrategy(true);

    // Simulate AI generation (in production, this would call Claude)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const rw = currentForecast?.raceWindow;
    const windSpeed = rw?.windAtStart || 10;
    const windDir = rw?.windDirectionAtStart || 'N';

    const brief = `## Wind Playbook

**Expected Conditions at Start:** ${windSpeed.toFixed(0)} kts from ${windDir}
**Shift Pattern:** ${shiftAnalysis.description}
${thermalAssessment.hasSeaBreeze ? `**Sea Breeze:** Expected ${thermalAssessment.expectedOnset}` : ''}

### Key Strategic Points

1. **Shift Strategy:** ${shiftAnalysis.pattern === 'oscillating'
  ? 'This is an oscillating day. Tack on every header of 5° or more. Stay in phase with the shifts.'
  : shiftAnalysis.pattern === 'persistent_left' || shiftAnalysis.pattern === 'persistent_right'
  ? `Persistent shift expected to the ${shiftAnalysis.pattern === 'persistent_left' ? 'left' : 'right'}. Get there early and commit.`
  : 'Stable conditions - play the fleet, not the shifts. Focus on boat speed.'}

2. **First Beat Approach:** ${shiftAnalysis.pattern === 'persistent_left'
  ? 'Start at pin end and extend left. First shift will reward you.'
  : shiftAnalysis.pattern === 'persistent_right'
  ? 'Start at boat end and extend right. First shift will reward you.'
  : 'Play the start line bias and be ready to tack on the first header.'}

3. **Wind Trend:** ${shiftAnalysis.pattern === 'building'
  ? 'Wind building through race. Expect better conditions on later legs. Be patient.'
  : shiftAnalysis.pattern === 'dying'
  ? 'Wind dying through race. Bank gains early. Protect your position on later legs.'
  : 'Steady breeze expected. Consistent speed will pay off.'}

${thermalAssessment.hasSeaBreeze ? `
### Thermal Consideration

Sea breeze may develop ${thermalAssessment.expectedOnset}. Watch for:
- Wind backing/veering toward shore
- Building pressure near the coastline
- Cloud development inland (indicating thermal activity)

If sea breeze fills, get to the new wind early for maximum advantage.
` : ''}

### Confidence Level

${shiftAnalysis.pattern === 'stable'
  ? '**High Confidence:** Stable conditions give high predictability. Execute your race plan.'
  : shiftAnalysis.pattern === 'oscillating'
  ? '**Medium Confidence:** Oscillating conditions require attention. Stay alert and reactive.'
  : '**Variable Confidence:** Watch for pattern confirmation early in the race.'}

### Race Window Summary

- **Start:** ${windSpeed.toFixed(0)} kts ${windDir}
- **Expected Shifts:** ${shiftAnalysis.expectedShifts > 0 ? `${shiftAnalysis.expectedShifts} significant shifts` : 'Minimal shifts expected'}
- **Trend:** ${shiftAnalysis.pattern === 'building' ? 'Building' : shiftAnalysis.pattern === 'dying' ? 'Dying' : 'Steady'}`;

    setStrategyBrief(brief);
    setIsGeneratingStrategy(false);
  }, [currentForecast, shiftAnalysis, thermalAssessment]);

  // Navigate to specific wind shifts lesson
  const handleLearnMore = useCallback(() => {
    onCancel();
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/learn/[courseId]/player',
        params: {
          courseId: 'launch-phase-strategy',
          lessonId: 'lesson-14-1-1',
        },
      });
    }, 150);
  }, [router, onCancel]);

  // Navigate to edit race
  const handleEditRace = useCallback(() => {
    if (!regattaId) return;
    onCancel();
    setTimeout(() => {
      router.push(`/race/edit/${regattaId}`);
    }, 150);
  }, [regattaId, onCancel, router]);

  // Format race date
  const formatRaceDate = useCallback((dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
    } catch {
      return '';
    }
  }, []);

  // Step progress
  const steps = useMemo<WizardStep[]>(
    () => ['conditions', 'shift_pattern', 'thermal', 'strategy_brief'],
    []
  );
  const currentStepIndex = steps.indexOf(step);
  const progress = step === 'loading' ? 0 : (currentStepIndex + 1) / steps.length;

  // Navigation
  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  }, [currentStepIndex, steps]);

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  }, [currentStepIndex, steps]);

  // Handle completion with strategy capture
  const handleComplete = useCallback(() => {
    // Capture wind shift strategy data before completing
    if (onStrategyCapture) {
      const strategyData: Record<string, string> = {};

      // Wind shift pattern
      strategyData['upwind.shiftStrategy'] = `${shiftAnalysis.pattern.replace('_', ' ')} pattern - ${shiftAnalysis.recommendation}`;

      // Thermal effects
      if (thermalAssessment.hasSeaBreeze) {
        strategyData['wind.thermal'] = `Sea breeze expected ${thermalAssessment.expectedOnset || 'during race'} from ${thermalAssessment.expectedDirection || 'shore'} - ${thermalAssessment.recommendation}`;
      }

      if (userNotes.trim()) {
        strategyData['wind.userNotes'] = userNotes.trim();
      }

      onStrategyCapture(strategyData);
    }

    onComplete();
  }, [onStrategyCapture, onComplete, shiftAnalysis, thermalAssessment, userNotes]);

  // Get trend icon
  const getTrendIcon = useCallback((trend: string) => {
    switch (trend) {
      case 'building':
        return <TrendingUp size={20} color={IOS_COLORS.green} />;
      case 'dying':
        return <TrendingDown size={20} color={IOS_COLORS.orange} />;
      default:
        return <Minus size={20} color={IOS_COLORS.gray} />;
    }
  }, []);

  // Get pattern icon
  const getPatternIcon = useCallback((pattern: ShiftPattern) => {
    switch (pattern) {
      case 'oscillating':
        return <RotateCw size={24} color={IOS_COLORS.purple} />;
      case 'persistent_left':
      case 'persistent_right':
        return <Navigation size={24} color={IOS_COLORS.blue} style={{ transform: [{ rotate: pattern === 'persistent_left' ? '-45deg' : '45deg' }] }} />;
      case 'building':
        return <TrendingUp size={24} color={IOS_COLORS.green} />;
      case 'dying':
        return <TrendingDown size={24} color={IOS_COLORS.orange} />;
      default:
        return <Compass size={24} color={IOS_COLORS.gray} />;
    }
  }, []);

  // Render loading state
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={IOS_COLORS.blue} />
      <Text style={styles.loadingText}>Loading wind forecast...</Text>
    </View>
  );

  // Render conditions step
  const renderConditions = () => {
    if (!venue) {
      return (
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color={IOS_COLORS.orange} />
          <Text style={styles.errorTitle}>Venue Location Required</Text>
          <Text style={styles.errorDescription}>
            To see the wind forecast, please set a venue location for this race.
          </Text>
          {regattaId && (
            <Pressable style={styles.editRaceButton} onPress={handleEditRace}>
              <Text style={styles.editRaceButtonText}>Edit Race</Text>
              <ArrowRight size={16} color={IOS_COLORS.blue} />
            </Pressable>
          )}
        </View>
      );
    }

    if (!currentForecast?.raceWindow) {
      return (
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color={IOS_COLORS.orange} />
          <Text style={styles.errorTitle}>Forecast Unavailable</Text>
          <Text style={styles.errorDescription}>
            Unable to load wind forecast. The race may be too far in the future.
          </Text>
        </View>
      );
    }

    const rw = currentForecast.raceWindow;
    const hourlyWind = currentForecast.hourlyWind || [];
    const windSpeeds = hourlyWind.map(h => h.value);

    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        {/* Current Conditions Card */}
        <View style={styles.conditionsCard}>
          <View style={styles.conditionsHeader}>
            <View style={styles.conditionsIconContainer}>
              <Wind size={32} color={IOS_COLORS.blue} />
            </View>
            <View style={styles.conditionsInfo}>
              <Text style={styles.conditionsTitle}>Wind at Race Start</Text>
              <Text style={styles.conditionsSubtitle}>{raceStartTime || rw.raceStartTime}</Text>
            </View>
          </View>

          <View style={styles.windData}>
            <View style={styles.windDataItem}>
              <Text style={styles.windValue}>{rw.windAtStart.toFixed(0)}</Text>
              <Text style={styles.windUnit}>kts</Text>
            </View>
            <View style={styles.windDivider} />
            <View style={styles.windDataItem}>
              <Compass size={28} color={IOS_COLORS.secondaryLabel} />
              <Text style={styles.windDirection}>{rw.windDirectionAtStart}</Text>
            </View>
          </View>

          {/* Beaufort scale */}
          <View style={styles.beaufortRow}>
            <Text style={styles.beaufortLabel}>Beaufort {rw.beaufortAtStart}</Text>
            <Text style={styles.beaufortDesc}>
              {rw.beaufortAtStart <= 2 ? 'Light' : rw.beaufortAtStart <= 4 ? 'Moderate' : 'Fresh'}
            </Text>
          </View>
        </View>

        {/* Wind Timeline */}
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>Wind Through Race Window</Text>

          {windSpeeds.length > 0 && (
            <View style={styles.sparklineContainer}>
              <TinySparkline
                data={windSpeeds}
                width={300}
                height={80}
                color={IOS_COLORS.blue}
                variant="line"
                highlightPeak
              />
            </View>
          )}

          {/* Wind range */}
          <View style={styles.rangeRow}>
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Min</Text>
              <Text style={styles.rangeValue}>{Math.min(...windSpeeds).toFixed(0)} kts</Text>
            </View>
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Max</Text>
              <Text style={styles.rangeValue}>{Math.max(...windSpeeds).toFixed(0)} kts</Text>
            </View>
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Trend</Text>
              <View style={styles.trendBadge}>
                {getTrendIcon(shiftAnalysis.pattern)}
              </View>
            </View>
          </View>
        </View>

        {/* Direction timeline */}
        {hourlyWind.length > 0 && (
          <View style={styles.dataCard}>
            <Text style={styles.cardTitle}>Direction Changes</Text>
            <View style={styles.directionTimeline}>
              {hourlyWind.slice(0, 6).map((point, index) => (
                <View key={index} style={styles.directionPoint}>
                  <Text style={styles.directionTime}>{point.time}</Text>
                  <View style={[
                    styles.directionDot,
                    index === 0 && styles.directionDotActive
                  ]} />
                  <Text style={styles.directionValue}>{point.direction || '--'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  // Render shift pattern step
  const renderShiftPattern = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Pattern Card */}
      <View style={styles.patternCard}>
        <View style={styles.patternHeader}>
          <View style={styles.patternIconContainer}>
            {getPatternIcon(shiftAnalysis.pattern)}
          </View>
          <View style={styles.patternInfo}>
            <Text style={styles.patternTitle}>
              {shiftAnalysis.pattern === 'oscillating' ? 'Oscillating Shifts' :
               shiftAnalysis.pattern === 'persistent_left' ? 'Persistent Left (Backing)' :
               shiftAnalysis.pattern === 'persistent_right' ? 'Persistent Right (Veering)' :
               shiftAnalysis.pattern === 'building' ? 'Building Wind' :
               shiftAnalysis.pattern === 'dying' ? 'Dying Wind' :
               'Stable Conditions'}
            </Text>
            <Text style={styles.patternSubtitle}>{shiftAnalysis.description}</Text>
          </View>
        </View>
      </View>

      {/* Strategy Recommendation */}
      <View style={styles.strategyCard}>
        <Text style={styles.cardTitle}>Strategic Approach</Text>
        <Text style={styles.strategyText}>{shiftAnalysis.recommendation}</Text>
      </View>

      {/* Shift Details */}
      <View style={styles.dataCard}>
        <Text style={styles.cardTitle}>Shift Analysis</Text>

        <View style={styles.shiftDetail}>
          <Text style={styles.shiftLabel}>Expected Significant Shifts</Text>
          <Text style={styles.shiftValue}>
            {shiftAnalysis.expectedShifts > 0
              ? `${shiftAnalysis.expectedShifts} during race`
              : 'Minimal shifts expected'}
          </Text>
        </View>

        <View style={styles.shiftDetail}>
          <Text style={styles.shiftLabel}>Average Shift Magnitude</Text>
          <Text style={styles.shiftValue}>
            {shiftAnalysis.avgMagnitude > 0
              ? `~${shiftAnalysis.avgMagnitude.toFixed(0)}°`
              : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Pattern-specific tips */}
      <View style={styles.tipsCard}>
        <Text style={styles.cardTitle}>Pattern-Specific Tips</Text>

        {shiftAnalysis.pattern === 'oscillating' && (
          <>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Tack immediately on headers of 5° or more</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Sail lifts longer - don't give them away</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Avoid corners - stay in the middle to play shifts</Text>
            </View>
          </>
        )}

        {(shiftAnalysis.pattern === 'persistent_left' || shiftAnalysis.pattern === 'persistent_right') && (
          <>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Get to the {shiftAnalysis.pattern === 'persistent_left' ? 'left' : 'right'} side early
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Commit to your strategy - don't second-guess</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Start at the {shiftAnalysis.pattern === 'persistent_left' ? 'pin' : 'boat'} end
              </Text>
            </View>
          </>
        )}

        {shiftAnalysis.pattern === 'stable' && (
          <>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Focus on boat speed - it's a boat speed day</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Play the fleet, not imaginary shifts</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Clear air is paramount - avoid tight situations</Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );

  // Render thermal effects step
  const renderThermal = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Thermal Assessment Card */}
      <View style={styles.thermalCard}>
        <View style={styles.thermalHeader}>
          <View style={[
            styles.thermalIconContainer,
            thermalAssessment.hasSeaBreeze && styles.thermalIconActive
          ]}>
            {thermalAssessment.hasSeaBreeze ? (
              <Sun size={32} color={IOS_COLORS.orange} />
            ) : (
              <Thermometer size={32} color={IOS_COLORS.gray} />
            )}
          </View>
          <View style={styles.thermalInfo}>
            <Text style={styles.thermalTitle}>
              {thermalAssessment.hasSeaBreeze ? 'Sea Breeze Possible' : 'Minimal Thermal Effects'}
            </Text>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>
                {thermalAssessment.confidence} confidence
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Thermal Details */}
      {thermalAssessment.hasSeaBreeze && (
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>Sea Breeze Forecast</Text>

          <View style={styles.thermalDetail}>
            <Clock size={20} color={IOS_COLORS.orange} />
            <View style={styles.thermalDetailContent}>
              <Text style={styles.thermalDetailLabel}>Expected Onset</Text>
              <Text style={styles.thermalDetailValue}>{thermalAssessment.expectedOnset}</Text>
            </View>
          </View>

          <View style={styles.thermalDetail}>
            <Compass size={20} color={IOS_COLORS.blue} />
            <View style={styles.thermalDetailContent}>
              <Text style={styles.thermalDetailLabel}>Expected Direction</Text>
              <Text style={styles.thermalDetailValue}>{thermalAssessment.expectedDirection}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Recommendation */}
      <View style={styles.strategyCard}>
        <Text style={styles.cardTitle}>Thermal Strategy</Text>
        <Text style={styles.strategyText}>{thermalAssessment.recommendation}</Text>
      </View>

      {/* Signs to Watch */}
      <View style={styles.tipsCard}>
        <Text style={styles.cardTitle}>Signs to Watch For</Text>

        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>Cumulus cloud development over land</Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>Dark water (new breeze) on the horizon</Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>Temperature difference between land and water</Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>Other boats finding new pressure first</Text>
        </View>
      </View>

      {/* Current temperature if available */}
      {currentForecast?.raceWindow?.airTemperature && (
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>Temperature</Text>
          <View style={styles.tempDisplay}>
            <Text style={styles.tempValue}>
              {currentForecast.raceWindow.airTemperature.toFixed(0)}°C
            </Text>
            <Text style={styles.tempLabel}>Air temperature at race time</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );

  // Render strategy brief step
  const renderStrategyBrief = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {!strategyBrief ? (
        <View style={styles.generateContainer}>
          <View style={styles.generateIcon}>
            <Sparkles size={48} color={IOS_COLORS.purple} />
          </View>
          <Text style={styles.generateTitle}>Generate Wind Playbook</Text>
          <Text style={styles.generateDescription}>
            Create a wind strategy summary for this race.
          </Text>
          <Pressable
            style={styles.generateButton}
            onPress={generateStrategyBrief}
            disabled={isGeneratingStrategy}
          >
            {isGeneratingStrategy ? (
              <ActivityIndicator size="small" color={IOS_COLORS.secondaryBackground} />
            ) : (
              <>
                <Sparkles size={20} color={IOS_COLORS.secondaryBackground} />
                <Text style={styles.generateButtonText}>Generate Playbook</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.briefContainer}>
          <View style={styles.briefHeader}>
            <Sparkles size={24} color={IOS_COLORS.purple} />
            <Text style={styles.briefTitle}>Wind Playbook</Text>
          </View>
          <View style={styles.briefContent}>
            <Text style={styles.briefText}>{strategyBrief}</Text>
          </View>

          {/* Learn more link */}
          <Pressable style={styles.learnMoreButton} onPress={handleLearnMore}>
            <BookOpen size={20} color={IOS_COLORS.blue} />
            <Text style={styles.learnMoreText}>Learn more about wind shifts</Text>
            <ChevronRight size={20} color={IOS_COLORS.blue} />
          </Pressable>
        </View>
      )}

      {/* User Notes */}
      <View style={styles.notesSection}>
        <Text style={styles.notesLabel}>Your Notes</Text>
        <Text style={styles.notesSubLabel}>
          Record your reasoning or observations to review after racing
        </Text>
        <TextInput
          style={styles.notesInput}
          value={userNotes}
          onChangeText={setUserNotes}
          placeholder="e.g., Shifts were more persistent than forecast suggested, sea breeze came early..."
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Tip */}
      <View style={styles.reviewTipCard}>
        <Sparkles size={16} color={IOS_COLORS.purple} />
        <Text style={styles.reviewTipText}>
          After the race, review how the wind pattern played out. Your notes improve future recommendations.
        </Text>
      </View>
    </ScrollView>
  );

  // Render current step content
  const renderStepContent = () => {
    switch (step) {
      case 'loading':
        return renderLoading();
      case 'conditions':
        return renderConditions();
      case 'shift_pattern':
        return renderShiftPattern();
      case 'thermal':
        return renderThermal();
      case 'strategy_brief':
        return renderStrategyBrief();
      default:
        return null;
    }
  };

  // Step titles
  const stepTitles: Record<WizardStep, string> = {
    loading: 'Loading...',
    conditions: 'Current Conditions',
    shift_pattern: 'Shift Pattern',
    thermal: 'Thermal Effects',
    strategy_brief: 'Wind Playbook',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={IOS_COLORS.label} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Wind Strategy</Text>
          {raceName && <Text style={styles.headerSubtitle}>{raceName}</Text>}
          {raceDate && <Text style={styles.headerDate}>{formatRaceDate(raceDate)}</Text>}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        <Text style={styles.stepText}>{stepTitles[step]}</Text>
        {step !== 'loading' && (
          <Text style={styles.stepProgress}>
            {currentStepIndex + 1} of {steps.length}
          </Text>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderStepContent()}
      </View>

      {/* Footer navigation */}
      {step !== 'loading' && (
        <View style={styles.footer}>
          {currentStepIndex > 0 ? (
            <Pressable style={styles.backButton} onPress={goBack}>
              <ChevronLeft size={20} color={IOS_COLORS.blue} />
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.footerSpacer} />
          )}

          {currentStepIndex < steps.length - 1 ? (
            <Pressable style={styles.nextButton} onPress={goNext}>
              <Text style={styles.nextButtonText}>Next</Text>
              <ChevronRight size={20} color={IOS_COLORS.secondaryBackground} />
            </Pressable>
          ) : (
            <Pressable style={styles.doneButton} onPress={handleComplete}>
              <CheckCircle2 size={20} color={IOS_COLORS.secondaryBackground} />
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  closeButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  headerDate: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  headerSpacer: {
    width: 40,
  },
  progressContainer: {
    height: 3,
    backgroundColor: IOS_COLORS.separator,
  },
  progressBar: {
    height: '100%',
    backgroundColor: IOS_COLORS.blue,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondaryBackground,
  },
  stepText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  stepProgress: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginTop: 16,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  editRaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 10,
    gap: 8,
  },
  editRaceButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  conditionsCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  conditionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  conditionsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${IOS_COLORS.blue}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conditionsInfo: {
    flex: 1,
  },
  conditionsTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  conditionsSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  windData: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  windDataItem: {
    alignItems: 'center',
    flex: 1,
  },
  windValue: {
    fontSize: 48,
    fontWeight: '300',
    color: IOS_COLORS.blue,
  },
  windUnit: {
    fontSize: 16,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
  },
  windDivider: {
    width: 1,
    height: 60,
    backgroundColor: IOS_COLORS.separator,
    marginHorizontal: 24,
  },
  windDirection: {
    fontSize: 24,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginTop: 8,
  },
  beaufortRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    gap: 8,
  },
  beaufortLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  beaufortDesc: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
  },
  dataCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 12,
  },
  sparklineContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  rangeItem: {
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    marginBottom: 4,
  },
  rangeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  trendBadge: {
    marginTop: 2,
  },
  directionTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  directionPoint: {
    alignItems: 'center',
    flex: 1,
  },
  directionTime: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 8,
  },
  directionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: IOS_COLORS.separator,
    marginBottom: 8,
  },
  directionDotActive: {
    backgroundColor: IOS_COLORS.blue,
  },
  directionValue: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  patternCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patternIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${IOS_COLORS.purple}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patternInfo: {
    flex: 1,
  },
  patternTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 4,
  },
  patternSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  strategyCard: {
    backgroundColor: `${IOS_COLORS.blue}10`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  strategyText: {
    fontSize: 14,
    color: IOS_COLORS.blue,
    lineHeight: 20,
  },
  shiftDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  shiftLabel: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  shiftValue: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  tipsCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  tipBullet: {
    fontSize: 14,
    color: IOS_COLORS.blue,
    marginRight: 8,
    width: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },
  thermalCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  thermalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thermalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${IOS_COLORS.gray}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thermalIconActive: {
    backgroundColor: `${IOS_COLORS.orange}15`,
  },
  thermalInfo: {
    flex: 1,
  },
  thermalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  confidenceBadge: {
    backgroundColor: IOS_COLORS.separator,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  confidenceText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'capitalize',
  },
  thermalDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  thermalDetailContent: {
    flex: 1,
  },
  thermalDetailLabel: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  thermalDetailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginTop: 2,
  },
  tempDisplay: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  tempValue: {
    fontSize: 36,
    fontWeight: '300',
    color: IOS_COLORS.orange,
  },
  tempLabel: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
  },
  generateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  generateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${IOS_COLORS.purple}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  generateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  generateDescription: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.purple,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.secondaryBackground,
  },
  briefContainer: {
    flex: 1,
  },
  briefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  briefTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  briefContent: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  briefText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 22,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  learnMoreText: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.blue,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  footerSpacer: {
    width: 80,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  backButtonText: {
    fontSize: 15,
    color: IOS_COLORS.blue,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.blue,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 4,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.secondaryBackground,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.green,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.secondaryBackground,
  },
  notesSection: {
    marginTop: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  notesLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  notesSubLabel: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 10,
  },
  notesInput: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: IOS_COLORS.label,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reviewTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: `${IOS_COLORS.purple}08`,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  reviewTipText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
});
