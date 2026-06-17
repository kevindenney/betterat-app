/**
 * Live Race Signals Screen
 * Race Committee interface for broadcasting signals
 * SAILTI-competitive feature
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useClubWorkspace } from '@/hooks/useClubWorkspace';
import { 
  raceSignalService, 
  RaceSignal, 
  RaceFlag, 
  LiveRaceState,
} from '@/services/RaceSignalService';

const QUICK_SIGNALS = [
  { 
    key: 'warning', 
    label: '5 Min Warning', 
    icon: 'flag', 
    color: '#10B981',
    flags: ['WARNING'] as RaceFlag[],
    sounds: 1,
  },
  { 
    key: 'preparatory', 
    label: '4 Min (P flag)', 
    icon: 'alert', 
    color: '#3B82F6',
    flags: ['P'] as RaceFlag[],
    sounds: 1,
  },
  { 
    key: 'one_minute', 
    label: '1 Min', 
    icon: 'time', 
    color: '#F59E0B',
    sounds: 1,
  },
  { 
    key: 'start', 
    label: 'Start', 
    icon: 'rocket', 
    color: '#10B981',
    flags: ['START'] as RaceFlag[],
    sounds: 1,
  },
  { 
    key: 'recall_x', 
    label: 'Individual Recall', 
    icon: 'close-circle', 
    color: '#1E3A8A',
    flags: ['RECALL_X'] as RaceFlag[],
    sounds: 1,
  },
  { 
    key: 'general_recall', 
    label: 'General Recall', 
    icon: 'refresh-circle', 
    color: '#F59E0B',
    flags: ['RECALL_1'] as RaceFlag[],
    sounds: 2,
  },
  { 
    key: 'postpone', 
    label: 'Postpone', 
    icon: 'pause-circle', 
    color: '#6B7280',
    flags: ['AP'] as RaceFlag[],
    sounds: 2,
  },
  { 
    key: 'abandon', 
    label: 'Abandon', 
    icon: 'stop-circle', 
    color: '#EF4444',
    flags: ['N'] as RaceFlag[],
    sounds: 3,
  },
  { 
    key: 'shorten', 
    label: 'Shorten Course', 
    icon: 'cut', 
    color: '#8B5CF6',
    flags: ['S'] as RaceFlag[],
    sounds: 2,
  },
];

const STARTING_RULES = [
  { value: 'none', label: 'Normal Start', description: 'No penalty flag' },
  { value: 'I', label: 'Rule 30.1 (I flag)', description: 'Round ends of starting line' },
  { value: 'Z', label: 'Rule 30.2 (Z flag)', description: '20% penalty' },
  { value: 'U', label: 'Rule 30.3 (U flag)', description: 'UFD rule' },
  { value: 'BLACK', label: 'Rule 30.4 (Black flag)', description: 'Black flag rule' },
];

export default function LiveSignalsScreen() {
  const router = useRouter();
  const { regattaId } = useLocalSearchParams<{ regattaId: string }>();
  const { loading: clubLoading } = useClubWorkspace();

  const [raceState, setRaceState] = useState<LiveRaceState | null>(null);
  const [signals, setSignals] = useState<RaceSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Current race selection
  const [currentRace, setCurrentRace] = useState(1);
  const [currentFleet] = useState<string | undefined>();
  const [startingRule, setStartingRule] = useState('none');
  
  // Announcement
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');

  useEffect(() => {
    if (regattaId) {
      loadData();
      
      // Subscribe to real-time signals
      const unsubscribe = raceSignalService.subscribeToSignals(regattaId, (signal) => {
        setSignals(prev => [signal, ...prev]);
      });

      return () => unsubscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId, currentRace]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [state, activeSignals, history] = await Promise.all([
        raceSignalService.getRaceState(regattaId!, currentRace, currentFleet),
        raceSignalService.getActiveSignals(regattaId!),
        raceSignalService.getSignalHistory(regattaId!, currentRace, 20),
      ]);

      setRaceState(state);
      setSignals([...activeSignals, ...history]);
    } catch (error) {
      console.error('Error loading signal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSignal = async (signalKey: string) => {
    const signal = QUICK_SIGNALS.find(s => s.key === signalKey);
    if (!signal) return;

    setSending(true);
    try {
      switch (signalKey) {
        case 'warning':
          await raceSignalService.signalWarning(regattaId!, currentRace, 'Fleet', currentFleet);
          break;
        case 'preparatory':
          await raceSignalService.signalPreparatory(regattaId!, currentRace, currentFleet);
          break;
        case 'one_minute':
          await raceSignalService.signalOneMinute(regattaId!, currentRace, currentFleet);
          break;
        case 'start':
          await raceSignalService.signalStart(regattaId!, currentRace, currentFleet);
          break;
        case 'recall_x':
          await raceSignalService.signalIndividualRecall(regattaId!, currentRace, undefined, currentFleet);
          break;
        case 'general_recall':
          await raceSignalService.signalGeneralRecall(regattaId!, currentRace, currentFleet);
          break;
        case 'postpone':
          await raceSignalService.signalPostponement(regattaId!, currentRace, undefined, currentFleet);
          break;
        case 'abandon':
          await raceSignalService.signalAbandonment(regattaId!, currentRace, false, currentFleet);
          break;
        case 'shorten':
          await raceSignalService.signalShortenedCourse(regattaId!, currentRace, currentFleet);
          break;
      }
      
      await loadData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to send signal');
    } finally {
      setSending(false);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announcementTitle.trim()) {
      showAlert('Error', 'Please enter announcement title');
      return;
    }

    setSending(true);
    try {
      await raceSignalService.signalAnnouncement(
        regattaId!,
        currentRace,
        announcementTitle.trim(),
        announcementMessage.trim(),
        currentFleet
      );
      
      setShowAnnouncement(false);
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      await loadData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to send announcement');
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'racing': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'preparatory': return '#3B82F6';
      case 'postponed': return '#6B7280';
      case 'abandoned': return '#EF4444';
      case 'finished': return '#8B5CF6';
      default: return '#94A3B8';
    }
  };

  const getStatusText = (status?: string): string => {
    switch (status) {
      case 'racing': return 'RACING';
      case 'warning': return 'WARNING';
      case 'preparatory': return 'PREPARATORY';
      case 'postponed': return 'POSTPONED';
      case 'abandoned': return 'ABANDONED';
      case 'finished': return 'FINISHED';
      case 'scheduled': return 'SCHEDULED';
      default: return 'READY';
    }
  };

  if (clubLoading || loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0EA5E9" />
          <ThemedText style={styles.loadingText}>Loading signals...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle}>Race Signals</ThemedText>
          <ThemedText style={styles.headerSubtitle}>Committee Boat</ThemedText>
        </View>
        <TouchableOpacity 
          style={styles.announcementButton}
          onPress={() => setShowAnnouncement(true)}
        >
          <Ionicons name="megaphone" size={24} color="#0EA5E9" />
        </TouchableOpacity>
      </View>

      {/* Race Selector */}
      <View style={styles.raceSelector}>
        <TouchableOpacity 
          style={styles.raceNavButton}
          onPress={() => setCurrentRace(Math.max(1, currentRace - 1))}
          disabled={currentRace <= 1}
        >
          <Ionicons name="chevron-back" size={24} color={currentRace <= 1 ? '#CBD5E1' : '#1E293B'} />
        </TouchableOpacity>
        <View style={styles.raceInfo}>
          <ThemedText style={styles.raceNumber}>Race {currentRace}</ThemedText>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(raceState?.status) }]}>
            <ThemedText style={styles.statusText}>{getStatusText(raceState?.status)}</ThemedText>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.raceNavButton}
          onPress={() => setCurrentRace(currentRace + 1)}
        >
          <Ionicons name="chevron-forward" size={24} color="#1E293B" />
        </TouchableOpacity>
      </View>

      {/* Announcement Panel */}
      {showAnnouncement && (
        <View style={styles.announcementPanel}>
          <View style={styles.announcementHeader}>
            <ThemedText style={styles.announcementHeaderText}>Send Announcement</ThemedText>
            <TouchableOpacity onPress={() => setShowAnnouncement(false)}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.announcementInput}
            placeholder="Title (e.g., Course change)"
            placeholderTextColor="#94A3B8"
            value={announcementTitle}
            onChangeText={setAnnouncementTitle}
          />
          <TextInput
            style={[styles.announcementInput, styles.announcementMessage]}
            placeholder="Message details (optional)"
            placeholderTextColor="#94A3B8"
            value={announcementMessage}
            onChangeText={setAnnouncementMessage}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSendAnnouncement}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#FFFFFF" />
                <ThemedText style={styles.sendButtonText}>Send to All</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Signal Buttons */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Quick Signals</ThemedText>
          <View style={styles.signalGrid}>
            {QUICK_SIGNALS.map((signal) => (
              <TouchableOpacity
                key={signal.key}
                style={[styles.signalButton, { borderColor: signal.color }]}
                onPress={() => {
                  showConfirm(
                    signal.label,
                    `Send ${signal.label} signal?`,
                    () => handleQuickSignal(signal.key),
                    { confirmText: 'Send' }
                  );
                }}
                disabled={sending}
              >
                <Ionicons name={signal.icon as any} size={28} color={signal.color} />
                <ThemedText style={[styles.signalButtonLabel, { color: signal.color }]}>
                  {signal.label}
                </ThemedText>
                {signal.sounds && (
                  <View style={styles.soundBadge}>
                    <ThemedText style={styles.soundText}>{signal.sounds}🔊</ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Starting Rule Selection */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Starting Rule</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {STARTING_RULES.map((rule) => (
              <TouchableOpacity
                key={rule.value}
                style={[
                  styles.ruleButton,
                  startingRule === rule.value && styles.ruleButtonSelected,
                ]}
                onPress={() => setStartingRule(rule.value)}
              >
                <ThemedText style={[
                  styles.ruleButtonLabel,
                  startingRule === rule.value && styles.ruleButtonLabelSelected,
                ]}>
                  {rule.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Signal History */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Recent Signals</ThemedText>
          
          {signals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="radio-outline" size={40} color="#94A3B8" />
              <ThemedText style={styles.emptyText}>No signals yet</ThemedText>
            </View>
          ) : (
            signals.slice(0, 10).map((signal) => {
              const flagInfo = signal.flags?.[0] 
                ? raceSignalService.getFlagInfo(signal.flags[0])
                : null;
              
              return (
                <View key={signal.id} style={styles.signalCard}>
                  <View style={[
                    styles.signalIcon,
                    { backgroundColor: flagInfo?.color || '#94A3B8' }
                  ]}>
                    <Ionicons 
                      name={signal.signal_type === 'announcement' ? 'megaphone' : 'flag'} 
                      size={18} 
                      color={flagInfo?.color === '#FFFFFF' ? '#1E293B' : '#FFFFFF'} 
                    />
                  </View>
                  <View style={styles.signalInfo}>
                    <ThemedText style={styles.signalTitle}>{signal.title}</ThemedText>
                    {signal.message && (
                      <ThemedText style={styles.signalMessage}>{signal.message}</ThemedText>
                    )}
                    <ThemedText style={styles.signalTime}>
                      Race {signal.race_number} • {formatDistanceToNow(new Date(signal.signal_time), { addSuffix: true })}
                    </ThemedText>
                  </View>
                  {!signal.is_active && (
                    <View style={styles.expiredBadge}>
                      <ThemedText style={styles.expiredText}>Expired</ThemedText>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  announcementButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#64748B',
  },
  raceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  raceNavButton: {
    padding: 8,
  },
  raceInfo: {
    alignItems: 'center',
  },
  raceNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  announcementPanel: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  announcementHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  announcementInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 12,
  },
  announcementMessage: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0EA5E9',
    paddingVertical: 14,
    borderRadius: 10,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  signalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  signalButton: {
    width: '30%',
    minWidth: 100,
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  signalButtonLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  soundBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  soundText: {
    fontSize: 10,
    color: '#64748B',
  },
  ruleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ruleButtonSelected: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  ruleButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  ruleButtonLabelSelected: {
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  signalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  signalIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  signalInfo: {
    flex: 1,
  },
  signalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  signalMessage: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  signalTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  expiredBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  expiredText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
});

