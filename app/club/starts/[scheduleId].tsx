/**
 * Multi-Class Start Scheduler
 * Rolling start sequence management for multiple fleets
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Platform,
  Modal,
  Vibration,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Plus,
  Play,
  Flag,
  Clock,
  AlertTriangle,
  Check,
  X,
  Settings,
  ChevronUp,
  ChevronDown,
  Trash2,
  RotateCcw,
  Pause,
  Users,
  Timer,
} from 'lucide-react-native';
import {
  startSchedulerService,
  StartSchedule,
  FleetStartEntry,
  TimelineEntry,
} from '@/services/StartSchedulerService';

type ViewMode = 'timeline' | 'control';

export default function MultiClassStartScheduler() {
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const router = useRouter();

  // State
  const [schedule, setSchedule] = useState<StartSchedule | null>(null);
  const [fleetEntries, setFleetEntries] = useState<FleetStartEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  // Countdown state
  const [activeFleet, setActiveFleet] = useState<FleetStartEntry | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [countdownPhase, setCountdownPhase] = useState<string>('');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Modals
  const [showAddFleetModal, setShowAddFleetModal] = useState(false);
  const [, setShowSettingsModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [selectedFleetForRecall, setSelectedFleetForRecall] = useState<FleetStartEntry | null>(null);

  // Add fleet form
  const [newFleetName, setNewFleetName] = useState('');
  const [newClassFlag, setNewClassFlag] = useState('');
  const [newRaceNumber, setNewRaceNumber] = useState('1');

  // Load data
  useEffect(() => {
    if (scheduleId) {
      loadData();
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  // Start countdown when active fleet changes
  useEffect(() => {
    if (activeFleet && schedule) {
      startCountdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFleet?.id, activeFleet?.status]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [scheduleData, entriesData, timelineData] = await Promise.all([
        startSchedulerService.getSchedule(scheduleId!),
        startSchedulerService.getFleetEntries(scheduleId!),
        startSchedulerService.getTimeline(scheduleId!),
      ]);

      setSchedule(scheduleData);
      setFleetEntries(entriesData);
      setTimeline(timelineData);

      // Find active fleet (in sequence)
      const active = entriesData.find(e =>
        ['warning', 'preparatory', 'one_minute'].includes(e.status)
      );
      setActiveFleet(active || null);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const startCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    if (!activeFleet || !schedule) return;

    countdownRef.current = setInterval(() => {
      const result = startSchedulerService.calculateCountdown(
        activeFleet,
        schedule.sequence_type
      );

      if (result) {
        setCountdown(result.secondsRemaining);
        setCountdownPhase(result.phase);

        // Alert at key moments
        if (result.secondsRemaining === 60) {
          playSound('one_minute');
        } else if (result.secondsRemaining === 0) {
          playSound('start');
        }
      }
    }, 100);
  };

  const playSound = (_type: string) => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 500]);
    }
    // Audio would be triggered here
  };

  // Fleet management
  const handleAddFleet = async () => {
    if (!newFleetName.trim()) {
      showAlert('Required', 'Please enter a fleet name');
      return;
    }

    try {
      await startSchedulerService.addFleets(scheduleId!, [{
        fleet_name: newFleetName,
        class_flag: newClassFlag || undefined,
        race_number: parseInt(newRaceNumber) || 1,
      }]);

      setShowAddFleetModal(false);
      setNewFleetName('');
      setNewClassFlag('');
      setNewRaceNumber('1');
      loadData();
    } catch (error) {
      showAlert('Error', 'Failed to add fleet');
    }
  };

  const handleRemoveFleet = async (entryId: string) => {
    showConfirm(
      'Remove Fleet',
      'Remove this fleet from the schedule?',
      async () => {
        try {
          await startSchedulerService.removeFleet(entryId);
          loadData();
        } catch (error) {
          showAlert('Error', 'Failed to remove fleet');
        }
      },
      { destructive: true }
    );
  };

  const handleMoveFleet = async (entryId: string, direction: 'up' | 'down') => {
    const currentIndex = fleetEntries.findIndex(e => e.id === entryId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= fleetEntries.length) return;

    const newOrder = [...fleetEntries];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];

    try {
      await startSchedulerService.reorderFleets(scheduleId!, newOrder.map(e => e.id));
      loadData();
    } catch (error) {
      showAlert('Error', 'Failed to reorder fleets');
    }
  };

  // Start sequence control
  const handleStartSequence = async () => {
    if (!schedule) return;

    showConfirm(
      'Start Sequence',
      'Begin the start sequence? This will signal warning for the first fleet.',
      async () => {
        try {
          const firstFleet = await startSchedulerService.startSequence(scheduleId!);
          setActiveFleet(firstFleet);
          loadData();
        } catch (error) {
          showAlert('Error', 'Failed to start sequence');
        }
      },
      { confirmText: 'Start' }
    );
  };

  const handleSignalWarning = async (entryId: string) => {
    try {
      const updated = await startSchedulerService.signalWarning(entryId);
      setActiveFleet(updated);
      loadData();
    } catch (error) {
      showAlert('Error', 'Failed to signal warning');
    }
  };

  const handleSignalPrep = async (entryId: string) => {
    try {
      const updated = await startSchedulerService.signalPreparatory(entryId);
      setActiveFleet(updated);
      loadData();
    } catch (error) {
      showAlert('Error', 'Failed to signal preparatory');
    }
  };

  const handleSignalOneMinute = async (entryId: string) => {
    try {
      const updated = await startSchedulerService.signalOneMinute(entryId);
      setActiveFleet(updated);
      loadData();
    } catch (error) {
      showAlert('Error', 'Failed to signal one minute');
    }
  };

  const handleSignalStart = async (entryId: string) => {
    try {
      await startSchedulerService.signalStart(entryId);
      setActiveFleet(null);
      loadData();
    } catch (error) {
      showAlert('Error', 'Failed to signal start');
    }
  };

  const handleGeneralRecall = async () => {
    if (!selectedFleetForRecall) return;

    try {
      await startSchedulerService.generalRecall(selectedFleetForRecall.id, 'General recall');
      setShowRecallModal(false);
      setSelectedFleetForRecall(null);
      setActiveFleet(null);
      loadData();
    } catch (error) {
      showAlert('Error', 'Failed to process general recall');
    }
  };

  const handlePostpone = async (entryId: string) => {
    showConfirm(
      'Postpone',
      'Postpone this fleet start?',
      async () => {
        try {
          await startSchedulerService.postponeFleet(entryId);
          loadData();
        } catch (error) {
          showAlert('Error', 'Failed to postpone');
        }
      },
      { confirmText: 'Postpone' }
    );
  };

  // Format countdown
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Get phase color
  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'warning': return '#D97706';
      case 'preparatory': return '#2563EB';
      case 'final': return '#DC2626';
      case 'start': return '#059669';
      default: return '#6B7280';
    }
  };

  // Render timeline view
  const renderTimelineView = () => (
    <View style={styles.timelineContainer}>
      {timeline.map((entry, index) => {
        const statusDisplay = startSchedulerService.getStatusDisplay(entry.status);
        const isActive = ['warning', 'preparatory', 'one_minute'].includes(entry.status);

        return (
          <View
            key={entry.id}
            style={[
              styles.timelineItem,
              isActive && styles.timelineItemActive,
            ]}
          >
            <View style={styles.timelineOrder}>
              <Text style={styles.orderNumber}>{entry.start_order}</Text>
            </View>

            <View style={styles.timelineContent}>
              <View style={styles.timelineHeader}>
                <View style={styles.fleetInfo}>
                  {entry.class_flag && (
                    <View style={styles.flagBadge}>
                      <Text style={styles.flagText}>{entry.class_flag}</Text>
                    </View>
                  )}
                  <Text style={styles.fleetName}>{entry.fleet_name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusDisplay.bgColor }]}>
                  <Text style={[styles.statusText, { color: statusDisplay.color }]}>
                    {statusDisplay.label}
                  </Text>
                </View>
              </View>

              <View style={styles.timelineDetails}>
                <Text style={styles.raceNumber}>Race {entry.race_number}</Text>
                {entry.planned_start_time && (
                  <Text style={styles.plannedTime}>
                    Start: {new Date(entry.planned_start_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                )}
              </View>

              {entry.recall_count > 0 && (
                <View style={styles.recallInfo}>
                  <RotateCcw size={12} color="#DC2626" />
                  <Text style={styles.recallText}>
                    {entry.recall_count} recall(s)
                  </Text>
                </View>
              )}

              {/* Quick actions for pending fleets */}
              {entry.status === 'pending' && schedule?.status !== 'draft' && (
                <View style={styles.quickActions}>
                  <TouchableOpacity
                    style={styles.quickAction}
                    onPress={() => handleSignalWarning(entry.id)}
                  >
                    <Flag size={16} color="#D97706" />
                    <Text style={styles.quickActionText}>Warning</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Reorder buttons for draft mode */}
            {schedule?.status === 'draft' && (
              <View style={styles.reorderButtons}>
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={() => handleMoveFleet(entry.id, 'up')}
                  disabled={index === 0}
                >
                  <ChevronUp size={18} color={index === 0 ? '#D1D5DB' : '#6B7280'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={() => handleMoveFleet(entry.id, 'down')}
                  disabled={index === timeline.length - 1}
                >
                  <ChevronDown size={18} color={index === timeline.length - 1 ? '#D1D5DB' : '#6B7280'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={() => handleRemoveFleet(entry.id)}
                >
                  <Trash2 size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {timeline.length === 0 && (
        <View style={styles.emptyState}>
          <Users size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Fleets Added</Text>
          <Text style={styles.emptyText}>Add fleets to build your start sequence</Text>
        </View>
      )}
    </View>
  );

  // Render control view (active during sequence)
  const renderControlView = () => {
    if (!activeFleet) {
      return (
        <View style={styles.noActiveFleet}>
          <Timer size={48} color="#D1D5DB" />
          <Text style={styles.noActiveText}>No fleet in sequence</Text>
          <Text style={styles.noActiveHint}>
            Start the sequence or signal warning for a fleet
          </Text>
        </View>
      );
    }

    const _statusDisplay = startSchedulerService.getStatusDisplay(activeFleet.status);

    return (
      <View style={styles.controlContainer}>
        {/* Active Fleet Header */}
        <View style={[styles.activeHeader, { backgroundColor: getPhaseColor(countdownPhase) }]}>
          <Text style={styles.activeFleetName}>{activeFleet.fleet_name}</Text>
          <Text style={styles.activePhase}>{countdownPhase.toUpperCase()}</Text>
        </View>

        {/* Countdown Display */}
        <View style={styles.countdownContainer}>
          <Text style={[styles.countdown, { color: getPhaseColor(countdownPhase) }]}>
            {formatCountdown(countdown)}
          </Text>
          <Text style={styles.countdownLabel}>
            {countdownPhase === 'warning' && 'Until Prep Signal'}
            {countdownPhase === 'preparatory' && 'Until 1 Minute'}
            {countdownPhase === 'final' && 'Until Start'}
            {countdownPhase === 'start' && 'GO!'}
          </Text>
        </View>

        {/* Signal Buttons */}
        <View style={styles.signalButtons}>
          {activeFleet.status === 'warning' && (
            <TouchableOpacity
              style={[styles.signalButton, styles.signalButtonPrep]}
              onPress={() => handleSignalPrep(activeFleet.id)}
            >
              <Flag size={24} color="#FFFFFF" />
              <Text style={styles.signalButtonText}>P Flag (Prep)</Text>
            </TouchableOpacity>
          )}

          {activeFleet.status === 'preparatory' && (
            <TouchableOpacity
              style={[styles.signalButton, styles.signalButtonOneMin]}
              onPress={() => handleSignalOneMinute(activeFleet.id)}
            >
              <Clock size={24} color="#FFFFFF" />
              <Text style={styles.signalButtonText}>1 Minute</Text>
            </TouchableOpacity>
          )}

          {(activeFleet.status === 'one_minute' || countdown <= 0) && (
            <TouchableOpacity
              style={[styles.signalButton, styles.signalButtonStart]}
              onPress={() => handleSignalStart(activeFleet.id)}
            >
              <Play size={24} color="#FFFFFF" />
              <Text style={styles.signalButtonText}>START</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Emergency Actions */}
        <View style={styles.emergencyActions}>
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => {
              setSelectedFleetForRecall(activeFleet);
              setShowRecallModal(true);
            }}
          >
            <RotateCcw size={18} color="#DC2626" />
            <Text style={styles.emergencyText}>General Recall</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => handlePostpone(activeFleet.id)}
          >
            <Pause size={18} color="#6B7280" />
            <Text style={styles.emergencyText}>Postpone</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Timer size={48} color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading Schedule...</Text>
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
          <Text style={styles.headerTitle}>{schedule?.name || 'Start Schedule'}</Text>
          <Text style={styles.headerSubtitle}>
            {schedule?.scheduled_date && new Date(schedule.scheduled_date).toLocaleDateString()}
            {' • '}
            {schedule?.sequence_type}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettingsModal(true)}
        >
          <Settings size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{fleetEntries.length}</Text>
          <Text style={styles.statLabel}>Fleets</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {fleetEntries.filter(e => e.status === 'started').length}
          </Text>
          <Text style={styles.statLabel}>Started</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{schedule?.start_interval_minutes || 5}m</Text>
          <Text style={styles.statLabel}>Interval</Text>
        </View>
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'timeline' && styles.toggleButtonActive]}
          onPress={() => setViewMode('timeline')}
        >
          <Clock size={18} color={viewMode === 'timeline' ? '#0EA5E9' : '#6B7280'} />
          <Text style={[
            styles.toggleText,
            viewMode === 'timeline' && styles.toggleTextActive,
          ]}>
            Timeline
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'control' && styles.toggleButtonActive]}
          onPress={() => setViewMode('control')}
        >
          <Play size={18} color={viewMode === 'control' ? '#0EA5E9' : '#6B7280'} />
          <Text style={[
            styles.toggleText,
            viewMode === 'control' && styles.toggleTextActive,
          ]}>
            Control
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {viewMode === 'timeline' ? renderTimelineView() : renderControlView()}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {schedule?.status === 'draft' && (
          <>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddFleetModal(true)}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Fleet</Text>
            </TouchableOpacity>
            {fleetEntries.length > 0 && (
              <TouchableOpacity
                style={styles.readyButton}
                onPress={async () => {
                  await startSchedulerService.markReady(scheduleId!);
                  loadData();
                }}
              >
                <Check size={20} color="#FFFFFF" />
                <Text style={styles.readyButtonText}>Mark Ready</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {schedule?.status === 'ready' && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartSequence}
          >
            <Play size={22} color="#FFFFFF" />
            <Text style={styles.startButtonText}>Start Sequence</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add Fleet Modal */}
      <Modal
        visible={showAddFleetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddFleetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Fleet</Text>
              <TouchableOpacity onPress={() => setShowAddFleetModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Fleet Name *</Text>
              <TextInput
                style={styles.input}
                value={newFleetName}
                onChangeText={setNewFleetName}
                placeholder="e.g., PHRF A, J/70, Laser"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.inputLabel}>Class Flag</Text>
              <TextInput
                style={styles.input}
                value={newClassFlag}
                onChangeText={setNewClassFlag}
                placeholder="e.g., A, J, L"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.inputLabel}>Race Number</Text>
              <TextInput
                style={styles.input}
                value={newRaceNumber}
                onChangeText={setNewRaceNumber}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <TouchableOpacity style={styles.modalButton} onPress={handleAddFleet}>
              <Text style={styles.modalButtonText}>Add Fleet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* General Recall Modal */}
      <Modal
        visible={showRecallModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecallModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.recallContent}>
            <AlertTriangle size={48} color="#DC2626" />
            <Text style={styles.recallTitle}>General Recall</Text>
            <Text style={styles.recallMessage}>
              This will restart {selectedFleetForRecall?.fleet_name} at the end of the sequence.
            </Text>
            <View style={styles.recallActions}>
              <TouchableOpacity
                style={styles.recallCancel}
                onPress={() => setShowRecallModal(false)}
              >
                <Text style={styles.recallCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.recallConfirm}
                onPress={handleGeneralRecall}
              >
                <Text style={styles.recallConfirmText}>Confirm Recall</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#1F2937',
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
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  settingsButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 8,
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    backgroundColor: '#F3F4F6',
  },
  toggleButtonActive: {
    backgroundColor: '#EFF6FF',
  },
  toggleText: {
    fontSize: 14,
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  // Timeline styles
  timelineContainer: {
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  timelineItemActive: {
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  timelineOrder: {
    width: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
  },
  timelineContent: {
    flex: 1,
    padding: 12,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fleetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flagBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  flagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  fleetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timelineDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  raceNumber: {
    fontSize: 13,
    color: '#6B7280',
  },
  plannedTime: {
    fontSize: 13,
    color: '#6B7280',
  },
  recallInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  recallText: {
    fontSize: 12,
    color: '#DC2626',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  reorderButtons: {
    padding: 8,
    gap: 4,
    justifyContent: 'center',
  },
  reorderButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  // Control view styles
  noActiveFleet: {
    alignItems: 'center',
    padding: 48,
  },
  noActiveText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  noActiveHint: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  controlContainer: {
    padding: 16,
  },
  activeHeader: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  activeFleetName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activePhase: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  countdownContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  countdown: {
    fontSize: 72,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  countdownLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  signalButtons: {
    gap: 12,
    marginBottom: 24,
  },
  signalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    gap: 12,
  },
  signalButtonPrep: {
    backgroundColor: '#007AFF',
  },
  signalButtonOneMin: {
    backgroundColor: '#DC2626',
  },
  signalButtonStart: {
    backgroundColor: '#059669',
  },
  signalButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emergencyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emergencyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emergencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7280',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  readyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  readyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingVertical: 16,
    borderRadius: 10,
    gap: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  modalButton: {
    backgroundColor: '#0EA5E9',
    margin: 16,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Recall modal
  recallContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  recallTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 16,
  },
  recallMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  recallActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  recallCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  recallCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  recallConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  recallConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

