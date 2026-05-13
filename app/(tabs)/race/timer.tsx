import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Animated, Platform } from 'react-native';
import { showAlert, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { router } from 'expo-router';
import {
  Play,
  Pause,
  Square,
  MapPin,
  Clock,
  Trophy,
  Wind,
  Thermometer,
  Navigation,
  Users,
  MessageCircle,
  ChevronLeft,
  Send,
  Mic,
  RotateCcw,
  Flag,
  Timer,
  Activity,
  Compass,
  BarChart3,
  Radio,
  Settings,
  Bell,
} from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { RaceAnalysisService } from '@/services/RaceAnalysisService';
import { SmartRaceCoach } from '@/components/coaching/SmartRaceCoach';
import { QuickSkillButtons } from '@/components/coaching/QuickSkillButtons';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';

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

const RaceTimerProScreen = () => {
  const { user } = useAuth();
  const [timer, setTimer] = useState(300); // 5 minutes in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [raceData, setRaceData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('timer');
  const [aiResponses, setAiResponses] = useState<any[]>([]);
  const [userResponse, setUserResponse] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const windAnimation = useRef(new Animated.Value(0)).current;

  // GPS tracking state
  const [gpsTracking, setGpsTracking] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [gpsData, setGpsData] = useState({
    latitude: 0,
    longitude: 0,
    speed: 0,
    heading: 0,
    accuracy: 0,
  });
  const [gpsTrackPoints, setGpsTrackPoints] = useState<any[]>([]);
  const locationSubscription = useRef<any | null>(null);

  // Database state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [analyzingRace, setAnalyzingRace] = useState(false);

  // Performance tracking state
  const [performanceData, setPerformanceData] = useState({
    topSpeed: 0,
    avgSpeed: 0,
    distance: 0,
    tacks: 0,
    gybes: 0,
    vmg: 0
  });

  // Communication state
  const [crewMessages, setCrewMessages] = useState<any[]>([
    { id: 1, sender: 'Skipper', message: 'Tack in 30 seconds', time: '14:02:15', priority: 'high' },
    { id: 2, sender: 'Crew', message: 'Ready to tack', time: '14:02:45', priority: 'normal' }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [crewChannelActive, setCrewChannelActive] = useState(true);

  // Wind conditions (static mock data; no live update path yet)
  const windData = {
    speed: 12,
    direction: 315,
    gusts: 15,
    pressure: 1013,
  };

  // Mock race data
  const mockRaceData = {
    id: 'RACE-2023-001',
    name: 'RHKYC Spring Series R1',
    venue: 'Royal Hong Kong Yacht Club',
    boatClass: 'Dragon Class',
    date: 'June 15, 2023',
    fleetSize: 24,
    position: 3,
    elapsedTime: '48:22',
    correctedTime: '52:15',
    conditions: {
      windSpeed: '12-15 knots',
      windDirection: 'NW',
      temperature: '18°C',
      waterTemp: '14°C',
      visibility: '10 km',
      tide: 'Incoming',
    }
  };

  // AI questions for post-race analysis
  const aiQuestions = [
    {
      id: 1,
      question: "How was your start compared to your competitors?",
      type: "text"
    },
    {
      id: 2,
      question: "Did you experience any equipment issues during the race?",
      type: "boolean"
    },
    {
      id: 3,
      question: "Which tactical decisions proved most effective?",
      type: "text"
    },
    {
      id: 4,
      question: "How did the wind conditions change during the race?",
      type: "text"
    }
  ];

  // Start wind animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(windAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(windAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
    // windAnimation is a useRef-backed Animated.Value with stable identity; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request location permissions
  const requestLocationPermission = async () => {
    const Location = await getLocationModule();
    if (!Location) {
      return false;
    }

    try {
      // Request foreground permission first
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        showAlert(
          'Permission Required',
          'GPS tracking requires location permission for accurate race data.'
        );
        return false;
      }

      // Request background permission (for Android)
      if (Platform.OS === 'android') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          showAlert(
            'Background Location',
            'Background location permission will improve GPS tracking during races.'
          );
        }
      }

      setLocationPermissionGranted(true);
      return true;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      showAlert('Error', 'Failed to request location permission');
      return false;
    }
  };

  // Start GPS tracking
  const startGPSTracking = async () => {
    const Location = await getLocationModule();
    if (!Location) return;

    try {
      // Stop any existing subscription
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      // Start watching position
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or when moved 10 meters
        },
        (location) => {
          const trackPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date(location.timestamp).toISOString(),
            speed: location.coords.speed || 0,
            heading: location.coords.heading || 0,
            altitude: location.coords.altitude || 0,
            accuracy: location.coords.accuracy || 0,
          };

          // Update current GPS data
          setGpsData({
            latitude: trackPoint.latitude,
            longitude: trackPoint.longitude,
            speed: trackPoint.speed,
            heading: trackPoint.heading,
            accuracy: trackPoint.accuracy,
          });

          // Add to track points array
          setGpsTrackPoints(prev => [...prev, trackPoint]);

          // Update performance data
          setPerformanceData(prev => ({
            ...prev,
            topSpeed: Math.max(prev.topSpeed, trackPoint.speed * 1.944), // Convert m/s to knots
            avgSpeed: prev.avgSpeed || trackPoint.speed * 1.944,
          }));
        }
      );

      locationSubscription.current = subscription;
      setGpsTracking(true);
    } catch (error) {
      console.error('Error starting GPS tracking:', error);
      showAlert('GPS Error', 'Failed to start GPS tracking. Race will be recorded without GPS data.');
    }
  };

  // Stop GPS tracking
  const stopGPSTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setGpsTracking(false);
  };

  // Create race timer session in database
  const createTimerSession = async () => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const primaryInsert = await supabase
        .from('race_timer_sessions')
        .insert({
          sailor_id: user.id,
          regatta_id: null, // Can be linked to a regatta if known
          start_time: new Date().toISOString(),
          track_points: [],
          wind_direction: windData.direction,
          wind_speed: windData.speed,
        })
        .select()
        .single();

      let { data, error } = primaryInsert;

      if (error && isMissingIdColumn(error, 'race_timer_sessions', 'regatta_id')) {
        const fallbackInsert = await supabase
          .from('race_timer_sessions')
          .insert({
            sailor_id: user.id,
            race_id: null, // Legacy schema support
            start_time: new Date().toISOString(),
            track_points: [],
            wind_direction: windData.direction,
            wind_speed: windData.speed,
          })
          .select()
          .single();

        data = fallbackInsert.data;
        error = fallbackInsert.error;
      }

      if (error) throw error;

      setCurrentSessionId(data.id);
      return data.id;
    } catch (error: any) {
      console.error('Error creating timer session:', error);
      showAlert('Database Error', 'Failed to create race session. GPS data will not be saved.');
      return null;
    }
  };

  // Update race timer session with GPS data and end time
  const updateTimerSession = async (sessionId: string) => {
    try {
      setSavingSession(true);

      const { error } = await supabase
        .from('race_timer_sessions')
        .update({
          end_time: new Date().toISOString(),
          track_points: gpsTrackPoints,
          position: performanceData.tacks > 0 ? 3 : null, // Mock position
          fleet_size: 24, // Mock fleet size
        })
        .eq('id', sessionId);

      if (error) throw error;

      return true;
    } catch (error: any) {
      console.error('Error updating timer session:', error);
      showAlert('Save Error', 'Failed to save GPS track data.');
      return false;
    } finally {
      setSavingSession(false);
    }
  };

  // Trigger AI race analysis
  const triggerRaceAnalysis = async (sessionId: string) => {
    try {
      setAnalyzingRace(true);

      const analysis = await RaceAnalysisService.analyzeRaceSession(sessionId);

      if (analysis) {
        showAlert(
          'Analysis Complete',
          'AI analysis ready. View it in the Analysis tab.'
        );
      } else {
        console.error('Race analysis failed: no analysis returned');
      }
    } catch (error: any) {
      console.error('Error triggering race analysis:', error);
      // Don't show error to user - analysis is optional
    } finally {
      setAnalyzingRace(false);
    }
  };

  // Start the timer and GPS tracking
  const startTimer = async () => {
    if (timer <= 0) return;

    // Request location permission if not granted
    if (!locationPermissionGranted) {
      const granted = await requestLocationPermission();
      if (!granted) {
        showAlertWithButtons(
          'Start Without GPS?',
          'GPS tracking is recommended for race analysis. Start anyway?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Start Anyway',
              onPress: () => {
                setIsRunning(true);
                startTimerCountdown();
              }
            }
          ]
        );
        return;
      }
    }

    // Create database session (id captured server-side; we don't track it locally yet)
    await createTimerSession();

    // Start GPS tracking
    if (locationPermissionGranted) {
      await startGPSTracking();
    }

    // Start timer countdown
    setIsRunning(true);
    startTimerCountdown();
  };

  // Timer countdown logic
  const startTimerCountdown = () => {
    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current as ReturnType<typeof setInterval>);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Pause the timer
  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsRunning(false);
  };

  // Stop the timer and complete the race
  const stopTimer = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsRunning(false);
    setIsCompleted(true);

    // Stop GPS tracking
    stopGPSTracking();

    // Update database with final GPS data
    if (currentSessionId) {
      const saved = await updateTimerSession(currentSessionId);

      if (saved && gpsTrackPoints.length > 0) {
        // Trigger AI analysis in background
        triggerRaceAnalysis(currentSessionId);
      }
    }

    // Set race data for display
    setRaceData(mockRaceData);
    setActiveTab('analysis');

    // Calculate final performance metrics
    if (gpsTrackPoints.length > 0) {
      const speeds = gpsTrackPoints.map(p => p.speed * 1.944); // Convert to knots
      const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

      setPerformanceData(prev => ({
        ...prev,
        avgSpeed: parseFloat(avgSpeed.toFixed(1)),
        distance: parseFloat((avgSpeed * (timer / 3600)).toFixed(1)), // Rough distance calculation
      }));
    }
  };

  // Reset the timer
  const resetTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Stop GPS tracking if active
    stopGPSTracking();

    // Reset all state
    setTimer(300);
    setIsRunning(false);
    setIsCompleted(false);
    setRaceData(null);
    setAiResponses([]);
    setCurrentSessionId(null);
    setGpsTrackPoints([]);
    setGpsData({
      latitude: 0,
      longitude: 0,
      speed: 0,
      heading: 0,
      accuracy: 0,
    });
    setPerformanceData({
      topSpeed: 0,
      avgSpeed: 0,
      distance: 0,
      tacks: 0,
      gybes: 0,
      vmg: 0
    });
  };

  // Submit AI response
  const submitResponse = (questionId: number, response: string) => {
    const newResponse = {
      questionId,
      response,
      timestamp: new Date().toISOString(),
      sender: "" // User response
    };
    
    setAiResponses([...aiResponses, newResponse]);
    setUserResponse('');
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        questionId: questionId + 100, // Different ID for AI response
        response: "That's a great observation. Consider reviewing your starting line approach in the video analysis.",
        sender: "AI",
        timestamp: new Date().toISOString()
      };
      setAiResponses(prev => [...prev, aiResponse]);
    }, 1000);
  };

  // Send crew message
  const sendCrewMessage = () => {
    if (!newMessage.trim()) return;
    
    const message = {
      id: crewMessages.length + 1,
      sender: 'You',
      message: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      priority: 'normal'
    };
    
    setCrewMessages([...crewMessages, message]);
    setNewMessage('');
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Stop GPS tracking
      stopGPSTracking();
    };
  }, []);

  const renderTimer = () => (
    <ScrollView className="flex-1" contentContainerClassName="items-center px-4 py-6">
      {/* Timer Circle */}
      <View className="w-64 h-64 rounded-full bg-white shadow-lg items-center justify-center mb-6 border-4 border-blue-100">
        <Text className="text-gray-600 text-lg mb-1">Race Countdown</Text>
        <Text className={`text-5xl font-bold ${timer <= 60 ? 'text-red-500' : 'text-blue-600'}`}>
          {formatTime(timer)}
        </Text>
        <Text className="text-gray-500 mt-2">
          {isCompleted ? 'Race Completed' : isRunning ? 'Race in Progress' : 'Ready to Start'}
        </Text>
      </View>

      {/* Wind Visualization */}
      <View className="w-full bg-white rounded-xl p-4 mb-6 shadow">
        <View className="flex-row items-center mb-3">
          <Wind color="#2563EB" size={24} />
          <Text className="text-lg font-bold text-gray-800 ml-2">Wind Conditions</Text>
        </View>
        
        <View className="flex-row justify-between items-center">
          <View className="items-center">
            <Text className="text-gray-600">Speed</Text>
            <Text className="text-2xl font-bold text-blue-600">{windData.speed} kn</Text>
          </View>
          
          <View className="items-center">
            <Text className="text-gray-600">Direction</Text>
            <View className="flex-row items-center">
              <Navigation 
                color="#2563EB" 
                size={20} 
                style={{ transform: [{ rotate: `${windData.direction}deg` }] }} 
              />
              <Text className="text-xl font-bold text-gray-800 ml-1">{windData.direction}°</Text>
            </View>
          </View>
          
          <View className="items-center">
            <Text className="text-gray-600">Gusts</Text>
            <Text className="text-2xl font-bold text-yellow-600">{windData.gusts} kn</Text>
          </View>
        </View>
        
        {/* Animated Wind Indicator */}
        <View className="mt-4 h-8 flex-row items-center">
          <Animated.View
            style={{
              transform: [
                {
                  translateX: windAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 20],
                  }),
                },
              ],
            }}
          >
            <Wind color="#94A3B8" size={24} />
          </Animated.View>
          <View className="h-1 bg-gray-200 flex-1 mx-2 rounded-full">
            <Animated.View 
              className="h-1 bg-blue-500 rounded-full"
              style={{
                width: windAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }}
            />
          </View>
          <Wind color="#94A3B8" size={24} />
        </View>
      </View>

      {/* GPS Tracking Status */}
      <View className={`px-4 py-3 rounded-xl mb-6 ${gpsTracking ? 'bg-green-50 border border-green-200' : 'bg-gray-100'}`}>
        <View className="flex-row items-center mb-2">
          <MapPin color={gpsTracking ? '#10B981' : '#6B7280'} size={20} />
          <Text className={`ml-2 font-medium ${gpsTracking ? 'text-green-800' : 'text-gray-600'}`}>
            {gpsTracking ? 'GPS Tracking Active' : 'GPS Inactive'}
          </Text>
        </View>
        {gpsTracking && (
          <View className="mt-2 space-y-1">
            <Text className="text-xs text-gray-600">
              Track Points: {gpsTrackPoints.length} • Accuracy: ±{gpsData.accuracy.toFixed(0)}m
            </Text>
            {gpsData.latitude !== 0 && (
              <Text className="text-xs text-gray-600">
                {gpsData.latitude.toFixed(6)}, {gpsData.longitude.toFixed(6)}
              </Text>
            )}
          </View>
        )}
        {savingSession && (
          <Text className="text-xs text-blue-600 mt-2">Saving GPS track...</Text>
        )}
        {analyzingRace && (
          <Text className="text-xs text-purple-600 mt-2">Analyzing race...</Text>
        )}
      </View>

      {/* Performance Metrics */}
      {isRunning && (
        <View className="bg-white rounded-xl p-4 w-11/12 shadow mb-6">
          <Text className="text-lg font-bold text-gray-800 mb-3">Current Performance</Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Activity color="#2563EB" size={24} />
              <Text className="text-gray-600 text-sm mt-1">Speed</Text>
              <Text className="font-bold text-lg">
                {gpsTracking && gpsData.speed > 0
                  ? `${(gpsData.speed * 1.944).toFixed(1)} kn`
                  : '--'}
              </Text>
            </View>
            <View className="items-center">
              <Compass color="#2563EB" size={24} />
              <Text className="text-gray-600 text-sm mt-1">Heading</Text>
              <Text className="font-bold text-lg">
                {gpsTracking && gpsData.heading > 0
                  ? `${Math.round(gpsData.heading)}°`
                  : '--'}
              </Text>
            </View>
            <View className="items-center">
              <Navigation color="#2563EB" size={24} />
              <Text className="text-gray-600 text-sm mt-1">Track Pts</Text>
              <Text className="font-bold text-lg">{gpsTrackPoints.length}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Control Buttons */}
      <View className="flex-row gap-6 mb-6">
        {!isRunning && !isCompleted && (
          <TouchableOpacity 
            className="bg-blue-600 rounded-full p-5 shadow-md"
            onPress={startTimer}
          >
            <Play color="white" size={36} />
          </TouchableOpacity>
        )}
        
        {isRunning && (
          <>
            <TouchableOpacity 
              className="bg-yellow-500 rounded-full p-5 shadow-md"
              onPress={pauseTimer}
            >
              <Pause color="white" size={36} />
            </TouchableOpacity>
            <TouchableOpacity 
              className="bg-red-500 rounded-full p-5 shadow-md"
              onPress={stopTimer}
            >
              <Square color="white" size={36} />
            </TouchableOpacity>
          </>
        )}
        
        {(isCompleted || (!isRunning && timer < 300)) && (
          <TouchableOpacity 
            className="bg-blue-600 rounded-full p-5 shadow-md"
            onPress={resetTimer}
          >
            <RotateCcw color="white" size={36} />
          </TouchableOpacity>
        )}
      </View>

      {/* Race Information */}
      <View className="bg-white rounded-xl p-5 w-11/12 shadow">
        <View className="flex-row justify-between items-start mb-3">
          <View>
            <Text className="text-xl font-bold text-gray-800">RHKYC Spring Series R1</Text>
            <View className="flex-row items-center mt-1">
              <MapPin color="#6B7280" size={16} />
              <Text className="text-gray-600 ml-1 text-sm">Royal Hong Kong Yacht Club</Text>
            </View>
          </View>
          <View className="bg-blue-100 rounded-full px-3 py-1">
            <Text className="text-blue-800 font-bold">Dragon Class</Text>
          </View>
        </View>
        
        <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-100">
          <View className="items-center">
            <Clock color="#2563EB" size={20} />
            <Text className="text-gray-600 text-sm mt-1">Starts</Text>
            <Text className="font-bold">14:00</Text>
          </View>
          <View className="items-center">
            <Users color="#2563EB" size={20} />
            <Text className="text-gray-600 text-sm mt-1">Fleet</Text>
            <Text className="font-bold">24 Boats</Text>
          </View>
          <View className="items-center">
            <Flag color="#2563EB" size={20} />
            <Text className="text-gray-600 text-sm mt-1">Course</Text>
            <Text className="font-bold">Windward</Text>
          </View>
        </View>
      </View>

      {/* AI - Quick Skill Buttons */}
      <View className="w-11/12 mt-6">
        <QuickSkillButtons
          raceData={{
            name: 'RHKYC Spring Series R1',
            startTime: new Date(Date.now() + timer * 1000).toISOString(),
            weather: windData,
          }}
          onSkillInvoked={(_skillId, _advice) => {
          }}
        />
      </View>

      {/* AI - Smart Race Coach (Minimal Mode for Racing) */}
      <View className="w-11/12 mt-4 mb-6">
        <SmartRaceCoach
          raceId="live-race-timer"
          raceData={{
            name: 'RHKYC Spring Series R1',
            startTime: new Date(Date.now() + timer * 1000).toISOString(),
            weather: windData,
          }}
          position={gpsTracking && gpsData.latitude !== 0 ? {
            lat: gpsData.latitude,
            lon: gpsData.longitude,
          } : undefined}
          minimal={true}
          autoRefresh={true}
        />
      </View>
    </ScrollView>
  );

  const renderRaceAnalysis = () => {
    if (!raceData) return null;

    return (
      <View className="flex-1">
        <ScrollView className="flex-1 px-4 py-4">
          {/* Race Header */}
          <View className="bg-blue-50 p-5 rounded-xl mb-4 shadow-sm">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-2xl font-bold text-gray-800">{raceData.name}</Text>
                <Text className="text-gray-600 mt-1">{raceData.venue}</Text>
                <Text className="text-gray-600">{raceData.date}</Text>
              </View>
              <View className="bg-white rounded-full px-4 py-2 items-center shadow">
                <Text className="text-2xl font-bold text-blue-600">#{raceData.position}</Text>
                <Text className="text-gray-600 text-sm">of {raceData.fleetSize}</Text>
              </View>
            </View>
          </View>

          {/* Performance Summary */}
          <View className="bg-white p-5 rounded-xl shadow mb-4">
            <View className="flex-row items-center mb-4">
              <Trophy color="#2563EB" size={24} />
              <Text className="text-lg font-bold text-gray-800 ml-2">Performance Summary</Text>
            </View>
            
            <View className="flex-row justify-between mb-3 pb-3 border-b border-gray-100">
              <Text className="text-gray-600">Elapsed Time</Text>
              <Text className="font-bold text-lg">{raceData.elapsedTime}</Text>
            </View>
            <View className="flex-row justify-between mb-3 pb-3 border-b border-gray-100">
              <Text className="text-gray-600">Corrected Time</Text>
              <Text className="font-bold text-lg">{raceData.correctedTime}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-600">Position</Text>
              <Text className="font-bold text-xl text-blue-600">#{raceData.position} of {raceData.fleetSize}</Text>
            </View>
          </View>

          {/* Performance Metrics */}
          <View className="bg-white p-5 rounded-xl shadow mb-4">
            <View className="flex-row items-center mb-4">
              <BarChart3 color="#2563EB" size={24} />
              <Text className="text-lg font-bold text-gray-800 ml-2">Performance Metrics</Text>
            </View>
            
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-600">Top Speed</Text>
              <Text className="font-bold">{performanceData.topSpeed} knots</Text>
            </View>
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-600">Average Speed</Text>
              <Text className="font-bold">{performanceData.avgSpeed} knots</Text>
            </View>
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-600">Distance Covered</Text>
              <Text className="font-bold">{performanceData.distance} nautical miles</Text>
            </View>
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-600">Tacks</Text>
              <Text className="font-bold">{performanceData.tacks}</Text>
            </View>
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-600">Gybes</Text>
              <Text className="font-bold">{performanceData.gybes}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-600">Velocity Made Good</Text>
              <Text className="font-bold">{performanceData.vmg} knots</Text>
            </View>
          </View>

          {/* Conditions */}
          <View className="flex-row gap-4 mb-4">
            <View className="flex-1 bg-white p-4 rounded-xl shadow items-center">
              <Wind color="#2563EB" size={28} />
              <Text className="text-xl font-bold mt-2">{raceData.conditions.windSpeed}</Text>
              <Text className="text-gray-600 text-center">Wind Speed</Text>
            </View>
            <View className="flex-1 bg-white p-4 rounded-xl shadow items-center">
              <Thermometer color="#2563EB" size={28} />
              <Text className="text-xl font-bold mt-2">{raceData.conditions.temperature}</Text>
              <Text className="text-gray-600 text-center">Air Temp</Text>
            </View>
          </View>

          {/* AI Analysis Questions */}
          <View className="bg-white rounded-xl shadow mb-4">
            <View className="p-4 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-800">Race Analysis</Text>
              <Text className="text-gray-600">Answer these questions to help improve your performance</Text>
            </View>
            
            {aiQuestions.map((question) => (
              <View key={question.id} className="p-4 border-b border-gray-100 last:border-0">
                <Text className="font-medium text-gray-800 mb-3">{question.question}</Text>
                
                {question.type === 'boolean' ? (
                  <View className="flex-row gap-3">
                    <TouchableOpacity className="bg-green-100 px-5 py-3 rounded-full flex-1 items-center">
                      <Text className="text-green-800 font-bold">Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="bg-red-100 px-5 py-3 rounded-full flex-1 items-center">
                      <Text className="text-red-800 font-bold">No</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="flex-row gap-3">
                    <TouchableOpacity className="flex-1 bg-blue-50 py-3 rounded-lg items-center border border-blue-200">
                      <View className="flex-row items-center">
                        <Mic color="#2563EB" size={18} />
                        <Text className="text-blue-600 ml-2">Record</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-1 bg-blue-600 py-3 rounded-lg items-center">
                      <Text className="text-white">Type Response</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* AI Analysis */}
          <View className="bg-white rounded-xl shadow">
            <View className="p-4 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-800">Race Analysis</Text>
              <Text className="text-gray-600">Get feedback on your race performance</Text>
            </View>
            
            <ScrollView className="h-48 p-4 bg-gray-50">
              {aiResponses.length === 0 ? (
                <View className="items-center justify-center h-full">
                  <MessageCircle color="#9CA3AF" size={32} />
                  <Text className="text-gray-500 mt-2 text-center">Ask about your race to get feedback</Text>
                </View>
              ) : (
                aiResponses.map((response, index) => (
                  <View key={index} className={`mb-3 ${response.sender ? 'items-end' : 'items-start'}`}>
                    <View className={`p-3 rounded-lg max-w-[80%] ${response.sender ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Text className={`font-medium ${response.sender ? 'text-blue-800' : 'text-gray-800'}`}>
                        {response.response}
                      </Text>
                      <Text className="text-xs text-gray-500 mt-1">
                        {new Date(response.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            
            <View className="p-4 border-t border-gray-100 flex-row items-center">
              <TextInput
                className="flex-1 bg-gray-100 rounded-full px-4 py-3 mr-2"
                placeholder="Ask about the race..."
                value={userResponse}
                onChangeText={setUserResponse}
              />
              <TouchableOpacity 
                className="bg-blue-600 rounded-full p-3"
                onPress={() => submitResponse(999, userResponse)}
                disabled={!userResponse}
              >
                <Send color="white" size={20} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderCrewCommunication = () => (
    <View className="flex-1">
      <View className="bg-white p-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-bold text-gray-800">Crew Communication</Text>
          <View className="flex-row">
            <TouchableOpacity className="mr-3">
              <Bell color="#2563EB" size={24} />
            </TouchableOpacity>
            <TouchableOpacity>
              <Settings color="#6B7280" size={24} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2 mb-4">
          <Radio color={crewChannelActive ? "#10B981" : "#6B7280"} size={20} />
          <Text className={`ml-2 ${crewChannelActive ? 'text-green-700' : 'text-gray-600'}`}>
            {crewChannelActive ? 'Channel Active' : 'Channel Inactive'}
          </Text>
          <View className="flex-1" />
          <TouchableOpacity 
            className={`px-3 py-1 rounded-full ${crewChannelActive ? 'bg-green-100' : 'bg-gray-200'}`}
            onPress={() => setCrewChannelActive(!crewChannelActive)}
          >
            <Text className={`text-xs font-bold ${crewChannelActive ? 'text-green-800' : 'text-gray-700'}`}>
              {crewChannelActive ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView className="h-96 mb-4">
          {crewMessages.map((msg) => (
            <View key={msg.id} className="mb-3 p-3 rounded-lg bg-white border border-gray-200">
              <View className="flex-row justify-between mb-1">
                <Text className="font-bold text-gray-800">{msg.sender}</Text>
                <Text className="text-xs text-gray-500">{msg.time}</Text>
              </View>
              <Text className={`text-gray-700 ${msg.priority === 'high' ? 'font-bold text-red-600' : ''}`}>
                {msg.message}
              </Text>
            </View>
          ))}
        </ScrollView>
        
        <View className="flex-row">
          <TextInput
            className="flex-1 bg-gray-100 rounded-full px-4 py-3 mr-2"
            placeholder="Message crew..."
            value={newMessage}
            onChangeText={setNewMessage}
          />
          <TouchableOpacity 
            className="bg-blue-600 rounded-full p-3"
            onPress={sendCrewMessage}
          >
            <Send color="white" size={20} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderCoaches = () => (
    <View className="flex-1 p-4">
      <Text className="text-lg font-bold text-gray-800 mb-4">Coach Feedback</Text>
      
      {/* AI Analysis */}
      <View className="bg-white rounded-xl shadow p-5 mb-5">
        <View className="flex-row items-center mb-4">
          <View className="w-14 h-14 rounded-full bg-blue-100 items-center justify-center mr-4">
            <MessageCircle color="#2563EB" size={28} />
          </View>
          <View>
            <Text className="font-bold text-xl text-gray-800">Race Analysis</Text>
            <Text className="text-gray-600">Automated feedback system</Text>
          </View>
        </View>
        
        <View className="bg-blue-50 p-4 rounded-lg mb-4">
          <Text className="text-blue-800 font-bold mb-1">Performance Summary:</Text>
          <Text className="text-blue-700">
            Excellent start (1st of 24). Good first mark rounding (3rd). 
            Consider reviewing downwind speed in the video analysis.
          </Text>
        </View>
        
        <View className="flex-row justify-between">
          <TouchableOpacity className="bg-blue-600 py-3 px-5 rounded-full">
            <Text className="text-white font-medium">View Full Analysis</Text>
          </TouchableOpacity>
          <TouchableOpacity className="border border-blue-600 py-3 px-5 rounded-full">
            <Text className="text-blue-600 font-medium">Send to Email</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Real Coach */}
      <View className="bg-white rounded-xl shadow p-5">
        <View className="flex-row items-center mb-4">
          <View className="w-14 h-14 rounded-full bg-green-100 items-center justify-center mr-4">
            <Users color="#10B981" size={28} />
          </View>
          <View>
            <Text className="font-bold text-xl text-gray-800">Coach Sarah Johnson</Text>
            <Text className="text-gray-600">Professional sailing coach</Text>
          </View>
        </View>
        
        <View className="bg-green-50 p-4 rounded-lg mb-4">
          <Text className="text-green-800 font-bold mb-1">Personal Feedback:</Text>
          <Text className="text-green-700">
            Great job on your starts this series! Your boat handling was smooth. 
            Focus on maintaining VMG downwind for the next race.
          </Text>
        </View>
        
        <View className="flex-row justify-between">
          <TouchableOpacity className="bg-green-600 py-3 px-5 rounded-full">
            <Text className="text-white font-medium">Message Coach</Text>
          </TouchableOpacity>
          <TouchableOpacity className="border border-green-600 py-3 px-5 rounded-full">
            <Text className="text-green-600 font-medium">Schedule Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-4 px-4 shadow-sm">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity className="p-2 -ml-2" onPress={() => router.back()}>
            <ChevronLeft color="#1F2937" size={28} />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800 ml-2">Pro Race Timer</Text>
          <View className="flex-1" />
          <Timer color="#6B7280" size={24} />
        </View>
        
        {/* Tab Navigation */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="flex-row gap-2"
        >
          <TouchableOpacity 
            className={`px-5 py-2.5 rounded-full ${activeTab === 'timer' ? 'bg-blue-600' : 'bg-gray-200'}`}
            onPress={() => setActiveTab('timer')}
          >
            <Text className={activeTab === 'timer' ? 'text-white font-medium' : 'text-gray-700 font-medium'}>Timer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className={`px-5 py-2.5 rounded-full ${activeTab === 'analysis' ? 'bg-blue-600' : 'bg-gray-200'} ${!isCompleted ? 'opacity-50' : ''}`}
            onPress={() => isCompleted && setActiveTab('analysis')}
            disabled={!isCompleted}
          >
            <Text className={activeTab === 'analysis' ? 'text-white font-medium' : 'text-gray-700 font-medium'}>
              Analysis
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className={`px-5 py-2.5 rounded-full ${activeTab === 'crew' ? 'bg-blue-600' : 'bg-gray-200'} ${!isRunning ? 'opacity-50' : ''}`}
            onPress={() => isRunning && setActiveTab('crew')}
            disabled={!isRunning}
          >
            <Text className={activeTab === 'crew' ? 'text-white font-medium' : 'text-gray-700 font-medium'}>
              Crew
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className={`px-5 py-2.5 rounded-full ${activeTab === 'coaches' ? 'bg-blue-600' : 'bg-gray-200'} ${!isCompleted ? 'opacity-50' : ''}`}
            onPress={() => isCompleted && setActiveTab('coaches')}
            disabled={!isCompleted}
          >
            <Text className={activeTab === 'coaches' ? 'text-white font-medium' : 'text-gray-700 font-medium'}>
              Coaches
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      
      {/* Content */}
      <View className="flex-1">
        {activeTab === 'timer' && renderTimer()}
        {activeTab === 'analysis' && renderRaceAnalysis()}
        {activeTab === 'crew' && renderCrewCommunication()}
        {activeTab === 'coaches' && renderCoaches()}
      </View>
    </View>
  );
};

export default RaceTimerProScreen;
