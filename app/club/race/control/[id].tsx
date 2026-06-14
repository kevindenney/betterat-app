/**
 * Race Control Screen - Race Committee Interface
 * Comprehensive race day management: start sequences, finish recording, protests, and results
 */

import CrewManifestTab from '@/components/race-control/CrewManifestTab';
import ProtestModal from '@/components/race-control/ProtestModal';
import { useClubWorkspace } from '@/hooks/useClubWorkspace';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { realtimeService } from '@/services/RealtimeService';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { showAlert, showConfirm, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';

// Types
interface Regatta {
  id: string;
  name: string;
  start_date: string;
  venue_id?: string;
  organizer_id: string;
}

interface RaceEntry {
  id: string;
  sail_number: string;
  entry_number: string;
  sailor_id: string;
  boat_id: string;
  entry_class: string;
  status: string;
}

interface RaceResult {
  id?: string;
  regatta_id: string;
  race_number: number;
  entry_id: string;
  start_time?: string;
  finish_time?: string;
  finish_position?: number;
  status: 'racing' | 'finished' | 'dnf' | 'dns' | 'dsq' | 'ocs' | 'dnc' | 'ret' | 'raf';
  sail_number?: string;
  entry_number?: string;
  elapsed_time?: string;
}

type RaceResultsIdColumn = 'regatta_id' | 'race_id';

interface FlagControl {
  type: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const FLAG_CONTROLS: FlagControl[] = [
  { type: 'ap', label: 'AP', icon: 'flag', color: '#FFD700', description: 'Postponement' },
  { type: 'n', label: 'N', icon: 'close-circle', color: '#FF4444', description: 'Abandonment' },
  { type: 'first_substitute', label: '1st Sub', icon: 'repeat', color: '#FFA500', description: 'General Recall' },
  { type: 'black', label: 'Black', icon: 'flag', color: '#000000', description: 'Black Flag Rule' },
  { type: 'i', label: 'I', icon: 'flag', color: '#4169E1', description: 'Round the Ends' },
  { type: 'z', label: 'Z', icon: 'flag', color: '#FFD700', description: '20% Penalty Zone' },
  { type: 'u', label: 'U', icon: 'flag', color: '#FF0000', description: '1 Minute Rule' },
  { type: 's', label: 'S', icon: 'trending-down', color: '#4CAF50', description: 'Shortened Course' },
];

export default function RaceControlScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { clubId, loading: personaLoading, refresh: refreshPersonaContext } = useClubWorkspace();

  // State
  const [regatta, setRegatta] = useState<Regatta | null>(null);
  const [raceNumber, setRaceNumber] = useState(1);
  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [results, setResults] = useState<RaceResult[]>([]);

  // Start Sequence State
  const [sequenceStatus, setSequenceStatus] = useState<'idle' | 'countdown' | 'racing' | 'finished'>('idle');
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [sequenceConfig, setSequenceConfig] = useState({ warning: 5, prep: 4, one_min: 1 });
  const [startTime, setStartTime] = useState<Date | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<'timer' | 'finishes' | 'flags' | 'protests' | 'crew'>('timer');
  const [showProtestModal, setShowProtestModal] = useState(false);
  const [, setFinishQueue] = useState<string[]>([]); // Entry IDs in finish order

  // Sound
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // Load data
  useEffect(() => {
    if (!clubId) return;

    loadRegattaData();
    loadEntries();
    loadResults();

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, raceNumber, clubId]);

  // Realtime subscription for results
  useEffect(() => {
    if (!clubId) return;

    const channelName = `race-control-${id}-${raceNumber}`;
    const handler = () => {
      loadResults();
    };
    realtimeService.subscribe(
      channelName,
      {
        event: '*',
        schema: 'public',
        table: 'race_results',
        filter: `regatta_id=eq.${id}`,
      },
      handler
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, raceNumber, clubId]);

  const loadRegattaData = async () => {
    if (!clubId) return;
    try {
      const { data, error } = await supabase
        .from('regattas')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setRegatta(data);
    } catch (error) {
      console.error('Error loading regatta:', error);
      showAlert('Error', 'Could not load regatta data');
    }
  };

  const loadEntries = async () => {
    if (!clubId) return;
    try {
      const { data, error } = await supabase
        .from('race_entries')
        .select('*')
        .eq('regatta_id', id)
        .eq('status', 'confirmed')
        .order('entry_number');

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const loadResults = async () => {
    if (!clubId) return;
    try {
      const { data, error } = await withRaceResultsColumnFallback((column) =>
        supabase
          .from('race_results')
          .select(`
            *,
            race_entries!inner(sail_number, entry_number)
          `)
          .eq(column, id)
          .eq('race_number', raceNumber)
          .order('finish_position', { ascending: true })
      );

      if (error) throw error;

      const formattedResults = (data || []).map((r: any) => ({
        ...r,
        sail_number: r.race_entries?.sail_number,
        entry_number: r.race_entries?.entry_number,
      }));

      setResults(formattedResults);
    } catch (error) {
      console.error('Error loading results:', error);
    }
  };

  // Start Sequence Functions
  const playHorn = async (duration: number = 1000) => {
    try {
      const { sound: hornSound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3' },
        { shouldPlay: true }
      );
      setSound(hornSound);

      setTimeout(() => {
        hornSound.unloadAsync();
      }, duration);
    } catch (error) {
      console.error('Error playing horn:', error);
    }
  };

  const startCountdown = async () => {
    const warningMinutes = sequenceConfig.warning;
    const totalSeconds = warningMinutes * 60;

    setCountdownSeconds(totalSeconds);
    setSequenceStatus('countdown');

    // Play warning signal
    await playHorn();

    countdownInterval.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        const newValue = prev - 1;

        // Sound signals at key moments
        if (newValue === sequenceConfig.prep * 60) {
          playHorn(); // Preparatory signal
        } else if (newValue === sequenceConfig.one_min * 60) {
          playHorn(500); // 1 minute signal
        } else if (newValue === 0) {
          playHorn(2000); // Start signal (longer)
          handleRaceStart();
        }

        if (newValue <= 0) {
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
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
    setSequenceStatus('racing');

    // Create start sequence record
    try {
      await supabase.from('race_start_sequences').upsert({
        regatta_id: id,
        race_number: raceNumber,
        start_time: now.toISOString(),
        status: 'completed',
      });

      // Initialize results for all entries as racing
      await withRaceResultsColumnFallback((column) =>
        supabase.from('race_results').upsert(
          entries.map((entry) => ({
            [column]: id!,
            race_number: raceNumber,
            entry_id: entry.id,
            start_time: now.toISOString(),
            status: 'racing' as const,
          }))
        )
      );
      loadResults();
    } catch (error) {
      console.error('Error recording start:', error);
    }
  };

  const stopCountdown = () => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    setSequenceStatus('idle');
    setCountdownSeconds(0);
  };

  const postponeRace = async () => {
    showConfirm(
      'Postpone Race',
      'Display Postponement flag?',
      async () => {
        stopCountdown();
        await recordFlag('ap', 'Postponement');
      }
    );
  };

  const abandonRace = async () => {
    showConfirm(
      'Abandon Race',
      'Are you sure you want to abandon this race?',
      async () => {
        stopCountdown();
        await recordFlag('n', 'Abandonment');
        setSequenceStatus('idle');

        // Update all results to DNS
        await withRaceResultsColumnFallback((column) =>
          supabase
            .from('race_results')
            .update({ status: 'dnc' })
            .eq(column, id)
            .eq('race_number', raceNumber)
        );

        loadResults();
      },
      { destructive: true }
    );
  };

  // Finish Recording
  const recordFinish = async (entryId: string, manual: boolean = true) => {
    const finishTime = new Date();

    try {
      const { error } = await withRaceResultsColumnFallback((column) =>
        supabase
          .from('race_results')
          .update({
            finish_time: finishTime.toISOString(),
            status: 'finished',
          })
          .eq(column, id)
          .eq('race_number', raceNumber)
          .eq('entry_id', entryId)
      );

      if (error) throw error;

      // Add to finish queue for quick display
      setFinishQueue(prev => [...prev, entryId]);

      // Play finish horn
      if (manual) {
        await playHorn(300);
      }

      loadResults();
    } catch (error) {
      console.error('Error recording finish:', error);
      showAlert('Error', 'Could not record finish time');
    }
  };

  const updateBoatStatus = async (entryId: string, status: RaceResult['status']) => {
    try {
      const { error } = await withRaceResultsColumnFallback((column) =>
        supabase
          .from('race_results')
          .update({ status })
          .eq(column, id)
          .eq('race_number', raceNumber)
          .eq('entry_id', entryId)
      );

      if (error) throw error;
      loadResults();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Flag Controls
  const recordFlag = async (flagType: string, description: string) => {
    try {
      await supabase.from('race_flags').insert({
        regatta_id: id,
        race_number: raceNumber,
        flag_type: flagType,
        flag_description: description,
        recorded_by: user?.id,
      });

      await playHorn();
    } catch (error) {
      console.error('Error recording flag:', error);
    }
  };

  // Export Results to CSV
  const exportToCSV = () => {
    const header = 'Position,Sail Number,Entry Number,Status,Finish Time,Elapsed Time\n';
    const rows = results
      .map((r, i) =>
        `${i + 1},${r.sail_number || ''},${r.entry_number || ''},${r.status},${r.finish_time || ''},${r.elapsed_time || ''}`
      )
      .join('\n');

    const csv = header + rows;
    const filename = `race_${raceNumber}_results_${new Date().toISOString().split('T')[0]}.csv`;

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } else {
      // Mobile sharing would use react-native-share or similar
      showAlert('Export', 'CSV export prepared:\n\n' + csv.substring(0, 200) + '...');
    }
  };

  // Render countdown timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSignalDescription = () => {
    if (countdownSeconds >= sequenceConfig.prep * 60) return 'Warning Signal';
    if (countdownSeconds >= sequenceConfig.one_min * 60) return 'Preparatory Signal';
    if (countdownSeconds > 0) return 'One Minute';
    return 'START!';
  };

  // Render Functions
  const renderTimerTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.timerDisplay}>
        <Text style={styles.timerText}>
          {sequenceStatus === 'countdown' ? formatTime(countdownSeconds) : '--:--'}
        </Text>
        <Text style={styles.signalText}>{getSignalDescription()}</Text>
      </View>

      <View style={styles.sequenceControls}>
        {sequenceStatus === 'idle' && (
          <>
            <View style={styles.sequenceConfig}>
              <Text style={styles.label}>Sequence: </Text>
              <TextInput
                style={styles.input}
                value={sequenceConfig.warning.toString()}
                keyboardType="number-pad"
                onChangeText={(text) => setSequenceConfig({ ...sequenceConfig, warning: parseInt(text) || 5 })}
                placeholder="5"
              />
              <Text> - </Text>
              <TextInput
                style={styles.input}
                value={sequenceConfig.prep.toString()}
                keyboardType="number-pad"
                onChangeText={(text) => setSequenceConfig({ ...sequenceConfig, prep: parseInt(text) || 4 })}
                placeholder="4"
              />
              <Text> - </Text>
              <TextInput
                style={styles.input}
                value={sequenceConfig.one_min.toString()}
                keyboardType="number-pad"
                onChangeText={(text) => setSequenceConfig({ ...sequenceConfig, one_min: parseInt(text) || 1 })}
                placeholder="1"
              />
              <Text> - 0</Text>
            </View>

            <TouchableOpacity style={styles.startButton} onPress={startCountdown}>
              <Ionicons name="play" size={32} color="#fff" />
              <Text style={styles.startButtonText}>Start Sequence</Text>
            </TouchableOpacity>
          </>
        )}

        {sequenceStatus === 'countdown' && (
          <View style={styles.countdownActions}>
            <TouchableOpacity style={styles.actionButton} onPress={postponeRace}>
              <MaterialCommunityIcons name="flag-triangle" size={24} color="#FFA500" />
              <Text style={styles.actionButtonText}>Postpone (AP)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={abandonRace}>
              <Ionicons name="close-circle" size={24} color="#FF4444" />
              <Text style={styles.actionButtonText}>Abandon (N)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => recordFlag('first_substitute', 'General Recall')}>
              <Ionicons name="repeat" size={24} color="#FFA500" />
              <Text style={styles.actionButtonText}>General Recall</Text>
            </TouchableOpacity>
          </View>
        )}

        {sequenceStatus === 'racing' && (
          <View style={styles.racingInfo}>
            <Text style={styles.racingText}>Race in Progress</Text>
            <Text style={styles.startTimeText}>
              Started: {startTime?.toLocaleTimeString()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderFinishesTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.finishHeader}>
        <Text style={styles.finishTitle}>Record Finishes</Text>
        <TouchableOpacity style={styles.exportButton} onPress={exportToCSV}>
          <Ionicons name="download" size={20} color="#4CAF50" />
          <Text style={styles.exportButtonText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const result = results.find((r) => r.entry_id === item.id);
          const isFinished = result?.status === 'finished';

          return (
            <View style={[styles.entryCard, isFinished && styles.finishedCard]}>
              <View style={styles.entryInfo}>
                <Text style={styles.sailNumber}>{item.sail_number}</Text>
                <Text style={styles.entryNumber}>#{item.entry_number}</Text>
                <Text style={styles.entryClass}>{item.entry_class}</Text>
              </View>

              {isFinished ? (
                <View style={styles.finishInfo}>
                  <Text style={styles.positionText}>P{result.finish_position}</Text>
                  <Text style={styles.finishTimeText}>
                    {result.finish_time ? new Date(result.finish_time).toLocaleTimeString() : ''}
                  </Text>
                </View>
              ) : (
                <View style={styles.entryActions}>
                  <TouchableOpacity
                    style={[styles.finishButton, result?.status !== 'racing' && styles.finishButtonDisabled]}
                    onPress={() => recordFinish(item.id)}
                    disabled={result?.status !== 'racing'}
                  >
                    <Ionicons name="flag" size={20} color="#fff" />
                    <Text style={styles.finishButtonText}>Finish</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.statusButton}
                    onPress={() => {
                      showAlertWithButtons('Update Status', 'Select status:', [
                        { text: 'DNF', onPress: () => updateBoatStatus(item.id, 'dnf') },
                        { text: 'DNS', onPress: () => updateBoatStatus(item.id, 'dns') },
                        { text: 'OCS', onPress: () => updateBoatStatus(item.id, 'ocs') },
                        { text: 'DSQ', onPress: () => updateBoatStatus(item.id, 'dsq') },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }}
                  >
                    <MaterialCommunityIcons name="alert" size={16} color="#666" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );

  const renderFlagsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Signal Flags</Text>
      <View style={styles.flagsGrid}>
        {FLAG_CONTROLS.map((flag) => (
          <TouchableOpacity
            key={flag.type}
            style={[styles.flagCard, { borderColor: flag.color }]}
            onPress={() => recordFlag(flag.type, flag.description)}
          >
            <MaterialCommunityIcons name={flag.icon as any} size={32} color={flag.color} />
            <Text style={styles.flagLabel}>{flag.label}</Text>
            <Text style={styles.flagDescription}>{flag.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderProtestsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.protestHeader}>
        <Text style={styles.tabTitle}>Protests</Text>
        <TouchableOpacity style={styles.newProtestButton} onPress={() => setShowProtestModal(true)}>
          <Ionicons name="add-circle" size={24} color="#2196F3" />
          <Text style={styles.newProtestText}>File Protest</Text>
        </TouchableOpacity>
      </View>
      <ProtestList regattaId={id!} raceNumber={raceNumber} />
    </View>
  );

  // Protest List Component
  const ProtestList = ({ regattaId, raceNumber }: { regattaId: string; raceNumber: number }) => {
    const [protests, setProtests] = useState<any[]>([]);

    useEffect(() => {
      loadProtests();

      const channelName = `protests-${regattaId}-${raceNumber}`;
      const handler = () => {
        loadProtests();
      };
      realtimeService.subscribe(
        channelName,
        {
          event: '*',
          schema: 'public',
          table: 'race_protests',
          filter: `regatta_id=eq.${regattaId}`,
        },
        handler
      );

      return () => {
        void realtimeService.unsubscribe(channelName, handler);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [regattaId, raceNumber]);

    const loadProtests = async () => {
      try {
        const { data, error } = await supabase
          .from('race_protests')
          .select('*')
          .eq('regatta_id', regattaId)
          .eq('race_number', raceNumber)
          .order('filed_at', { ascending: false });

        if (error) throw error;
        setProtests(data || []);
      } catch (error) {
        console.error('Error loading protests:', error);
      }
    };

    if (protests.length === 0) {
      return <Text style={styles.emptyText}>No protests filed yet</Text>;
    }

    return (
      <FlatList
        data={protests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.protestCard}>
            <View style={styles.protestHeader}>
              <Text style={styles.protestType}>{item.protest_type.replace('_', ' ').toUpperCase()}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getProtestStatusColor(item.status) }]}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.protestDescription} numberOfLines={2}>{item.description}</Text>
            {item.incident_location && (
              <Text style={styles.protestLocation}>Location: {item.incident_location}</Text>
            )}
            <Text style={styles.protestTime}>Filed: {new Date(item.filed_at).toLocaleString()}</Text>
          </View>
        )}
      />
    );
  };

  const getProtestStatusColor = (status: string) => {
    switch (status) {
      case 'filed': return '#FFA500';
      case 'accepted': return '#2196F3';
      case 'rejected': return '#FF4444';
      case 'decided': return '#4CAF50';
      case 'withdrawn': return '#999';
      default: return '#666';
    }
  };

  if (personaLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!clubId) {
    return (
      <View style={styles.missingContainer}>
        <Ionicons name="people-circle-outline" size={48} color="#94A3B8" />
        <Text style={styles.missingTitle}>Connect Your Club Workspace</Text>
        <Text style={styles.missingDescription}>
          Race control tools require an active club connection. Finish onboarding or refresh your workspace to continue.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshPersonaContext}>
          <Text style={styles.retryButtonText}>Retry Connection</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryLink}
          onPress={() => router.push('/(auth)/club-onboarding-chat')}
        >
          <Text style={styles.secondaryLinkText}>Open Club Onboarding</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{regatta?.name || 'Race Control'}</Text>
          <Text style={styles.headerSubtitle}>Race {raceNumber}</Text>
        </View>
        <View style={styles.raceNumberSelector}>
          <TouchableOpacity onPress={() => setRaceNumber(Math.max(1, raceNumber - 1))}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setRaceNumber(raceNumber + 1)}>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabs}>
        {[
          { key: 'timer', label: 'Timer', icon: 'timer' },
          { key: 'finishes', label: 'Finishes', icon: 'flag' },
          { key: 'flags', label: 'Flags', icon: 'flag-variant' },
          { key: 'protests', label: 'Protests', icon: 'gavel' },
          { key: 'crew', label: 'Crew', icon: 'account-group' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <MaterialCommunityIcons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.key ? '#2196F3' : '#666'}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'timer' && renderTimerTab()}
        {activeTab === 'finishes' && renderFinishesTab()}
        {activeTab === 'flags' && renderFlagsTab()}
        {activeTab === 'protests' && renderProtestsTab()}
        {activeTab === 'crew' && <CrewManifestTab raceId={id!} />}
      </ScrollView>

      {/* Protest Modal */}
      <ProtestModal
        visible={showProtestModal}
        regattaId={id!}
        raceNumber={raceNumber}
        entries={entries}
        userId={user?.id}
        onClose={() => setShowProtestModal(false)}
        onSubmit={() => {
          // Refresh protests if on protests tab
          if (activeTab === 'protests') {
            loadEntries();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  missingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#f5f5f5',
  },
  missingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  missingDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0EA5E9',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryLink: {
    marginTop: 16,
  },
  secondaryLinkText: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    padding: 5,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E3F2FD',
  },
  raceNumberSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 5,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#2196F3',
  },
  tabLabel: {
    fontSize: 12,
    color: '#666',
  },
  activeTabLabel: {
    color: '#2196F3',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 15,
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },

  // Timer Tab
  timerDisplay: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  timerText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  signalText: {
    fontSize: 18,
    color: '#666',
    marginTop: 10,
  },
  sequenceControls: {
    gap: 15,
  },
  sequenceConfig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    width: 50,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 10,
    gap: 10,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  countdownActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionButtonText: {
    marginTop: 5,
    fontSize: 12,
    textAlign: 'center',
  },
  racingInfo: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  racingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  startTimeText: {
    fontSize: 14,
    color: '#E8F5E9',
    marginTop: 5,
  },

  // Finishes Tab
  finishHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  finishTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 5,
  },
  exportButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  entryCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  finishedCard: {
    borderLeftColor: '#4CAF50',
    opacity: 0.7,
  },
  entryInfo: {
    flex: 1,
  },
  sailNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  entryNumber: {
    fontSize: 14,
    color: '#666',
  },
  entryClass: {
    fontSize: 12,
    color: '#999',
  },
  entryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  finishButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    gap: 5,
  },
  finishButtonDisabled: {
    backgroundColor: '#ccc',
  },
  finishButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  statusButton: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
  },
  finishInfo: {
    alignItems: 'flex-end',
  },
  positionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  finishTimeText: {
    fontSize: 12,
    color: '#666',
  },

  // Flags Tab
  flagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flagCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    gap: 8,
  },
  flagLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  flagDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Protests Tab
  protestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  newProtestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  newProtestText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 30,
    fontSize: 16,
  },
  protestCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  protestType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  protestDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  protestLocation: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  protestTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
});
