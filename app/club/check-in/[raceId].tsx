/**
 * Competitor Check-In Dashboard
 * Race-day check-in management with quick tap, QR codes, and fleet status
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Platform,
  Modal,
  Share,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Check,
  X,
  Clock,
  Users,
  QrCode,
  Search,
  Sailboat,
  Share2,
} from 'lucide-react-native';
import {
  checkInService,
  CheckIn,
  CheckInStatus,
  FleetStatus,
  RaceCheckInConfig,
} from '@/services/CheckInService';

type TabType = 'roster' | 'pending' | 'status';
type FilterType = 'all' | 'pending' | 'checked_in' | 'scratched' | 'dns';

const STATUS_CONFIG: Record<CheckInStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#D97706', bg: '#FEF3C7' },
  checked_in: { label: 'Checked In', color: '#059669', bg: '#D1FAE5' },
  late: { label: 'Late', color: '#EA580C', bg: '#FFEDD5' },
  scratched: { label: 'Scratched', color: '#6B7280', bg: '#F3F4F6' },
  dns_auto: { label: 'DNS (Auto)', color: '#DC2626', bg: '#FEE2E2' },
  dns_manual: { label: 'DNS', color: '#DC2626', bg: '#FEE2E2' },
};

export default function CheckInDashboard() {
  const { raceId } = useLocalSearchParams<{ raceId: string }>();
  const router = useRouter();

  // Parse race ID (format: regattaId_raceNumber)
  const [regattaId, raceNumberStr] = (raceId || '').split('_');
  const raceNumber = parseInt(raceNumberStr, 10);

  // State
  const [roster, setRoster] = useState<CheckIn[]>([]);
  const [fleetStatus, setFleetStatus] = useState<FleetStatus | null>(null);
  const [config, setConfig] = useState<RaceCheckInConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('roster');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (regattaId && raceNumber) {
      loadData();
      setupRealtime();
    }

    return () => {
      if (regattaId && raceNumber) {
        checkInService.unsubscribeFromCheckIns(regattaId, raceNumber);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId, raceNumber]);

  // Countdown timer
  useEffect(() => {
    if (!deadline) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Closed');
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rosterData, statusData, configData] = await Promise.all([
        checkInService.getRoster(regattaId, raceNumber),
        checkInService.getFleetStatus(regattaId, raceNumber),
        checkInService.getRaceConfig(regattaId, raceNumber),
      ]);

      setRoster(rosterData);
      setFleetStatus(statusData);
      setConfig(configData);

      if (configData?.check_in_closes_at) {
        setDeadline(new Date(configData.check_in_closes_at));
      }
    } catch (error) {
      console.error('Error loading check-in data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    checkInService.subscribeToCheckIns(regattaId, raceNumber, (updated) => {
      setRoster(prev => prev.map(r => 
        r.entry_id === updated.entry_id ? { ...r, ...updated } : r
      ));
      // Reload fleet status
      checkInService.getFleetStatus(regattaId, raceNumber).then(setFleetStatus);
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Handle check-in
  const handleCheckIn = async (entryId: string) => {
    try {
      await checkInService.checkIn(regattaId, raceNumber, entryId);
    } catch (error) {
      console.error('Error checking in:', error);
      showAlert('Error', 'Failed to check in');
    }
  };

  // Handle scratch
  const handleScratch = (entry: CheckIn) => {
    Alert.prompt(
      'Scratch Entry',
      `Withdraw ${entry.entry?.sail_number} from this race?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Scratch',
          style: 'destructive',
          onPress: async (reason) => {
            try {
              await checkInService.scratch(regattaId, raceNumber, entry.entry_id, reason);
            } catch (error) {
              showAlert('Error', 'Failed to scratch entry');
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  };

  // Handle DNS
  const handleDNS = (entry: CheckIn) => {
    showConfirm(
      'Mark DNS',
      `Mark ${entry.entry?.sail_number} as Did Not Start?`,
      async () => {
        try {
          await checkInService.markDNS(regattaId, raceNumber, entry.entry_id);
        } catch (error) {
          showAlert('Error', 'Failed to mark DNS');
        }
      },
      { destructive: true }
    );
  };

  // Handle undo
  const handleUndo = async (entryId: string) => {
    try {
      await checkInService.undoCheckIn(regattaId, raceNumber, entryId);
    } catch (error) {
      showAlert('Error', 'Failed to undo check-in');
    }
  };

  // Check in all pending
  const handleCheckInAll = () => {
    const pendingEntries = roster.filter(r => r.status === 'pending');
    if (pendingEntries.length === 0) {
      showAlert('No Pending', 'All entries have already been checked in');
      return;
    }

    showConfirm(
      'Check In All',
      `Check in ${pendingEntries.length} pending entries?`,
      async () => {
        try {
          const count = await checkInService.batchCheckIn(
            regattaId,
            raceNumber,
            pendingEntries.map(e => e.entry_id)
          );
          showAlert('Success', `${count} entries checked in`);
          loadData();
        } catch (error) {
          showAlert('Error', 'Failed to check in entries');
        }
      },
      { confirmText: 'Check In All' }
    );
  };

  // Share QR code URL
  const shareQRCode = async () => {
    if (!config?.check_in_qr_token) return;

    const url = checkInService.getQRCodeUrl(config.check_in_qr_token);
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav?.share) {
          await nav.share({ text: `Check in for Race ${raceNumber}: ${url}`, url });
        } else if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(url);
          showAlert('Copied', 'Check-in link copied to clipboard');
        }
      } else {
        await Share.share({
          message: `Check in for Race ${raceNumber}: ${url}`,
          url,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Filter roster
  const filteredRoster = roster.filter(entry => {
    // Apply status filter
    if (filter !== 'all') {
      if (filter === 'pending' && entry.status !== 'pending') return false;
      if (filter === 'checked_in' && !['checked_in', 'late'].includes(entry.status)) return false;
      if (filter === 'scratched' && entry.status !== 'scratched') return false;
      if (filter === 'dns' && !['dns_auto', 'dns_manual'].includes(entry.status)) return false;
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        entry.entry?.sail_number?.toLowerCase().includes(query) ||
        entry.entry?.boat_name?.toLowerCase().includes(query) ||
        entry.entry?.skipper_name?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Render roster tab
  const renderRosterTab = () => (
    <View style={styles.tabContent}>
      {/* Search & Filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sail number, boat..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
        {(['all', 'pending', 'checked_in', 'scratched', 'dns'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterChipText,
              filter === f && styles.filterChipTextActive,
            ]}>
              {f === 'all' ? 'All' : 
               f === 'checked_in' ? 'Checked In' :
               f === 'dns' ? 'DNS' :
               f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'all' ? ` (${roster.length})` :
               f === 'pending' ? ` (${fleetStatus?.pending || 0})` :
               f === 'checked_in' ? ` (${fleetStatus?.checkedIn || 0})` :
               f === 'scratched' ? ` (${fleetStatus?.scratched || 0})` :
               ` (${fleetStatus?.dns || 0})`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Roster List */}
      {filteredRoster.map(entry => {
        const statusConfig = STATUS_CONFIG[entry.status];
        return (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryMain}>
              <View style={styles.sailBadge}>
                <Text style={styles.sailNumber}>{entry.entry?.sail_number}</Text>
              </View>
              <View style={styles.entryInfo}>
                <Text style={styles.boatName}>
                  {entry.entry?.boat_name || entry.entry?.skipper_name || '—'}
                </Text>
                {entry.entry?.boat_name && entry.entry?.skipper_name && (
                  <Text style={styles.skipperName}>{entry.entry.skipper_name}</Text>
                )}
                {entry.entry?.entry_class && (
                  <Text style={styles.boatClass}>{entry.entry.entry_class}</Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>

            <View style={styles.entryActions}>
              {entry.status === 'pending' && (
                <>
                  <TouchableOpacity
                    style={styles.checkInButton}
                    onPress={() => handleCheckIn(entry.entry_id)}
                  >
                    <Check size={18} color="#FFFFFF" />
                    <Text style={styles.checkInButtonText}>Check In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => handleScratch(entry)}
                  >
                    <X size={16} color="#6B7280" />
                  </TouchableOpacity>
                </>
              )}
              {(entry.status === 'checked_in' || entry.status === 'late') && (
                <>
                  <Text style={styles.checkedInTime}>
                    ✓ {entry.checked_in_at && new Date(entry.checked_in_at).toLocaleTimeString()}
                  </Text>
                  <TouchableOpacity
                    style={styles.undoButton}
                    onPress={() => handleUndo(entry.entry_id)}
                  >
                    <Text style={styles.undoButtonText}>Undo</Text>
                  </TouchableOpacity>
                </>
              )}
              {entry.status === 'scratched' && (
                <Text style={styles.scratchReason}>
                  {entry.scratch_reason || 'Withdrawn'}
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {filteredRoster.length === 0 && (
        <View style={styles.emptyState}>
          <Users size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Entries</Text>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No entries match your search' : 'No entries to display'}
          </Text>
        </View>
      )}
    </View>
  );

  // Render pending tab (quick view)
  const renderPendingTab = () => {
    const pending = roster.filter(r => r.status === 'pending');
    
    return (
      <View style={styles.tabContent}>
        <View style={styles.pendingHeader}>
          <Text style={styles.pendingCount}>
            {pending.length} boat{pending.length !== 1 ? 's' : ''} not checked in
          </Text>
          {pending.length > 0 && (
            <TouchableOpacity style={styles.checkInAllButton} onPress={handleCheckInAll}>
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.checkInAllText}>Check In All</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.pendingGrid}>
          {pending.map(entry => (
            <TouchableOpacity
              key={entry.id}
              style={styles.pendingCard}
              onPress={() => handleCheckIn(entry.entry_id)}
              onLongPress={() => handleDNS(entry)}
            >
              <Text style={styles.pendingSail}>{entry.entry?.sail_number}</Text>
              <Text style={styles.pendingBoat}>{entry.entry?.boat_name || '—'}</Text>
              <Text style={styles.pendingHint}>Tap to check in</Text>
            </TouchableOpacity>
          ))}
        </View>

        {pending.length === 0 && (
          <View style={styles.allCheckedIn}>
            <Check size={48} color="#10B981" />
            <Text style={styles.allCheckedInTitle}>All Checked In!</Text>
            <Text style={styles.allCheckedInText}>
              {fleetStatus?.checkedIn} of {fleetStatus?.total} boats ready to race
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Render status tab
  const renderStatusTab = () => (
    <View style={styles.tabContent}>
      {/* Progress Circle */}
      <View style={styles.progressCard}>
        <View style={styles.progressCircle}>
          <Text style={styles.progressPercent}>{fleetStatus?.percentage || 0}%</Text>
          <Text style={styles.progressLabel}>Checked In</Text>
        </View>
        <View style={styles.progressStats}>
          <View style={styles.progressStat}>
            <Text style={styles.progressStatValue}>{fleetStatus?.checkedIn || 0}</Text>
            <Text style={styles.progressStatLabel}>Ready</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={[styles.progressStatValue, { color: '#F59E0B' }]}>
              {fleetStatus?.pending || 0}
            </Text>
            <Text style={styles.progressStatLabel}>Pending</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={[styles.progressStatValue, { color: '#EF4444' }]}>
              {(fleetStatus?.scratched || 0) + (fleetStatus?.dns || 0)}
            </Text>
            <Text style={styles.progressStatLabel}>Out</Text>
          </View>
        </View>
      </View>

      {/* By Division */}
      {fleetStatus?.byDivision && Object.keys(fleetStatus.byDivision).length > 1 && (
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>By Division</Text>
          {Object.entries(fleetStatus.byDivision).map(([division, stats]) => (
            <View key={division} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{division}</Text>
              <View style={styles.breakdownBar}>
                <View 
                  style={[
                    styles.breakdownFill,
                    { width: `${(stats.checkedIn / stats.total) * 100}%` }
                  ]} 
                />
              </View>
              <Text style={styles.breakdownValue}>
                {stats.checkedIn}/{stats.total}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* By Class */}
      {fleetStatus?.byClass && Object.keys(fleetStatus.byClass).length > 1 && (
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>By Class</Text>
          {Object.entries(fleetStatus.byClass).map(([boatClass, stats]) => (
            <View key={boatClass} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{boatClass}</Text>
              <View style={styles.breakdownBar}>
                <View 
                  style={[
                    styles.breakdownFill,
                    { width: `${(stats.checkedIn / stats.total) * 100}%` }
                  ]} 
                />
              </View>
              <Text style={styles.breakdownValue}>
                {stats.checkedIn}/{stats.total}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Sailboat size={48} color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading Check-In...</Text>
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
          <Text style={styles.headerTitle}>Race {raceNumber} Check-In</Text>
          {timeRemaining && (
            <View style={styles.deadlineRow}>
              <Clock size={14} color={timeRemaining === 'Closed' ? '#FCA5A5' : '#BAE6FD'} />
              <Text style={[
                styles.headerDeadline,
                timeRemaining === 'Closed' && styles.headerDeadlineClosed,
              ]}>
                {timeRemaining === 'Closed' ? 'Check-in closed' : `Closes in ${timeRemaining}`}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.qrButton} onPress={() => setShowQRModal(true)}>
          <QrCode size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Quick Stats Bar */}
      <View style={styles.quickStats}>
        <View style={styles.quickStat}>
          <Text style={styles.quickStatValue}>{fleetStatus?.checkedIn || 0}</Text>
          <Text style={styles.quickStatLabel}>Ready</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStat}>
          <Text style={[styles.quickStatValue, { color: '#F59E0B' }]}>
            {fleetStatus?.pending || 0}
          </Text>
          <Text style={styles.quickStatLabel}>Pending</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStat}>
          <Text style={styles.quickStatValue}>{fleetStatus?.total || 0}</Text>
          <Text style={styles.quickStatLabel}>Total</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'roster', label: 'Roster', icon: Users },
          { key: 'pending', label: 'Pending', icon: Clock },
          { key: 'status', label: 'Status', icon: Sailboat },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as TabType)}
            >
              <Icon size={18} color={isActive ? '#0EA5E9' : '#6B7280'} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'roster' && renderRosterTab()}
        {activeTab === 'pending' && renderPendingTab()}
        {activeTab === 'status' && renderStatusTab()}
      </ScrollView>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <Text style={styles.qrModalTitle}>Self Check-In QR Code</Text>
            
            <View style={styles.qrPlaceholder}>
              <QrCode size={120} color="#1F2937" />
              <Text style={styles.qrNote}>
                Scan to check in
              </Text>
            </View>

            {config?.check_in_qr_token && (
              <View style={styles.qrUrl}>
                <Text style={styles.qrUrlText} numberOfLines={1}>
                  {checkInService.getQRCodeUrl(config.check_in_qr_token)}
                </Text>
              </View>
            )}

            <View style={styles.qrActions}>
              <TouchableOpacity style={styles.qrAction} onPress={shareQRCode}>
                <Share2 size={18} color="#0EA5E9" />
                <Text style={styles.qrActionText}>Share Link</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.qrClose}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.qrCloseText}>Close</Text>
            </TouchableOpacity>
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
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerDeadline: {
    fontSize: 13,
    color: '#BAE6FD',
  },
  headerDeadlineClosed: {
    color: '#FCA5A5',
  },
  qrButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: 10,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10B981',
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0EA5E9',
  },
  tabLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  tabLabelActive: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 15,
    color: '#1F2937',
  },
  filterBar: {
    marginBottom: 16,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0EA5E9',
  },
  filterChipText: {
    fontSize: 13,
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  entryMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sailBadge: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  sailNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  entryInfo: {
    flex: 1,
  },
  boatName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  skipperName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  boatClass: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  checkInButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  checkInButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  checkedInTime: {
    flex: 1,
    fontSize: 13,
    color: '#10B981',
  },
  undoButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  undoButtonText: {
    fontSize: 13,
    color: '#6B7280',
  },
  scratchReason: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
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
    textAlign: 'center',
    marginTop: 8,
  },
  // Pending tab
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pendingCount: {
    fontSize: 15,
    color: '#6B7280',
  },
  checkInAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  checkInAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FEF3C7',
  },
  pendingSail: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  pendingBoat: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  pendingHint: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 8,
  },
  allCheckedIn: {
    alignItems: 'center',
    padding: 48,
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
  },
  allCheckedInTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#059669',
    marginTop: 16,
  },
  allCheckedInText: {
    fontSize: 14,
    color: '#065F46',
    marginTop: 8,
  },
  // Status tab
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  progressCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  progressPercent: {
    fontSize: 36,
    fontWeight: '700',
    color: '#059669',
  },
  progressLabel: {
    fontSize: 14,
    color: '#065F46',
  },
  progressStats: {
    flexDirection: 'row',
    gap: 32,
  },
  progressStat: {
    alignItems: 'center',
  },
  progressStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  progressStatLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  breakdownLabel: {
    width: 100,
    fontSize: 13,
    color: '#374151',
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  breakdownValue: {
    width: 50,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  qrModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrNote: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 12,
  },
  qrUrl: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    width: '100%',
    marginBottom: 16,
  },
  qrUrlText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  qrActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  qrAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  qrActionText: {
    fontSize: 14,
    color: '#0EA5E9',
  },
  qrClose: {
    paddingVertical: 12,
  },
  qrCloseText: {
    fontSize: 15,
    color: '#6B7280',
  },
});

