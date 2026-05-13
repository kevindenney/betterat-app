/**
 * Race Day Interface - Mobile-Optimized Real-Time Racing Interface
 * The ultimate "OnX Maps for Sailing" experience - designed for actual race day use
 * Optimized for gloved hands, bright sunlight, and single-handed operation
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Vibration,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import * as KeepAwake from 'expo-keep-awake';
import { type RaceStrategy, type RaceConditions } from '@/services/ai/RaceStrategyEngine';
import { venueDetectionService, type SailingVenue } from '@/services/location/VenueDetectionService';

// Dynamic import helper for expo-location (native only)
let LocationModule: typeof import('expo-location') | null = null;

async function getLocationModule() {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!LocationModule) {
    LocationModule = await import('expo-location');
  }
  return LocationModule;
}

interface RaceTimer {
  startTime: Date | null;
  currentTime: Date;
  raceStarted: boolean;
  timeToStart: number; // seconds
  raceElapsed: number; // seconds
}

interface TacticalAlert {
  id: string;
  type: 'wind_shift' | 'current_change' | 'mark_approach' | 'start_sequence' | 'weather_alert' | 'gps_alert';
  priority: 'critical' | 'important' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  action?: string;
}

interface GPSData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null; // m/s
  heading: number | null; // degrees
  timestamp: number;
}

interface RacePosition {
  distanceToStartLine: number; // meters
  distanceToNextMark: number; // meters
  currentLeg: 'start' | 'beat' | 'reach' | 'run' | 'finish';
  position: number; // estimated position in fleet
  laylineInfo: {
    onPortLayline: boolean;
    onStarboardLayline: boolean;
    distanceToLayline: number;
  };
}

interface RaceDayInterfaceProps {
  strategy?: RaceStrategy;
  onStrategyUpdate?: (strategy: RaceStrategy) => void;
  onEmergencyAlert?: () => void;
}

const { width: screenWidth, height: _screenHeight } = Dimensions.get('window');
const isTablet = screenWidth > 768;

export const RaceDayInterface: React.FC<RaceDayInterfaceProps> = ({
  strategy,
  onStrategyUpdate: _onStrategyUpdate,
  onEmergencyAlert
}) => {
  const [raceTimer, setRaceTimer] = useState<RaceTimer>({
    startTime: null,
    currentTime: new Date(),
    raceStarted: false,
    timeToStart: 600, // 10 minutes default
    raceElapsed: 0
  });

  const [currentConditions, _setCurrentConditions] = useState<RaceConditions | null>(null);
  const [currentVenue, setCurrentVenue] = useState<SailingVenue | null>(null);
  const [tacticalAlerts, setTacticalAlerts] = useState<TacticalAlert[]>([]);
  const [activeView, setActiveView] = useState<'overview' | 'tactical' | 'conditions' | 'gps' | 'emergency'>('overview');
  const [_isRecording, _setIsRecording] = useState(false);
  const [_raceNotes, setRaceNotes] = useState<string[]>([]);
  const [gpsData, setGpsData] = useState<GPSData | null>(null);
  const [racePosition, setRacePosition] = useState<RacePosition | null>(null);
  const [gpsPermission, setGpsPermission] = useState<'granted' | 'denied' | 'pending'>('pending');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertSoundsRef = useRef<{ [key: string]: boolean }>({});

  const addEmergencyAlert = (title: string, message: string, type: TacticalAlert['type']) => {
    const emergencyAlert: TacticalAlert = {
      id: `emergency-${Date.now()}`,
      type,
      priority: 'critical',
      title,
      message,
      timestamp: new Date(),
      acknowledged: false,
      action: 'Review immediately',
    };
    setTacticalAlerts(prev => [emergencyAlert, ...prev].slice(0, 10));
  };

  useEffect(() => {
    // Keep screen awake during race day
    KeepAwake.activateKeepAwake();

    // Hide status bar for maximum screen space
    if (Platform.OS === 'ios') {
      StatusBar.setHidden(true, 'fade');
    }

    // Initialize venue detection
    initializeVenueDetection();

    // Initialize GPS tracking
    initializeGPSTracking();

    // Start race timer
    startRaceTimer();

    // Generate initial tactical alerts
    generateInitialAlerts();

    return () => {
      KeepAwake.deactivateKeepAwake();
      if (Platform.OS === 'ios') {
        StatusBar.setHidden(false, 'fade');
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeVenueDetection = async () => {
    const initialized = await venueDetectionService.initialize();
    if (initialized) {
      const venue = venueDetectionService.getCurrentVenue();
      setCurrentVenue(venue);

      if (venue) {
        addTacticalAlert({
          type: 'info',
          priority: 'info',
          title: `📍 Venue Detected`,
          message: `Racing at ${venue.name}. Local conditions and intelligence loaded.`,
          action: 'View Local Knowledge'
        });
      }
    }
  };

  const initializeGPSTracking = async () => {
    const Location = await getLocationModule();
    if (!Location) {
      setGpsPermission('denied');
      addTacticalAlert({
        type: 'gps_alert',
        priority: 'important',
        title: '📍 GPS Not Available',
        message: 'GPS tracking is not available on web platform.',
      });
      return;
    }

    try {
      // Request permission for location access
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        setGpsPermission('granted');

        // Start GPS tracking with high accuracy for race day
        const locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000, // Update every second
            distanceInterval: 1, // Update every meter
          },
          (location) => {
            const newGpsData: GPSData = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              altitude: location.coords.altitude,
              accuracy: location.coords.accuracy,
              speed: location.coords.speed,
              heading: location.coords.heading,
              timestamp: location.timestamp,
            };

            setGpsData(newGpsData);
            updateRacePosition(newGpsData);
          }
        );

        addTacticalAlert({
          type: 'gps_alert',
          priority: 'info',
          title: '🛰️ GPS Active',
          message: 'High-precision GPS tracking enabled for race navigation.',
        });

        // Store subscription for cleanup
        return () => {
          locationSubscription.remove();
        };
      } else {
        setGpsPermission('denied');
        addTacticalAlert({
          type: 'gps_alert',
          priority: 'important',
          title: '📍 GPS Permission Required',
          message: 'Enable location access for precise race tracking and navigation.',
          action: 'Enable GPS'
        });
      }
    } catch (error) {
      console.error('GPS initialization error:', error);
      addTacticalAlert({
        type: 'gps_alert',
        priority: 'important',
        title: '⚠️ GPS Error',
        message: 'Unable to initialize GPS tracking. Racing in offline mode.',
      });
    }
  };

  const updateRacePosition = (_gps: GPSData) => {
    // Calculate race position based on GPS and strategy
    if (strategy && currentVenue) {
      // Mock calculation - in real implementation, this would use course marks and strategy
      const mockPosition: RacePosition = {
        distanceToStartLine: Math.random() * 500,
        distanceToNextMark: Math.random() * 1000,
        currentLeg: raceTimer.raceStarted ? 'beat' : 'start',
        position: Math.floor(Math.random() * 20) + 1,
        laylineInfo: {
          onPortLayline: Math.random() > 0.8,
          onStarboardLayline: Math.random() > 0.8,
          distanceToLayline: Math.random() * 200,
        }
      };

      setRacePosition(mockPosition);

      // Generate tactical alerts based on position
      if (mockPosition.laylineInfo.onPortLayline && !alertSoundsRef.current['port_layline']) {
        addTacticalAlert({
          type: 'mark_approach',
          priority: 'important',
          title: '🏁 Port Layline',
          message: 'On port layline to mark. Consider tacking.',
        });
        alertSoundsRef.current['port_layline'] = true;
        Vibration.vibrate(100);
      }

      if (mockPosition.distanceToStartLine < 50 && !raceTimer.raceStarted && !alertSoundsRef.current['start_line_close']) {
        addTacticalAlert({
          type: 'start_sequence',
          priority: 'critical',
          title: '⚠️ Start Line Proximity',
          message: 'Very close to start line. Monitor for early start.',
        });
        alertSoundsRef.current['start_line_close'] = true;
        Vibration.vibrate([100, 50, 100]);
      }
    }
  };

  const startRaceTimer = () => {
    timerRef.current = setInterval(() => {
      const now = new Date();
      setRaceTimer(prev => {
        const newTimer = { ...prev, currentTime: now };

        if (prev.startTime && !prev.raceStarted) {
          const timeToStart = Math.max(0, Math.floor((prev.startTime.getTime() - now.getTime()) / 1000));
          newTimer.timeToStart = timeToStart;

          // Start sequence alerts
          if (timeToStart === 300 && !alertSoundsRef.current['5min']) {
            addStartSequenceAlert('5 Minutes to Start', 'Prepare for start sequence');
            alertSoundsRef.current['5min'] = true;
          } else if (timeToStart === 60 && !alertSoundsRef.current['1min']) {
            addStartSequenceAlert('1 Minute Warning', 'Final approach to start line');
            alertSoundsRef.current['1min'] = true;
          } else if (timeToStart === 0 && !alertSoundsRef.current['start']) {
            addStartSequenceAlert('🏁 START!', 'Race is on! Execute strategy.');
            newTimer.raceStarted = true;
            alertSoundsRef.current['start'] = true;
            Vibration.vibrate([100, 50, 100, 50, 100]);
          }
        }

        if (prev.raceStarted && prev.startTime) {
          newTimer.raceElapsed = Math.floor((now.getTime() - prev.startTime.getTime()) / 1000);
        }

        return newTimer;
      });
    }, 1000);
  };

  const addStartSequenceAlert = (title: string, message: string) => {
    addTacticalAlert({
      type: 'start_sequence',
      priority: 'critical',
      title,
      message,
    });
    Vibration.vibrate(200);
  };

  const addTacticalAlert = (alert: Omit<TacticalAlert, 'id' | 'timestamp' | 'acknowledged'>) => {
    const newAlert: TacticalAlert = {
      ...alert,
      id: `alert_${Date.now()}`,
      timestamp: new Date(),
      acknowledged: false
    };

    setTacticalAlerts(prev => [newAlert, ...prev].slice(0, 10)); // Keep last 10 alerts
  };

  const acknowledgeAlert = (alertId: string) => {
    setTacticalAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  };

  const generateInitialAlerts = () => {
    // Sample tactical alerts based on strategy
    if (strategy) {
      addTacticalAlert({
        type: 'info',
        priority: 'important',
        title: '🧠 Strategy Loaded',
        message: `Strategy ready: ${strategy.strategy.overallApproach.slice(0, 50)}...`,
        action: 'View Full Strategy'
      });

      if (strategy.strategy.startStrategy) {
        addTacticalAlert({
          type: 'info',
          priority: 'important',
          title: '🏁 Start Plan',
          message: strategy.strategy.startStrategy.action,
          action: 'Review Start Strategy'
        });
      }
    }
  };

  const setStartTime = (minutesToStart: number) => {
    const startTime = new Date(Date.now() + (minutesToStart * 60 * 1000));
    setRaceTimer(prev => ({
      ...prev,
      startTime,
      timeToStart: minutesToStart * 60,
      raceStarted: false
    }));

    addTacticalAlert({
      type: 'start_sequence',
      priority: 'important',
      title: '⏰ Start Time Set',
      message: `Race starts at ${startTime.toLocaleTimeString()}`,
    });

    // Reset alert flags
    alertSoundsRef.current = {};
  };

  const addRaceNote = (note: string) => {
    const timestamp = raceTimer.raceStarted
      ? `T+${Math.floor(raceTimer.raceElapsed / 60)}:${String(raceTimer.raceElapsed % 60).padStart(2, '0')}`
      : `T-${Math.floor(raceTimer.timeToStart / 60)}:${String(raceTimer.timeToStart % 60).padStart(2, '0')}`;

    const fullNote = `${timestamp}: ${note}`;
    setRaceNotes(prev => [fullNote, ...prev]);

    addTacticalAlert({
      type: 'info',
      priority: 'info',
      title: '📝 Note Added',
      message: fullNote
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getTimerColor = (): string => {
    if (!raceTimer.startTime) return '#666666';
    if (raceTimer.raceStarted) return '#00CC44';
    if (raceTimer.timeToStart <= 60) return '#FF4444';
    if (raceTimer.timeToStart <= 300) return '#FFD700';
    return '#0066CC';
  };

  const getCurrentPhase = (): string => {
    if (!raceTimer.startTime) return 'Pre-Race Setup';
    if (!raceTimer.raceStarted) {
      if (raceTimer.timeToStart > 600) return 'Preparation';
      if (raceTimer.timeToStart > 300) return 'Pre-Start';
      if (raceTimer.timeToStart > 60) return 'Start Sequence';
      return 'Final Approach';
    }

    // Race phases based on elapsed time
    if (raceTimer.raceElapsed < 600) return 'First Beat';
    if (raceTimer.raceElapsed < 1200) return 'First Run';
    if (raceTimer.raceElapsed < 1800) return 'Second Beat';
    return 'Final Leg';
  };

  const renderOverviewScreen = () => (
    <View style={styles.screenContainer}>
      {/* Main Timer Display */}
      <View style={[styles.timerContainer, { borderColor: getTimerColor() }]}>
        <Text style={[styles.timerText, { color: getTimerColor() }]}>
          {raceTimer.startTime
            ? formatTime(raceTimer.raceStarted ? raceTimer.raceElapsed : raceTimer.timeToStart)
            : '--:--'
          }
        </Text>
        <Text style={styles.phaseText}>
          {getCurrentPhase()}
        </Text>
        {currentVenue && (
          <Text style={styles.venueText}>
            📍 {currentVenue.name}
          </Text>
        )}
      </View>

      {/* Tactical Summary */}
      {strategy && (
        <View style={styles.tacticalSummary}>
          <Text style={styles.summaryTitle}>🎯 Current Focus</Text>
          <Text style={styles.summaryText}>
            {getCurrentPhase() === 'First Beat' && strategy.strategy.beatStrategy[0]?.action}
            {getCurrentPhase() === 'Start Sequence' && strategy.strategy.startStrategy.action}
            {getCurrentPhase() === 'Preparation' && 'Review strategy and prepare boat'}
            {!['First Beat', 'Start Sequence', 'Preparation'].includes(getCurrentPhase()) && 'Execute race plan'}
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={[styles.quickActionButton, styles.startButton]}
          onPress={() => setStartTime(10)}
        >
          <Ionicons name="flag" size={32} color="white" />
          <Text style={styles.quickActionText}>10 Min Start</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionButton, styles.noteButton]}
          onPress={() => addRaceNote('Manual observation')}
        >
          <Ionicons name="create" size={32} color="white" />
          <Text style={styles.quickActionText}>Add Note</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionButton, styles.tacticalButton]}
          onPress={() => setActiveView('tactical')}
        >
          <Ionicons name="compass" size={32} color="white" />
          <Text style={styles.quickActionText}>Tactical</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionButton, styles.emergencyButton]}
          onPress={() => {
            setActiveView('emergency');
            onEmergencyAlert?.();
          }}
        >
          <Ionicons name="warning" size={32} color="white" />
          <Text style={styles.quickActionText}>Emergency</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTacticalScreen = () => (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>🧭 Tactical Intelligence</Text>

      {strategy && (
        <View style={styles.tacticalContent}>
          <View style={styles.tacticalCard}>
            <Text style={styles.cardTitle}>Current Strategy</Text>
            <Text style={styles.cardText}>
              {getCurrentPhase() === 'First Beat' && strategy.strategy.beatStrategy[0]?.rationale}
              {getCurrentPhase() === 'Start Sequence' && strategy.strategy.startStrategy.rationale}
              {getCurrentPhase() === 'Preparation' && strategy.strategy.overallApproach}
            </Text>
          </View>

          {currentVenue && (
            <View style={styles.tacticalCard}>
              <Text style={styles.cardTitle}>Local Knowledge</Text>
              <Text style={styles.cardText}>
                {currentVenue.localKnowledge.expertTips[0] || 'No specific tips available'}
              </Text>
            </View>
          )}

          <View style={styles.tacticalCard}>
            <Text style={styles.cardTitle}>Next Action</Text>
            <Text style={styles.cardText}>
              Execute current phase strategy and monitor conditions
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderConditionsScreen = () => (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>🌊 Conditions</Text>

      <View style={styles.conditionsGrid}>
        <View style={styles.conditionCard}>
          <Text style={styles.conditionLabel}>Wind</Text>
          <Text style={styles.conditionValue}>
            {currentConditions?.wind.speed || '--'} kt
          </Text>
          <Text style={styles.conditionDirection}>
            {currentConditions?.wind.direction || '--'}°
          </Text>
        </View>

        <View style={styles.conditionCard}>
          <Text style={styles.conditionLabel}>Current</Text>
          <Text style={styles.conditionValue}>
            {currentConditions?.current.speed || '--'} kt
          </Text>
          <Text style={styles.conditionDirection}>
            {currentConditions?.current.tidePhase || '--'}
          </Text>
        </View>

        <View style={styles.conditionCard}>
          <Text style={styles.conditionLabel}>Waves</Text>
          <Text style={styles.conditionValue}>
            {currentConditions?.waves.height || '--'} m
          </Text>
          <Text style={styles.conditionDirection}>
            {currentConditions?.waves.period || '--'}s
          </Text>
        </View>

        <View style={styles.conditionCard}>
          <Text style={styles.conditionLabel}>Risk</Text>
          <Text style={styles.conditionValue}>
            {currentConditions?.weatherRisk || 'Unknown'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderGPSScreen = () => (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>🛰️ GPS Navigation</Text>

      {gpsPermission === 'denied' && (
        <View style={styles.gpsWarning}>
          <Ionicons name="warning" size={48} color="#FF8000" />
          <Text style={styles.warningText}>GPS Access Required</Text>
          <Text style={styles.warningSubtext}>
            Enable location permissions for race navigation and position tracking.
          </Text>
          <TouchableOpacity
            style={styles.enableGpsButton}
            onPress={initializeGPSTracking}
          >
            <Text style={styles.enableGpsText}>Enable GPS</Text>
          </TouchableOpacity>
        </View>
      )}

      {gpsPermission === 'granted' && gpsData && (
        <View style={styles.gpsContent}>
          {/* GPS Status */}
          <View style={styles.gpsStatusCard}>
            <Text style={styles.gpsStatusTitle}>📡 GPS Status</Text>
            <Text style={styles.gpsStatusText}>
              Accuracy: {gpsData.accuracy?.toFixed(1) || '--'}m
            </Text>
            <Text style={styles.gpsStatusText}>
              Speed: {gpsData.speed ? (gpsData.speed * 1.944).toFixed(1) : '--'} kts
            </Text>
            <Text style={styles.gpsStatusText}>
              Heading: {gpsData.heading?.toFixed(0) || '--'}°
            </Text>
          </View>

          {/* Race Position */}
          {racePosition && (
            <View style={styles.racePositionCard}>
              <Text style={styles.racePositionTitle}>🏁 Race Position</Text>
              <View style={styles.positionGrid}>
                <View style={styles.positionItem}>
                  <Text style={styles.positionLabel}>Fleet Position</Text>
                  <Text style={styles.positionValue}>#{racePosition.position}</Text>
                </View>
                <View style={styles.positionItem}>
                  <Text style={styles.positionLabel}>Current Leg</Text>
                  <Text style={styles.positionValue}>{racePosition.currentLeg.toUpperCase()}</Text>
                </View>
                <View style={styles.positionItem}>
                  <Text style={styles.positionLabel}>To Start Line</Text>
                  <Text style={styles.positionValue}>{racePosition.distanceToStartLine.toFixed(0)}m</Text>
                </View>
                <View style={styles.positionItem}>
                  <Text style={styles.positionLabel}>To Next Mark</Text>
                  <Text style={styles.positionValue}>{racePosition.distanceToNextMark.toFixed(0)}m</Text>
                </View>
              </View>
            </View>
          )}

          {/* Layline Information */}
          {racePosition?.laylineInfo && (
            <View style={styles.laylineCard}>
              <Text style={styles.laylineTitle}>🧭 Layline Info</Text>
              <View style={styles.laylineStatus}>
                <View style={[styles.laylineIndicator, racePosition.laylineInfo.onPortLayline && styles.laylineActive]}>
                  <Text style={styles.laylineText}>Port Layline</Text>
                </View>
                <View style={[styles.laylineIndicator, racePosition.laylineInfo.onStarboardLayline && styles.laylineActive]}>
                  <Text style={styles.laylineText}>Starboard Layline</Text>
                </View>
              </View>
              <Text style={styles.laylineDistance}>
                Distance to layline: {racePosition.laylineInfo.distanceToLayline.toFixed(0)}m
              </Text>
            </View>
          )}

          {/* GPS Coordinates */}
          <View style={styles.coordinatesCard}>
            <Text style={styles.coordinatesTitle}>📍 Coordinates</Text>
            <Text style={styles.coordinatesText}>
              Lat: {gpsData.latitude.toFixed(6)}°
            </Text>
            <Text style={styles.coordinatesText}>
              Lon: {gpsData.longitude.toFixed(6)}°
            </Text>
            {gpsData.altitude && (
              <Text style={styles.coordinatesText}>
                Alt: {gpsData.altitude.toFixed(1)}m
              </Text>
            )}
          </View>
        </View>
      )}

      {gpsPermission === 'pending' && (
        <View style={styles.gpsLoading}>
          <Text style={styles.loadingText}>Initializing GPS...</Text>
        </View>
      )}
    </View>
  );

  const renderEmergencyScreen = () => (
    <View style={[styles.screenContainer, styles.emergencyContainer]}>
      <Text style={styles.emergencyTitle}>⚠️ EMERGENCY</Text>

      <View style={styles.emergencyActions}>
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => {
            addEmergencyAlert('Emergency Call Triggered', 'Initiating emergency contact workflow.', 'weather_alert');
            onEmergencyAlert?.();
            const emergencyNumber = Platform.OS === 'ios' ? 'tel://911' : 'tel:911';
            void Linking.openURL(emergencyNumber);
          }}
        >
          <Ionicons name="call" size={48} color="white" />
          <Text style={styles.emergencyButtonText}>Call Emergency</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => {
            addEmergencyAlert('Man Overboard', 'MOB sequence initiated. Alerting crew and marking position.', 'gps_alert');
            setActiveView('gps');
            Vibration.vibrate([0, 400, 200, 400, 200, 400]);
          }}
        >
          <Ionicons name="person" size={48} color="white" />
          <Text style={styles.emergencyButtonText}>Man Overboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => {
            addEmergencyAlert('Race Abandoned', 'Race abandonment signal acknowledged. Return-to-harbor protocol enabled.', 'weather_alert');
            showAlert('Race Abandoned', 'Return to overview and notify fleet communications.');
            setActiveView('overview');
          }}
        >
          <Ionicons name="flag" size={48} color="white" />
          <Text style={styles.emergencyButtonText}>Abandon Race</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setActiveView('overview')}
      >
        <Text style={styles.backButtonText}>Return to Race</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Alerts Bar */}
      {tacticalAlerts.filter(alert => !alert.acknowledged).length > 0 && (
        <View style={styles.alertsContainer}>
          {tacticalAlerts.filter(alert => !alert.acknowledged).slice(0, 2).map(alert => (
            <TouchableOpacity
              key={alert.id}
              style={[styles.alertCard, styles[`${alert.priority}Alert`]]}
              onPress={() => acknowledgeAlert(alert.id)}
            >
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertMessage}>{alert.message}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Main Screen Content */}
      <View style={styles.mainContent}>
        {activeView === 'overview' && renderOverviewScreen()}
        {activeView === 'tactical' && renderTacticalScreen()}
        {activeView === 'conditions' && renderConditionsScreen()}
        {activeView === 'gps' && renderGPSScreen()}
        {activeView === 'emergency' && renderEmergencyScreen()}
      </View>

      {/* Navigation Bar */}
      {activeView !== 'emergency' && (
        <View style={styles.navigationBar}>
          {(['overview', 'tactical', 'conditions', 'gps'] as const).map(view => (
            <TouchableOpacity
              key={view}
              style={[styles.navButton, activeView === view && styles.activeNavButton]}
              onPress={() => setActiveView(view)}
            >
              <Ionicons
                name={
                  view === 'overview' ? 'home' :
                  view === 'tactical' ? 'compass' :
                  view === 'conditions' ? 'cloudy' : 'location'
                }
                size={24}
                color={activeView === view ? '#0066CC' : '#666'}
              />
              <Text style={[
                styles.navButtonText,
                activeView === view && styles.activeNavButtonText
              ]}>
                {view === 'gps' ? 'GPS' : view.charAt(0).toUpperCase() + view.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // High contrast for sunlight
  },
  mainContent: {
    flex: 1,
    padding: isTablet ? 24 : 16,
  },
  screenContainer: {
    flex: 1,
  },

  // Timer Display
  timerContainer: {
    alignItems: 'center',
    padding: isTablet ? 32 : 24,
    marginBottom: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 3,
  },
  timerText: {
    fontSize: isTablet ? 84 : 64,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  phaseText: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '600',
    color: '#CCCCCC',
    marginTop: 8,
  },
  venueText: {
    fontSize: isTablet ? 18 : 16,
    color: '#00FF88',
    marginTop: 4,
  },

  // Tactical Summary
  tacticalSummary: {
    backgroundColor: '#0D1B2A',
    padding: isTablet ? 24 : 20,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#00FF88',
  },
  summaryTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '700',
    color: '#00FF88',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: isTablet ? 18 : 16,
    color: '#FFFFFF',
    lineHeight: isTablet ? 24 : 22,
  },

  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isTablet ? 16 : 12,
    marginTop: 'auto',
  },
  quickActionButton: {
    flex: 1,
    minWidth: isTablet ? 160 : 140,
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px',
    elevation: 8,
  },
  quickActionText: {
    color: 'white',
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#00CC44',
  },
  noteButton: {
    backgroundColor: '#0066CC',
  },
  tacticalButton: {
    backgroundColor: '#FF8000',
  },
  emergencyButton: {
    backgroundColor: '#FF4444',
  },

  // Screen Titles
  screenTitle: {
    fontSize: isTablet ? 32 : 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },

  // Tactical Screen
  tacticalContent: {
    gap: 16,
  },
  tacticalCard: {
    backgroundColor: '#1A1A1A',
    padding: isTablet ? 24 : 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00FF88',
  },
  cardTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '700',
    color: '#00FF88',
    marginBottom: 12,
  },
  cardText: {
    fontSize: isTablet ? 18 : 16,
    color: '#FFFFFF',
    lineHeight: isTablet ? 24 : 22,
  },

  // Conditions Screen
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isTablet ? 16 : 12,
  },
  conditionCard: {
    flex: 1,
    minWidth: isTablet ? 160 : 140,
    backgroundColor: '#1A1A1A',
    padding: isTablet ? 24 : 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  conditionLabel: {
    fontSize: isTablet ? 16 : 14,
    color: '#CCCCCC',
    marginBottom: 8,
  },
  conditionValue: {
    fontSize: isTablet ? 32 : 28,
    fontWeight: '900',
    color: '#00FF88',
  },
  conditionDirection: {
    fontSize: isTablet ? 16 : 14,
    color: '#CCCCCC',
    marginTop: 4,
  },

  // Emergency Screen
  emergencyContainer: {
    backgroundColor: '#330000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isTablet ? 32 : 24,
  },
  emergencyTitle: {
    fontSize: isTablet ? 48 : 40,
    fontWeight: '900',
    color: '#FF4444',
    textAlign: 'center',
    marginBottom: 48,
  },
  emergencyActions: {
    gap: 24,
    alignItems: 'center',
    marginBottom: 48,
  },
  backButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  backButtonText: {
    color: 'white',
    fontSize: isTablet ? 20 : 18,
    fontWeight: '700',
  },
  emergencyButtonText: {
    color: 'white',
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },

  // Alerts
  alertsContainer: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  alertCard: {
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  criticalAlert: {
    backgroundColor: '#4D1A1A',
    borderLeftColor: '#FF4444',
  },
  importantAlert: {
    backgroundColor: '#1A2A4D',
    borderLeftColor: '#0066CC',
  },
  infoAlert: {
    backgroundColor: '#1A4D1A',
    borderLeftColor: '#00CC44',
  },
  alertTitle: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  alertMessage: {
    fontSize: isTablet ? 14 : 12,
    color: '#CCCCCC',
    marginTop: 2,
  },

  // GPS Screen
  gpsWarning: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  warningText: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '700',
    color: '#FF8000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  warningSubtext: {
    fontSize: isTablet ? 18 : 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  enableGpsButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  enableGpsText: {
    color: 'white',
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
  },
  gpsContent: {
    gap: 16,
  },
  gpsStatusCard: {
    backgroundColor: '#1A1A1A',
    padding: isTablet ? 20 : 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00FF88',
  },
  gpsStatusTitle: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    color: '#00FF88',
    marginBottom: 12,
  },
  gpsStatusText: {
    fontSize: isTablet ? 16 : 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  racePositionCard: {
    backgroundColor: '#1A1A1A',
    padding: isTablet ? 20 : 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC',
  },
  racePositionTitle: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    color: '#0066CC',
    marginBottom: 12,
  },
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  positionItem: {
    flex: 1,
    minWidth: isTablet ? 120 : 100,
    alignItems: 'center',
  },
  positionLabel: {
    fontSize: isTablet ? 14 : 12,
    color: '#CCCCCC',
    marginBottom: 4,
  },
  positionValue: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  laylineCard: {
    backgroundColor: '#1A1A1A',
    padding: isTablet ? 20 : 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF8000',
  },
  laylineTitle: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    color: '#FF8000',
    marginBottom: 12,
  },
  laylineStatus: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  laylineIndicator: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#333333',
    alignItems: 'center',
  },
  laylineActive: {
    backgroundColor: '#FF8000',
  },
  laylineText: {
    fontSize: isTablet ? 14 : 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  laylineDistance: {
    fontSize: isTablet ? 14 : 12,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  coordinatesCard: {
    backgroundColor: '#1A1A1A',
    padding: isTablet ? 20 : 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#CCCCCC',
  },
  coordinatesTitle: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    color: '#CCCCCC',
    marginBottom: 12,
  },
  coordinatesText: {
    fontSize: isTablet ? 16 : 14,
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  gpsLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: isTablet ? 20 : 18,
    color: '#CCCCCC',
  },

  // Navigation
  navigationBar: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeNavButton: {
    backgroundColor: '#0D1B2A',
    borderRadius: 8,
  },
  navButtonText: {
    fontSize: isTablet ? 14 : 10,
    color: '#666',
    marginTop: 4,
    fontWeight: '600',
  },
  activeNavButtonText: {
    color: '#0066CC',
  },
});

export default RaceDayInterface;
