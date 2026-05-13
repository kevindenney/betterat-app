/**
 * TideStrategyWizard
 *
 * Multi-step wizard for developing current/tide strategy for race preparation.
 * Helps sailors factor current into every tactical decision.
 *
 * Steps:
 * 1. Tide State - Current tide (ebb/flood), next change, spring/neap
 * 2. Current Map - Venue overlay showing current direction + strength zones
 * 3. Race Timeline - How current changes during expected race duration
 * 4. Mark Approaches - Optimal approach angle accounting for set
 * 5. Course Sides - Which side has favorable/unfavorable current
 * 6. Strategy Brief - AI-generated "Current Strategy Card"
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
  Waves,
  Clock,
  AlertTriangle,
  Compass,
  Target,
  Sparkles,
  BookOpen,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  LifeBuoy,
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

type WizardStep = 'loading' | 'tide_state' | 'timeline' | 'mark_approaches' | 'course_sides' | 'strategy_brief';

interface TideStrategyWizardProps extends ChecklistToolProps {
  venue?: SailingVenue | null;
  raceDate?: string | null;
  raceName?: string;
  raceStartTime?: string;
  raceDurationHours?: number;
  onStrategyCapture?: (data: Record<string, string>) => void;
}

// Tide state type
type TideFlow = 'flood' | 'ebb' | 'slack_high' | 'slack_low';

// Strategy recommendation for a mark approach
interface MarkApproachStrategy {
  markName: string;
  approachAngle: string;
  currentEffect: 'favorable' | 'adverse' | 'neutral';
  recommendation: string;
}

// Course side strategy
interface CourseSideStrategy {
  side: 'left' | 'right' | 'middle';
  currentAdvantage: number; // -1 to 1 scale
  recommendation: string;
}

export function TideStrategyWizard({
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
}: TideStrategyWizardProps) {
  const router = useRouter();

  // Use existing forecast check hook for tide data
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
      setStep('tide_state');
    } else if (!isLoadingForecast && !currentForecast) {
      setStep('tide_state');
    }
  }, [isLoadingForecast, currentForecast]);

  // Calculate tide state from forecast data
  const tideState = useMemo((): {
    flow: TideFlow;
    flowDescription: string;
    nextChange: string | null;
    currentStrength: 'strong' | 'moderate' | 'weak';
    springNeap: 'spring' | 'neap' | 'unknown';
  } => {
    if (!currentForecast?.raceWindow || !currentForecast.highTide || !currentForecast.lowTide) {
      return {
        flow: 'slack_high',
        flowDescription: 'Unknown',
        nextChange: null,
        currentStrength: 'moderate',
        springNeap: 'unknown',
      };
    }

    const rw = currentForecast.raceWindow;
    const highTide = currentForecast.highTide;
    const lowTide = currentForecast.lowTide;

    // Parse times
    const parseTime = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const startTime = parseTime(rw.raceStartTime);
    const highTime = parseTime(highTide.time);
    const lowTime = parseTime(lowTide.time);

    // Determine flow direction
    let flow: TideFlow;
    let nextChange: string | null = null;

    if (highTime < lowTime) {
      // High tide first, then low
      if (startTime < highTime) {
        flow = 'flood';
        nextChange = highTide.time;
      } else if (startTime > lowTime) {
        flow = 'flood';
        nextChange = null; // Next day
      } else if (Math.abs(startTime - highTime) < 30) {
        flow = 'slack_high';
        nextChange = lowTide.time;
      } else if (Math.abs(startTime - lowTime) < 30) {
        flow = 'slack_low';
        nextChange = highTide.time;
      } else {
        flow = 'ebb';
        nextChange = lowTide.time;
      }
    } else {
      // Low tide first, then high
      if (startTime < lowTime) {
        flow = 'ebb';
        nextChange = lowTide.time;
      } else if (startTime > highTime) {
        flow = 'ebb';
        nextChange = null;
      } else if (Math.abs(startTime - lowTime) < 30) {
        flow = 'slack_low';
        nextChange = highTide.time;
      } else if (Math.abs(startTime - highTime) < 30) {
        flow = 'slack_high';
        nextChange = lowTide.time;
      } else {
        flow = 'flood';
        nextChange = highTide.time;
      }
    }

    // Estimate current strength based on time from slack
    const timeSinceSlack = Math.min(
      Math.abs(startTime - highTime),
      Math.abs(startTime - lowTime)
    );
    let currentStrength: 'strong' | 'moderate' | 'weak';
    if (timeSinceSlack < 60) {
      currentStrength = 'weak';
    } else if (timeSinceSlack < 180) {
      currentStrength = 'strong'; // Mid-tide is strongest
    } else {
      currentStrength = 'moderate';
    }

    // Flow description
    const flowDescription = {
      flood: 'Flooding (rising tide)',
      ebb: 'Ebbing (falling tide)',
      slack_high: 'Slack water at high tide',
      slack_low: 'Slack water at low tide',
    }[flow];

    return {
      flow,
      flowDescription,
      nextChange,
      currentStrength,
      springNeap: 'unknown', // Would need lunar data
    };
  }, [currentForecast]);

  // Generate mark approach strategies
  const markApproaches = useMemo((): MarkApproachStrategy[] => {
    if (!tideState) return [];

    const flow = tideState.flow;
    const isEbb = flow === 'ebb' || flow === 'slack_low';
    const isFlood = flow === 'flood' || flow === 'slack_high';

    // Generic mark approach strategies based on current
    return [
      {
        markName: 'Windward Mark',
        approachAngle: isEbb ? 'Approach from port layline if current sets left' : 'Approach from starboard layline if current sets right',
        currentEffect: tideState.currentStrength === 'strong' ? 'adverse' : 'neutral',
        recommendation: tideState.currentStrength === 'strong'
          ? 'Over-stand slightly to account for current set'
          : 'Standard layline approach',
      },
      {
        markName: 'Leeward Gate',
        approachAngle: 'Account for current drift during downwind approach',
        currentEffect: 'neutral',
        recommendation: isFlood
          ? 'Favor gate mark with current pushing you toward next mark'
          : 'Consider which mark gives better angle to next leg',
      },
      {
        markName: 'Reaching Marks',
        approachAngle: 'Adjust for current set across your track',
        currentEffect: tideState.currentStrength === 'strong' ? 'adverse' : 'neutral',
        recommendation: 'Bear away early if current sets you toward mark, head up if it sets you away',
      },
    ];
  }, [tideState]);

  // Generate course side strategy
  const courseSideStrategy = useMemo((): CourseSideStrategy[] => {
    if (!tideState) return [];

    const isStrong = tideState.currentStrength === 'strong';
    const isEbb = tideState.flow === 'ebb' || tideState.flow === 'slack_low';

    // This would ideally use actual venue current data
    // For now, provide generic guidance
    return [
      {
        side: 'left',
        currentAdvantage: isEbb ? 0.3 : -0.3,
        recommendation: isEbb
          ? 'Ebb typically flows left to right in northern hemisphere - may find relief near left shore'
          : 'Flood may be stronger on left side - consider if upwind or downwind leg',
      },
      {
        side: 'right',
        currentAdvantage: isEbb ? -0.3 : 0.3,
        recommendation: isEbb
          ? 'Right side may have stronger ebb current'
          : 'Flood typically stronger on right - use if sailing with current',
      },
      {
        side: 'middle',
        currentAdvantage: 0,
        recommendation: isStrong
          ? 'Middle of course often has strongest current - avoid unless sailing with it'
          : 'Current effects less pronounced - focus on wind strategy',
      },
    ];
  }, [tideState]);

  // Generate AI strategy brief
  const generateStrategyBrief = useCallback(async () => {
    setIsGeneratingStrategy(true);

    // Simulate AI generation (in production, this would call Claude)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const brief = `## Current Strategy Card

**Tide State at Race Start:** ${tideState.flowDescription}
**Current Strength:** ${tideState.currentStrength.charAt(0).toUpperCase() + tideState.currentStrength.slice(1)}
${tideState.nextChange ? `**Next Change:** ${tideState.nextChange}` : ''}

### Key Tactical Points

1. **Upwind Strategy:** ${tideState.currentStrength === 'strong'
  ? 'Factor current heavily into layline calculations. Over-stand by 3-5 boat lengths if current is adverse at the mark.'
  : 'Standard layline approach with minor adjustments for current.'}

2. **Downwind Strategy:** ${tideState.flow === 'ebb'
  ? 'Ebb current will increase your ground speed. Sail deeper angles to maximize this advantage.'
  : 'Flood current may slow downwind progress. Consider higher angles to maintain boat speed.'}

3. **Mark Roundings:** ${tideState.currentStrength === 'strong'
  ? 'Allow extra room at marks to account for current set. Approach marks from the "upstream" side.'
  : 'Normal rounding tactics apply with awareness of minor current effects.'}

### Course Side Preference

${tideState.currentStrength === 'strong'
  ? 'Seek the side of the course with favorable current or reduced current strength. Shore relief may help on shallow sides.'
  : 'Current has minimal impact on course side selection - prioritize wind strategy.'}

### Risk Assessment

${tideState.currentStrength === 'strong'
  ? '**High Impact:** Current will significantly affect VMG and tactical decisions. Plan carefully.'
  : tideState.currentStrength === 'moderate'
  ? '**Moderate Impact:** Current is a factor but not dominant. Balance with wind strategy.'
  : '**Low Impact:** Current is weak. Focus primarily on wind and fleet positioning.'}`;

    setStrategyBrief(brief);
    setIsGeneratingStrategy(false);
  }, [tideState]);

  // Navigate to learn module
  const handleLearnMore = useCallback(() => {
    onCancel();
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/learn',
        params: { courseSlug: 'racing-in-current' },
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
    () => ['tide_state', 'timeline', 'mark_approaches', 'course_sides', 'strategy_brief'],
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
    // Capture tide strategy data before completing
    if (onStrategyCapture) {
      const strategyData: Record<string, string> = {};

      // Tide flow state
      strategyData['tide.flow'] = tideState.flowDescription;
      strategyData['tide.strength'] = `${tideState.currentStrength.charAt(0).toUpperCase() + tideState.currentStrength.slice(1)} current`;

      // Favored course side from tide analysis
      if (courseSideStrategy.length > 0) {
        const favored = courseSideStrategy.reduce((best, current) =>
          current.currentAdvantage > best.currentAdvantage ? current : best
        );
        strategyData['tide.favoredSide'] = `${favored.side.charAt(0).toUpperCase() + favored.side.slice(1)} side favored - ${favored.recommendation}`;
      }

      if (userNotes.trim()) {
        strategyData['tide.userNotes'] = userNotes.trim();
      }

      onStrategyCapture(strategyData);
    }

    onComplete();
  }, [onStrategyCapture, onComplete, tideState, courseSideStrategy, userNotes]);

  // Render loading state
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={IOS_COLORS.blue} />
      <Text style={styles.loadingText}>Loading tide data...</Text>
    </View>
  );

  // Render tide state step
  const renderTideState = () => {
    if (!venue) {
      return (
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color={IOS_COLORS.orange} />
          <Text style={styles.errorTitle}>Venue Location Required</Text>
          <Text style={styles.errorDescription}>
            To see tide information, please set a venue location for this race.
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
          <Text style={styles.errorTitle}>Tide Data Unavailable</Text>
          <Text style={styles.errorDescription}>
            Unable to load tide data for this race. The race may be too far in the future.
          </Text>
        </View>
      );
    }

    const rw = currentForecast.raceWindow;
    const FlowIcon = tideState.flow === 'flood' || tideState.flow === 'slack_high'
      ? ArrowUpRight
      : ArrowDownRight;

    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        {/* Tide State Card */}
        <View style={styles.stateCard}>
          <View style={styles.stateHeader}>
            <View style={styles.stateIconContainer}>
              <Waves size={32} color={IOS_COLORS.teal} />
            </View>
            <View style={styles.stateInfo}>
              <Text style={styles.stateTitle}>Current Tide State</Text>
              <Text style={styles.stateSubtitle}>At race start ({raceStartTime || rw.raceStartTime})</Text>
            </View>
          </View>

          <View style={styles.stateDetails}>
            <View style={styles.stateRow}>
              <FlowIcon size={24} color={tideState.flow.includes('flood') ? IOS_COLORS.blue : IOS_COLORS.orange} />
              <Text style={styles.stateValue}>{tideState.flowDescription}</Text>
            </View>

            <View style={styles.stateRow}>
              <LifeBuoy size={24} color={IOS_COLORS.gray} />
              <Text style={styles.stateValue}>
                Current Strength: <Text style={styles.stateHighlight}>{tideState.currentStrength}</Text>
              </Text>
            </View>

            {tideState.nextChange && (
              <View style={styles.stateRow}>
                <Clock size={24} color={IOS_COLORS.gray} />
                <Text style={styles.stateValue}>
                  Next change: <Text style={styles.stateHighlight}>{tideState.nextChange}</Text>
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Tide Heights */}
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>Tide Heights</Text>

          <View style={styles.tideRow}>
            <View style={styles.tideItem}>
              <Text style={styles.tideLabel}>High Tide</Text>
              <Text style={styles.tideValue}>{currentForecast.highTide?.time || '--:--'}</Text>
              <Text style={styles.tideHeight}>{currentForecast.highTide?.height.toFixed(1) || '--'}m</Text>
            </View>

            <View style={styles.tideDivider} />

            <View style={styles.tideItem}>
              <Text style={styles.tideLabel}>Low Tide</Text>
              <Text style={styles.tideValue}>{currentForecast.lowTide?.time || '--:--'}</Text>
              <Text style={styles.tideHeight}>{currentForecast.lowTide?.height.toFixed(1) || '--'}m</Text>
            </View>
          </View>

          {/* Sparkline */}
          {currentForecast.tideForecast && currentForecast.tideForecast.length > 0 && (
            <View style={styles.sparklineContainer}>
              <TinySparkline
                data={currentForecast.tideForecast}
                width={280}
                height={60}
                color={IOS_COLORS.teal}
                variant="area"
              />
              <Text style={styles.sparklineLabel}>Tide height over race window</Text>
            </View>
          )}
        </View>

        {/* Impact Assessment */}
        <View style={styles.impactCard}>
          <Text style={styles.cardTitle}>Impact on Racing</Text>
          <Text style={styles.impactText}>
            {tideState.currentStrength === 'strong'
              ? 'Current will significantly affect your VMG and tactical decisions. Plan laylines and mark approaches carefully.'
              : tideState.currentStrength === 'moderate'
              ? 'Current is a factor to consider but not dominant. Balance current strategy with wind tactics.'
              : 'Current is relatively weak. Focus primarily on wind strategy with awareness of minor current effects.'}
          </Text>
        </View>
      </ScrollView>
    );
  };

  // Render timeline step
  const renderTimeline = () => {
    if (!currentForecast?.hourlyTide) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Timeline data unavailable</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>Current Changes During Race</Text>
          <Text style={styles.cardSubtitle}>
            How the tide will change during your race window
          </Text>

          {/* Timeline visualization */}
          <View style={styles.timelineContainer}>
            {currentForecast.hourlyTide.slice(0, 6).map((point, index) => (
              <View key={index} style={styles.timelinePoint}>
                <Text style={styles.timelineTime}>{point.time}</Text>
                <View style={[
                  styles.timelineDot,
                  index === 0 && styles.timelineDotActive
                ]} />
                <Text style={styles.timelineValue}>{point.value.toFixed(1)}m</Text>
              </View>
            ))}
          </View>

          {/* Full sparkline */}
          {currentForecast.tideForecast && (
            <View style={styles.sparklineContainer}>
              <TinySparkline
                data={currentForecast.tideForecast}
                width={300}
                height={80}
                color={IOS_COLORS.teal}
                variant="area"
                highlightPeak
              />
            </View>
          )}
        </View>

        {/* Key moments */}
        <View style={styles.keyMomentsCard}>
          <Text style={styles.cardTitle}>Key Moments</Text>

          {tideState.nextChange && (
            <View style={styles.keyMoment}>
              <View style={styles.keyMomentIcon}>
                <Clock size={20} color={IOS_COLORS.orange} />
              </View>
              <View style={styles.keyMomentContent}>
                <Text style={styles.keyMomentTitle}>Tide Turn</Text>
                <Text style={styles.keyMomentText}>
                  Current will change direction around {tideState.nextChange}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.keyMoment}>
            <View style={styles.keyMomentIcon}>
              <Waves size={20} color={IOS_COLORS.teal} />
            </View>
            <View style={styles.keyMomentContent}>
              <Text style={styles.keyMomentTitle}>Peak Current</Text>
              <Text style={styles.keyMomentText}>
                Strongest current typically occurs 2-3 hours after tide turn
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  // Render mark approaches step
  const renderMarkApproaches = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.dataCard}>
        <Text style={styles.cardTitle}>Mark Approach Strategy</Text>
        <Text style={styles.cardSubtitle}>
          How to adjust your approaches for current
        </Text>
      </View>

      {markApproaches.map((approach, index) => (
        <View key={index} style={styles.approachCard}>
          <View style={styles.approachHeader}>
            <View style={styles.approachIconContainer}>
              <MapPin size={24} color={IOS_COLORS.blue} />
            </View>
            <Text style={styles.approachName}>{approach.markName}</Text>
            <View style={[
              styles.effectBadge,
              approach.currentEffect === 'favorable' && styles.effectFavorable,
              approach.currentEffect === 'adverse' && styles.effectAdverse,
            ]}>
              <Text style={styles.effectText}>{approach.currentEffect}</Text>
            </View>
          </View>

          <Text style={styles.approachAngle}>{approach.approachAngle}</Text>
          <Text style={styles.approachRec}>{approach.recommendation}</Text>
        </View>
      ))}

      {/* General tip */}
      <View style={styles.tipCard}>
        <View style={styles.tipIcon}>
          <Target size={20} color={IOS_COLORS.orange} />
        </View>
        <Text style={styles.tipText}>
          Always approach marks from the "upstream" side when current is strong to avoid being swept past.
        </Text>
      </View>
    </ScrollView>
  );

  // Render course sides step
  const renderCourseSides = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.dataCard}>
        <Text style={styles.cardTitle}>Course Side Strategy</Text>
        <Text style={styles.cardSubtitle}>
          Current advantages on different sides of the course
        </Text>
      </View>

      {courseSideStrategy.map((strategy, index) => (
        <View key={index} style={styles.sideCard}>
          <View style={styles.sideHeader}>
            <Compass size={24} color={IOS_COLORS.blue} />
            <Text style={styles.sideName}>
              {strategy.side.charAt(0).toUpperCase() + strategy.side.slice(1)} Side
            </Text>
            <View style={[
              styles.advantageBadge,
              strategy.currentAdvantage > 0 && styles.advantagePositive,
              strategy.currentAdvantage < 0 && styles.advantageNegative,
            ]}>
              <Text style={styles.advantageText}>
                {strategy.currentAdvantage > 0 ? '+' : ''}{(strategy.currentAdvantage * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
          <Text style={styles.sideRec}>{strategy.recommendation}</Text>
        </View>
      ))}

      {/* Current strength disclaimer */}
      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerText}>
          Note: These are general guidelines. Local knowledge and on-water observations should take precedence.
        </Text>
      </View>
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
          <Text style={styles.generateTitle}>Generate Strategy Brief</Text>
          <Text style={styles.generateDescription}>
            Create a summary of your current strategy for this race.
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
                <Text style={styles.generateButtonText}>Generate Brief</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.briefContainer}>
          <View style={styles.briefHeader}>
            <Sparkles size={24} color={IOS_COLORS.purple} />
            <Text style={styles.briefTitle}>Current Strategy Card</Text>
          </View>
          <View style={styles.briefContent}>
            <Text style={styles.briefText}>{strategyBrief}</Text>
          </View>

          {/* Learn more link */}
          <Pressable style={styles.learnMoreButton} onPress={handleLearnMore}>
            <BookOpen size={20} color={IOS_COLORS.blue} />
            <Text style={styles.learnMoreText}>Learn more about racing in current</Text>
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
          placeholder="e.g., Current stronger than expected near the pin, adjust laylines..."
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
          After the race, review how the current affected your strategy. Your notes improve future recommendations.
        </Text>
      </View>
    </ScrollView>
  );

  // Render current step content
  const renderStepContent = () => {
    switch (step) {
      case 'loading':
        return renderLoading();
      case 'tide_state':
        return renderTideState();
      case 'timeline':
        return renderTimeline();
      case 'mark_approaches':
        return renderMarkApproaches();
      case 'course_sides':
        return renderCourseSides();
      case 'strategy_brief':
        return renderStrategyBrief();
      default:
        return null;
    }
  };

  // Step titles
  const stepTitles: Record<WizardStep, string> = {
    loading: 'Loading...',
    tide_state: 'Tide State',
    timeline: 'Race Timeline',
    mark_approaches: 'Mark Approaches',
    course_sides: 'Course Sides',
    strategy_brief: 'Strategy Brief',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={IOS_COLORS.label} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Current Strategy</Text>
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
  stateCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  stateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stateIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${IOS_COLORS.teal}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stateInfo: {
    flex: 1,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  stateSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  stateDetails: {
    gap: 12,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stateValue: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
  },
  stateHighlight: {
    fontWeight: '600',
    color: IOS_COLORS.label,
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
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 16,
  },
  tideRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tideItem: {
    flex: 1,
    alignItems: 'center',
  },
  tideDivider: {
    width: 1,
    height: 48,
    backgroundColor: IOS_COLORS.separator,
  },
  tideLabel: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 4,
  },
  tideValue: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  tideHeight: {
    fontSize: 13,
    color: IOS_COLORS.teal,
    marginTop: 2,
  },
  sparklineContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  sparklineLabel: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 8,
  },
  impactCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  impactText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
    marginTop: 8,
  },
  timelineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  timelinePoint: {
    alignItems: 'center',
    flex: 1,
  },
  timelineTime: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: IOS_COLORS.separator,
    marginBottom: 8,
  },
  timelineDotActive: {
    backgroundColor: IOS_COLORS.blue,
  },
  timelineValue: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  keyMomentsCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  keyMoment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  keyMomentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${IOS_COLORS.orange}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  keyMomentContent: {
    flex: 1,
  },
  keyMomentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  keyMomentText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  approachCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  approachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  approachIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${IOS_COLORS.blue}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  approachName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  effectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: IOS_COLORS.gray5,
  },
  effectFavorable: {
    backgroundColor: `${IOS_COLORS.green}20`,
  },
  effectAdverse: {
    backgroundColor: `${IOS_COLORS.red}20`,
  },
  effectText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'capitalize',
  },
  approachAngle: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 8,
  },
  approachRec: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    fontStyle: 'italic',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${IOS_COLORS.orange}10`,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  tipIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.orange,
    lineHeight: 18,
  },
  sideCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  sideName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  advantageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: IOS_COLORS.gray5,
  },
  advantagePositive: {
    backgroundColor: `${IOS_COLORS.green}20`,
  },
  advantageNegative: {
    backgroundColor: `${IOS_COLORS.red}20`,
  },
  advantageText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  sideRec: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  disclaimerCard: {
    backgroundColor: `${IOS_COLORS.gray}10`,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: IOS_COLORS.gray,
    textAlign: 'center',
    fontStyle: 'italic',
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
