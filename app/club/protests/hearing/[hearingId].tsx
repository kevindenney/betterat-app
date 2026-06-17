/**
 * Hearing Room View
 * Conduct protest hearings and enter decisions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Play,
  Square,
  Clock,
  Users,
  FileText,
  Check,
  X,
  AlertTriangle,
  Gavel,
  Plus,
  Image,
  MessageSquare,
} from 'lucide-react-native';
import {
  protestService,
  Protest,
  Hearing,
  Evidence,
  Witness,
  Decision,
  PanelMember,
  DecisionType,
  PenaltyType,
  DecisionFormData,
} from '@/services/ProtestService';

type TabType = 'overview' | 'evidence' | 'witnesses' | 'decision';

const DECISION_TYPES: { value: DecisionType; label: string }[] = [
  { value: 'protest_upheld', label: 'Protest Upheld' },
  { value: 'protest_dismissed', label: 'Protest Dismissed' },
  { value: 'protest_withdrawn', label: 'Protest Withdrawn' },
  { value: 'no_protest_valid', label: 'No Valid Protest' },
  { value: 'redress_granted', label: 'Redress Granted' },
  { value: 'redress_denied', label: 'Redress Denied' },
];

const PENALTY_TYPES: { value: PenaltyType; label: string }[] = [
  { value: 'none', label: 'No Penalty' },
  { value: 'dsq', label: 'DSQ - Disqualified' },
  { value: 'scoring_penalty', label: 'Scoring Penalty' },
  { value: 'time_penalty', label: 'Time Penalty' },
  { value: 'warning', label: 'Warning' },
];

export default function HearingRoom() {
  const { hearingId } = useLocalSearchParams<{ hearingId: string }>();
  const router = useRouter();

  // State
  const [hearing, setHearing] = useState<Hearing | null>(null);
  const [protest, setProtest] = useState<(Protest & {
    evidence: Evidence[];
    witnesses: Witness[];
    decision?: Decision;
  }) | null>(null);
  const [panel, setPanel] = useState<PanelMember[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Decision form state
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState<DecisionType>('protest_dismissed');
  const [factsFound, setFactsFound] = useState('');
  const [conclusions, setConclusions] = useState('');
  const [rulesApplied, setRulesApplied] = useState('');
  const [penaltyType, setPenaltyType] = useState<PenaltyType>('none');
  const [penaltyDetails, setPenaltyDetails] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearingId]);

  // Timer for in-progress hearing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (hearing?.status === 'in_progress' && hearing.actual_start_time) {
      interval = setInterval(() => {
        const start = new Date(hearing.actual_start_time!).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hearing?.status, hearing?.actual_start_time]);

  const loadData = async () => {
    try {
      // Get hearing details
      const { data: hearingData, error: hearingError } = await (await import('@/services/supabase')).supabase
        .from('protest_hearings')
        .select('*')
        .eq('id', hearingId)
        .single();

      if (hearingError) throw hearingError;
      setHearing(hearingData);

      // Get full protest details
      const protestData = await protestService.getProtest(hearingData.protest_id);
      setProtest(protestData);

      // Get panel
      const panelData = await protestService.getHearingPanel(hearingId!);
      setPanel(panelData);
    } catch (error) {
      console.error('Error loading hearing:', error);
      showAlert('Error', 'Failed to load hearing details');
    } finally {
      setLoading(false);
    }
  };

  const startHearing = async () => {
    try {
      await protestService.startHearing(hearingId!);
      await loadData();
    } catch (error) {
      showAlert('Error', 'Failed to start hearing');
    }
  };

  const endHearing = async () => {
    showConfirm(
      'End Hearing',
      'Are you sure you want to end this hearing?',
      async () => {
        try {
          await protestService.endHearing(hearingId!);
          await loadData();
        } catch (error) {
          showAlert('Error', 'Failed to end hearing');
        }
      },
      { confirmText: 'End Hearing' }
    );
  };

  const handleSubmitDecision = async () => {
    if (!factsFound.trim()) {
      showAlert('Required', 'Please enter the facts found');
      return;
    }
    if (!conclusions.trim()) {
      showAlert('Required', 'Please enter the conclusions');
      return;
    }

    setSubmittingDecision(true);
    try {
      const decision: DecisionFormData = {
        decision_type: decisionType,
        facts_found: factsFound,
        conclusions,
        rules_applied: rulesApplied.split(',').map(r => r.trim()).filter(Boolean),
        penalty_type: penaltyType,
        penalty_details: penaltyDetails || undefined,
        affected_entry_ids: protest?.protestee_entry_ids,
      };

      await protestService.enterDecision(protest!.id, hearingId!, decision);
      setShowDecisionModal(false);
      await loadData();
      showAlert('Success', 'Decision recorded and penalties applied');
    } catch (error) {
      console.error('Error submitting decision:', error);
      showAlert('Error', 'Failed to record decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render overview tab
  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Protest Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Protest {protest?.protest_number}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Type</Text>
          <Text style={styles.summaryValue}>
            {protest?.protest_type.replace(/_/g, ' ')}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Race</Text>
          <Text style={styles.summaryValue}>Race {protest?.race_number}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Protestor</Text>
          <Text style={styles.summaryValue}>
            {protest?.protestor_entry?.sail_number || 'Race Committee'}
          </Text>
        </View>
        {protest?.rule_infringed && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Rule Alleged</Text>
            <Text style={styles.summaryValue}>{protest.rule_infringed}</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Incident Description</Text>
        <Text style={styles.description}>{protest?.description}</Text>
        {protest?.incident_location && (
          <View style={styles.locationTag}>
            <Text style={styles.locationText}>📍 {protest.incident_location}</Text>
          </View>
        )}
      </View>

      {/* Panel */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Protest Committee Panel</Text>
        {panel.length > 0 ? (
          panel.map(member => (
            <View key={member.id} style={styles.panelMember}>
              <Users size={16} color="#6B7280" />
              <Text style={styles.panelName}>{member.name}</Text>
              <View style={[
                styles.roleBadge,
                member.role === 'chair' && styles.chairBadge,
              ]}>
                <Text style={[
                  styles.roleText,
                  member.role === 'chair' && styles.chairText,
                ]}>
                  {member.role}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noPanel}>No panel assigned</Text>
        )}
      </View>

      {/* Actions */}
      {protest?.decision ? (
        <View style={styles.decisionSummary}>
          <Gavel size={24} color="#10B981" />
          <Text style={styles.decisionTitle}>
            {protest.decision.decision_type.replace(/_/g, ' ')}
          </Text>
          {protest.decision.penalty_type && protest.decision.penalty_type !== 'none' && (
            <Text style={styles.decisionPenalty}>
              Penalty: {protest.decision.penalty_type.toUpperCase()}
            </Text>
          )}
        </View>
      ) : hearing?.status === 'completed' ? (
        <TouchableOpacity
          style={styles.decisionButton}
          onPress={() => setShowDecisionModal(true)}
        >
          <Gavel size={20} color="#FFFFFF" />
          <Text style={styles.decisionButtonText}>Enter Decision</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // Render evidence tab
  const renderEvidenceTab = () => (
    <View style={styles.tabContent}>
      {(protest?.evidence || []).length > 0 ? (
        protest!.evidence.map(ev => (
          <View key={ev.id} style={styles.evidenceCard}>
            <View style={styles.evidenceHeader}>
              {ev.evidence_type === 'diagram' && <Image size={20} color="#0EA5E9" />}
              {ev.evidence_type === 'witness_statement' && <MessageSquare size={20} color="#0EA5E9" />}
              {!['diagram', 'witness_statement'].includes(ev.evidence_type) && (
                <FileText size={20} color="#0EA5E9" />
              )}
              <Text style={styles.evidenceTitle}>{ev.title}</Text>
            </View>
            {ev.description && (
              <Text style={styles.evidenceDescription}>{ev.description}</Text>
            )}
            <View style={styles.evidenceFooter}>
              <Text style={styles.evidenceSubmitter}>
                From: {ev.submitted_by}
              </Text>
              <View style={[
                styles.admissionBadge,
                !ev.is_admitted && styles.notAdmittedBadge,
              ]}>
                <Text style={styles.admissionText}>
                  {ev.is_admitted ? 'Admitted' : 'Not Admitted'}
                </Text>
              </View>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <FileText size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Evidence</Text>
          <Text style={styles.emptyText}>No evidence has been submitted</Text>
        </View>
      )}
    </View>
  );

  // Render witnesses tab
  const renderWitnessesTab = () => (
    <View style={styles.tabContent}>
      {(protest?.witnesses || []).length > 0 ? (
        protest!.witnesses.map(witness => (
          <View key={witness.id} style={styles.witnessCard}>
            <View style={styles.witnessHeader}>
              <Users size={20} color="#6B7280" />
              <Text style={styles.witnessName}>{witness.name}</Text>
            </View>
            <View style={styles.witnessDetails}>
              <Text style={styles.witnessRole}>{witness.role}</Text>
              <Text style={styles.witnessCalledBy}>Called by: {witness.called_by}</Text>
            </View>
            {witness.testified && witness.testimony_summary && (
              <View style={styles.testimonySummary}>
                <Text style={styles.testimonySummaryTitle}>Testimony Summary:</Text>
                <Text style={styles.testimonySummaryText}>{witness.testimony_summary}</Text>
              </View>
            )}
            <View style={[
              styles.testifiedBadge,
              witness.testified && styles.testifiedBadgeActive,
            ]}>
              <Text style={[
                styles.testifiedText,
                witness.testified && styles.testifiedTextActive,
              ]}>
                {witness.testified ? 'Testified' : 'Not Called'}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Users size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Witnesses</Text>
          <Text style={styles.emptyText}>No witnesses have been listed</Text>
        </View>
      )}
    </View>
  );

  // Render decision tab
  const renderDecisionTab = () => (
    <View style={styles.tabContent}>
      {protest?.decision ? (
        <View style={styles.decisionCard}>
          <View style={styles.decisionHeader}>
            <Gavel size={24} color="#1F2937" />
            <Text style={styles.decisionType}>
              {protest.decision.decision_type.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>

          <View style={styles.decisionSection}>
            <Text style={styles.decisionSectionTitle}>Facts Found</Text>
            <Text style={styles.decisionText}>{protest.decision.facts_found}</Text>
          </View>

          <View style={styles.decisionSection}>
            <Text style={styles.decisionSectionTitle}>Conclusions</Text>
            <Text style={styles.decisionText}>{protest.decision.conclusions}</Text>
          </View>

          {protest.decision.rules_applied && protest.decision.rules_applied.length > 0 && (
            <View style={styles.decisionSection}>
              <Text style={styles.decisionSectionTitle}>Rules Applied</Text>
              <View style={styles.rulesList}>
                {protest.decision.rules_applied.map((rule, idx) => (
                  <View key={idx} style={styles.ruleChip}>
                    <Text style={styles.ruleChipText}>{rule}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {protest.decision.penalty_type && protest.decision.penalty_type !== 'none' && (
            <View style={styles.penaltyBox}>
              <AlertTriangle size={20} color="#DC2626" />
              <View>
                <Text style={styles.penaltyTitle}>
                  Penalty: {protest.decision.penalty_type.toUpperCase()}
                </Text>
                {protest.decision.penalty_details && (
                  <Text style={styles.penaltyDetailsText}>
                    {protest.decision.penalty_details}
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.signatureBox}>
            {protest.decision.signed_by_chair ? (
              <>
                <Check size={16} color="#10B981" />
                <Text style={styles.signedText}>
                  Signed by Chair on {new Date(protest.decision.signed_at!).toLocaleString()}
                </Text>
              </>
            ) : (
              <>
                <Clock size={16} color="#F59E0B" />
                <Text style={styles.unsignedText}>Awaiting Chair Signature</Text>
              </>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Gavel size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Decision Yet</Text>
          <Text style={styles.emptyText}>
            Complete the hearing to enter a decision
          </Text>
          {hearing?.status === 'completed' && (
            <TouchableOpacity
              style={styles.enterDecisionButton}
              onPress={() => setShowDecisionModal(true)}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.enterDecisionButtonText}>Enter Decision</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Gavel size={48} color="#DC2626" />
        <Text style={styles.loadingText}>Loading Hearing...</Text>
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
          <Text style={styles.headerTitle}>
            Hearing: {protest?.protest_number}
          </Text>
          <Text style={styles.headerSubtitle}>
            {hearing?.room_name || 'Room TBD'} • {new Date(hearing?.scheduled_time || '').toLocaleTimeString()}
          </Text>
        </View>
      </View>

      {/* Status Bar */}
      <View style={[
        styles.statusBar,
        hearing?.status === 'in_progress' && styles.statusBarActive,
        hearing?.status === 'completed' && styles.statusBarCompleted,
      ]}>
        {hearing?.status === 'scheduled' && (
          <>
            <Clock size={18} color="#F59E0B" />
            <Text style={styles.statusText}>Scheduled</Text>
            <TouchableOpacity style={styles.startButton} onPress={startHearing}>
              <Play size={16} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Start Hearing</Text>
            </TouchableOpacity>
          </>
        )}
        {hearing?.status === 'in_progress' && (
          <>
            <View style={styles.liveDot} />
            <Text style={styles.statusTextLive}>IN PROGRESS</Text>
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
            <TouchableOpacity style={styles.endButton} onPress={endHearing}>
              <Square size={14} color="#FFFFFF" />
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          </>
        )}
        {hearing?.status === 'completed' && (
          <>
            <Check size={18} color="#10B981" />
            <Text style={styles.statusTextCompleted}>Hearing Completed</Text>
          </>
        )}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'evidence', label: 'Evidence' },
          { key: 'witnesses', label: 'Witnesses' },
          { key: 'decision', label: 'Decision' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <Text style={[
              styles.tabLabel,
              activeTab === tab.key && styles.tabLabelActive,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'evidence' && renderEvidenceTab()}
        {activeTab === 'witnesses' && renderWitnessesTab()}
        {activeTab === 'decision' && renderDecisionTab()}
      </ScrollView>

      {/* Decision Modal */}
      <Modal
        visible={showDecisionModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDecisionModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDecisionModal(false)}>
              <X size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Enter Decision</Text>
            <TouchableOpacity
              style={[
                styles.submitDecisionButton,
                submittingDecision && styles.submitDecisionButtonDisabled,
              ]}
              onPress={handleSubmitDecision}
              disabled={submittingDecision}
            >
              <Text style={styles.submitDecisionButtonText}>
                {submittingDecision ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Decision Type */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Decision *</Text>
              <View style={styles.decisionOptions}>
                {DECISION_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.decisionOption,
                      decisionType === type.value && styles.decisionOptionActive,
                    ]}
                    onPress={() => setDecisionType(type.value)}
                  >
                    <Text style={[
                      styles.decisionOptionText,
                      decisionType === type.value && styles.decisionOptionTextActive,
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Facts Found */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Facts Found *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Enter the facts found during the hearing..."
                placeholderTextColor="#9CA3AF"
                value={factsFound}
                onChangeText={setFactsFound}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            {/* Conclusions */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Conclusions *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Enter the committee's conclusions..."
                placeholderTextColor="#9CA3AF"
                value={conclusions}
                onChangeText={setConclusions}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Rules Applied */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Rules Applied</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., RRS 10, RRS 14 (comma separated)"
                placeholderTextColor="#9CA3AF"
                value={rulesApplied}
                onChangeText={setRulesApplied}
              />
            </View>

            {/* Penalty */}
            {(decisionType === 'protest_upheld') && (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Penalty</Text>
                <View style={styles.penaltyOptions}>
                  {PENALTY_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.penaltyOption,
                        penaltyType === type.value && styles.penaltyOptionActive,
                      ]}
                      onPress={() => setPenaltyType(type.value)}
                    >
                      <Text style={[
                        styles.penaltyOptionText,
                        penaltyType === type.value && styles.penaltyOptionTextActive,
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {penaltyType && penaltyType !== 'none' && (
                  <TextInput
                    style={[styles.formInput, { marginTop: 12 }]}
                    placeholder="Penalty details..."
                    placeholderTextColor="#9CA3AF"
                    value={penaltyDetails}
                    onChangeText={setPenaltyDetails}
                  />
                )}
              </View>
            )}
          </ScrollView>
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
    backgroundColor: '#DC2626',
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
    color: '#FCA5A5',
    marginTop: 2,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  statusBarActive: {
    backgroundColor: '#FEE2E2',
  },
  statusBarCompleted: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },
  statusTextLive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  statusTextCompleted: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  timerText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    fontVariant: ['tabular-nums'],
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  endButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#DC2626',
  },
  tabLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  tabLabelActive: {
    color: '#DC2626',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  locationTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  locationText: {
    fontSize: 13,
    color: '#6B7280',
  },
  panelMember: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  panelName: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
  },
  roleBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  chairBadge: {
    backgroundColor: '#FEF3C7',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  chairText: {
    color: '#D97706',
  },
  noPanel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  decisionSummary: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  decisionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
    textTransform: 'uppercase',
  },
  decisionPenalty: {
    fontSize: 14,
    color: '#047857',
  },
  decisionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  decisionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
  enterDecisionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
  },
  enterDecisionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  evidenceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  evidenceTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  evidenceDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  evidenceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  evidenceSubmitter: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  admissionBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  notAdmittedBadge: {
    backgroundColor: '#FEE2E2',
  },
  admissionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  witnessCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  witnessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  witnessName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  witnessDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  witnessRole: {
    fontSize: 13,
    color: '#6B7280',
  },
  witnessCalledBy: {
    fontSize: 13,
    color: '#6B7280',
  },
  testimonySummary: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  testimonySummaryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  testimonySummaryText: {
    fontSize: 13,
    color: '#374151',
  },
  testifiedBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  testifiedBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  testifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  testifiedTextActive: {
    color: '#059669',
  },
  decisionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  decisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  decisionType: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  decisionSection: {
    marginBottom: 20,
  },
  decisionSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  decisionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  rulesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ruleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  penaltyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  penaltyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  penaltyDetailsText: {
    fontSize: 13,
    color: '#991B1B',
    marginTop: 4,
  },
  signatureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  signedText: {
    fontSize: 13,
    color: '#059669',
  },
  unsignedText: {
    fontSize: 13,
    color: '#D97706',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  submitDecisionButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  submitDecisionButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitDecisionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 100,
  },
  decisionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  decisionOption: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  decisionOptionActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  decisionOptionText: {
    fontSize: 13,
    color: '#374151',
  },
  decisionOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  penaltyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  penaltyOption: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  penaltyOptionActive: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  penaltyOptionText: {
    fontSize: 13,
    color: '#374151',
  },
  penaltyOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

