/**
 * Race Committee Console
 * Professional-grade race management for PROs and race committee
 * 
 * Features:
 * - Start sequence timer with sound signals
 * - Quick-tap finish recording
 * - Course signal board
 * - Live announcements to competitors
 * - Real-time results view
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Vibration,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Play,
  RotateCcw,
  Flag,
  Clock,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  X,
  Send,
  Megaphone,
  Navigation,
  Timer,
  Trophy,
} from 'lucide-react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { Audio } from 'expo-av';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
interface RaceEntry {
  id: string;
  sail_number: string;
  entry_number: string;
  boat_name: string | null;
  skipper_name: string | null;
  class_name: string | null;
  status: string;
}

interface RaceResult {
  id?: string;
  entry_id: string;
  sail_number: string;
  boat_name: string | null;
  finish_position: number | null;
  finish_time: string | null;
  elapsed_seconds: number | null;
  status: 'racing' | 'finished' | 'dnf' | 'dns' | 'dsq' | 'ocs' | 'dnc' | 'ret' | 'raf' | 'bfd' | 'ufd';
}

type RaceResultsIdColumn = 'regatta_id' | 'race_id';

interface SignalFlag {
  code: string;
  name: string;
  meaning: string;
  color: string;
  active: boolean;
}

type TabType = 'timer' | 'finishes' | 'signals' | 'announce' | 'results';

// Signal flags data
const SIGNAL_FLAGS: SignalFlag[] = [
  { code: 'AP', name: 'Answering Pennant', meaning: 'Postponement', color: '#FFFFFF', active: false },
  { code: 'N', name: 'November', meaning: 'Abandonment', color: '#0000FF', active: false },
  { code: '1st Sub', name: 'First Substitute', meaning: 'General Recall', color: '#FFD700', active: false },
  { code: 'I', name: 'India', meaning: 'Round-the-Ends Rule', color: '#FFD700', active: false },
  { code: 'Z', name: 'Zulu', meaning: '20% Penalty Zone', color: '#FFD700', active: false },
  { code: 'U', name: 'Uniform', meaning: 'UFD Rule (Black Flag Light)', color: '#FF0000', active: false },
  { code: 'Black', name: 'Black Flag', meaning: 'Black Flag Rule', color: '#000000', active: false },
  { code: 'S', name: 'Sierra', meaning: 'Shortened Course', color: '#0000FF', active: false },
  { code: 'L', name: 'Lima', meaning: 'Come Within Hail', color: '#FFD700', active: false },
  { code: 'M', name: 'Mike', meaning: 'Mark Missing', color: '#0000FF', active: false },
  { code: 'Y', name: 'Yankee', meaning: 'Wear Life Jackets', color: '#FFD700', active: false },
  { code: 'C', name: 'Charlie', meaning: 'Course Change', color: '#0000FF', active: false },
];

export default function RaceCommitteeConsole() {
  const params = useLocalSearchParams();
  const regattaId = params.regattaId as string || params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  // Core state
  const [regatta, setRegatta] = useState<any>(null);
  const [raceNumber, setRaceNumber] = useState(1);
  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [results, setResults] = useState<Map<string, RaceResult>>(new Map());
  const [activeTab, setActiveTab] = useState<TabType>('timer');
  const [loading, setLoading] = useState(true);

  // Timer state
  const [sequenceMinutes, setSequenceMinutes] = useState(5);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [timerState, setTimerState] = useState<'idle' | 'countdown' | 'racing' | 'finished'>('idle');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Finish recording state
  const [finishSearch, setFinishSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<RaceEntry | null>(null);
  const [finishQueue, setFinishQueue] = useState<string[]>([]);

  // Signals state
  const [activeFlags, setActiveFlags] = useState<Set<string>>(new Set());
  const [courseDesignation, setCourseDesignation] = useState('');

  // Announcement state
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'important' | 'urgent'>('normal');

  // Audio
  const soundRef = useRef<Audio.Sound | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const raceResultsIdColumnRef = useRef<RaceResultsIdColumn>('regatta_id');

  const withRaceResultsColumnFallback = async <T,>(
    operation: (column: RaceResultsIdColumn) => Promise<{ data: T | null; error: any }>
  ) => {
    const currentColumn = raceResultsIdColumnRef.current;
    let result = await operation(currentColumn);
    if (
      result.error &&
      currentColumn === 'regatta_id' &&
      isMissingIdColumn(result.error, 'race_results', currentColumn)
    ) {
      const fallbackColumn: RaceResultsIdColumn = 'race_id';
      result = await operation(fallbackColumn);
      if (!result.error) {
        raceResultsIdColumnRef.current = fallbackColumn;
      }
    }

    return result;
  };

  // Animation values
  const timerPulse = useSharedValue(1);

  // Load initial data
  useEffect(() => {
    if (regattaId) {
      loadRegattaData();
      loadEntries();
      loadResults();
    }
    
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId, raceNumber]);

  // Real-time subscription
  useEffect(() => {
    if (!regattaId) return;

    const channel = supabase
      .channel(`rc-console-${regattaId}-${raceNumber}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'race_results',
        filter: `regatta_id=eq.${regattaId}`,
      }, () => {
        loadResults();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId, raceNumber]);

  const cleanup = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    if (soundRef.current) soundRef.current.unloadAsync();
  };

  const loadRegattaData = async () => {
    try {
      const { data, error } = await supabase
        .from('regattas')
        .select('*, clubs(club_name)')
        .eq('id', regattaId)
        .single();

      if (error) throw error;
      setRegatta(data);
    } catch (error) {
      console.error('Error loading regatta:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('race_entries')
        .select('id, sail_number, entry_number, boat_name, skipper_name, entry_class, status')
        .eq('regatta_id', regattaId)
        .in('status', ['confirmed', 'registered'])
        .order('sail_number');

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const loadResults = async () => {
    try {
      const { data, error } = await withRaceResultsColumnFallback((column) =>
        supabase
          .from('race_results')
          .select(`
            id,
            entry_id,
            finish_position,
            finish_time,
            elapsed_time,
            status,
            race_entries(sail_number, boat_name)
          `)
          .eq(column, regattaId)
          .eq('race_number', raceNumber)
      );

      if (error) throw error;

      const resultsMap = new Map<string, RaceResult>();
      (data || []).forEach((r: any) => {
        resultsMap.set(r.entry_id, {
          id: r.id,
          entry_id: r.entry_id,
          sail_number: r.race_entries?.sail_number || '',
          boat_name: r.race_entries?.boat_name,
          finish_position: r.finish_position,
          finish_time: r.finish_time,
          elapsed_seconds: r.elapsed_time,
          status: r.status,
        });
      });
      setResults(resultsMap);
    } catch (error) {
      console.error('Error loading results:', error);
    }
  };

  // Sound functions
  const playHorn = async (duration: number = 1000, count: number = 1) => {
    try {
      // Vibrate on mobile
      if (Platform.OS !== 'web') {
        Vibration.vibrate(duration);
      }

      // Try to play sound - gracefully handle missing file
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3' },
          { shouldPlay: true, volume: 1.0 }
        );
        soundRef.current = sound;

        setTimeout(() => {
          sound.unloadAsync();
        }, duration);
      } catch (soundError) {
        // Sound playback not available, using vibration fallback
      }

      // Multiple horns
      if (count > 1) {
        for (let i = 1; i < count; i++) {
          setTimeout(() => playHorn(duration, 1), i * (duration + 200));
        }
      }
    } catch (error) {
      console.error('Error playing horn:', error);
      // Fallback: vibrate
      if (Platform.OS !== 'web') {
        Vibration.vibrate(duration);
      }
    }
  };

  // Timer functions
  const startSequence = async () => {
    const totalSeconds = sequenceMinutes * 60;
    setCountdownSeconds(totalSeconds);
    setTimerState('countdown');

    // Start pulse animation
    timerPulse.value = withRepeat(
      withTiming(1.05, { duration: 500 }),
      -1,
      true
    );

    // Warning signal
    await playHorn(1000);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        const newValue = prev - 1;

        // Signal points (for 5-4-1-0 sequence)
        if (sequenceMinutes === 5) {
          if (newValue === 240) playHorn(1000); // 4 min - Prep
          if (newValue === 60) playHorn(500); // 1 min
          if (newValue === 0) {
            playHorn(1500);
            handleRaceStart();
          }
        } else if (sequenceMinutes === 3) {
          if (newValue === 120) playHorn(1000); // 2 min
          if (newValue === 60) playHorn(500); // 1 min
          if (newValue === 0) {
            playHorn(1500);
            handleRaceStart();
          }
        }

        // Last 10 seconds beeps
        if (newValue > 0 && newValue <= 10) {
          playHorn(100);
        }

        if (newValue <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          return 0;
        }
        return newValue;
      });
    }, 1000);
  };

  const handleRaceStart = async () => {
    const now = new Date();
    setStartTime(now);
    setTimerState('racing');
    setElapsedSeconds(0);

    // Stop pulse animation
    timerPulse.value = 1;

    // Start elapsed timer
    elapsedIntervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    // Initialize results for all entries
    try {
      const { error } = await withRaceResultsColumnFallback((column) =>
        supabase.from('race_results').upsert(
          entries.map((entry) => ({
            [column]: regattaId,
            race_number: raceNumber,
            entry_id: entry.id,
            start_time: now.toISOString(),
            status: 'racing',
          })),
          {
            onConflict: `${column},race_number,entry_id`,
          }
        )
      );
      if (error) throw error;

      await supabase.from('race_start_sequences').upsert({
        regatta_id: regattaId,
        race_number: raceNumber,
        start_time: now.toISOString(),
        sequence_type: `${sequenceMinutes}-minute`,
        status: 'completed',
      });

      loadResults();
    } catch (error) {
      console.error('Error recording race start:', error);
    }
  };

  const stopSequence = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setTimerState('idle');
    setCountdownSeconds(0);
    timerPulse.value = 1;
  };

  const postponeRace = async () => {
    showConfirm(
      'Postpone Race',
      'Display AP flag and postpone the race?',
      async () => {
        stopSequence();
        setActiveFlags(prev => new Set([...prev, 'AP']));
        await playHorn(1000, 2);

        await supabase.from('race_flags').insert({
          regatta_id: regattaId,
          race_number: raceNumber,
          flag_type: 'AP',
          action: 'display',
          recorded_by: user?.id,
        });
      }
    );
  };

  const generalRecall = async () => {
    showConfirm(
      'General Recall',
      'Display 1st Substitute flag for General Recall?',
      async () => {
        stopSequence();
        setActiveFlags(prev => new Set([...prev, '1st Sub']));
        await playHorn(1000, 2);

        await supabase.from('race_flags').insert({
          regatta_id: regattaId,
          race_number: raceNumber,
          flag_type: '1st Sub',
          action: 'display',
          recorded_by: user?.id,
        });
      }
    );
  };

  // Finish recording functions
  const recordFinish = async (entry: RaceEntry) => {
    if (timerState !== 'racing') {
      showAlert('Race Not Started', 'Start the race before recording finishes.');
      return;
    }

    const finishTime = new Date();
    const elapsed = startTime ? Math.floor((finishTime.getTime() - startTime.getTime()) / 1000) : 0;
    const nextPosition = finishQueue.length + 1;

    try {
      const { error } = await withRaceResultsColumnFallback((column) =>
        supabase
          .from('race_results')
          .update({
            finish_time: finishTime.toISOString(),
            finish_position: nextPosition,
            elapsed_time: elapsed,
            status: 'finished',
          })
          .eq(column, regattaId)
          .eq('race_number', raceNumber)
          .eq('entry_id', entry.id)
      );

      if (error) throw error;

      setFinishQueue(prev => [...prev, entry.id]);
      setFinishSearch('');
      setSelectedEntry(null);
      
      // Short horn for finish
      await playHorn(300);
      
      loadResults();
    } catch (error) {
      console.error('Error recording finish:', error);
      showAlert('Error', 'Failed to record finish');
    }
  };

  const updateStatus = async (entryId: string, status: RaceResult['status']) => {
    try {
      const { error } = await withRaceResultsColumnFallback((column) =>
        supabase
          .from('race_results')
          .update({ status })
          .eq(column, regattaId)
          .eq('race_number', raceNumber)
          .eq('entry_id', entryId)
      );
      if (error) throw error;

      loadResults();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Signal functions
  const toggleFlag = async (flagCode: string) => {
    const isActive = activeFlags.has(flagCode);
    const newFlags = new Set(activeFlags);
    
    if (isActive) {
      newFlags.delete(flagCode);
    } else {
      newFlags.add(flagCode);
    }
    
    setActiveFlags(newFlags);
    
    await supabase.from('race_flags').insert({
      regatta_id: regattaId,
      race_number: raceNumber,
      flag_type: flagCode,
      action: isActive ? 'lower' : 'display',
      recorded_by: user?.id,
    });

    if (!isActive) {
      await playHorn(500);
    }
  };

  // Announcement functions
  const sendAnnouncement = async () => {
    if (!announcementText.trim()) return;

    try {
      await supabase.from('race_notices').insert({
        regatta_id: regattaId,
        title: `Race ${raceNumber} Update`,
        content: announcementText,
        priority: announcementPriority,
        visibility: 'public',
        published_at: new Date().toISOString(),
        created_by: user?.id,
      });

      // TODO: Trigger push notifications to registered sailors

      showAlert('Sent', 'Announcement published successfully');
      setAnnouncementText('');
      setAnnouncementPriority('normal');
    } catch (error) {
      console.error('Error sending announcement:', error);
      showAlert('Error', 'Failed to send announcement');
    }
  };

  // Format time helpers
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatElapsed = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSignalText = () => {
    if (countdownSeconds > (sequenceMinutes - 1) * 60) return 'Warning';
    if (countdownSeconds > 60) return 'Preparatory';
    if (countdownSeconds > 0) return '1 Minute';
    return 'GO!';
  };

  // Animated styles
  const timerAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const pulseValue = timerPulse.value ?? 1;
    return {
      transform: [{ scale: pulseValue }],
    };
  });

  // Filter entries for finish recording
  const filteredEntries = entries.filter(entry => {
    const result = results.get(entry.id);
    if (result?.status === 'finished') return false;
    if (!finishSearch) return true;
    return (
      entry.sail_number.toLowerCase().includes(finishSearch.toLowerCase()) ||
      entry.boat_name?.toLowerCase().includes(finishSearch.toLowerCase()) ||
      entry.skipper_name?.toLowerCase().includes(finishSearch.toLowerCase())
    );
  });

  // Sorted results for display
  const sortedResults = Array.from(results.values())
    .filter(r => r.status === 'finished')
    .sort((a, b) => (a.finish_position || 999) - (b.finish_position || 999));

  // Racing boats count
  const racingCount = Array.from(results.values()).filter(r => r.status === 'racing').length;
  const finishedCount = sortedResults.length;

  // Render tab content
  const renderTimerTab = () => (
    <View style={styles.timerContainer}>
      {/* Main Timer Display */}
      <Animated.View style={[styles.timerDisplay, timerAnimatedStyle]}>
        {timerState === 'countdown' ? (
          <>
            <Text style={styles.timerLabel}>{getSignalText()}</Text>
            <Text style={[
              styles.timerValue,
              countdownSeconds <= 60 && styles.timerWarning,
              countdownSeconds <= 10 && styles.timerDanger,
            ]}>
              {formatCountdown(countdownSeconds)}
            </Text>
          </>
        ) : timerState === 'racing' ? (
          <>
            <Text style={styles.timerLabel}>Race Time</Text>
            <Text style={[styles.timerValue, styles.timerRacing]}>
              {formatElapsed(elapsedSeconds)}
            </Text>
            <Text style={styles.startedAt}>
              Started: {startTime?.toLocaleTimeString()}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.timerLabel}>Sequence Timer</Text>
            <Text style={styles.timerValue}>--:--</Text>
          </>
        )}
      </Animated.View>

      {/* Sequence Type Selector */}
      {timerState === 'idle' && (
        <View style={styles.sequenceSelector}>
          <Text style={styles.selectorLabel}>Sequence Type</Text>
          <View style={styles.sequenceOptions}>
            {[5, 3].map(mins => (
              <TouchableOpacity
                key={mins}
                style={[
                  styles.sequenceOption,
                  sequenceMinutes === mins && styles.sequenceOptionActive,
                ]}
                onPress={() => setSequenceMinutes(mins)}
              >
                <Text style={[
                  styles.sequenceOptionText,
                  sequenceMinutes === mins && styles.sequenceOptionTextActive,
                ]}>
                  {mins} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.timerControls}>
        {timerState === 'idle' && (
          <TouchableOpacity style={styles.startButton} onPress={startSequence}>
            <Play size={32} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.startButtonText}>Start Sequence</Text>
          </TouchableOpacity>
        )}

        {timerState === 'countdown' && (
          <View style={styles.countdownControls}>
            <TouchableOpacity style={styles.controlButton} onPress={postponeRace}>
              <Flag size={24} color="#F59E0B" />
              <Text style={styles.controlButtonText}>Postpone</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.controlButton, styles.stopButton]} onPress={stopSequence}>
              <X size={24} color="#EF4444" />
              <Text style={[styles.controlButtonText, styles.stopButtonText]}>Stop</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={generalRecall}>
              <RotateCcw size={24} color="#8B5CF6" />
              <Text style={styles.controlButtonText}>Recall</Text>
            </TouchableOpacity>
          </View>
        )}

        {timerState === 'racing' && (
          <View style={styles.racingStats}>
            <View style={styles.statItem}>
              <Users size={20} color="#0EA5E9" />
              <Text style={styles.statValue}>{racingCount}</Text>
              <Text style={styles.statLabel}>Racing</Text>
            </View>
            <View style={styles.statItem}>
              <Flag size={20} color="#10B981" />
              <Text style={styles.statValue}>{finishedCount}</Text>
              <Text style={styles.statLabel}>Finished</Text>
            </View>
            <View style={styles.statItem}>
              <Trophy size={20} color="#F59E0B" />
              <Text style={styles.statValue}>{entries.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        )}
      </View>

      {/* Active Flags */}
      {activeFlags.size > 0 && (
        <View style={styles.activeFlagsDisplay}>
          <Text style={styles.activeFlagsTitle}>Active Signals</Text>
          <View style={styles.activeFlagsRow}>
            {Array.from(activeFlags).map(flag => (
              <View key={flag} style={styles.activeFlagChip}>
                <Text style={styles.activeFlagText}>{flag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderFinishesTab = () => (
    <View style={styles.finishesContainer}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by sail number or name..."
          placeholderTextColor="#9CA3AF"
          value={finishSearch}
          onChangeText={setFinishSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {finishSearch.length > 0 && (
          <TouchableOpacity onPress={() => setFinishSearch('')}>
            <X size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Finish Buttons */}
      <Text style={styles.sectionTitle}>Tap to Record Finish</Text>
      <FlatList
        data={filteredEntries.slice(0, 20)}
        numColumns={3}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const result = results.get(item.id);
          const isRacing = result?.status === 'racing';
          
          return (
            <TouchableOpacity
              style={[
                styles.finishTile,
                !isRacing && styles.finishTileDisabled,
              ]}
              onPress={() => isRacing && recordFinish(item)}
              disabled={!isRacing}
            >
              <Text style={styles.finishTileSail}>{item.sail_number}</Text>
              {item.boat_name && (
                <Text style={styles.finishTileBoat} numberOfLines={1}>
                  {item.boat_name}
                </Text>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>No boats to finish</Text>
          </View>
        }
        contentContainerStyle={styles.finishGrid}
      />

      {/* Recent Finishes */}
      {finishQueue.length > 0 && (
        <View style={styles.recentFinishes}>
          <Text style={styles.sectionTitle}>Recent Finishes</Text>
          {sortedResults.slice(-5).reverse().map((result) => (
            <View key={result.entry_id} style={styles.finishRow}>
              <View style={styles.finishPosition}>
                <Text style={styles.finishPositionText}>{result.finish_position}</Text>
              </View>
              <Text style={styles.finishSailNumber}>{result.sail_number}</Text>
              <Text style={styles.finishBoatName}>{result.boat_name || '—'}</Text>
              <Text style={styles.finishTime}>
                {result.elapsed_seconds ? formatElapsed(result.elapsed_seconds) : '—'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Status Codes */}
      <View style={styles.statusCodes}>
        <Text style={styles.sectionTitle}>Assign Status</Text>
        <View style={styles.statusRow}>
          {(['dnf', 'dns', 'ocs', 'dsq', 'ret', 'bfd'] as const).map(status => (
            <TouchableOpacity
              key={status}
              style={styles.statusButton}
              onPress={() => {
                if (selectedEntry) {
                  updateStatus(selectedEntry.id, status);
                  setSelectedEntry(null);
                } else {
                  showAlert('Select Boat', 'Tap a boat first, then assign status');
                }
              }}
            >
              <Text style={styles.statusButtonText}>{status.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderSignalsTab = () => (
    <ScrollView style={styles.signalsContainer}>
      {/* Course Designation */}
      <View style={styles.courseSection}>
        <Text style={styles.sectionTitle}>Course Designation</Text>
        <View style={styles.courseInputRow}>
          <TextInput
            style={styles.courseInput}
            placeholder="Enter course (e.g., W3)"
            placeholderTextColor="#9CA3AF"
            value={courseDesignation}
            onChangeText={setCourseDesignation}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.courseButton}
            onPress={async () => {
              await supabase.from('race_course_signals').upsert({
                regatta_id: regattaId,
                race_number: raceNumber,
                course_designation: courseDesignation,
                signaled_at: new Date().toISOString(),
              });
              showAlert('Course Set', `Course ${courseDesignation} signaled`);
            }}
          >
            <Navigation size={20} color="#FFFFFF" />
            <Text style={styles.courseButtonText}>Signal</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Signal Flags */}
      <Text style={styles.sectionTitle}>Signal Flags</Text>
      <View style={styles.flagsGrid}>
        {SIGNAL_FLAGS.map(flag => {
          const isActive = activeFlags.has(flag.code);
          return (
            <TouchableOpacity
              key={flag.code}
              style={[
                styles.flagCard,
                isActive && styles.flagCardActive,
                { borderColor: flag.color === '#FFFFFF' ? '#E5E7EB' : flag.color },
              ]}
              onPress={() => toggleFlag(flag.code)}
            >
              <View style={[
                styles.flagIndicator,
                { backgroundColor: flag.color },
                flag.color === '#FFFFFF' && styles.flagIndicatorWhite,
              ]} />
              <Text style={[styles.flagCode, isActive && styles.flagCodeActive]}>
                {flag.code}
              </Text>
              <Text style={styles.flagMeaning}>{flag.meaning}</Text>
              {isActive && (
                <View style={styles.flagActiveIndicator}>
                  <Check size={14} color="#10B981" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderAnnounceTab = () => (
    <KeyboardAvoidingView
      style={styles.announceContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.announceHeader}>
        <Megaphone size={24} color="#0EA5E9" />
        <Text style={styles.announceTitle}>Broadcast to Competitors</Text>
      </View>

      {/* Quick Messages */}
      <View style={styles.quickMessages}>
        <Text style={styles.sectionTitle}>Quick Messages</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            'Race postponed - new start time TBA',
            'Next warning signal in 5 minutes',
            'All boats return to start area',
            'Course shortened - finish at gate',
            'Racing abandoned for today',
          ].map((msg, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickMessageChip}
              onPress={() => setAnnouncementText(msg)}
            >
              <Text style={styles.quickMessageText}>{msg}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Custom Message */}
      <View style={styles.messageInput}>
        <TextInput
          style={styles.messageTextInput}
          placeholder="Type your announcement..."
          placeholderTextColor="#9CA3AF"
          value={announcementText}
          onChangeText={setAnnouncementText}
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Priority Selector */}
      <View style={styles.prioritySelector}>
        <Text style={styles.priorityLabel}>Priority:</Text>
        {(['normal', 'important', 'urgent'] as const).map(priority => (
          <TouchableOpacity
            key={priority}
            style={[
              styles.priorityOption,
              announcementPriority === priority && styles.priorityOptionActive,
              priority === 'urgent' && styles.priorityUrgent,
              priority === 'important' && styles.priorityImportant,
            ]}
            onPress={() => setAnnouncementPriority(priority)}
          >
            <Text style={[
              styles.priorityText,
              announcementPriority === priority && styles.priorityTextActive,
            ]}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.sendButton, !announcementText.trim() && styles.sendButtonDisabled]}
        onPress={sendAnnouncement}
        disabled={!announcementText.trim()}
      >
        <Send size={20} color="#FFFFFF" />
        <Text style={styles.sendButtonText}>Send Announcement</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );

  const renderResultsTab = () => (
    <ScrollView style={styles.resultsContainer}>
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>Race {raceNumber} Results</Text>
        <View style={styles.resultsStats}>
          <Text style={styles.resultsStat}>{finishedCount} finished</Text>
          <Text style={styles.resultsStat}>{racingCount} racing</Text>
        </View>
      </View>

      {sortedResults.length > 0 ? (
        sortedResults.map((result) => (
          <View key={result.entry_id} style={styles.resultRow}>
            <View style={[
              styles.resultPosition,
              result.finish_position === 1 && styles.resultPositionGold,
              result.finish_position === 2 && styles.resultPositionSilver,
              result.finish_position === 3 && styles.resultPositionBronze,
            ]}>
              <Text style={styles.resultPositionText}>{result.finish_position}</Text>
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultSail}>{result.sail_number}</Text>
              <Text style={styles.resultBoat}>{result.boat_name || '—'}</Text>
            </View>
            <View style={styles.resultTime}>
              <Text style={styles.resultTimeText}>
                {result.elapsed_seconds ? formatElapsed(result.elapsed_seconds) : '—'}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyResults}>
          <Trophy size={48} color="#D1D5DB" />
          <Text style={styles.emptyResultsText}>No finishes recorded yet</Text>
        </View>
      )}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Timer size={48} color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading Race Console...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {regatta?.name || 'Race Control'}
          </Text>
          <View style={styles.raceSelector}>
            <TouchableOpacity onPress={() => setRaceNumber(Math.max(1, raceNumber - 1))}>
              <ChevronLeft size={20} color="#BAE6FD" />
            </TouchableOpacity>
            <Text style={styles.raceNumber}>Race {raceNumber}</Text>
            <TouchableOpacity onPress={() => setRaceNumber(raceNumber + 1)}>
              <ChevronRight size={20} color="#BAE6FD" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.settingsButton}>
          <Settings size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'timer', label: 'Timer', icon: Clock },
          { key: 'finishes', label: 'Finishes', icon: Flag },
          { key: 'signals', label: 'Signals', icon: Navigation },
          { key: 'announce', label: 'Announce', icon: Megaphone },
          { key: 'results', label: 'Results', icon: Trophy },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as TabType)}
            >
              <Icon size={20} color={isActive ? '#0EA5E9' : '#6B7280'} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'timer' && renderTimerTab()}
        {activeTab === 'finishes' && renderFinishesTab()}
        {activeTab === 'signals' && renderSignalsTab()}
        {activeTab === 'announce' && renderAnnounceTab()}
        {activeTab === 'results' && renderResultsTab()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0EA5E9',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  raceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  raceNumber: {
    fontSize: 14,
    color: '#BAE6FD',
    marginHorizontal: 8,
  },
  settingsButton: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0EA5E9',
  },
  tabLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },

  // Timer Tab
  timerContainer: {
    flex: 1,
    padding: 16,
  },
  timerDisplay: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  timerLabel: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 8,
  },
  timerValue: {
    fontSize: 72,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  timerWarning: {
    color: '#FBBF24',
  },
  timerDanger: {
    color: '#EF4444',
  },
  timerRacing: {
    color: '#10B981',
  },
  startedAt: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
  sequenceSelector: {
    marginBottom: 24,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sequenceOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  sequenceOption: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  sequenceOptionActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#EFF6FF',
  },
  sequenceOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
  sequenceOptionTextActive: {
    color: '#0EA5E9',
  },
  timerControls: {
    marginBottom: 24,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 20,
    borderRadius: 16,
    gap: 12,
  },
  startButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  countdownControls: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  stopButton: {
    borderColor: '#EF4444',
  },
  stopButtonText: {
    color: '#EF4444',
  },
  racingStats: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  activeFlagsDisplay: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
  },
  activeFlagsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  activeFlagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeFlagChip: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeFlagText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },

  // Finishes Tab
  finishesContainer: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  finishGrid: {
    paddingBottom: 16,
  },
  finishTile: {
    flex: 1,
    margin: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    minHeight: 80,
  },
  finishTileDisabled: {
    opacity: 0.4,
    borderColor: '#E5E7EB',
  },
  finishTileSail: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  finishTileBoat: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  recentFinishes: {
    marginTop: 16,
  },
  finishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  finishPosition: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  finishPositionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  finishSailNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    width: 70,
  },
  finishBoatName: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  finishTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  statusCodes: {
    marginTop: 16,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991B1B',
  },

  // Signals Tab
  signalsContainer: {
    flex: 1,
    padding: 16,
  },
  courseSection: {
    marginBottom: 24,
  },
  courseInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  courseInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  courseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  courseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  flagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  flagCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 3,
    position: 'relative',
  },
  flagCardActive: {
    backgroundColor: '#F0FDF4',
  },
  flagIndicator: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginBottom: 8,
  },
  flagIndicatorWhite: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  flagCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  flagCodeActive: {
    color: '#10B981',
  },
  flagMeaning: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  flagActiveIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 4,
  },

  // Announce Tab
  announceContainer: {
    flex: 1,
    padding: 16,
  },
  announceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  announceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  quickMessages: {
    marginBottom: 20,
  },
  quickMessageChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  quickMessageText: {
    fontSize: 13,
    color: '#1E40AF',
  },
  messageInput: {
    marginBottom: 16,
  },
  messageTextInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  prioritySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  priorityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginRight: 12,
  },
  priorityOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  priorityOptionActive: {
    backgroundColor: '#DBEAFE',
  },
  priorityUrgent: {
    backgroundColor: '#FEE2E2',
  },
  priorityImportant: {
    backgroundColor: '#FEF3C7',
  },
  priorityText: {
    fontSize: 14,
    color: '#6B7280',
  },
  priorityTextActive: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Results Tab
  resultsContainer: {
    flex: 1,
    padding: 16,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  resultsStats: {
    flexDirection: 'row',
    gap: 16,
  },
  resultsStat: {
    fontSize: 12,
    color: '#6B7280',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  resultPosition: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  resultPositionGold: {
    backgroundColor: '#FEF3C7',
  },
  resultPositionSilver: {
    backgroundColor: '#E5E7EB',
  },
  resultPositionBronze: {
    backgroundColor: '#FED7AA',
  },
  resultPositionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  resultInfo: {
    flex: 1,
  },
  resultSail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  resultBoat: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  resultTime: {
    alignItems: 'flex-end',
  },
  resultTimeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  emptyResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyResultsText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
});
