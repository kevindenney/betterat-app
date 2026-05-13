/**
 * Race Detail Screen - Command Center for Individual Race
 * Comprehensive race management: strategy, documents, crew, equipment, tracks, results
 */

import { useAuth } from '@/providers/AuthProvider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { RaceCourseExtractor } from '@/services/ai/RaceCourseExtractor';
import { raceStrategyEngine, RaceStrategy, RaceConditions } from '@/services/ai/RaceStrategyEngine';
import type { TacticalRecommendation } from '@/lib/types/ai-knowledge';
import type { CourseMark } from '@/types/raceEvents';
import { RaceMapView } from '@/components/race-strategy/RaceMapView';
import { QuickDrawMode } from '@/components/race-strategy/QuickDrawMode';
import { VictoryLine, VictoryChart, VictoryTheme, VictoryAxis, VictoryArea } from 'victory';
import { RaceDetailsView, DocumentList, type Document, CourseVisualization, CourseSetupPrompt, CourseSelector } from '@/components/races';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { showAlert, showConfirm, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';

interface RaceDetails {
  id: string;
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  classId: string;
  className: string;
  hasStrategy: boolean;
  hasDocuments: boolean;
  hasCrew: boolean;
  daysUntil: number;
}

type TabType = 'overview' | 'details' | 'strategy' | 'documents' | 'crew' | 'equipment' | 'tracks' | 'results';

type StrategySection = Partial<TacticalRecommendation>;
type StrategyConditions = Partial<RaceConditions>;

type StrategyContingencies = {
  windShift: StrategySection[];
  windDrop: StrategySection[];
  windIncrease: StrategySection[];
  currentChange: StrategySection[];
  equipmentIssue: StrategySection[];
};

type RaceStrategyViewModel = {
  overallApproach: string;
  startStrategy: StrategySection | null;
  beatStrategy: StrategySection[];
  runStrategy: StrategySection[];
  markRoundings: StrategySection[];
  finishStrategy: StrategySection | null;
  contingencies: StrategyContingencies;
  conditions: StrategyConditions;
  simulationResults?: RaceStrategy['simulationResults'];
  confidence: number;
  startLineSummary?: {
    favoredEnd?: string;
    approach?: string;
  };
  keyTacticalPoints: string[];
};

const extractStartLineSummary = (startStrategy?: StrategySection | null) => {
  if (!startStrategy) return undefined;
  const favoredEnd =
    (startStrategy as any)?.favored_end ??
    (startStrategy as any)?.favoredEnd;
  const approach =
    (startStrategy as any)?.approach ??
    (typeof startStrategy.action === 'string' ? startStrategy.action : undefined);

  if (!favoredEnd && !approach) {
    return undefined;
  }

  return {
    favoredEnd,
    approach
  };
};

const extractKeyTacticalPoints = (
  strategy?: {
    beatStrategy?: StrategySection[];
    runStrategy?: StrategySection[];
    markRoundings?: StrategySection[];
  }
): string[] => {
  if (!strategy) return [];
  const points: string[] = [];

  const beatAction = strategy.beatStrategy?.[0]?.action;
  if (beatAction) points.push(beatAction);

  const runAction = strategy.runStrategy?.[0]?.action;
  if (runAction) points.push(runAction);

  const markAction = strategy.markRoundings?.[0]?.action;
  if (markAction) points.push(markAction);

  return points;
};

const mapGeneratedStrategyToView = (data: RaceStrategy): RaceStrategyViewModel => ({
  overallApproach: data.strategy?.overallApproach ?? '',
  startStrategy: data.strategy?.startStrategy ?? null,
  beatStrategy: data.strategy?.beatStrategy ?? [],
  runStrategy: data.strategy?.runStrategy ?? [],
  markRoundings: data.strategy?.markRoundings ?? [],
  finishStrategy: data.strategy?.finishStrategy ?? null,
  contingencies: {
    windShift: data.contingencies?.windShift ?? [],
    windDrop: data.contingencies?.windDrop ?? [],
    windIncrease: data.contingencies?.windIncrease ?? [],
    currentChange: data.contingencies?.currentChange ?? [],
    equipmentIssue: data.contingencies?.equipmentIssue ?? []
  },
  conditions: data.conditions ?? {},
  simulationResults: data.simulationResults,
  confidence: data.confidence ?? 0.5,
  startLineSummary: extractStartLineSummary(data.strategy?.startStrategy),
  keyTacticalPoints: extractKeyTacticalPoints(data.strategy)
});

const mergeConditionsFromRecord = (record: any): StrategyConditions => {
  if (!record) return {};

  return {
    wind: {
      speed: record?.wind_speed ?? record?.wind?.speed,
      direction: record?.wind_direction ?? record?.wind?.direction,
      forecast:
        record?.wind_forecast ??
        record?.wind?.forecast ??
        {
          nextHour: { speed: record?.wind_speed ?? 0, direction: record?.wind_direction ?? 0 },
          nextThreeHours: { speed: record?.wind_speed ?? 0, direction: record?.wind_direction ?? 0 }
        },
      confidence: record?.wind_confidence ?? 0.6
    },
    current: {
      speed: record?.current_speed ?? record?.current?.speed,
      direction: record?.current_direction ?? record?.current?.direction,
      tidePhase: record?.tide_phase ?? record?.current?.tidePhase ?? 'slack'
    },
    waves: {
      height: record?.wave_height ?? record?.waves?.height ?? 0,
      period: record?.wave_period ?? record?.waves?.period ?? 0,
      direction: record?.wave_direction ?? record?.waves?.direction ?? 0
    },
    visibility: record?.visibility ?? record?.conditions?.visibility ?? 10,
    temperature: record?.temperature ?? record?.conditions?.temperature ?? 24,
    weatherRisk: record?.weatherRisk ?? record?.conditions?.weatherRisk ?? 'moderate'
  };
};

const mapStrategyRecordToView = (data: any): RaceStrategyViewModel => {
  const content = data?.strategy_content && typeof data.strategy_content === 'object'
    ? data.strategy_content
    : {};
  const normalized = {
    ...data,
    ...content,
  };

  const contingencies = normalized?.contingencies || {};
  const beatStrategy = Array.isArray(normalized?.beat_strategy) ? normalized.beat_strategy : [];
  const runStrategy = Array.isArray(normalized?.run_strategy) ? normalized.run_strategy : [];
  const markRoundings = Array.isArray(normalized?.mark_roundings) ? normalized.mark_roundings : [];

  const startStrategy = normalized?.start_strategy ?? null;
  const finishStrategy = normalized?.finish_strategy ?? null;

  const keyPoints =
    Array.isArray(normalized?.key_tactical_points) && normalized.key_tactical_points.length > 0
      ? normalized.key_tactical_points
      : extractKeyTacticalPoints({
          beatStrategy,
          runStrategy,
          markRoundings
        });

  const rawConfidence =
    typeof normalized?.confidence === 'number'
      ? normalized.confidence
      : typeof normalized?.confidence_score === 'number'
      ? normalized.confidence_score
      : undefined;
  const confidence =
    typeof rawConfidence === 'number'
      ? rawConfidence > 1
        ? Math.max(0, Math.min(1, rawConfidence / 100))
        : Math.max(0, Math.min(1, rawConfidence))
      : 0.5;

  return {
    overallApproach: normalized?.overall_approach || normalized?.overallApproach || '',
    startStrategy,
    beatStrategy,
    runStrategy,
    markRoundings,
    finishStrategy,
    contingencies: {
      windShift: contingencies?.windShift ?? contingencies?.wind_shift ?? [],
      windDrop: contingencies?.windDrop ?? contingencies?.wind_drop ?? [],
      windIncrease: contingencies?.windIncrease ?? contingencies?.wind_increase ?? [],
      currentChange: contingencies?.currentChange ?? contingencies?.current_change ?? [],
      equipmentIssue: contingencies?.equipmentIssue ?? contingencies?.equipment_issue ?? []
    },
    conditions: mergeConditionsFromRecord(normalized),
    simulationResults: normalized?.simulation_results,
    confidence,
    startLineSummary: extractStartLineSummary(startStrategy),
    keyTacticalPoints: keyPoints
  };
};

// Generate SHA-256 hash for document deduplication
async function generateDocumentHash(content: string): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      // Web: Use SubtleCrypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } else {
      // Native: Use expo-crypto
      const Crypto = await import('expo-crypto');
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        content
      );
      return hash;
    }
  } catch (error) {

    // Fallback: simple hash based on content length and first 100 chars
    return `fallback_${content.length}_${content.substring(0, 100).length}`;
  }
}

// ✨ REDIRECT TO NEW SCROLLABLE DESIGN ✨
// Feature flag: Enable new Apple Weather-inspired scrollable design
const USE_SCROLLABLE_DESIGN = true;

export default function RaceDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    tab?: string;
    action?: 'quickdraw' | 'template';
    courseId?: string;
  }>();
  const { id, tab, action, courseId } = params;
  const { user } = useAuth();

  // All hooks must be declared before any early returns to satisfy rules-of-hooks
  const [race, setRace] = useState<RaceDetails | null>(null);
  const [raceFullData, setRaceFullData] = useState<any>(null); // Full race data for details view
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);

  // Strategy state
  const [strategy, setStrategy] = useState<RaceStrategyViewModel | null>(null);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [activeLayer, setActiveLayer] = useState<'course' | 'weather' | 'tide' | 'tactical' | 'bathymetry' | 'satellite'>('course');
  const [showLaylines, setShowLaylines] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Course Setup state (Phase 2)
  const [hasCourseMarks, setHasCourseMarks] = useState(false);
  const [showCourseSetup, setShowCourseSetup] = useState(false);
  const [showCourseSelector, setShowCourseSelector] = useState(false);

  // Handle URL parameters for Quick Draw launch (Phase 2)
  const [isQuickDrawMode, setIsQuickDrawMode] = useState(false);
  const urlActionHandled = React.useRef(false);

  useEffect(() => {
    if (USE_SCROLLABLE_DESIGN && id) {
      const redirectParams: Record<string, string> = { id };
      if (tab) redirectParams.tab = tab;
      if (action) redirectParams.action = action;
      if (courseId) redirectParams.courseId = courseId;
      logger.debug(
        '[RaceDetail] Redirecting to new scrollable design:',
        `/race/scrollable/${id}`,
        'with params',
        redirectParams
      );
      router.replace({ pathname: '/race/scrollable/[id]', params: redirectParams } as any);
    }
  }, [id, tab, action, courseId]);

  useEffect(() => {
    if (USE_SCROLLABLE_DESIGN) return;
    loadRaceDetails();
    // loadRaceDetails reads `id` from the outer closure; keying on id only is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Reset urlActionHandled when action parameter changes
  useEffect(() => {
    if (USE_SCROLLABLE_DESIGN) return;
    logger.debug('[RaceDetail] Action parameter changed, resetting urlActionHandled');
    urlActionHandled.current = false;
  }, [action]);

  useEffect(() => {
    if (USE_SCROLLABLE_DESIGN) return;
    logger.debug('[RaceDetail] ===== URL PARAMS EFFECT =====');
    logger.debug('[RaceDetail] tab:', tab, 'action:', action);
    logger.debug('[RaceDetail] urlActionHandled.current:', urlActionHandled.current);
    logger.debug('[RaceDetail] Current state - isQuickDrawMode:', isQuickDrawMode, 'showCourseSelector:', showCourseSelector);

    if (tab) {
      logger.debug('[RaceDetail] Setting active tab from URL:', tab);
      setActiveTab(tab as TabType);
    }

    // Only handle action parameter once per page load
    if (action && !urlActionHandled.current) {
      logger.debug('[RaceDetail] Processing action:', action);

      if (action === 'quickdraw') {
        logger.debug('[RaceDetail] ===== QUICK DRAW ACTION DETECTED =====');
        logger.debug('[RaceDetail] Setting isQuickDrawMode to TRUE');
        urlActionHandled.current = true;
        // Enable Quick Draw mode instead of showing CourseSetupPrompt
        setIsQuickDrawMode(true);
      } else if (action === 'template') {
        logger.debug('[RaceDetail] ===== TEMPLATE ACTION DETECTED =====');
        logger.debug('[RaceDetail] Setting showCourseSelector to TRUE');
        logger.debug('[RaceDetail] Race object exists?', !!race);
        urlActionHandled.current = true;
        // Show course template selector
        setTimeout(() => {
          logger.debug('[RaceDetail] Timeout fired - setting showCourseSelector(true)');
          setShowCourseSelector(true);
        }, 300);
      } else {
        logger.debug('[RaceDetail] Unknown action:', action);
      }
    } else {
      if (!action) {
        logger.debug('[RaceDetail] No action parameter in URL');
      }
      if (urlActionHandled.current) {
        logger.debug('[RaceDetail] Action already handled, skipping');
      }
    }
    // Intentionally fires only when URL params change; reads of race/isQuickDrawMode/showCourseSelector are diagnostic logs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, action]);

  // If redirecting, show nothing
  if (USE_SCROLLABLE_DESIGN) {
    return null;
  }

  const loadRaceDetails = async () => {
    try {
      setLoading(true);
      logger.debug('[RaceDetail] Loading race:', id);

      // Add safety check for undefined/null id
      if (!id) {
        console.error('[RaceDetail] No race ID provided');
        setLoading(false);
        return;
      }

      // Check if this is a mock race
      if (id.startsWith('mock-race-')) {

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Import timeout')), 5000)
        );

        const importPromise = import('@/constants/mockData');

        const { getRaceWithLinks } = await Promise.race([importPromise, timeoutPromise]) as any;

        const linkedData = getRaceWithLinks(id);

        if (!linkedData) {
          console.error('Mock race not found');
          setLoading(false);
          return;
        }

        const mockRace = linkedData.race;

        // Convert mock race to race details format
        const startDate = new Date(mockRace.date);
        const today = new Date();
        const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        setRace({
          id: mockRace.id,
          name: mockRace.name,
          venue: mockRace.venue,
          startDate: mockRace.date,
          endDate: mockRace.date, // Same day for demo
          classId: 'dragon',
          className: 'Dragon',
          hasStrategy: false,
          hasDocuments: false,
          hasCrew: false,
          daysUntil,
        });

        // Set mock race data for details view
        setRaceFullData({
          id: mockRace.id,
          name: mockRace.name,
          start_date: mockRace.date,
          end_date: mockRace.date,
          metadata: {
            venue_name: mockRace.venue,
            class: 'Dragon',
            class_name: 'Dragon',
            wind: mockRace.wind,
            tide: mockRace.tide,
            strategy: mockRace.strategy,
            critical_details: mockRace.critical_details,
          },
        });

        setLoading(false);
        return;
      }

      // Fetch race details from Supabase for real races
      logger.debug('[RaceDetail] Fetching race from Supabase, ID:', id);
      logger.debug('[RaceDetail] User ID:', user?.id);
      const { supabase } = await import('@/services/supabase');

      // First, try a simple count query to see if race exists at all (bypassing RLS for diagnostics)
      logger.debug('[RaceDetail] Testing if race exists in database...');
      const { count, error: countError } = await supabase
        .from('regattas')
        .select('*', { count: 'exact', head: true })
        .eq('id', id);

      logger.debug('[RaceDetail] Count query result:', { count, countError });

      // Add timeout to prevent hanging
      logger.debug('[RaceDetail] Fetching full race data...');
      const fetchPromise = supabase
        .from('regattas')
        .select('*') // Load ALL fields for comprehensive race details
        .eq('id', id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Race fetch timeout after 10 seconds')), 10000)
      );

      let regattaData, error;
      try {
        const result = await Promise.race([fetchPromise, timeoutPromise]);
        regattaData = (result as any).data;
        error = (result as any).error;
      } catch (timeoutError: any) {
        console.error('[RaceDetail] Fetch timeout:', timeoutError);
        showAlert('Error', 'Failed to load race details (timeout). Please try again.');
        setLoading(false);
        return;
      }

      if (error) {
        console.error('[RaceDetail] Error loading race:', error);
        showAlert('Error', `Failed to load race: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!regattaData) {
        console.error('[RaceDetail] Race not found in database:', id);
        showAlert('Error', 'Race not found');
        setLoading(false);
        return;
      }

      logger.debug('[RaceDetail] Race data loaded:', regattaData);

      // Store full race data for details view
      setRaceFullData(regattaData);

      // Calculate days until race
      const startDate = new Date(regattaData.start_date);
      const today = new Date();
      const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Load race documents from database (sailing_documents table)
      // Prefer metadata.regatta_id scoping; fallback to user documents if the JSON path is unavailable.
      logger.debug('[RaceDetail] Loading documents for user:', user?.id);
      let docsData = null;
      try {
        let data: any[] | null = null;
        let docsError: any = null;

        const scopedQuery = await supabase
          .from('sailing_documents')
          .select('id, user_id, filename, mime_type, created_at, processing_status, course_data, metadata')
          .eq('user_id', user?.id)
          .eq('metadata->>regatta_id', id)
          .order('created_at', { ascending: false });

        data = scopedQuery.data;
        docsError = scopedQuery.error;

        if (docsError) {
          console.warn('[RaceDetail] Regatta-scoped document query failed, falling back to user documents:', docsError);
          const fallbackQuery = await supabase
            .from('sailing_documents')
            .select('id, user_id, filename, mime_type, created_at, processing_status, course_data')
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false });
          data = fallbackQuery.data;
          docsError = fallbackQuery.error;
        }

        if (docsError) {
          console.warn('[RaceDetail] Error loading documents (non-critical):', docsError);
        } else if (data && data.length > 0) {
          const loadedDocs: Document[] = data.map(doc => ({
            id: doc.id,
            name: doc.filename || 'Unknown Document',
            type: doc.mime_type || 'application/pdf',
            uploadedAt: new Date(doc.created_at),
            extractionStatus: (doc.processing_status as any) || 'completed',
            // TODO: Load extraction from ai_analyses table with document_id
            extraction: doc.course_data ? doc.course_data : undefined,
          }));
          setDocuments(loadedDocs);
          logger.debug('[RaceDetail] Loaded', loadedDocs.length, 'documents');
          docsData = data;
        }
      } catch (docError) {
        console.warn('[RaceDetail] Document loading failed (non-critical):', docError);
        // Continue anyway - documents are optional
      }

      // Load race strategy if exists (supports current schema with strategy_content JSONB)
      let strategyData = null;
      try {
        let data: any = null;
        let strategyError: any = null;
        const primaryStrategy = await supabase
          .from('race_strategies')
          .select('id, regatta_id, user_id, strategy_type, favored_end, start_line_bias, layline_approach, wind_strategy, confidence_score, strategy_content, ai_generated, ai_model, generated_at, created_at, updated_at')
          .eq('regatta_id', id)
          .eq('user_id', user?.id)
          .maybeSingle();
        data = primaryStrategy.data;
        strategyError = primaryStrategy.error;

        if (isMissingIdColumn(strategyError, 'race_strategies', 'regatta_id')) {
          const fallbackStrategy = await supabase
            .from('race_strategies')
            .select('id, race_id, user_id, strategy_type, favored_end, start_line_bias, layline_approach, wind_strategy, confidence_score, strategy_content, ai_generated, ai_model, generated_at, created_at, updated_at')
            .eq('race_id', id)
            .eq('user_id', user?.id)
            .maybeSingle();
          data = fallbackStrategy.data;
          strategyError = fallbackStrategy.error;
        }

        if (strategyError) {
          console.warn('[RaceDetail] Error loading strategy (non-critical):', strategyError);
        } else if (data) {
          logger.debug('[RaceDetail] Loaded strategy');
          strategyData = data;
        }
      } catch (strategyLoadError) {
        console.warn('[RaceDetail] Strategy loading failed (non-critical):', strategyLoadError);
        // Continue anyway - strategy is optional
      }

      // Process strategy data if it exists
      if (strategyData) {
        const loadedStrategy = mapStrategyRecordToView(strategyData);
        setStrategy(loadedStrategy);
      }

      // Check for course marks - look up race_event and marks
      logger.debug('[RaceDetail] Checking for course marks...');
      try {
        // Find race_event associated with this regatta
        let raceEvent: { id: string } | null = null;
        const primaryRaceEvent = await supabase
          .from('race_events')
          .select('id')
          .eq('regatta_id', id)
          .maybeSingle();
        raceEvent = primaryRaceEvent.data;

        if (isMissingIdColumn(primaryRaceEvent.error, 'race_events', 'regatta_id')) {
          const fallbackRaceEvent = await supabase
            .from('race_events')
            .select('id')
            .eq('race_id', id)
            .maybeSingle();
          raceEvent = fallbackRaceEvent.data;
        }

        if (raceEvent) {
          logger.debug('[RaceDetail] Found race_event:', raceEvent.id);

          // Check for marks
          const { count } = await supabase
            .from('race_marks')
            .select('*', { count: 'exact', head: true })
            .eq('race_id', raceEvent.id);

          logger.debug('[RaceDetail] Found', count || 0, 'marks for race_event');
          setHasCourseMarks((count || 0) > 0);
        } else {
          logger.debug('[RaceDetail] No race_event found for regatta');
          setHasCourseMarks(false);
        }
      } catch (marksError) {
        console.error('[RaceDetail] Error checking course marks:', marksError);
        setHasCourseMarks(false);
      }

      setRace({
        id: regattaData.id,
        name: regattaData.name,
        venue: regattaData.metadata?.venue_name || 'Venue TBD',
        startDate: regattaData.start_date,
        endDate: regattaData.end_date,
        classId: regattaData.metadata?.class || 'unknown',
        className: regattaData.metadata?.class_name || regattaData.metadata?.class || 'Class TBD',
        hasStrategy: !!strategyData,
        hasDocuments: (docsData && docsData.length > 0) || false,
        hasCrew: !!regattaData.metadata?.crew,
        daysUntil,
      });
    } catch (error) {
      console.error('[RaceDetail] Error loading race details:', error);
      // Make sure we show an error state to the user
      setRace(null);
      setLoading(false);
    } finally {
      // Always ensure loading is set to false
      setLoading(false);
    }
  };

  const handleDocumentUpload = async () => {
    try {
      setUploading(true);

      // Pick document
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const file = result.assets[0];

      // Create document entry
      const newDoc: Document = {
        id: Date.now().toString(),
        name: file.name,
        type: file.mimeType || 'unknown',
        uploadedAt: new Date(),
        extractionStatus: 'pending',
      };

      setDocuments(prev => [...prev, newDoc]);
      setUploading(false);

      // Start AI extraction
      await extractDocumentContent(newDoc.id, file);

    } catch (error) {
      console.error('Error uploading document:', error);
      showAlert('Upload Failed', 'Could not upload document. Please try again.');
      setUploading(false);
    }
  };

  const extractDocumentContent = async (docId: string, file: any) => {
    try {
      // Track extraction per-document, not globally (allow concurrent extractions)
      setDocuments(prev => prev.map(d =>
        d.id === docId ? { ...d, extractionStatus: 'processing' } : d
      ));

      // Read actual file content (PDF text extraction)
      let documentText = '';

      try {
        // Use PDFExtractionService (static method)
        const { PDFExtractionService } = await import('@/services/PDFExtractionService');

        const result = await PDFExtractionService.extractText(file.uri);

        if (result.success && result.text) {
          documentText = result.text;

        } else {
          throw new Error(result.error || 'PDF extraction returned no text');
        }
      } catch (pdfError) {

        // Fallback: Use filename as hint for extraction
        documentText = `Document: ${file.name}`;
      }

      if (!documentText || documentText.length < 20) {
        throw new Error('Could not extract text from PDF. File may be empty or image-based.');
      }

      const extractor = new RaceCourseExtractor();

      const extraction = await extractor.extractRaceCourse(documentText, {
        filename: file.name,
        venue: race?.venue,
        documentType: 'sailing_instructions',
      });

      // Save document to Supabase
      const { supabase } = await import('@/services/supabase');

      // Generate document hash for deduplication
      const documentHash = await generateDocumentHash(documentText);

      const { data: savedDoc, error: saveError} = await supabase
        .from('sailing_documents')
        .insert({
          user_id: user?.id,
          title: file.name,
          filename: file.name,
          file_path: file.uri || file.name,
          file_size: file.size ?? 0,
          mime_type: file.mimeType || 'application/pdf',
          document_hash: documentHash,
          processing_status: 'completed',
          course_data: extraction,
          metadata: {
            regatta_id: id,
            document_type: 'sailing_instructions'
          }
        })
        .select()
        .single();

      if (saveError) {
        showAlert('Save Failed', 'Document extracted but could not be saved to database.');
      }

      // Update document with extraction and real database ID
      setDocuments(prev => prev.map(d =>
        d.id === docId
          ? { ...d, id: savedDoc?.id || docId, extractionStatus: 'completed', extraction }
          : d
      ));

      // Auto-populate race data if not set
      if (extraction && race) {
        setRace({
          ...race,
          hasDocuments: true,
        });
      }

      showAlertWithButtons(
        'Extraction Complete',
        `Found ${extraction.marks.length} marks and extracted course layout. View in Strategy tab for visualization.`,
        [
          { text: 'View Strategy', onPress: () => setActiveTab('strategy') },
          { text: 'OK' }
        ]
      );

    } catch (error) {
      setDocuments(prev => prev.map(d =>
        d.id === docId ? { ...d, extractionStatus: 'failed' } : d
      ));

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showAlert('Extraction Failed', errorMessage);
    } finally {
    }
  };

  const handleDeleteRace = async () => {
    showConfirm(
      'Delete Race',
      'Are you sure you want to delete this race? This action cannot be undone.',
      performDelete,
      { destructive: true, confirmText: 'Delete' }
    );
  };

  const performDelete = async () => {
    try {
      setDeleting(true);
      setShowMenuModal(false);

      // Delete race from database
      const { supabase } = await import('@/services/supabase');
      const { error } = await supabase
        .from('regattas')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting race:', error);
        showAlert('Error', 'Failed to delete race. Please try again.');
        setDeleting(false);
        return;
      }

      // Navigate back to races list
      showAlert('Success', 'Race deleted successfully');
      router.back();
    } catch (error) {
      console.error('Error deleting race:', error);
      showAlert('Error', 'An unexpected error occurred.');
      setDeleting(false);
    }
  };

  const handleEditRace = () => {
    setShowMenuModal(false);
    // Navigate to edit screen (we'll create this or reuse the add screen)
    router.push(`/race/edit/${id}`);
  };

  const resolveVenueId = async (metadata: any): Promise<string | null> => {
    const directVenueId =
      metadata?.venue_id ||
      metadata?.venue?.id ||
      raceFullData?.venue_id;

    if (typeof directVenueId === 'string' && directVenueId.trim().length > 0) {
      return directVenueId;
    }

    const venueNameCandidates = [
      metadata?.venue_name,
      raceFullData?.venue_name,
      race?.venue,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    for (const venueName of venueNameCandidates) {
      const trimmedName = venueName.trim();
      const { data, error } = await supabase
        .from('sailing_venues')
        .select('id')
        .ilike('name', trimmedName)
        .limit(1)
        .maybeSingle();

      if (!error && data?.id) {
        return data.id;
      }
    }

    return null;
  };

  const generateStrategy = async () => {
    try {
      if (!race || !raceFullData) return;

      setGeneratingStrategy(true);

      // Get weather data from raceFullData.metadata or use defaults
      const metadata = raceFullData.metadata || {};
      const windData = metadata.wind || {};
      const tideData = metadata.tide || {};

      // Parse wind direction from string (e.g., "SSW") to degrees
      const windDirectionMap: Record<string, number> = {
        'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
        'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
        'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
        'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
      };

      const windDirection = windDirectionMap[windData.direction] || 180;
      const windSpeed = windData.speedMin || 10;
      const windSpeedMax = windData.speedMax || windSpeed + 3;

      // Build current conditions from race data
      const currentConditions: RaceConditions = {
        wind: {
          speed: windSpeed,
          direction: windDirection,
          forecast: {
            nextHour: { speed: windSpeed + 1, direction: windDirection + 5 },
            nextThreeHours: { speed: windSpeedMax, direction: windDirection + 10 }
          },
          confidence: metadata.weather_provider ? 0.85 : 0.6
        },
        current: {
          speed: tideData.current || 0.5,
          direction: windDirection, // Simplified: assume current flows with wind
          tidePhase: (tideData.state === 'high' || tideData.state === 'rising') ? 'flood' :
                    (tideData.state === 'low' || tideData.state === 'falling') ? 'ebb' : 'slack'
        },
        waves: {
          height: windSpeed > 15 ? 1.0 : windSpeed > 10 ? 0.5 : 0.3,
          period: 4,
          direction: windDirection
        },
        visibility: 10,
        temperature: 24,
        weatherRisk: windSpeed > 20 ? 'high' : windSpeed > 15 ? 'moderate' : 'low'
      };

      const venueId = await resolveVenueId(metadata);
      if (!venueId) {
        throw new Error('Venue is missing. Add a venue to this race to generate AI strategy.');
      }

      // Check if documents with extraction exist
      const docWithExtraction = documents.find(d => d.extraction);

      let generatedStrategy: RaceStrategy;

      // Helper function to add timeout to promises
      const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
          )
        ]);
      };

      // Try document-based strategy first if documents exist, but with timeout and fallback
      if (docWithExtraction) {
        try {
          // MODE 1: Full strategy with sailing instructions and course marks (WITH TIMEOUT)

          generatedStrategy = await withTimeout(
            raceStrategyEngine.generateRaceStrategy(
              `Sailing Instructions for ${race.name}`,
              currentConditions,
              venueId,
              {
                raceName: race.name,
                fleetSize: 25,
                boatType: race.className,
                importance: 'championship'
              }
            ),
            60000, // 60 second timeout
            'Document processing timed out after 60 seconds'
          );

        } catch (docError: any) {

          // FALLBACK: Generate venue-based strategy instead
          generatedStrategy = await raceStrategyEngine.generateVenueBasedStrategy(
            venueId,
            currentConditions,
            {
              raceName: race.name,
              raceDate: new Date(raceFullData.start_date),
              raceTime: raceFullData.warning_signal_time || '10:00:00',
              boatType: race.className,
              fleetSize: 25,
              importance: 'championship'
            }
          );
        }
      } else {
        // MODE 2: Venue-based strategy without documents (NEW!)

        generatedStrategy = await raceStrategyEngine.generateVenueBasedStrategy(
          venueId,
          currentConditions,
          {
            raceName: race.name,
            raceDate: new Date(raceFullData.start_date),
            raceTime: raceFullData.warning_signal_time || '10:00:00',
            boatType: race.className,
            fleetSize: 25,
            importance: 'championship'
          }
        );
      }

      const generatedStrategyView = mapGeneratedStrategyToView(generatedStrategy);
      setStrategy(generatedStrategyView);
      setRace(prev => prev ? { ...prev, hasStrategy: true } : null);

      // Save strategy to database so it persists
      let strategyText: string;

      try {
        if (
          generatedStrategyView?.startLineSummary?.approach &&
          generatedStrategyView.keyTacticalPoints.length > 0
        ) {
          const favoredEnd = generatedStrategyView.startLineSummary.favoredEnd || 'Start line';
          strategyText = `${favoredEnd}: ${generatedStrategyView.startLineSummary.approach}. ${generatedStrategyView.keyTacticalPoints[0]}`;
        } else {
          strategyText = 'Strategy generated - view full details in strategy tab';
        }

        logger.debug('  Race ID:', id);
        logger.debug('  Strategy text:', strategyText);
        logger.debug('  Current metadata keys:', Object.keys(metadata));

        // Persist structured strategy to race_strategies (primary store)
        if (user?.id) {
          const confidencePercent = Math.round((generatedStrategyView.confidence || 0) * 100);
          const { error: strategySaveError } = await supabase
            .from('race_strategies')
            .upsert(
              {
                regatta_id: id,
                user_id: user.id,
                strategy_type: 'pre_race',
                confidence_score: Math.max(0, Math.min(100, confidencePercent)),
                strategy_content: {
                  overall_approach: generatedStrategyView.overallApproach,
                  start_strategy: generatedStrategyView.startStrategy,
                  beat_strategy: generatedStrategyView.beatStrategy,
                  run_strategy: generatedStrategyView.runStrategy,
                  finish_strategy: generatedStrategyView.finishStrategy,
                  mark_roundings: generatedStrategyView.markRoundings,
                  contingencies: generatedStrategyView.contingencies,
                  simulation_results: generatedStrategyView.simulationResults,
                  key_tactical_points: generatedStrategyView.keyTacticalPoints,
                  start_line_summary: generatedStrategyView.startLineSummary,
                  conditions: generatedStrategyView.conditions,
                },
                ai_generated: true,
                ai_model: 'claude-3-5-haiku-20241022',
                generated_at: new Date().toISOString(),
              },
              { onConflict: 'regatta_id,user_id' }
            );

          if (strategySaveError) {
            console.warn('[RaceDetail] Structured strategy save failed (non-critical):', strategySaveError);
          }
        }

        const { error: updateError } = await supabase
          .from('regattas')
          .update({
            metadata: {
              ...metadata,
              strategy: strategyText,
              has_strategy: true,
              strategy_generated_at: new Date().toISOString()
            }
          })
          .eq('id', id)
          .select();

        if (updateError) {
          console.error('  Error details:', JSON.stringify(updateError, null, 2));
          showAlert('Warning', `Strategy generated but failed to save: ${updateError.message}`);
        } else {
          showAlert('Success', 'Strategy generated and saved!');
        }
      } catch (saveError) {
        showAlert('Warning', 'Strategy generated but failed to save. It may not persist.');
      }

    } catch (error) {
      console.error('Error generating strategy:', error);
      showAlert('Strategy Generation Failed', 'Could not generate race strategy. Please try again.');
    } finally {
      setGeneratingStrategy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading race details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!race) {
    // Show loading spinner if still loading, error message if load failed
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          {loading ? (
            <>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading race details...</Text>
            </>
          ) : (
            <>
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
              <Text style={styles.errorText}>Race not found</Text>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backButtonText}>Go Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const renderOverview = () => (
    <View style={styles.tabContent}>
      {/* Race Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.countdownBadge}>
          <Text style={styles.countdownNumber}>{race.daysUntil}</Text>
          <Text style={styles.countdownLabel}>days</Text>
        </View>
        <View style={styles.raceHeaderInfo}>
          <Text style={styles.venueName}>{race.venue}</Text>
          <Text style={styles.dateRange}>
            {new Date(race.startDate).toLocaleDateString()}
            {race.endDate && race.endDate !== race.startDate && ` - ${new Date(race.endDate).toLocaleDateString()}`}
          </Text>
          <View style={styles.classBadge}>
            <MaterialCommunityIcons name="sail-boat" size={14} color="#3B82F6" />
            <Text style={styles.classText}>{race.className}</Text>
          </View>
        </View>
      </View>

      {/* Quick Status */}
      <View style={styles.statusGrid}>
        <TouchableOpacity
          style={[styles.statusCard, !race.hasStrategy && styles.statusCardIncomplete]}
          onPress={() => setActiveTab('strategy')}
        >
          <MaterialCommunityIcons
            name={race.hasStrategy ? 'compass-outline' : 'compass-off-outline'}
            size={32}
            color={race.hasStrategy ? '#10B981' : '#EF4444'}
          />
          <Text style={styles.statusTitle}>Strategy</Text>
          <Text style={[styles.statusSubtitle, !race.hasStrategy && styles.statusSubtitleIncomplete]}>
            {race.hasStrategy ? 'Ready' : 'Not Planned'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statusCard, !race.hasDocuments && styles.statusCardIncomplete]}
          onPress={() => setActiveTab('documents')}
        >
          <MaterialCommunityIcons
            name={race.hasDocuments ? 'file-check-outline' : 'file-alert-outline'}
            size={32}
            color={race.hasDocuments ? '#10B981' : '#F59E0B'}
          />
          <Text style={styles.statusTitle}>Documents</Text>
          <Text style={[styles.statusSubtitle, !race.hasDocuments && styles.statusSubtitleIncomplete]}>
            {race.hasDocuments ? 'Uploaded' : 'Missing'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statusCard, !race.hasCrew && styles.statusCardIncomplete]}
          onPress={() => setActiveTab('crew')}
        >
          <MaterialCommunityIcons
            name={race.hasCrew ? 'account-group' : 'account-group-outline'}
            size={32}
            color={race.hasCrew ? '#10B981' : '#94A3B8'}
          />
          <Text style={styles.statusTitle}>Crew</Text>
          <Text style={[styles.statusSubtitle, !race.hasCrew && styles.statusSubtitleIncomplete]}>
            {race.hasCrew ? 'Assigned' : 'Not Set'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Course Visualization - Phase 4 */}
      {(() => {
        const docWithExtraction = documents.find(d => d.extraction);
        if (docWithExtraction && docWithExtraction.extraction?.marks && docWithExtraction.extraction.marks.length > 0) {
          const visualizationMarks: CourseMark[] = docWithExtraction.extraction.marks.reduce<CourseMark[]>(
            (acc, mark, index) => {
              const latitude = mark.position?.latitude;
              const longitude = mark.position?.longitude;

              if (typeof latitude !== 'number' || typeof longitude !== 'number') {
                return acc;
              }

              acc.push({
                id: `${docWithExtraction.id}_${index}`,
                race_id: race?.id ?? 'preview',
                mark_name: mark.name,
                mark_type: mark.type,
                latitude,
                longitude,
                rounding: null,
                sequence: index,
                metadata: {
                  description: mark.position?.description,
                  confidence: mark.position?.confidence
                }
              } as CourseMark);

              return acc;
            },
            []
          );

          if (visualizationMarks.length === 0) {
            return null;
          }

          return (
            <View style={styles.courseSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Race Course</Text>
                <TouchableOpacity onPress={() => setActiveTab('strategy')}>
                  <Text style={styles.sectionLink}>View Strategy →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.courseContainer}>
                <CourseVisualization
                  marks={visualizationMarks}
                  racingAreaBoundary={docWithExtraction.extraction.racing_area_boundary}
                  courseConfiguration={docWithExtraction.extraction.course_description}
                  height={300}
                  interactive={true}
                />
              </View>
              <Text style={styles.courseHint}>
                {docWithExtraction.extraction.marks.length} marks extracted from sailing instructions
              </Text>
            </View>
          );
        }
        return null;
      })()}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons name="weather-cloudy" size={20} color="#3B82F6" />
          <Text style={styles.actionButtonText}>Check Weather</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons name="map-marker" size={20} color="#3B82F6" />
          <Text style={styles.actionButtonText}>View Venue Intel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons name="share-variant" size={20} color="#3B82F6" />
          <Text style={styles.actionButtonText}>Share with Crew</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStrategy = () => {
    const docWithExtraction = documents.find(d => d.extraction);

    logger.debug('[RaceDetail] renderStrategy called, isQuickDrawMode:', isQuickDrawMode);

    // QUICK DRAW MODE (Phase 2 navigation, Phase 3 full implementation)
    if (isQuickDrawMode) {
      // Get extracted marks from documents or metadata
      const extractedMarks = docWithExtraction?.extraction?.marks?.map(m => ({
        name: m.name,
        type: (m.type as any) || 'windward',
        confidence: m.position?.confidence || 0.8
      })) || [];

      const racingArea = raceFullData?.metadata?.start_area_name || race?.venue || 'Racing Area';

      return (
        <View style={styles.tabContent}>
          <QuickDrawMode
            extractedMarks={extractedMarks}
            racingAreaName={racingArea}
            onComplete={(marks) => {
              logger.debug('[RaceDetail] Quick Draw complete, marks:', marks);
              setIsQuickDrawMode(false);
              showAlert('Success', `${marks.length} marks placed successfully!`);
              // TODO: Save marks to course_marks table (Phase 3)
            }}
            onCancel={() => {
              logger.debug('[RaceDetail] Quick Draw cancelled');
              setIsQuickDrawMode(false);
            }}
          />
        </View>
      );
    }

    // ENHANCED EMPTY STATE: No course marks (Phase 2)
    // BUT STILL ALLOW VENUE-BASED STRATEGY!
    if (!hasCourseMarks && !docWithExtraction) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="compass-outline" size={64} color="#3B82F6" />
            <Text style={styles.emptyTitle}>Generate Venue Strategy</Text>
            <Text style={styles.emptyText}>
              You have venue and weather data. Generate a race strategy now!{'\n\n'}
              For more detailed strategy, add course marks or upload sailing instructions.
            </Text>

            <TouchableOpacity
              style={styles.generateButton}
              onPress={generateStrategy}
            >
              <MaterialCommunityIcons name="brain" size={20} color="#FFFFFF" />
              <Text style={styles.generateButtonText}>Generate Strategy</Text>
            </TouchableOpacity>

            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowCourseSetup(true)}
              >
                <MaterialCommunityIcons name="map-marker-plus" size={16} color="#3B82F6" />
                <Text style={styles.secondaryButtonText}>Add Course Marks</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setActiveTab('documents')}
              >
                <MaterialCommunityIcons name="file-document" size={16} color="#3B82F6" />
                <Text style={styles.secondaryButtonText}>Upload Documents</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // No documents uploaded yet (but has course marks)
    if (!docWithExtraction) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="compass-outline" size={48} color="#3B82F6" />
            <Text style={styles.emptyTitle}>Ready for Strategy</Text>
            <Text style={styles.emptyText}>
              Generate AI strategy with venue intelligence and conditions
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setActiveTab('documents')}
            >
              <MaterialCommunityIcons name="file-document-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Upload Documents</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Documents uploaded but no strategy yet
    if (!strategy && !generatingStrategy) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.strategyPreview}>
            <MaterialCommunityIcons name="compass-outline" size={48} color="#3B82F6" />
            <Text style={styles.strategyPreviewTitle}>Ready to Generate Strategy</Text>
            <Text style={styles.strategyPreviewText}>
              Course extracted with {docWithExtraction.extraction!.marks.length} marks.{'\n'}
              Generate AI-powered race strategy with venue intelligence.
            </Text>
            <TouchableOpacity
              style={styles.generateButton}
              onPress={generateStrategy}
            >
              <MaterialCommunityIcons name="brain" size={20} color="#FFFFFF" />
              <Text style={styles.generateButtonText}>Generate Strategy</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Generating strategy
    if (generatingStrategy) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.generatingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.generatingTitle}>Generating Race Strategy</Text>
            <Text style={styles.generatingText}>
              Analyzing sailing instructions, conditions, and venue intelligence...
            </Text>
            <View style={styles.generatingSteps}>
              <Text style={styles.generatingStep}>✓ Extracting race course</Text>
              <Text style={styles.generatingStep}>✓ Loading venue intelligence</Text>
              <Text style={styles.generatingStep}>⟳ Generating tactical recommendations</Text>
              <Text style={styles.generatingStep}>⟳ Running Monte Carlo simulation</Text>
            </View>
          </View>
        </View>
      );
    }

    // Strategy generated - show full-screen map interface
    return (
      <View style={styles.strategyContainer}>
        {/* OnX Maps-style Layer Controls */}
        <View style={styles.layerControls}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.layerScrollContent}
          >
            {[
              { key: 'course', label: 'Course', icon: 'map-marker-path' },
              { key: 'weather', label: 'Weather', icon: 'weather-windy' },
              { key: 'tide', label: 'Tide', icon: 'waves' },
              { key: 'tactical', label: 'Tactical', icon: 'chess-knight' },
              { key: 'bathymetry', label: 'Depth', icon: 'chart-line' },
              { key: 'satellite', label: 'Satellite', icon: 'satellite-variant' }
            ].map(layer => (
              <TouchableOpacity
                key={layer.key}
                style={[
                  styles.layerButton,
                  activeLayer === layer.key && styles.layerButtonActive
                ]}
                onPress={() => setActiveLayer(layer.key as any)}
              >
                <MaterialCommunityIcons
                  name={layer.icon as any}
                  size={16}
                  color={activeLayer === layer.key ? '#FFFFFF' : '#64748B'}
                />
                <Text style={[
                  styles.layerButtonText,
                  activeLayer === layer.key && styles.layerButtonTextActive
                ]}>
                  {layer.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.laylinesToggle, showLaylines && styles.laylinesToggleActive]}
            onPress={() => setShowLaylines(!showLaylines)}
          >
            <MaterialCommunityIcons
              name="triangle-outline"
              size={16}
              color={showLaylines ? '#FFFFFF' : '#64748B'}
            />
          </TouchableOpacity>
        </View>

        {/* 3D Map Container with MapLibre GL */}
        <View style={styles.mapContainer}>
          <RaceMapView
            courseExtraction={docWithExtraction.extraction!}
            activeLayer={activeLayer}
            showLaylines={showLaylines}
            onMapLoad={() => {}}
          />

          {/* Confidence Badge Overlay */}
          <View style={styles.confidenceBadge}>
            <MaterialCommunityIcons name="shield-check" size={16} color="#10B981" />
            <Text style={styles.confidenceBadgeText}>
              {Math.round((strategy?.confidence || 0) * 100)}% Confidence
            </Text>
          </View>
        </View>

        {/* Strategy Panel */}
        <ScrollView style={styles.strategyPanel} showsVerticalScrollIndicator={false}>
          {/* Strategy Metrics */}
          <View style={styles.strategyMetricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Pred. Finish</Text>
              <Text style={styles.metricValue}>
                {strategy?.simulationResults?.averageFinish || 'N/A'}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Win Prob.</Text>
              <Text style={styles.metricValue}>
                {Math.round((strategy?.simulationResults?.winProbability || 0) * 100)}%
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Top 3</Text>
              <Text style={styles.metricValue}>
                {Math.round((strategy?.simulationResults?.topThreeProbability || 0) * 100)}%
              </Text>
            </View>
          </View>

          {/* Weather Intelligence Panel */}
          <View style={styles.weatherPanel}>
            <View style={styles.weatherHeader}>
              <MaterialCommunityIcons name="weather-partly-cloudy" size={24} color="#3B82F6" />
              <Text style={styles.weatherTitle}>Weather Intelligence</Text>
              <View style={styles.weatherConfidenceBadge}>
                <Text style={styles.weatherConfidenceText}>
                  {Math.round((strategy?.conditions?.wind?.confidence || 0) * 100)}%
                </Text>
              </View>
            </View>

            {/* Weather Trend Charts */}
            <View style={styles.weatherTrendsSection}>
              <Text style={styles.weatherSectionLabel}>Conditions Forecast</Text>

              {/* Wind Speed Trend */}
              <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                  <MaterialCommunityIcons name="weather-windy" size={16} color="#3B82F6" />
                  <Text style={styles.chartTitle}>Wind Speed</Text>
                  <Text style={styles.chartCurrentValue}>{strategy?.conditions?.wind?.speed} kts</Text>
                </View>
                <VictoryChart
                  theme={VictoryTheme.material}
                  height={80}
                  padding={{ top: 5, bottom: 20, left: 30, right: 10 }}
                >
                  <VictoryAxis
                    style={{
                      axis: { stroke: '#E2E8F0' },
                      tickLabels: { fontSize: 8, fill: '#94A3B8' }
                    }}
                  />
                  <VictoryArea
                  data={[
                    { x: 'Now', y: strategy?.conditions?.wind?.speed || 15 },
                    { x: '+1h', y: strategy?.conditions?.wind?.forecast?.nextHour?.speed || 16 },
                    { x: '+3h', y: strategy?.conditions?.wind?.forecast?.nextThreeHours?.speed || 18 }
                  ]}
                    style={{
                      data: { fill: '#3B82F6', fillOpacity: 0.3, stroke: '#3B82F6', strokeWidth: 2 }
                    }}
                  />
                </VictoryChart>
              </View>

              {/* Current Speed Trend */}
              <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                  <MaterialCommunityIcons name="waves" size={16} color="#10B981" />
                  <Text style={styles.chartTitle}>Current & Tide</Text>
                  <Text style={styles.chartCurrentValue}>{strategy?.conditions?.current?.speed} kts</Text>
                </View>
                <VictoryChart
                  theme={VictoryTheme.material}
                  height={80}
                  padding={{ top: 5, bottom: 20, left: 30, right: 10 }}
                >
                  <VictoryAxis
                    style={{
                      axis: { stroke: '#E2E8F0' },
                      tickLabels: { fontSize: 8, fill: '#94A3B8' }
                    }}
                  />
                  <VictoryLine
                  data={[
                    { x: 'Now', y: strategy?.conditions?.current?.speed || 0.8 },
                      { x: '+1h', y: 0.9 },
                      { x: '+3h', y: 1.1 }
                    ]}
                    style={{
                      data: { stroke: '#10B981', strokeWidth: 2 }
                    }}
                  />
                </VictoryChart>
              </View>

              {/* Wave Height Trend */}
              <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                  <MaterialCommunityIcons name="wave" size={16} color="#06B6D4" />
                  <Text style={styles.chartTitle}>Wave Height</Text>
                  <Text style={styles.chartCurrentValue}>{strategy?.conditions?.waves?.height}m</Text>
                </View>
                <VictoryChart
                  theme={VictoryTheme.material}
                  height={80}
                  padding={{ top: 5, bottom: 20, left: 30, right: 10 }}
                >
                  <VictoryAxis
                    style={{
                      axis: { stroke: '#E2E8F0' },
                      tickLabels: { fontSize: 8, fill: '#94A3B8' }
                    }}
                  />
                  <VictoryLine
                  data={[
                    { x: 'Now', y: strategy?.conditions?.waves?.height || 0.5 },
                      { x: '+1h', y: 0.6 },
                      { x: '+3h', y: 0.7 }
                    ]}
                    style={{
                      data: { stroke: '#06B6D4', strokeWidth: 2 }
                    }}
                  />
                </VictoryChart>
              </View>
            </View>

            {/* Forecast Timeline */}
            <View style={styles.weatherForecastSection}>
              <Text style={styles.weatherSectionLabel}>Race Window Forecast</Text>
              <View style={styles.forecastTimeline}>
                {/* Now */}
                <View style={styles.forecastTimepoint}>
                  <View style={[styles.forecastMarker, styles.forecastMarkerNow]}>
                    <Text style={styles.forecastMarkerText}>NOW</Text>
                  </View>
                  <View style={styles.forecastDataPoint}>
                    <MaterialCommunityIcons name="weather-windy" size={16} color="#3B82F6" />
                    <Text style={styles.forecastValue}>
                      {strategy?.conditions?.wind?.speed} kts
                    </Text>
                  </View>
                </View>

                {/* +1 Hour */}
                <View style={styles.forecastTimepoint}>
                  <View style={styles.forecastMarker}>
                    <Text style={styles.forecastMarkerText}>+1h</Text>
                  </View>
                  <View style={styles.forecastDataPoint}>
                    <MaterialCommunityIcons name="weather-windy" size={16} color="#64748B" />
                    <Text style={styles.forecastValue}>
                      {strategy?.conditions?.wind?.forecast?.nextHour?.speed} kts
                    </Text>
                  </View>
                  <Text style={styles.forecastChange}>
                    {strategy && (strategy.conditions?.wind?.forecast?.nextHour?.speed || 0) > (strategy.conditions?.wind?.speed || 0) ? '↑' : '↓'}
                    {' '}{Math.abs((strategy?.conditions?.wind?.forecast?.nextHour?.speed || 0) - (strategy?.conditions?.wind?.speed || 0))} kts
                  </Text>
                </View>

                {/* +3 Hours */}
                <View style={styles.forecastTimepoint}>
                  <View style={styles.forecastMarker}>
                    <Text style={styles.forecastMarkerText}>+3h</Text>
                  </View>
                  <View style={styles.forecastDataPoint}>
                    <MaterialCommunityIcons name="weather-windy" size={16} color="#64748B" />
                    <Text style={styles.forecastValue}>
                      {strategy?.conditions?.wind?.forecast?.nextThreeHours?.speed} kts
                    </Text>
                  </View>
                  <Text style={styles.forecastChange}>
                    {strategy && (strategy.conditions?.wind?.forecast?.nextThreeHours?.speed || 0) > (strategy.conditions?.wind?.speed || 0) ? '↑' : '↓'}
                    {' '}{Math.abs((strategy?.conditions?.wind?.forecast?.nextThreeHours?.speed || 0) - (strategy?.conditions?.wind?.speed || 0))} kts
                  </Text>
                </View>
              </View>

              {/* Weather Risk Alert */}
              {strategy?.conditions?.weatherRisk !== 'low' && (
                <View style={[
                  styles.weatherRiskAlert,
                  strategy?.conditions?.weatherRisk === 'high' && styles.weatherRiskAlertHigh
                ]}>
                  <MaterialCommunityIcons
                    name="alert"
                    size={16}
                    color={strategy?.conditions?.weatherRisk === 'high' ? '#EF4444' : '#F59E0B'}
                  />
                  <Text style={[
                    styles.weatherRiskText,
                    strategy?.conditions?.weatherRisk === 'high' && styles.weatherRiskTextHigh
                  ]}>
                    {strategy?.conditions?.weatherRisk === 'high' ? 'High' : 'Moderate'} weather risk - Monitor conditions closely
                  </Text>
                </View>
              )}
            </View>

            {/* Auto-Update Status */}
            <View style={styles.weatherAutoUpdate}>
              <View style={styles.autoUpdateIndicator}>
                <View style={styles.autoUpdateDot} />
                <Text style={styles.autoUpdateText}>Auto-updating strategy on weather changes</Text>
              </View>
              <Text style={styles.autoUpdateSubtext}>Last updated: {new Date().toLocaleTimeString()}</Text>
            </View>
          </View>

          {/* Overall Approach */}
          <View style={styles.strategySection}>
            <View style={styles.strategySectionHeader}>
              <MaterialCommunityIcons name="compass" size={20} color="#3B82F6" />
              <Text style={styles.strategySectionTitle}>Overall Approach</Text>
            </View>
            <Text style={styles.strategySectionText}>
              {strategy?.overallApproach}
            </Text>
          </View>

          {/* Start Strategy */}
          <View style={styles.strategySection}>
            <View style={styles.strategySectionHeader}>
              <MaterialCommunityIcons name="flag" size={20} color="#10B981" />
              <Text style={styles.strategySectionTitle}>Start Strategy</Text>
              <View style={[
                styles.priorityBadge,
                strategy?.startStrategy?.priority === 'critical' && styles.priorityCritical
              ]}>
                <Text style={styles.priorityText}>{strategy?.startStrategy?.priority}</Text>
              </View>
            </View>
            <Text style={styles.tacticalAction}>{strategy?.startStrategy?.action}</Text>
            <Text style={styles.tacticalRationale}>{strategy?.startStrategy?.rationale}</Text>
            {strategy?.startStrategy?.alternatives && (
              <View style={styles.alternativesContainer}>
                <Text style={styles.alternativesTitle}>Alternatives:</Text>
                {strategy.startStrategy.alternatives.map((alt, i) => (
                  <Text key={i} style={styles.alternativeText}>• {alt}</Text>
                ))}
              </View>
            )}
          </View>

          {/* Beat Strategy */}
          {strategy?.beatStrategy.map((beat, index) => (
            <View key={index} style={styles.strategySection}>
              <View style={styles.strategySectionHeader}>
                <MaterialCommunityIcons name="arrow-up-bold" size={20} color="#F59E0B" />
                <Text style={styles.strategySectionTitle}>Upwind Strategy</Text>
              </View>
              <Text style={styles.tacticalAction}>{beat.action}</Text>
              <Text style={styles.tacticalRationale}>{beat.rationale}</Text>
            </View>
          ))}

          {/* Contingency Plans */}
          <View style={styles.strategySection}>
            <View style={styles.strategySectionHeader}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.strategySectionTitle}>Contingencies</Text>
            </View>
            {(strategy?.contingencies.windShift?.length ?? 0) > 0 && (
              <View style={styles.contingencyItem}>
                <Text style={styles.contingencyTitle}>Wind Shift:</Text>
                <Text style={styles.contingencyText}>{strategy?.contingencies.windShift?.[0]?.action}</Text>
              </View>
            )}
            {(strategy?.contingencies.windDrop?.length ?? 0) > 0 && (
              <View style={styles.contingencyItem}>
                <Text style={styles.contingencyTitle}>Wind Drop:</Text>
                <Text style={styles.contingencyText}>{strategy?.contingencies.windDrop?.[0]?.action}</Text>
              </View>
            )}
          </View>

          {/* Regenerate Button */}
          <TouchableOpacity
            style={styles.regenerateButton}
            onPress={generateStrategy}
          >
            <MaterialCommunityIcons name="refresh" size={18} color="#3B82F6" />
            <Text style={styles.regenerateButtonText}>Regenerate Strategy</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // Document handler functions
  const handleReExtractDocument = async (documentId: string) => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return;

    // TODO: Re-extract document content
    logger.debug('Re-extracting document:', documentId);
    showAlert('Re-extraction', 'Document re-extraction will be implemented soon.');
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      // Check if document ID is a UUID (saved to database) or timestamp (local only)
      const isUUID = documentId.includes('-'); // UUIDs have hyphens, timestamps don't

      if (isUUID) {
        // Document is in database - delete from Supabase first
        const { supabase } = await import('@/services/supabase');
        const { error: deleteError } = await supabase
          .from('sailing_documents')
          .delete()
          .eq('id', documentId);

        if (deleteError) {
          showAlert('Delete Failed', 'Could not delete document from database.');
          return;
        }
      }
      // else: Document is local only (still processing or failed)

      // Remove from local state
      setDocuments(prev => prev.filter(d => d.id !== documentId));

    } catch (error) {
      showAlert('Error', 'An unexpected error occurred while deleting the document.');
    }
  };

  const handleViewInStrategy = (_documentId: string) => {
    setActiveTab('strategy');
  };

  const renderDocuments = () => (
    <View style={styles.tabContent}>
      {/* Upload Button */}
      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
        onPress={handleDocumentUpload}
        disabled={uploading}
      >
        <MaterialCommunityIcons
          name={uploading ? "loading" : "upload"}
          size={20}
          color="#FFFFFF"
        />
        <Text style={styles.uploadButtonText}>
          {uploading ? 'Uploading...' : 'Upload Document'}
        </Text>
      </TouchableOpacity>

      {/* Enhanced Document List */}
      <DocumentList
        documents={documents}
        onReExtract={handleReExtractDocument}
        onDelete={handleDeleteDocument}
        onViewInStrategy={handleViewInStrategy}
      />
    </View>
  );

  const renderCrew = () => {
    // TODO: Load crew data from crew_members table
    // For now showing empty state since no crew data has been set up
    return (
      <View style={styles.tabContent}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="account-group-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Crew Assigned</Text>
          <Text style={styles.emptyText}>
            Add crew members to track attendance and positions for this race
          </Text>
        </View>
      </View>
    );
  };

  const renderEquipment = () => {
    // TODO: Load equipment/boat setup data from sailor_boats table
    // For now showing empty state since no equipment data has been set up
    return (
      <View style={styles.tabContent}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="wrench-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Equipment Setup</Text>
          <Text style={styles.emptyText}>
            Configure your boat's equipment and rig settings for this race
          </Text>
        </View>
      </View>
    );
  };

  const renderTracks = () => (
    <View style={styles.tabContent}>
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="map-marker-path" size={64} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>No GPS Tracks</Text>
        <Text style={styles.emptyText}>
          Practice tracks and race recordings will appear here
        </Text>
        <Text style={styles.emptyHint}>
          Use the countdown timer to automatically record race tracks
        </Text>
      </View>
    </View>
  );

  const renderResults = () => (
    <View style={styles.tabContent}>
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="trophy-outline" size={64} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>Race Not Complete</Text>
        <Text style={styles.emptyText}>
          Enter your results after the race finishes
        </Text>
      </View>
    </View>
  );

  const renderDetails = () => {
    if (!raceFullData) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.emptyTitle}>Loading race details...</Text>
          </View>
        </View>
      );
    }

    return <RaceDetailsView raceData={raceFullData} onUpdate={loadRaceDetails} />;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'details': return renderDetails();
      case 'strategy': return renderStrategy();
      case 'documents': return renderDocuments();
      case 'crew': return renderCrew();
      case 'equipment': return renderEquipment();
      case 'tracks': return renderTracks();
      case 'results': return renderResults();
      default: return renderOverview();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIconButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.raceName} numberOfLines={1}>{race.name}</Text>
          <Text style={styles.raceClass}>{race.className}</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setShowMenuModal(true)}
          disabled={deleting}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={showMenuModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowMenuModal(false)}
      >
        <TouchableOpacity
          style={styles.menuModalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenuModal(false)}
        >
          <View style={styles.menuModalContent}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleEditRace}
            >
              <Ionicons name="create-outline" size={20} color="#3B82F6" />
              <Text style={styles.menuItemText}>Edit Race</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDeleteRace}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Delete Race</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowMenuModal(false)}
            >
              <Ionicons name="close-outline" size={20} color="#64748B" />
              <Text style={styles.menuItemText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tab Navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Ionicons name="home" size={18} color={activeTab === 'overview' ? '#3B82F6' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'details' && styles.tabActive]}
          onPress={() => setActiveTab('details')}
        >
          <MaterialCommunityIcons name="format-list-bulleted" size={18} color={activeTab === 'details' ? '#3B82F6' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'strategy' && styles.tabActive]}
          onPress={() => setActiveTab('strategy')}
        >
          <MaterialCommunityIcons name="compass-outline" size={18} color={activeTab === 'strategy' ? '#3B82F6' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'strategy' && styles.tabTextActive]}>Strategy</Text>
          {!race.hasStrategy && <View style={styles.tabBadge} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'documents' && styles.tabActive]}
          onPress={() => setActiveTab('documents')}
        >
          <Ionicons name="document-text" size={18} color={activeTab === 'documents' ? '#3B82F6' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'documents' && styles.tabTextActive]}>Docs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'crew' && styles.tabActive]}
          onPress={() => setActiveTab('crew')}
        >
          <MaterialCommunityIcons name="account-group" size={18} color={activeTab === 'crew' ? '#3B82F6' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'crew' && styles.tabTextActive]}>Crew</Text>
          {!race.hasCrew && <View style={styles.tabBadge} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'equipment' && styles.tabActive]}
          onPress={() => setActiveTab('equipment')}
        >
          <MaterialCommunityIcons name="wrench" size={18} color={activeTab === 'equipment' ? '#3B82F6' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'equipment' && styles.tabTextActive]}>Setup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'tracks' && styles.tabActive]}
          onPress={() => setActiveTab('tracks')}
        >
          <MaterialCommunityIcons name="map-marker-path" size={18} color={activeTab === 'tracks' ? '#3B82F6' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'tracks' && styles.tabTextActive]}>Tracks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'results' && styles.tabActive]}
          onPress={() => setActiveTab('results')}
        >
          <MaterialCommunityIcons name="trophy" size={18} color={activeTab === 'results' ? '#3B82F6' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'results' && styles.tabTextActive]}>Results</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderTabContent()}
      </ScrollView>

      {/* CourseSetupPrompt - Phase 2 */}
      {race && (
        <CourseSetupPrompt
          visible={showCourseSetup}
          raceName={race.name}
          raceId={race.id}
          racingAreaName={raceFullData?.metadata?.start_area_name}
          extractedMarks={
            documents.find(d => d.extraction)?.extraction?.marks?.map(m => ({
              name: m.name,
              type: m.type
            }))
          }
          onQuickDraw={() => {
            logger.debug('[RaceDetail] Quick Draw selected');
            setShowCourseSetup(false);
            // Launch Quick Draw Mode
            setIsQuickDrawMode(true);
          }}
          onLoadTemplate={() => {
            logger.debug('[RaceDetail] ===== LOAD TEMPLATE CLICKED =====');
            logger.debug('[RaceDetail] Current state before:', { isQuickDrawMode, showCourseSelector, showCourseSetup });
            setShowCourseSetup(false);
            // Show course template selector
            logger.debug('[RaceDetail] Calling setShowCourseSelector(true)');
            setShowCourseSelector(true);
            logger.debug('[RaceDetail] setShowCourseSelector called');
          }}
          onSkip={() => {
            logger.debug('[RaceDetail] Skipped course setup');
            setShowCourseSetup(false);
          }}
          onClose={() => setShowCourseSetup(false)}
        />
      )}

      {/* CourseSelector - Load Venue Template */}
      {(() => {
        logger.debug('[RaceDetail] CourseSelector render check - race exists?', !!race, 'showCourseSelector:', showCourseSelector);
        return race && (
          <CourseSelector
            visible={showCourseSelector}
            onClose={() => {
              logger.debug('[RaceDetail] CourseSelector onClose called');
              setShowCourseSelector(false);
            }}
            onCourseSelected={(course) => {
              logger.debug('[RaceDetail] Course template selected:', course);
              setShowCourseSelector(false);

            // Apply course template marks to race
            showAlert(
              'Template Applied',
              `${course.name} template with ${course.marks?.length || 0} marks will be applied to your race.`
            );

            // TODO: Save course marks to course_marks table
            // TODO: Update race with course configuration
          }}
          onCreateNew={() => {
            logger.debug('[RaceDetail] Create new course from CourseSelector');
            setShowCourseSelector(false);
            // Launch Quick Draw for custom course
            setIsQuickDrawMode(true);
          }}
          venueId={raceFullData?.venue_id}
          clubId={raceFullData?.club_id}
        />
        );
      })()}
    </SafeAreaView>
  );
}

const logger = createLogger('[id]');
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  backButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  raceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  raceClass: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  editButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    maxHeight: 52,
  },
  tabBarContent: {
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    position: 'relative',
  },
  tabActive: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  tabBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    boxShadow: '0px 2px',
    elevation: 3,
  },
  countdownBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  countdownNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#D97706',
  },
  countdownLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  raceHeaderInfo: {
    flex: 1,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  dateRange: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  classBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  classText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    boxShadow: '0px 2px',
    elevation: 2,
  },
  statusCardIncomplete: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FFFBEB',
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 8,
  },
  statusSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusSubtitleIncomplete: {
    color: '#EF4444',
  },
  courseSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionLink: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  courseContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  courseHint: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  quickActions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  emptyHint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    boxShadow: '0px 4px',
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
  secondaryActions: {
    marginTop: 24,
    gap: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    boxShadow: '0px 4px',
    elevation: 4,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  documentsList: {
    gap: 16,
  },
  documentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0px 2px',
    elevation: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  documentDate: {
    fontSize: 12,
    color: '#64748B',
  },
  extractionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 12,
  },
  extractionText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  extractionTextSuccess: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500',
  },
  extractionTextError: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  extractionDetails: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  extractionDetailTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  extractionDetailText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  confidenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  confidenceBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  documentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  documentActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  documentActionButtonDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  documentActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
  documentActionTextDanger: {
    color: '#EF4444',
  },
  // Strategy Interface Styles
  strategyContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  layerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  layerScrollContent: {
    gap: 8,
  },
  layerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  layerButtonActive: {
    backgroundColor: '#3B82F6',
  },
  layerButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  layerButtonTextActive: {
    color: '#FFFFFF',
  },
  laylinesToggle: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  laylinesToggleActive: {
    backgroundColor: '#10B981',
  },
  mapContainer: {
    height: 840,
    backgroundColor: '#E3F2FD',
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mapPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  mapPlaceholderSubtext: {
    fontSize: 13,
    color: '#94A3B8',
  },
  confidenceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    boxShadow: '0px 2px',
    elevation: 3,
  },
  confidenceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  strategyPanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  strategyMetricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  strategySection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  strategySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  strategySectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  strategySectionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  priorityCritical: {
    backgroundColor: '#FEE2E2',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tacticalAction: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
    lineHeight: 22,
  },
  tacticalRationale: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  alternativesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  alternativesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  alternativeText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    lineHeight: 18,
  },
  contingencyItem: {
    marginBottom: 12,
    paddingLeft: 8,
  },
  contingencyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  contingencyText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  regenerateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  // Strategy Preview/Generation States
  strategyPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  strategyPreviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
  },
  strategyPreviewText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    boxShadow: '0px 4px',
    elevation: 4,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
    gap: 16,
  },
  generatingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
  },
  generatingText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  generatingSteps: {
    alignSelf: 'stretch',
    marginTop: 24,
    gap: 8,
  },
  generatingStep: {
    fontSize: 14,
    color: '#64748B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  // Weather Panel Styles
  weatherPanel: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  weatherTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  weatherConfidenceBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  weatherConfidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  weatherTrendsSection: {
    marginBottom: 16,
  },
  weatherSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  chartCurrentValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  weatherForecastSection: {
    marginBottom: 16,
  },
  forecastTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  forecastTimepoint: {
    alignItems: 'center',
    gap: 8,
  },
  forecastMarker: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  forecastMarkerNow: {
    backgroundColor: '#3B82F6',
  },
  forecastMarkerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  forecastDataPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  forecastValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  forecastChange: {
    fontSize: 11,
    color: '#64748B',
  },
  weatherRiskAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  weatherRiskAlertHigh: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  weatherRiskText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#92400E',
    flex: 1,
  },
  weatherRiskTextHigh: {
    color: '#991B1B',
  },
  weatherAutoUpdate: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  autoUpdateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  autoUpdateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  autoUpdateText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
  },
  autoUpdateSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 16,
  },
  // Menu Modal Styles
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  menuModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 200,
    boxShadow: '0px 4px',
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
  },
  menuItemTextDanger: {
    color: '#EF4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
});
