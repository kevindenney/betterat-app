import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Vibration,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import AICoachingAssistant from '../../services/AICoachingAssistant';

interface LiveAdviceDisplayProps {
  advice: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: 'speed' | 'tactics' | 'safety' | 'technique' | 'rules';
    title: string;
    message: string;
    actionItems: string[];
    reasoning: string;
    timeRelevant: number;
    followUp?: string;
  };
  onDismiss: () => void;
}

interface PerformanceMetricProps {
  metric: {
    metric: string;
    currentValue: number;
    optimalRange: { min: number; max: number };
    improvement: string;
    impact: 'high' | 'medium' | 'low';
  };
}

interface SimulatedConditions {
  windSpeed: number;
  windDirection: number;
  gustFactor: number;
  waveHeight: number;
  current: { speed: number; direction: number };
  visibility: number;
  temperature: number;
}

interface SimulatedBoatState {
  position: { latitude: number; longitude: number };
  heading: number;
  speed: number;
  heel: number;
  trim: { fore_aft: number; athwartships: number };
  sailTrim: {
    mainsheet: number;
    jib_sheet: number;
    cunningham: number;
    outhaul: number;
    vang: number;
  };
}

function LiveAdviceDisplay({ advice, onDismiss }: LiveAdviceDisplayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Vibrate for critical advice
    if (advice.priority === 'critical') {
      Vibration.vibrate([0, 100, 50, 100]);
    }

    // Auto-dismiss after timeRelevant
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }, advice.timeRelevant * 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advice]);

  const getPriorityColor = () => {
    switch (advice.priority) {
      case 'critical': return '#FF0000';
      case 'high': return '#FF6B35';
      case 'medium': return '#FFA500';
      case 'low': return '#00AA33';
      default: return '#666';
    }
  };

  const getCategoryIcon = () => {
    switch (advice.category) {
      case 'speed': return '💨';
      case 'tactics': return '🧭';
      case 'safety': return '⚠️';
      case 'technique': return '⚙️';
      case 'rules': return '📋';
      default: return '💡';
    }
  };

  return (
    <Animated.View
      style={[
        styles.adviceContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          borderLeftColor: getPriorityColor(),
        },
      ]}
    >
      <View style={styles.adviceHeader}>
        <View style={styles.adviceHeaderLeft}>
          <Text style={styles.categoryIcon}>{getCategoryIcon()}</Text>
          <View>
            <Text style={styles.adviceTitle}>{advice.title}</Text>
            <Text style={[styles.advicePriority, { color: getPriorityColor() }]}>
              {advice.priority.toUpperCase()} • {advice.category.toUpperCase()}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.adviceMessage}>{advice.message}</Text>

      {advice.actionItems.length > 0 && (
        <View style={styles.actionItems}>
          <Text style={styles.actionItemsTitle}>Actions:</Text>
          {advice.actionItems.map((item, index) => (
            <Text key={index} style={styles.actionItem}>• {item}</Text>
          ))}
        </View>
      )}

      <Text style={styles.adviceReasoning}>{advice.reasoning}</Text>

      {advice.followUp && (
        <View style={styles.followUpContainer}>
          <Text style={styles.followUpLabel}>Follow-up:</Text>
          <Text style={styles.followUpText}>{advice.followUp}</Text>
        </View>
      )}
    </Animated.View>
  );
}

function PerformanceMetric({ metric }: PerformanceMetricProps) {
  const isInRange = metric.currentValue >= metric.optimalRange.min &&
                   metric.currentValue <= metric.optimalRange.max;

  const getImpactColor = () => {
    switch (metric.impact) {
      case 'high': return '#FF6B35';
      case 'medium': return '#FFA500';
      case 'low': return '#00AA33';
      default: return '#666';
    }
  };

  return (
    <View style={styles.metricContainer}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricName}>{metric.metric}</Text>
        <View style={[styles.impactBadge, { backgroundColor: getImpactColor() }]}>
          <Text style={styles.impactText}>{metric.impact}</Text>
        </View>
      </View>

      <View style={styles.metricValue}>
        <Text style={[styles.currentValue, { color: isInRange ? '#00AA33' : '#FF6B35' }]}>
          {metric.currentValue.toFixed(1)}
        </Text>
        <Text style={styles.optimalRange}>
          Optimal: {metric.optimalRange.min.toFixed(1)} - {metric.optimalRange.max.toFixed(1)}
        </Text>
      </View>

      <Text style={styles.improvement}>{metric.improvement}</Text>
    </View>
  );
}

export default function LiveCoachingAssistant() {
  const { user: _user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentAdvice, setCurrentAdvice] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState([]);
  const [sessionData, setSessionData] = useState({
    startTime: null,
    duration: 0,
    adviceCount: 0,
  });

  // Simulated sensor data (in production, this would come from real sensors)
  const [simulatedConditions] = useState<SimulatedConditions>({
    windSpeed: 12,
    windDirection: 290,
    gustFactor: 1.3,
    waveHeight: 0.8,
    current: { speed: 0.5, direction: 180 },
    visibility: 10,
    temperature: 18,
  });

  const [simulatedBoatState] = useState<SimulatedBoatState>({
    position: { latitude: 37.8044, longitude: -122.4692 },
    heading: 45,
    speed: 6.2,
    heel: 18,
    trim: { fore_aft: 0, athwartships: -2 },
    sailTrim: {
      mainsheet: 65,
      jib_sheet: 70,
      cunningham: 30,
      outhaul: 80,
      vang: 40,
    },
  });

  useEffect(() => {
    let adviceInterval: ReturnType<typeof setInterval>;
    let metricsInterval: ReturnType<typeof setInterval>;
    let durationInterval: ReturnType<typeof setInterval>;

    if (isActive) {
      // Generate advice every 30-60 seconds
      adviceInterval = setInterval(generateAdvice, 35000);

      // Update metrics every 10 seconds
      metricsInterval = setInterval(updateMetrics, 10000);

      // Update session duration
      durationInterval = setInterval(() => {
        setSessionData(prev => ({
          ...prev,
          duration: prev.startTime ? Math.floor((Date.now() - prev.startTime) / 1000) : 0,
        }));
      }, 1000);

      // Generate initial advice and metrics
      generateAdvice();
      updateMetrics();
    }

    return () => {
      clearInterval(adviceInterval);
      clearInterval(metricsInterval);
      clearInterval(durationInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const startSession = () => {
    setIsActive(true);
    setSessionData({
      startTime: Date.now(),
      duration: 0,
      adviceCount: 0,
    });
    AICoachingAssistant.startSession(`session-${Date.now()}`);
  };

  const endSession = () => {
    setIsActive(false);
    setCurrentAdvice(null);
    setPerformanceMetrics([]);
    AICoachingAssistant.endSession();
  };

  const generateAdvice = async () => {
    try {
      const advice = await AICoachingAssistant.generateRealTimeAdvice(
        simulatedConditions,
        simulatedBoatState,
        {
          racePhase: 'upwind',
          boatsAhead: 3,
          boatsBehind: 7,
          nearbyCompetitors: [
            { position: 'starboard', distance: 50, relative_speed: 0.2 },
            { position: 'port', distance: 80, relative_speed: -0.1 },
          ],
          nextMark: {
            bearing: 45,
            distance: 500,
            type: 'windward',
          },
        },
        {
          sessionGoals: ['Improve upwind speed', 'Better tactical awareness'],
          sailorExperience: 'Intermediate',
          boatClass: 'J/24',
          venue: 'San Francisco Bay',
          coachingFocus: 'speed',
        }
      );

      setCurrentAdvice(advice);
      setSessionData(prev => ({
        ...prev,
        adviceCount: prev.adviceCount + 1,
      }));
    } catch (error) {
      console.error('Error generating advice:', error);
    }
  };

  const updateMetrics = async () => {
    try {
      const metrics = await AICoachingAssistant.analyzePerformanceMetrics(
        simulatedConditions,
        simulatedBoatState,
        'J/24',
        { targetSpeed: 6.5, targetHeel: 20 }
      );

      setPerformanceMetrics(metrics);
    } catch (error) {
      console.error('Error updating metrics:', error);
    }
  };

  const dismissAdvice = () => {
    setCurrentAdvice(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Coaching Assistant</Text>
        <Text style={styles.subtitle}>Real-time guidance</Text>
      </View>

      {/* Session Controls */}
      <View style={styles.controls}>
        {!isActive ? (
          <TouchableOpacity style={styles.startButton} onPress={startSession}>
            <Text style={styles.startButtonText}>Start Coaching Session</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.activeControls}>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionDuration}>{formatDuration(sessionData.duration)}</Text>
              <Text style={styles.adviceCount}>{sessionData.adviceCount} insights</Text>
            </View>
            <TouchableOpacity style={styles.endButton} onPress={endSession}>
              <Text style={styles.endButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Live Advice */}
      {currentAdvice && (
        <LiveAdviceDisplay advice={currentAdvice} onDismiss={dismissAdvice} />
      )}

      {/* Performance Metrics */}
      {isActive && (
        <ScrollView style={styles.metricsContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.metricsTitle}>Performance Metrics</Text>
          {performanceMetrics.map((metric, index) => (
            <PerformanceMetric key={index} metric={metric} />
          ))}

          {/* Simulated Conditions Display */}
          <View style={styles.conditionsContainer}>
            <Text style={styles.conditionsTitle}>Current Conditions</Text>
            <View style={styles.conditionsGrid}>
              <View style={styles.conditionItem}>
                <Text style={styles.conditionLabel}>Wind</Text>
                <Text style={styles.conditionValue}>
                  {simulatedConditions.windSpeed} kts @ {simulatedConditions.windDirection}°
                </Text>
              </View>
              <View style={styles.conditionItem}>
                <Text style={styles.conditionLabel}>Waves</Text>
                <Text style={styles.conditionValue}>{simulatedConditions.waveHeight}m</Text>
              </View>
              <View style={styles.conditionItem}>
                <Text style={styles.conditionLabel}>Speed</Text>
                <Text style={styles.conditionValue}>{simulatedBoatState.speed} kts</Text>
              </View>
              <View style={styles.conditionItem}>
                <Text style={styles.conditionLabel}>Heel</Text>
                <Text style={styles.conditionValue}>{simulatedBoatState.heel}°</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Demo Notice */}
      <View style={styles.demoNotice}>
        <Text style={styles.demoText}>
          🚧 Demo Mode: Using simulated sensor data and analysis
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  controls: {
    padding: 20,
  },
  startButton: {
    backgroundColor: '#0066CC',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDuration: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00AA33',
  },
  adviceCount: {
    fontSize: 14,
    color: '#666',
  },
  endButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  endButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adviceContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    boxShadow: '0px 2px',
    elevation: 3,
  },
  adviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  adviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  adviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  advicePriority: {
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 8,
  },
  dismissText: {
    fontSize: 18,
    color: '#666',
  },
  adviceMessage: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
    marginBottom: 12,
  },
  actionItems: {
    marginBottom: 12,
  },
  actionItemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  actionItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  adviceReasoning: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  followUpContainer: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  followUpLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0066CC',
    marginBottom: 4,
  },
  followUpText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  metricsContainer: {
    flex: 1,
    padding: 20,
  },
  metricsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  metricContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    boxShadow: '0px 1px',
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  impactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  impactText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  currentValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 12,
  },
  optimalRange: {
    fontSize: 12,
    color: '#666',
  },
  improvement: {
    fontSize: 14,
    color: '#666',
  },
  conditionsContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  conditionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  conditionItem: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  conditionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  conditionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  demoNotice: {
    backgroundColor: '#FFF4E6',
    padding: 12,
    margin: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE5B3',
  },
  demoText: {
    fontSize: 12,
    color: '#B8860B',
    textAlign: 'center',
  },
});