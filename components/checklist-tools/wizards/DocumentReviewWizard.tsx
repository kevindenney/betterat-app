/**
 * DocumentReviewWizard
 *
 * Multi-purpose wizard for reviewing race documents (NOR, SI).
 * Shows uploaded document, extracts key info, and allows marking as reviewed.
 * If no document is uploaded, prompts user to upload one.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Linking,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  CheckCircle2,
  Circle,
  AlertTriangle,
  FileText,
  Upload,
  ExternalLink,
  Clock,
  MapPin,
  Radio,
  Flag,
  AlertCircle,
  BookOpen,
  Check,
  Sailboat,
  Users,
  Shield,
  Link2,
  Sparkles,
  RefreshCw,
  DollarSign,
  Trophy,
  Ship,
  Calendar,
  Navigation,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { ChecklistToolProps } from '@/lib/checklists/toolRegistry';
import { useRaceDocuments } from '@/hooks/useRaceDocuments';
import { useAuth } from '@/providers/AuthProvider';
import type { RaceDocumentType } from '@/services/RaceDocumentService';

// iOS System Colors
const IOS_COLORS = {
  blue: '#007AFF',
  purple: '#5856D6',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  gray: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  gray4: '#3A3A3C',
  gray5: '#2C2C2E',
  background: '#F2F2F7',
  secondaryBackground: '#FFFFFF',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C4399',
  separator: '#3C3C4349',
};

// Document type configuration
interface DocumentTypeConfig {
  type: RaceDocumentType;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
  checkItems: {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[];
}

const DOCUMENT_CONFIGS: Record<string, DocumentTypeConfig> = {
  nor_review: {
    type: 'nor',
    label: 'Notice of Race',
    shortLabel: 'NOR',
    description: 'Review the NOR for entry requirements, schedule, and race format',
    icon: <FileText size={32} color={IOS_COLORS.purple} />,
    checkItems: [
      {
        id: 'entry_requirements',
        label: 'Entry Requirements',
        description: 'Eligibility, membership, and registration requirements',
        icon: <Users size={20} color={IOS_COLORS.blue} />,
      },
      {
        id: 'schedule',
        label: 'Schedule & Dates',
        description: 'Race dates, registration deadlines, prize giving',
        icon: <Clock size={20} color={IOS_COLORS.orange} />,
      },
      {
        id: 'venue',
        label: 'Venue & Location',
        description: 'Race area, club facilities, launching',
        icon: <MapPin size={20} color={IOS_COLORS.green} />,
      },
      {
        id: 'equipment',
        label: 'Equipment Requirements',
        description: 'Required safety gear, restrictions, inspections',
        icon: <Shield size={20} color={IOS_COLORS.red} />,
      },
      {
        id: 'scoring',
        label: 'Scoring & Prizes',
        description: 'Scoring system, series scoring, trophies',
        icon: <Flag size={20} color={IOS_COLORS.purple} />,
      },
    ],
  },
  si_review: {
    type: 'sailing_instructions',
    label: 'Sailing Instructions',
    shortLabel: 'SI',
    description: 'Review the SI for course info, signals, and special procedures',
    icon: <Sailboat size={32} color={IOS_COLORS.blue} />,
    checkItems: [
      {
        id: 'signals',
        label: 'Race Signals',
        description: 'Starting signals, flag sequences, sound signals',
        icon: <Flag size={20} color={IOS_COLORS.orange} />,
      },
      {
        id: 'course',
        label: 'Course Configuration',
        description: 'Marks, rounding order, course changes',
        icon: <MapPin size={20} color={IOS_COLORS.blue} />,
      },
      {
        id: 'vhf',
        label: 'VHF & Communication',
        description: 'Race committee channel, emergency contacts',
        icon: <Radio size={20} color={IOS_COLORS.green} />,
      },
      {
        id: 'time_limits',
        label: 'Time Limits',
        description: 'Race time limit, mark time limits, finishing',
        icon: <Clock size={20} color={IOS_COLORS.purple} />,
      },
      {
        id: 'penalties',
        label: 'Penalties & Protests',
        description: 'Penalty turns, protest procedure, arbitration',
        icon: <AlertCircle size={20} color={IOS_COLORS.red} />,
      },
    ],
  },
};

type WizardStep = 'check_document' | 'review' | 'complete';

// ============================================================================
// Extracted Data for Checklist Items - Inline display of extracted NOR data
// ============================================================================

interface ExtractedField {
  icon: React.ReactNode;
  label: string;
  value: string;
  url?: string;
}

/**
 * Maps checklist item IDs to relevant extracted data fields
 */
function getExtractedDataForChecklistItem(
  itemId: string,
  data: any | null
): ExtractedField[] | null {
  if (!data) return null;

  const fields: ExtractedField[] = [];

  switch (itemId) {
    case 'entry_requirements':
      if (data.eligibilityRequirements) {
        fields.push({
          icon: <Users size={14} color={IOS_COLORS.blue} />,
          label: 'Eligibility',
          value: data.eligibilityRequirements,
        });
      }
      if (data.entryDeadline) {
        fields.push({
          icon: <Calendar size={14} color={IOS_COLORS.orange} />,
          label: 'Entry Deadline',
          value: data.entryDeadline,
        });
      }
      if (data.entryFees && data.entryFees.length > 0) {
        const feeText = data.entryFees.map((fee: any) =>
          `${fee.type}: ${fee.amount}${fee.deadline ? ` (by ${fee.deadline})` : ''}`
        ).join(', ');
        fields.push({
          icon: <DollarSign size={14} color={IOS_COLORS.green} />,
          label: 'Entry Fees',
          value: feeText,
        });
      }
      if (data.entryFormUrl) {
        fields.push({
          icon: <Link2 size={14} color={IOS_COLORS.blue} />,
          label: 'Entry Form',
          value: 'Open Entry Form',
          url: data.entryFormUrl,
        });
      }
      if (data.minimumCrew) {
        fields.push({
          icon: <Users size={14} color={IOS_COLORS.purple} />,
          label: 'Min Crew',
          value: String(data.minimumCrew),
        });
      }
      if (data.crewRequirements) {
        fields.push({
          icon: <Users size={14} color={IOS_COLORS.gray} />,
          label: 'Crew Rules',
          value: data.crewRequirements,
        });
      }
      if (data.minorSailorRules) {
        fields.push({
          icon: <AlertCircle size={14} color={IOS_COLORS.orange} />,
          label: 'Under 18',
          value: data.minorSailorRules,
        });
      }
      if (data.lateEntryPolicy) {
        fields.push({
          icon: <AlertCircle size={14} color={IOS_COLORS.red} />,
          label: 'Late Entry',
          value: data.lateEntryPolicy,
        });
      }
      break;

    case 'schedule':
      if (data.raceDate) {
        fields.push({
          icon: <Calendar size={14} color={IOS_COLORS.blue} />,
          label: 'Race Date',
          value: data.raceDate,
        });
      }
      if (data.warningSignalTime) {
        fields.push({
          icon: <Flag size={14} color={IOS_COLORS.orange} />,
          label: 'Warning Signal',
          value: data.warningSignalTime,
        });
      }
      if (data.skipperBriefingTime) {
        fields.push({
          icon: <Users size={14} color={IOS_COLORS.purple} />,
          label: 'Skipper Briefing',
          value: data.skipperBriefingTime,
        });
      }
      if (data.checkInTime) {
        fields.push({
          icon: <Clock size={14} color={IOS_COLORS.green} />,
          label: 'Check-in',
          value: data.checkInTime,
        });
      }
      if (data.racingDays && data.racingDays.length > 0) {
        fields.push({
          icon: <Calendar size={14} color={IOS_COLORS.blue} />,
          label: 'Racing Days',
          value: data.racingDays.join(', '),
        });
      }
      if (data.racesPerDay) {
        fields.push({
          icon: <Flag size={14} color={IOS_COLORS.gray} />,
          label: 'Races/Day',
          value: String(data.racesPerDay),
        });
      }
      if (data.schedule && data.schedule.length > 0) {
        // Show first 3 schedule items
        const scheduleItems = data.schedule.slice(0, 3);
        scheduleItems.forEach((event: any, idx: number) => {
          fields.push({
            icon: idx === 0 ? <Calendar size={14} color={IOS_COLORS.orange} /> : <View style={{ width: 14 }} />,
            label: event.date || '',
            value: `${event.time ? event.time + ' - ' : ''}${event.event}${event.mandatory ? ' [MANDATORY]' : ''}`,
          });
        });
        if (data.schedule.length > 3) {
          fields.push({
            icon: <View style={{ width: 14 }} />,
            label: '',
            value: `+${data.schedule.length - 3} more events`,
          });
        }
      }
      if (data.reserveDays && data.reserveDays.length > 0) {
        fields.push({
          icon: <Calendar size={14} color={IOS_COLORS.gray} />,
          label: 'Reserve Days',
          value: data.reserveDays.join(', '),
        });
      }
      break;

    case 'venue':
      if (data.venue) {
        fields.push({
          icon: <MapPin size={14} color={IOS_COLORS.green} />,
          label: 'Venue',
          value: data.venue,
        });
      }
      if (data.racingAreaName) {
        fields.push({
          icon: <Navigation size={14} color={IOS_COLORS.blue} />,
          label: 'Racing Area',
          value: data.racingAreaName,
        });
      }
      if (data.racingAreaDescription) {
        fields.push({
          icon: <View style={{ width: 14 }} />,
          label: '',
          value: data.racingAreaDescription,
        });
      }
      if (data.startAreaName) {
        fields.push({
          icon: <Flag size={14} color={IOS_COLORS.orange} />,
          label: 'Start Area',
          value: data.startAreaName,
        });
      }
      if (data.finishAreaName && data.finishAreaName !== data.startAreaName) {
        fields.push({
          icon: <Flag size={14} color={IOS_COLORS.purple} />,
          label: 'Finish Area',
          value: data.finishAreaName,
        });
      }
      // Route waypoints (for distance races)
      if (data.routeWaypoints && data.routeWaypoints.length > 0) {
        const routeText = data.routeWaypoints.map((wp: any) => wp.name).join(' → ');
        fields.push({
          icon: <Navigation size={14} color={IOS_COLORS.blue} />,
          label: 'Route',
          value: routeText,
        });
      }
      // Prohibited areas
      if (data.prohibitedAreas && data.prohibitedAreas.length > 0) {
        const areaNames = data.prohibitedAreas.slice(0, 3).map((a: any) => a.name).join(', ');
        const moreCount = data.prohibitedAreas.length > 3 ? ` +${data.prohibitedAreas.length - 3} more` : '';
        fields.push({
          icon: <AlertTriangle size={14} color={IOS_COLORS.red} />,
          label: 'Prohibited',
          value: areaNames + moreCount,
        });
      }
      if (data.raceControlLocation) {
        fields.push({
          icon: <Radio size={14} color={IOS_COLORS.blue} />,
          label: 'Race Control',
          value: data.raceControlLocation,
        });
      }
      if (data.berthingInfo) {
        fields.push({
          icon: <Ship size={14} color={IOS_COLORS.gray} />,
          label: 'Berthing',
          value: data.berthingInfo,
        });
      }
      if (data.parkingInfo) {
        fields.push({
          icon: <MapPin size={14} color={IOS_COLORS.gray} />,
          label: 'Parking',
          value: data.parkingInfo,
        });
      }
      if (data.launchingInfo) {
        fields.push({
          icon: <Ship size={14} color={IOS_COLORS.green} />,
          label: 'Launching',
          value: data.launchingInfo,
        });
      }
      break;

    case 'equipment':
      if (data.safetyRequirements) {
        fields.push({
          icon: <Shield size={14} color={IOS_COLORS.red} />,
          label: 'Safety Gear',
          value: data.safetyRequirements,
        });
      }
      if (data.classRestrictions) {
        fields.push({
          icon: <AlertCircle size={14} color={IOS_COLORS.orange} />,
          label: 'Restrictions',
          value: data.classRestrictions,
        });
      }
      if (data.classRules && (Array.isArray(data.classRules) ? data.classRules.length > 0 : data.classRules)) {
        // Defensive type guard: handle both array and legacy string formats
        const classRulesPreview = Array.isArray(data.classRules)
          ? data.classRules.slice(0, 3).join('; ') + (data.classRules.length > 3 ? '...' : '')
          : typeof data.classRules === 'string'
            ? data.classRules.slice(0, 150) + (data.classRules.length > 150 ? '...' : '')
            : String(data.classRules);

        fields.push({
          icon: <FileText size={14} color={IOS_COLORS.blue} />,
          label: 'Class Rules',
          value: classRulesPreview,
        });
      }
      if (data.minimumInsuranceCoverage) {
        fields.push({
          icon: <Shield size={14} color={IOS_COLORS.green} />,
          label: 'Min Insurance',
          value: typeof data.minimumInsuranceCoverage === 'number'
            ? `$${data.minimumInsuranceCoverage.toLocaleString()}`
            : String(data.minimumInsuranceCoverage),
        });
      }
      break;

    case 'scoring':
      if (data.scoringFormulaDescription) {
        fields.push({
          icon: <Trophy size={14} color={IOS_COLORS.orange} />,
          label: 'Scoring',
          value: data.scoringFormulaDescription,
        });
      }
      if (data.handicapSystem && (Array.isArray(data.handicapSystem) ? data.handicapSystem.length > 0 : data.handicapSystem)) {
        // Defensive type guard: handle both array and legacy string formats
        const handicapValue = Array.isArray(data.handicapSystem)
          ? data.handicapSystem.join(', ')
          : String(data.handicapSystem);

        fields.push({
          icon: <Flag size={14} color={IOS_COLORS.blue} />,
          label: 'Handicap',
          value: handicapValue,
        });
      }
      if (data.seriesRacesRequired) {
        fields.push({
          icon: <Flag size={14} color={IOS_COLORS.purple} />,
          label: 'Series Races',
          value: String(data.seriesRacesRequired),
        });
      }
      if (data.discardsPolicy) {
        fields.push({
          icon: <AlertCircle size={14} color={IOS_COLORS.gray} />,
          label: 'Discards',
          value: data.discardsPolicy,
        });
      }
      if (data.prizesDescription) {
        fields.push({
          icon: <Trophy size={14} color={IOS_COLORS.green} />,
          label: 'Prizes',
          value: data.prizesDescription,
        });
      }
      break;

    // SI Review items
    case 'signals':
      if (data.warningSignalType) {
        fields.push({
          icon: <Flag size={14} color={IOS_COLORS.orange} />,
          label: 'Warning Signal',
          value: data.warningSignalType,
        });
      }
      if (data.preparatoryMinutes) {
        fields.push({
          icon: <Clock size={14} color={IOS_COLORS.blue} />,
          label: 'Prep Time',
          value: `${data.preparatoryMinutes} min`,
        });
      }
      if (data.classIntervalMinutes) {
        fields.push({
          icon: <Clock size={14} color={IOS_COLORS.purple} />,
          label: 'Class Interval',
          value: `${data.classIntervalMinutes} min`,
        });
      }
      break;

    case 'course':
      if (data.courseName) {
        fields.push({
          icon: <Navigation size={14} color={IOS_COLORS.blue} />,
          label: 'Course',
          value: data.courseName,
        });
      }
      if (data.courseDescription) {
        fields.push({
          icon: <View style={{ width: 14 }} />,
          label: '',
          value: data.courseDescription,
        });
      }
      if (data.marks && data.marks.length > 0) {
        const markNames = data.marks.map((m: any) => m.name).slice(0, 5).join(', ');
        fields.push({
          icon: <MapPin size={14} color={IOS_COLORS.orange} />,
          label: 'Marks',
          value: markNames + (data.marks.length > 5 ? '...' : ''),
        });
      }
      break;

    case 'vhf':
      if (data.vhfChannels && data.vhfChannels.length > 0) {
        data.vhfChannels.forEach((ch: any) => {
          fields.push({
            icon: <Radio size={14} color={IOS_COLORS.green} />,
            label: ch.purpose || 'Race',
            value: `Ch ${ch.channel}`,
          });
        });
      } else if (data.vhfChannel) {
        fields.push({
          icon: <Radio size={14} color={IOS_COLORS.green} />,
          label: 'Race Channel',
          value: `Ch ${data.vhfChannel}`,
        });
      }
      if (data.safetyChannel) {
        fields.push({
          icon: <Radio size={14} color={IOS_COLORS.red} />,
          label: 'Safety Channel',
          value: `Ch ${data.safetyChannel}`,
        });
      }
      if (data.rcBoatName) {
        fields.push({
          icon: <Ship size={14} color={IOS_COLORS.blue} />,
          label: 'RC Boat',
          value: data.rcBoatName,
        });
      }
      break;

    case 'time_limits':
      if (data.timeLimitMinutes) {
        fields.push({
          icon: <Clock size={14} color={IOS_COLORS.purple} />,
          label: 'Race Time Limit',
          value: `${data.timeLimitMinutes} min`,
        });
      }
      if (data.timeLimitHours) {
        fields.push({
          icon: <Clock size={14} color={IOS_COLORS.purple} />,
          label: 'Time Limit',
          value: `${data.timeLimitHours} hours`,
        });
      }
      if (data.plannedFinishTime) {
        fields.push({
          icon: <Flag size={14} color={IOS_COLORS.green} />,
          label: 'Target Finish',
          value: data.plannedFinishTime,
        });
      }
      break;

    case 'penalties':
      if (data.penaltyDetails) {
        fields.push({
          icon: <AlertCircle size={14} color={IOS_COLORS.red} />,
          label: 'Penalties',
          value: data.penaltyDetails,
        });
      }
      if (data.protestDeadline) {
        fields.push({
          icon: <Clock size={14} color={IOS_COLORS.orange} />,
          label: 'Protest Deadline',
          value: data.protestDeadline,
        });
      }
      break;
  }

  return fields.length > 0 ? fields : null;
}

/**
 * Component to display extracted data inline below a checklist item
 */
function ExtractedItemData({
  itemId,
  data
}: {
  itemId: string;
  data: any | null;
}) {
  const fields = getExtractedDataForChecklistItem(itemId, data);

  if (!fields || fields.length === 0) {
    return null;
  }

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={extractedItemStyles.container}>
      {fields.map((field, index) => (
        <View key={index} style={extractedItemStyles.row}>
          <View style={extractedItemStyles.iconContainer}>
            {field.icon}
          </View>
          {field.label ? (
            <>
              <Text style={extractedItemStyles.label}>{field.label}:</Text>
              {field.url ? (
                <Pressable onPress={() => handleOpenUrl(field.url!)}>
                  <Text style={extractedItemStyles.linkValue}>{field.value} ↗</Text>
                </Pressable>
              ) : (
                <Text style={extractedItemStyles.value} numberOfLines={2}>{field.value}</Text>
              )}
            </>
          ) : (
            <Text style={[extractedItemStyles.value, { marginLeft: 0 }]} numberOfLines={2}>
              {field.value}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const extractedItemStyles = StyleSheet.create({
  container: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  iconContainer: {
    width: 14,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
    minWidth: 70,
  },
  value: {
    fontSize: 12,
    color: IOS_COLORS.label,
    flex: 1,
    lineHeight: 16,
  },
  linkValue: {
    fontSize: 12,
    color: IOS_COLORS.blue,
    fontWeight: '500',
    flex: 1,
  },
});


interface DocumentReviewWizardProps extends ChecklistToolProps {
  /** Optional venue for context */
  venue?: { id: string; name: string } | null;
}

export function DocumentReviewWizard({
  item,
  regattaId,
  boatId: _boatId,
  onComplete,
  onCancel,
  venue: _venue,
}: DocumentReviewWizardProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Get document config based on tool ID
  const config = DOCUMENT_CONFIGS[item.toolId || 'nor_review'];

  // State
  const [step, setStep] = useState<WizardStep>('check_document');
  const [completedChecks, setCompletedChecks] = useState<Set<string>>(new Set());
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [urlValue, setUrlValue] = useState('');
  const [textContent, setTextContent] = useState('');
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);

  // Load documents for this race
  const {
    documentsForDisplay,
    loading: docsLoading,
    upload,
    addFromUrl,
    addFromText,
    deleteDocument,
    isExtracting,
    extractionResult,
    storedExtractionChecked,
    triggerExtraction,
    clearExtractionResult,
  } = useRaceDocuments({
    raceId: regattaId,
    userId: user?.id,
  });

  // Find document of this type
  const document = useMemo(() => {
    return documentsForDisplay.find((doc) => doc.type === config.type);
  }, [documentsForDisplay, config.type]);

  // Track if we've attempted extraction for this document
  const [extractionAttempted, setExtractionAttempted] = useState<string | null>(null);

  // Auto-advance to review if document exists
  useEffect(() => {
    if (!docsLoading && document && step === 'check_document') {
      setStep('review');
    }
  }, [docsLoading, document, step]);

  // Auto-trigger extraction when document exists but no extraction result
  // Wait for storedExtractionChecked to prevent re-extracting when stored data exists
  useEffect(() => {
    // Skip if already extracting
    if (isExtracting) {
      return;
    }

    // Skip if we already have extraction data
    if (extractionResult?.data) {
      return;
    }

    // Wait until we've checked for stored extraction before deciding to trigger
    if (!storedExtractionChecked) {
      return;
    }

    // Only trigger for NOR and SI documents that we haven't attempted yet
    if (
      document &&
      document.url &&
      extractionAttempted !== document.id &&
      (config.type === 'nor' || config.type === 'sailing_instructions')
    ) {
      // Mark as attempted to prevent re-triggering
      setExtractionAttempted(document.id);
      // Trigger extraction - use documentId (actual documents table ID) for storage
      const docId = document.documentId || document.id;
      triggerExtraction(document.url, docId, config.type);
    }
  }, [document, isExtracting, extractionResult, storedExtractionChecked, extractionAttempted, config.type, triggerExtraction]);

  // Progress calculation
  const progress = completedChecks.size / config.checkItems.length;
  const allChecksComplete = completedChecks.size === config.checkItems.length;

  // Toggle a check item
  const toggleCheck = useCallback((checkId: string) => {
    setCompletedChecks((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  }, []);

  // Handle document upload
  const handleUpload = useCallback(async () => {
    // Pre-select the correct document type based on the wizard config
    await upload(config.type);
    // After upload completes, the useEffect will advance to review step
  }, [upload, config.type]);

  // Handle URL submission
  const handleUrlSubmit = useCallback(async () => {
    if (!urlValue.trim()) {
      return;
    }

    setIsSubmittingUrl(true);
    try {
      const success = await addFromUrl(urlValue.trim(), config.type);
      if (success) {
        setUrlValue('');
        setShowUrlInput(false);
        // The useEffect will advance to review step when document is loaded
      }
    } finally {
      setIsSubmittingUrl(false);
    }
  }, [urlValue, addFromUrl, config.type]);

  // Handle text content submission
  const handleTextSubmit = useCallback(async () => {
    if (!textContent.trim()) {
      return;
    }

    setIsSubmittingUrl(true);
    try {
      const success = await addFromText(textContent.trim(), config.type);
      if (success) {
        setTextContent('');
        setShowUrlInput(false);
        setInputMode('url'); // Reset for next time
        // The useEffect will advance to review step when document is loaded
      }
    } finally {
      setIsSubmittingUrl(false);
    }
  }, [textContent, addFromText, config.type]);

  // Handle opening document
  const handleOpenDocument = useCallback(() => {
    if (document?.url) {
      Linking.openURL(document.url);
    }
  }, [document?.url]);

  // Handle replacing document
  const handleReplaceDocument = useCallback(async () => {
    if (document?.id) {
      await deleteDocument(document.id);
      setCompletedChecks(new Set()); // Reset checklist
      setStep('check_document'); // Go back to upload step
    }
  }, [document?.id, deleteDocument]);

  // Handle re-extraction (force fresh extraction)
  const handleReExtract = useCallback(() => {
    if (document?.url && document?.id) {
      // Clear current extraction result
      clearExtractionResult();
      // Reset extraction attempt tracking
      setExtractionAttempted(null);
      // Trigger fresh extraction - use documentId (actual documents table ID) for storage
      const docId = document.documentId || document.id;
      triggerExtraction(document.url, docId, config.type);
    }
  }, [document?.url, document?.id, document?.documentId, clearExtractionResult, triggerExtraction, config.type]);

  // Handle learn more
  const handleLearnMore = useCallback(() => {
    if (item.learningModuleSlug) {
      router.push({
        pathname: '/(tabs)/learn',
        params: {
          courseSlug: item.learningModuleSlug,
          lessonId: item.learningModuleId,
        },
      });
      onCancel();
    }
  }, [item.learningModuleSlug, item.learningModuleId, router, onCancel]);

  // Handle complete
  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Render based on step
  const renderContent = () => {
    switch (step) {
      case 'check_document':
        return renderCheckDocument();
      case 'review':
        return renderReview();
      case 'complete':
        return renderComplete();
      default:
        return null;
    }
  };

  const renderCheckDocument = () => (
    <KeyboardAvoidingView
      style={styles.centeredContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {docsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.blue} />
          <Text style={styles.loadingText}>Checking documents...</Text>
        </View>
      ) : showUrlInput ? (
        // URL/Text Input Mode with Tab Toggle
        <View style={styles.urlInputContainer}>
          <View style={styles.iconCircle}>
            {inputMode === 'url' ? (
              <Link2 size={32} color={IOS_COLORS.blue} />
            ) : (
              <FileText size={32} color={IOS_COLORS.purple} />
            )}
          </View>
          <Text style={styles.centeredTitle}>
            Add {config.shortLabel}
          </Text>
          <Text style={styles.centeredDescription}>
            {inputMode === 'url'
              ? `Paste the link to the ${config.label} document.`
              : `Paste the ${config.label} text content (copy from PDF).`}
          </Text>

          {/* Tab Toggle */}
          <View style={styles.tabToggleContainer}>
            <Pressable
              style={[
                styles.tabToggleButton,
                inputMode === 'url' && styles.tabToggleButtonActive,
              ]}
              onPress={() => setInputMode('url')}
              disabled={isSubmittingUrl}
            >
              <Link2 size={16} color={inputMode === 'url' ? '#FFFFFF' : IOS_COLORS.blue} />
              <Text
                style={[
                  styles.tabToggleText,
                  inputMode === 'url' && styles.tabToggleTextActive,
                ]}
              >
                Paste URL
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tabToggleButton,
                inputMode === 'text' && styles.tabToggleButtonActive,
              ]}
              onPress={() => setInputMode('text')}
              disabled={isSubmittingUrl}
            >
              <FileText size={16} color={inputMode === 'text' ? '#FFFFFF' : IOS_COLORS.purple} />
              <Text
                style={[
                  styles.tabToggleText,
                  inputMode === 'text' && styles.tabToggleTextActive,
                ]}
              >
                Paste Text
              </Text>
            </Pressable>
          </View>

          {inputMode === 'url' ? (
            // URL Input
            <View style={styles.urlInputWrapper}>
              <TextInput
                style={styles.urlInput}
                placeholder={`https://example.com/${config.shortLabel.toLowerCase()}.pdf`}
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                value={urlValue}
                onChangeText={setUrlValue}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={handleUrlSubmit}
                editable={!isSubmittingUrl}
              />
            </View>
          ) : (
            // Text Input (multiline)
            <View style={styles.textInputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder={`Paste ${config.shortLabel} document text here...\n\nTip: Open the PDF, select all text (Cmd+A), copy (Cmd+C), and paste here.`}
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                value={textContent}
                onChangeText={setTextContent}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                editable={!isSubmittingUrl}
              />
              {textContent.trim().length > 0 && (
                <Text style={styles.textInputCharCount}>
                  {textContent.trim().length.toLocaleString()} characters
                </Text>
              )}
            </View>
          )}

          <Pressable
            style={[
              styles.uploadButton,
              ((inputMode === 'url' && !urlValue.trim()) ||
                (inputMode === 'text' && !textContent.trim()) ||
                isSubmittingUrl) &&
                styles.uploadButtonDisabled,
            ]}
            onPress={inputMode === 'url' ? handleUrlSubmit : handleTextSubmit}
            disabled={
              (inputMode === 'url' && !urlValue.trim()) ||
              (inputMode === 'text' && !textContent.trim()) ||
              isSubmittingUrl
            }
          >
            {isSubmittingUrl ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Check size={20} color="#FFFFFF" />
            )}
            <Text style={styles.uploadButtonText}>
              {isSubmittingUrl ? 'Processing...' : 'Add Document'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.skipButton}
            onPress={() => {
              setShowUrlInput(false);
              setInputMode('url');
            }}
          >
            <Text style={styles.skipButtonText}>Back</Text>
          </Pressable>
        </View>
      ) : (
        // Default: Upload/URL Choice
        <>
          <View style={styles.iconCircle}>{config.icon}</View>
          <Text style={styles.centeredTitle}>
            No {config.shortLabel} Found
          </Text>
          <Text style={styles.centeredDescription}>
            Upload or link the {config.label} to review key information.
          </Text>

          <Pressable style={styles.uploadButton} onPress={handleUpload}>
            <Upload size={20} color="#FFFFFF" />
            <Text style={styles.uploadButtonText}>
              Upload {config.shortLabel}
            </Text>
          </Pressable>

          <Pressable style={styles.urlLinkButton} onPress={() => setShowUrlInput(true)}>
            <Link2 size={18} color={IOS_COLORS.blue} />
            <Text style={styles.urlLinkButtonText}>
              Add from URL
            </Text>
          </Pressable>

          <Pressable style={styles.skipButton} onPress={() => setStep('review')}>
            <Text style={styles.skipButtonText}>
              Review without document
            </Text>
          </Pressable>
        </>
      )}
    </KeyboardAvoidingView>
  );

  const renderReview = () => (
    <ScrollView
      style={styles.scrollContent}
      contentContainerStyle={styles.scrollContentInner}
    >
      {/* Document Card */}
      {document && (
        <Pressable style={styles.documentCard} onPress={handleOpenDocument}>
          <View style={styles.documentIconContainer}>
            <FileText size={24} color={IOS_COLORS.purple} />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentName} numberOfLines={1}>
              {document.name}
            </Text>
            <Text style={styles.documentMeta}>
              Uploaded {document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : 'recently'}
            </Text>
          </View>
          <ExternalLink size={20} color={IOS_COLORS.blue} />
        </Pressable>
      )}

      {/* Replace Document Button */}
      {document && (
        <Pressable style={styles.replaceButton} onPress={handleReplaceDocument}>
          <RefreshCw size={16} color={IOS_COLORS.blue} />
          <Text style={styles.replaceButtonText}>Replace Document</Text>
        </Pressable>
      )}

      {/* AI Extraction Status */}
      {isExtracting && (
        <View style={styles.extractionCard}>
          <ActivityIndicator size="small" color={IOS_COLORS.purple} />
          <View style={styles.extractionContent}>
            <Text style={styles.extractionTitle}>
              Extracting race data...
            </Text>
            <Text style={styles.extractionDescription}>
              Parsing the document for entry, schedule, venue, and more
            </Text>
          </View>
        </View>
      )}

      {/* Extraction Result */}
      {!isExtracting && extractionResult && (
        <View style={[
          styles.extractionCard,
          extractionResult.success ? styles.extractionSuccess : styles.extractionError,
        ]}>
          {extractionResult.success ? (
            <>
              <Sparkles size={20} color={IOS_COLORS.green} />
              <View style={styles.extractionContent}>
                <Text style={[styles.extractionTitle, { color: IOS_COLORS.green }]}>
                  Race data extracted
                </Text>
                <Text style={styles.extractionDescription}>
                  {extractionResult.extractedFields?.length || 0} fields updated from document
                </Text>
              </View>
            </>
          ) : (
            <>
              <AlertCircle size={20} color={IOS_COLORS.orange} />
              <View style={styles.extractionContent}>
                <Text style={[styles.extractionTitle, { color: IOS_COLORS.orange }]}>
                  Extraction incomplete
                </Text>
                <Text style={styles.extractionDescription}>
                  {extractionResult.error || 'Some fields could not be extracted'}
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Re-extract Button (only when extraction succeeded) */}
      {!isExtracting && extractionResult?.success && document && (
        <Pressable style={styles.reExtractButton} onPress={handleReExtract}>
          <RefreshCw size={14} color={IOS_COLORS.secondaryLabel} />
          <Text style={styles.reExtractButtonText}>Re-extract from document</Text>
        </Pressable>
      )}

      {/* Extracted data is now shown inline with each checklist item */}

      {/* No document - show upload options */}
      {!document && !showUrlInput && (
        <View style={styles.noDocumentCard}>
          <View style={styles.noDocumentHeader}>
            <AlertTriangle size={20} color={IOS_COLORS.orange} />
            <Text style={styles.noDocumentTitle}>
              No {config.shortLabel} uploaded
            </Text>
          </View>
          <Text style={styles.noDocumentDescription}>
            Add the document to extract race details automatically
          </Text>
          <View style={styles.noDocumentActions}>
            <Pressable style={styles.noDocumentUploadButton} onPress={handleUpload}>
              <Upload size={18} color="#FFFFFF" />
              <Text style={styles.noDocumentUploadText}>Upload File</Text>
            </Pressable>
            <Pressable
              style={styles.noDocumentUrlButton}
              onPress={() => setShowUrlInput(true)}
            >
              <Link2 size={18} color={IOS_COLORS.blue} />
              <Text style={styles.noDocumentUrlText}>Add from URL</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* URL/Text Input Mode in Review Step */}
      {!document && showUrlInput && (
        <View style={styles.reviewUrlInputCard}>
          <View style={styles.reviewUrlInputHeader}>
            {inputMode === 'url' ? (
              <Link2 size={20} color={IOS_COLORS.blue} />
            ) : (
              <FileText size={20} color={IOS_COLORS.purple} />
            )}
            <Text style={styles.reviewUrlInputTitle}>
              Add {config.shortLabel}
            </Text>
          </View>

          {/* Tab Toggle */}
          <View style={styles.reviewTabToggle}>
            <Pressable
              style={[
                styles.reviewTabButton,
                inputMode === 'url' && styles.reviewTabButtonActive,
              ]}
              onPress={() => setInputMode('url')}
              disabled={isSubmittingUrl}
            >
              <Text style={[
                styles.reviewTabText,
                inputMode === 'url' && styles.reviewTabTextActive,
              ]}>
                Paste URL
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.reviewTabButton,
                inputMode === 'text' && styles.reviewTabButtonActive,
              ]}
              onPress={() => setInputMode('text')}
              disabled={isSubmittingUrl}
            >
              <Text style={[
                styles.reviewTabText,
                inputMode === 'text' && styles.reviewTabTextActive,
              ]}>
                Paste Text
              </Text>
            </Pressable>
          </View>

          {inputMode === 'url' ? (
            <TextInput
              style={styles.reviewUrlInput}
              placeholder={`https://example.com/${config.shortLabel.toLowerCase()}.pdf`}
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              value={urlValue}
              onChangeText={setUrlValue}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleUrlSubmit}
              editable={!isSubmittingUrl}
            />
          ) : (
            <TextInput
              style={styles.reviewTextInput}
              placeholder={`Paste ${config.shortLabel} text here...`}
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              value={textContent}
              onChangeText={setTextContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={!isSubmittingUrl}
            />
          )}

          <View style={styles.reviewUrlInputActions}>
            <Pressable
              style={styles.reviewUrlCancelButton}
              onPress={() => {
                setShowUrlInput(false);
                setInputMode('url');
                setUrlValue('');
                setTextContent('');
              }}
              disabled={isSubmittingUrl}
            >
              <Text style={styles.reviewUrlCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.reviewUrlSubmitButton,
                ((inputMode === 'url' && !urlValue.trim()) ||
                  (inputMode === 'text' && !textContent.trim()) ||
                  isSubmittingUrl) &&
                  styles.reviewUrlSubmitButtonDisabled,
              ]}
              onPress={inputMode === 'url' ? handleUrlSubmit : handleTextSubmit}
              disabled={
                (inputMode === 'url' && !urlValue.trim()) ||
                (inputMode === 'text' && !textContent.trim()) ||
                isSubmittingUrl
              }
            >
              {isSubmittingUrl ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Check size={18} color="#FFFFFF" />
              )}
              <Text style={styles.reviewUrlSubmitText}>
                {isSubmittingUrl ? 'Processing...' : 'Add Document'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Check Items */}
      <Text style={styles.sectionTitle}>Review Checklist</Text>
      <Text style={styles.sectionDescription}>
        {item.description || config.description}
      </Text>

      <View style={styles.checklistContainer}>
        {config.checkItems.map((checkItem) => {
          const isChecked = completedChecks.has(checkItem.id);
          const extractedData = extractionResult?.data;
          const hasExtractedData = extractedData && getExtractedDataForChecklistItem(checkItem.id, extractedData);

          return (
            <View
              key={checkItem.id}
              style={[
                styles.checkItem,
                isChecked && styles.checkItemChecked,
              ]}
            >
              {/* Header row with icon, label, description, and checkbox */}
              <Pressable
                style={styles.checkItemHeader}
                onPress={() => toggleCheck(checkItem.id)}
              >
                <View style={styles.checkItemIcon}>{checkItem.icon}</View>
                <View style={styles.checkItemContent}>
                  <Text
                    style={[
                      styles.checkItemLabel,
                      isChecked && styles.checkItemLabelChecked,
                    ]}
                  >
                    {checkItem.label}
                  </Text>
                  <Text style={styles.checkItemDescription}>
                    {checkItem.description}
                  </Text>
                </View>
                <View style={styles.checkItemCheckbox}>
                  {isChecked ? (
                    <CheckCircle2 size={24} color={IOS_COLORS.green} />
                  ) : (
                    <Circle size={24} color={IOS_COLORS.gray} />
                  )}
                </View>
              </Pressable>

              {/* Inline extracted data - always visible */}
              {hasExtractedData && (
                <ExtractedItemData
                  itemId={checkItem.id}
                  data={extractedData}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Quick Tips */}
      {item.quickTips && item.quickTips.length > 0 && (
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Quick Tips</Text>
          {item.quickTips.map((tip, index) => (
            <View key={index} style={styles.tipRow}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderComplete = () => (
    <View style={styles.centeredContainer}>
      <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
        <CheckCircle2 size={32} color={IOS_COLORS.green} />
      </View>
      <Text style={styles.centeredTitle}>
        {config.shortLabel} Review Complete
      </Text>
      <Text style={styles.centeredDescription}>
        You've reviewed the {config.label}. The key information has been noted for race day.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.closeButton}
          onPress={onCancel}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={24} color={IOS_COLORS.gray} />
        </Pressable>
        <Text style={styles.headerTitle}>{config.shortLabel} Review</Text>
        <View style={styles.headerRight}>
          {item.learningModuleSlug && (
            <Pressable style={styles.learnIconButton} onPress={handleLearnMore}>
              <BookOpen size={20} color={IOS_COLORS.purple} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      {step === 'review' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
                allChecksComplete && styles.progressComplete,
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {completedChecks.size} of {config.checkItems.length} reviewed
          </Text>
        </View>
      )}

      {/* Content */}
      {renderContent()}

      {/* Bottom Action */}
      {step === 'review' && (
        <View style={styles.bottomAction}>
          <Pressable
            style={[
              styles.primaryButton,
              allChecksComplete
                ? styles.primaryButtonSuccess
                : styles.primaryButtonWarning,
            ]}
            onPress={handleComplete}
          >
            <Check size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              {allChecksComplete
                ? 'Complete Review'
                : 'Mark as Reviewed'}
            </Text>
          </Pressable>
        </View>
      )}

      {step === 'complete' && (
        <View style={styles.bottomAction}>
          <Pressable
            style={[styles.primaryButton, styles.primaryButtonSuccess]}
            onPress={handleComplete}
          >
            <Check size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  closeButton: {
    padding: 4,
    minWidth: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  learnIconButton: {
    padding: 4,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondaryBackground,
    gap: 6,
  },
  progressBar: {
    height: 4,
    backgroundColor: IOS_COLORS.separator,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 2,
  },
  progressComplete: {
    backgroundColor: IOS_COLORS.green,
  },
  progressText: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: 20,
    paddingBottom: 40,
  },
  // Centered container (for no doc / complete states)
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${IOS_COLORS.purple}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconCircleSuccess: {
    backgroundColor: `${IOS_COLORS.green}15`,
  },
  centeredTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 12,
    textAlign: 'center',
  },
  centeredDescription: {
    fontSize: 16,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.blue,
    gap: 10,
    marginBottom: 16,
  },
  uploadButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    padding: 12,
  },
  skipButtonText: {
    fontSize: 15,
    color: IOS_COLORS.blue,
    fontWeight: '500',
  },
  // URL Input styles
  urlInputContainer: {
    alignItems: 'center',
    width: '100%',
  },
  urlInputWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  urlInput: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: IOS_COLORS.label,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
  },
  urlLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: `${IOS_COLORS.blue}10`,
    gap: 8,
    marginBottom: 8,
  },
  urlLinkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  // Tab Toggle styles
  tabToggleContainer: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.separator,
    borderRadius: 10,
    padding: 2,
    marginBottom: 20,
    width: '100%',
  },
  tabToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  tabToggleButtonActive: {
    backgroundColor: IOS_COLORS.blue,
  },
  tabToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  tabToggleTextActive: {
    color: '#FFFFFF',
  },
  // Text Input styles
  textInputWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: IOS_COLORS.label,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    minHeight: 200,
    maxHeight: 300,
  },
  textInputCharCount: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 6,
    textAlign: 'right',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
  },
  // Document card
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  documentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: `${IOS_COLORS.purple}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  documentMeta: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  // Replace button
  replaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    marginTop: -12,
    marginBottom: 16,
  },
  replaceButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  // Re-extract button
  reExtractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  reExtractButtonText: {
    fontSize: 13,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
  },
  // Warning card
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: `${IOS_COLORS.orange}10`,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.orange}30`,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.orange,
    marginBottom: 2,
  },
  warningDescription: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  // Extraction card
  extractionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: `${IOS_COLORS.purple}10`,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.purple}30`,
  },
  extractionSuccess: {
    backgroundColor: `${IOS_COLORS.green}10`,
    borderColor: `${IOS_COLORS.green}30`,
  },
  extractionError: {
    backgroundColor: `${IOS_COLORS.orange}10`,
    borderColor: `${IOS_COLORS.orange}30`,
  },
  extractionContent: {
    flex: 1,
  },
  extractionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.purple,
    marginBottom: 2,
  },
  extractionDescription: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  // Extracted data card
  extractedDataCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  extractedDataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  extractedDataHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  extractedDataTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  extractedBadge: {
    backgroundColor: IOS_COLORS.green,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  extractedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  extractedBasicInfo: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  extractedDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  extractedDataLabel: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    width: 100,
  },
  extractedDataValue: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
    flex: 1,
  },
  extractedDetailsContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  extractedSection: {
    gap: 8,
  },
  extractedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  extractedSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  extractedSectionContent: {
    paddingLeft: 24,
    gap: 4,
  },
  scheduleItem: {
    marginBottom: 8,
  },
  scheduleDate: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  scheduleEvent: {
    fontSize: 14,
    color: IOS_COLORS.label,
  },
  scheduleLocation: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    fontStyle: 'italic',
  },
  mandatoryTag: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.red,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  detailText: {
    fontSize: 14,
    color: IOS_COLORS.label,
    lineHeight: 20,
  },
  detailTextSecondary: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
    marginTop: 4,
  },
  highlightText: {
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  listItem: {
    fontSize: 13,
    color: IOS_COLORS.label,
    lineHeight: 20,
  },
  listItemNote: {
    color: IOS_COLORS.tertiaryLabel,
    fontStyle: 'italic',
  },
  linkText: {
    fontSize: 13,
    color: IOS_COLORS.blue,
    lineHeight: 20,
  },
  expandPrompt: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  expandPromptText: {
    fontSize: 13,
    color: IOS_COLORS.blue,
    fontStyle: 'italic',
  },
  // Section
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 22,
    marginBottom: 16,
  },
  // Checklist
  checklistContainer: {
    gap: 10,
    marginBottom: 24,
  },
  checkItem: {
    padding: 16,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
  },
  checkItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkItemChecked: {
    backgroundColor: `${IOS_COLORS.green}08`,
  },
  checkItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkItemContent: {
    flex: 1,
  },
  checkItemLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  checkItemLabelChecked: {
    color: IOS_COLORS.secondaryLabel,
  },
  checkItemDescription: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
  },
  checkItemCheckbox: {
    width: 24,
    height: 24,
  },
  // Tips
  tipsContainer: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.blue,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.label,
    lineHeight: 20,
  },
  // Bottom action
  bottomAction: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.blue,
    gap: 8,
  },
  primaryButtonSuccess: {
    backgroundColor: IOS_COLORS.green,
  },
  primaryButtonWarning: {
    backgroundColor: IOS_COLORS.orange,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // No document card (in review step)
  noDocumentCard: {
    backgroundColor: `${IOS_COLORS.orange}10`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.orange}30`,
  },
  noDocumentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  noDocumentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.orange,
  },
  noDocumentDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 16,
  },
  noDocumentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  noDocumentUploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.blue,
    gap: 8,
  },
  noDocumentUploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noDocumentUrlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: `${IOS_COLORS.blue}15`,
    gap: 8,
  },
  noDocumentUrlText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  // URL Input in Review Step
  reviewUrlInputCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  reviewUrlInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  reviewUrlInputTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  reviewTabToggle: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.separator,
    borderRadius: 8,
    padding: 2,
    marginBottom: 12,
  },
  reviewTabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  reviewTabButtonActive: {
    backgroundColor: IOS_COLORS.blue,
  },
  reviewTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  reviewTabTextActive: {
    color: '#FFFFFF',
  },
  reviewUrlInput: {
    backgroundColor: IOS_COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: IOS_COLORS.label,
    marginBottom: 12,
  },
  reviewTextInput: {
    backgroundColor: IOS_COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: IOS_COLORS.label,
    marginBottom: 12,
    minHeight: 120,
    maxHeight: 180,
  },
  reviewUrlInputActions: {
    flexDirection: 'row',
    gap: 12,
  },
  reviewUrlCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.background,
  },
  reviewUrlCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  reviewUrlSubmitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.blue,
    gap: 8,
  },
  reviewUrlSubmitButtonDisabled: {
    opacity: 0.5,
  },
  reviewUrlSubmitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default DocumentReviewWizard;
