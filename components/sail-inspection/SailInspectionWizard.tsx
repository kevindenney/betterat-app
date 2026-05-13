/**
 * SailInspectionWizard
 *
 * Multi-step guided inspection flow orchestrator.
 * Manages the full inspection workflow from start to completion.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Camera,
} from 'lucide-react-native';

import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { SailZoneSelector, ZoneStatus } from './SailZoneSelector';
import { PhotoCaptureModal } from './PhotoCaptureModal';
import { SailZone, ZoneAnalysisResult, SailContext, SailType } from '@/services/ai/SailAnalysisAIService';
import { SailInspectionService, InspectionSession, InspectionType, SailInspection } from '@/services/SailInspectionService';

// =============================================================================
// Types
// =============================================================================

interface SailInspectionWizardProps {
  /** Equipment ID of the sail */
  equipmentId: string;
  /** Boat ID (for context) */
  boatId?: string;
  /** Display name of the sail */
  sailName: string;
  /** Type of sail (optional - used for AI context) */
  sailType?: SailType;
  /** Additional context for AI analysis */
  sailContext?: SailContext;
  /** Type of inspection to perform */
  inspectionType?: InspectionType;
  /** Called when inspection is complete */
  onComplete: (inspection: SailInspection) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

type WizardStep = 'mode-select' | 'guided-inspect' | 'quick-inspect' | 'review' | 'complete';

const INSPECTION_ZONES: SailZone[] = ['head', 'leech', 'foot', 'luff', 'battens', 'cloth'];

// =============================================================================
// Component
// =============================================================================

export function SailInspectionWizard({
  equipmentId,
  boatId: _boatId,
  sailName,
  sailType,
  sailContext,
  inspectionType = 'full',
  onComplete,
  onCancel,
}: SailInspectionWizardProps) {
  // State
  const [step, setStep] = useState<WizardStep>('mode-select');
  const [session, setSession] = useState<InspectionSession | null>(null);
  const [currentZoneIndex, setCurrentZoneIndex] = useState(0);
  const [_selectedZone, setSelectedZone] = useState<SailZone | null>(null);
  const [zoneResults, setZoneResults] = useState<Map<SailZone, ZoneAnalysisResult>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [_error, setError] = useState<string | null>(null);

  // Derived state
  const currentZone = INSPECTION_ZONES[currentZoneIndex];
  const completedZones = Array.from(zoneResults.keys());
  const progress = (completedZones.length / INSPECTION_ZONES.length) * 100;

  // Zone statuses for the selector
  const zoneStatuses: Partial<Record<SailZone, ZoneStatus>> = {};
  for (const zone of INSPECTION_ZONES) {
    const result = zoneResults.get(zone);
    if (result) {
      zoneStatuses[zone] = {
        score: result.conditionScore,
        hasIssues: result.issues.length > 0,
        isComplete: true,
      };
    }
  }

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const startGuidedInspection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const newSession = await SailInspectionService.startInspection(
        equipmentId,
        inspectionType,
        'guided'
      );
      setSession(newSession);
      setStep('guided-inspect');
      setCurrentZoneIndex(0);
    } catch (err: any) {
      setError(err.message || 'Failed to start inspection');
      showAlert('Error', 'Failed to start inspection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [equipmentId, inspectionType]);

  const startQuickInspection = useCallback(async () => {
    setStep('quick-inspect');
    setShowPhotoModal(true);
  }, []);

  const handleZonePress = useCallback((zone: SailZone) => {
    const zoneIndex = INSPECTION_ZONES.indexOf(zone);
    if (zoneIndex !== -1) {
      setCurrentZoneIndex(zoneIndex);
      setSelectedZone(zone);
    }
  }, []);

  const handleCapturePhoto = useCallback(async (photoUri: string) => {
    if (!session) return;

    setIsAnalyzing(true);
    setShowPhotoModal(false);

    try {
      const result = await SailInspectionService.submitZonePhoto(
        session.inspection.id,
        currentZone,
        photoUri,
        sailContext
      );

      // Update local state
      setZoneResults(prev => new Map(prev).set(currentZone, result));

      // Auto-advance to next zone if available
      if (currentZoneIndex < INSPECTION_ZONES.length - 1) {
        setCurrentZoneIndex(prev => prev + 1);
      } else {
        // All zones complete, go to review
        setStep('review');
      }
    } catch (err: any) {
      showAlert('Analysis Error', err.message || 'Failed to analyze photo');
    } finally {
      setIsAnalyzing(false);
    }
  }, [session, currentZone, currentZoneIndex, sailContext]);

  const handleQuickCapture = useCallback(async (photoUri: string) => {
    setIsAnalyzing(true);
    setShowPhotoModal(false);

    try {
      const inspection = await SailInspectionService.performQuickInspection(
        equipmentId,
        photoUri,
        sailContext
      );
      onComplete(inspection);
    } catch (err: any) {
      showAlert('Analysis Error', err.message || 'Failed to analyze photo');
      setStep('mode-select');
    } finally {
      setIsAnalyzing(false);
    }
  }, [equipmentId, sailContext, onComplete]);

  const handleCompleteInspection = useCallback(async () => {
    if (!session) return;

    setIsLoading(true);
    try {
      const results = Array.from(zoneResults.values());
      const inspection = await SailInspectionService.completeInspection(
        session.inspection.id,
        results,
        sailContext
      );
      onComplete(inspection);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to complete inspection');
    } finally {
      setIsLoading(false);
    }
  }, [session, zoneResults, sailContext, onComplete]);

  const goToPreviousZone = useCallback(() => {
    if (currentZoneIndex > 0) {
      setCurrentZoneIndex(prev => prev - 1);
    }
  }, [currentZoneIndex]);

  const goToNextZone = useCallback(() => {
    if (currentZoneIndex < INSPECTION_ZONES.length - 1) {
      setCurrentZoneIndex(prev => prev + 1);
    }
  }, [currentZoneIndex]);

  // ===========================================================================
  // Render Methods
  // ===========================================================================

  const renderModeSelect = () => (
    <View style={styles.modeSelectContainer}>
      <Text style={styles.modeTitle}>Choose Inspection Mode</Text>
      <Text style={styles.modeSubtitle}>
        Select how you'd like to inspect {sailName}
      </Text>

      <TouchableOpacity
        style={styles.modeCard}
        onPress={startGuidedInspection}
        disabled={isLoading}
      >
        <View style={styles.modeIconContainer}>
          <Camera size={32} color="#3B82F6" />
        </View>
        <View style={styles.modeContent}>
          <Text style={styles.modeCardTitle}>Guided Inspection</Text>
          <Text style={styles.modeCardDesc}>
            Step-by-step inspection of each zone with analysis
          </Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>Recommended</Text>
          </View>
        </View>
        <ChevronRight size={24} color="#9CA3AF" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modeCard}
        onPress={startQuickInspection}
        disabled={isLoading}
      >
        <View style={[styles.modeIconContainer, { backgroundColor: '#FEF3C7' }]}>
          <Zap size={32} color="#F59E0B" />
        </View>
        <View style={styles.modeContent}>
          <Text style={styles.modeCardTitle}>Quick Inspection</Text>
          <Text style={styles.modeCardDesc}>
            Single photo for quick overall assessment
          </Text>
        </View>
        <ChevronRight size={24} color="#9CA3AF" />
      </TouchableOpacity>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Starting inspection...</Text>
        </View>
      )}
    </View>
  );

  const renderGuidedInspect = () => (
    <View style={styles.guidedContainer}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {completedZones.length} of {INSPECTION_ZONES.length} zones
        </Text>
      </View>

      {/* Sail Diagram */}
      <View style={styles.diagramContainer}>
        <SailZoneSelector
          sailType={sailType === 'spinnaker' ? 'spinnaker' : 'mainsail'}
          zoneStatuses={zoneStatuses}
          selectedZone={currentZone}
          onZonePress={handleZonePress}
          size="medium"
        />
      </View>

      {/* Current Zone Info */}
      <View style={styles.zoneInfoCard}>
        <Text style={styles.zoneInfoTitle}>
          {currentZone.charAt(0).toUpperCase() + currentZone.slice(1)} Zone
        </Text>

        {zoneResults.has(currentZone) ? (
          <View style={styles.zoneResultPreview}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreText}>
                {zoneResults.get(currentZone)?.conditionScore}
              </Text>
            </View>
            <View style={styles.zoneResultDetails}>
              <Text style={styles.zoneResultStatus}>
                {zoneResults.get(currentZone)?.raceReady ? 'Race Ready' : 'Needs Attention'}
              </Text>
              <Text style={styles.zoneResultIssues}>
                {zoneResults.get(currentZone)?.issues.length || 0} issues found
              </Text>
            </View>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() => setShowPhotoModal(true)}
            >
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={() => setShowPhotoModal(true)}
            disabled={isAnalyzing}
          >
            <Camera size={24} color="#fff" />
            <Text style={styles.captureButtonText}>
              {isAnalyzing ? 'Analyzing...' : 'Capture Photo'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Navigation */}
      <View style={styles.navigationRow}>
        <TouchableOpacity
          style={[styles.navButton, currentZoneIndex === 0 && styles.navButtonDisabled]}
          onPress={goToPreviousZone}
          disabled={currentZoneIndex === 0}
        >
          <ChevronLeft size={20} color={currentZoneIndex === 0 ? '#9CA3AF' : '#374151'} />
          <Text style={[styles.navButtonText, currentZoneIndex === 0 && styles.navButtonTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        {completedZones.length === INSPECTION_ZONES.length ? (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => setStep('review')}
          >
            <Text style={styles.reviewButtonText}>Review Results</Text>
            <ChevronRight size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navButton, currentZoneIndex === INSPECTION_ZONES.length - 1 && styles.navButtonDisabled]}
            onPress={goToNextZone}
            disabled={currentZoneIndex === INSPECTION_ZONES.length - 1}
          >
            <Text style={[styles.navButtonText, currentZoneIndex === INSPECTION_ZONES.length - 1 && styles.navButtonTextDisabled]}>
              Next
            </Text>
            <ChevronRight size={20} color={currentZoneIndex === INSPECTION_ZONES.length - 1 ? '#9CA3AF' : '#374151'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderReview = () => {
    const results = Array.from(zoneResults.values());
    const avgScore = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.conditionScore, 0) / results.length)
      : 0;
    const allRaceReady = results.every(r => r.raceReady);
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

    return (
      <ScrollView style={styles.reviewContainer}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryScore}>
            <Text style={styles.summaryScoreValue}>{avgScore}</Text>
            <Text style={styles.summaryScoreLabel}>Overall Score</Text>
          </View>

          <View style={styles.summaryStatus}>
            {allRaceReady ? (
              <>
                <CheckCircle2 size={24} color="#10B981" />
                <Text style={styles.summaryStatusTextGood}>Race Ready</Text>
              </>
            ) : (
              <>
                <AlertTriangle size={24} color="#F59E0B" />
                <Text style={styles.summaryStatusTextWarning}>Needs Attention</Text>
              </>
            )}
          </View>

          <Text style={styles.summaryIssues}>
            {totalIssues} issue{totalIssues !== 1 ? 's' : ''} detected across {results.length} zones
          </Text>
        </View>

        {/* Zone Results */}
        <Text style={styles.sectionTitle}>Zone Results</Text>
        {results.map((result) => (
          <View key={result.zone} style={styles.zoneResultCard}>
            <View style={styles.zoneResultHeader}>
              <Text style={styles.zoneResultName}>
                {result.zone.charAt(0).toUpperCase() + result.zone.slice(1)}
              </Text>
              <View style={[
                styles.zoneScoreBadge,
                { backgroundColor: result.conditionScore >= 80 ? '#D1FAE5' : result.conditionScore >= 60 ? '#FEF3C7' : '#FEE2E2' }
              ]}>
                <Text style={[
                  styles.zoneScoreText,
                  { color: result.conditionScore >= 80 ? '#065F46' : result.conditionScore >= 60 ? '#92400E' : '#991B1B' }
                ]}>
                  {result.conditionScore}
                </Text>
              </View>
            </View>

            {result.issues.length > 0 && (
              <View style={styles.issuesList}>
                {result.issues.slice(0, 2).map((issue, idx) => (
                  <Text key={idx} style={styles.issueText}>
                    {'\u2022'} {issue.description}
                  </Text>
                ))}
                {result.issues.length > 2 && (
                  <Text style={styles.moreIssues}>
                    +{result.issues.length - 2} more
                  </Text>
                )}
              </View>
            )}
          </View>
        ))}

        {/* Complete Button */}
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleCompleteInspection}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <CheckCircle2 size={24} color="#fff" />
          )}
          <Text style={styles.completeButtonText}>
            {isLoading ? 'Saving...' : 'Complete Inspection'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  // ===========================================================================
  // Main Render
  // ===========================================================================

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
          <X size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Sail Inspection</Text>
          <Text style={styles.headerSubtitle}>{sailName}</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {/* Content */}
      {step === 'mode-select' && renderModeSelect()}
      {step === 'guided-inspect' && renderGuidedInspect()}
      {step === 'quick-inspect' && isAnalyzing && (
        <View style={styles.analyzingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.analyzingText}>Analyzing sail condition...</Text>
        </View>
      )}
      {step === 'review' && renderReview()}

      {/* Photo Capture Modal */}
      <PhotoCaptureModal
        visible={showPhotoModal}
        zone={step === 'quick-inspect' ? 'overview' : currentZone}
        onCapture={step === 'quick-inspect' ? handleQuickCapture : handleCapturePhoto}
        onCancel={() => {
          setShowPhotoModal(false);
          if (step === 'quick-inspect') {
            setStep('mode-select');
          }
        }}
        isAnalyzing={isAnalyzing}
      />
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // Mode Select
  modeSelectContainer: {
    flex: 1,
    padding: 24,
  },
  modeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  modeSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  modeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeContent: {
    flex: 1,
    marginLeft: 16,
  },
  modeCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  modeCardDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  modeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 8,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },

  // Guided Inspection
  guidedContainer: {
    flex: 1,
  },
  progressContainer: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  diagramContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  zoneInfoCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
  },
  zoneInfoTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
  },
  captureButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  zoneResultPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  zoneResultDetails: {
    flex: 1,
  },
  zoneResultStatus: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  zoneResultIssues: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  retakeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
  },
  retakeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 'auto',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  navButtonTextDisabled: {
    color: '#9CA3AF',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reviewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Review
  reviewContainer: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryScore: {
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryScoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#111827',
  },
  summaryScoreLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  summaryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryStatusTextGood: {
    fontSize: 17,
    fontWeight: '600',
    color: '#10B981',
  },
  summaryStatusTextWarning: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F59E0B',
  },
  summaryIssues: {
    fontSize: 13,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  zoneResultCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  zoneResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zoneResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  zoneScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  zoneScoreText: {
    fontSize: 14,
    fontWeight: '700',
  },
  issuesList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  issueText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  moreIssues: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  completeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },

  // Analyzing
  analyzingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingText: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: '500',
    color: '#6B7280',
  },
});

export default SailInspectionWizard;
