import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { PublicSharingStatus, RacePreparationWithStrategy, strategicPlanningService } from '@/services/StrategicPlanningService';
import { supabase } from '@/services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Share,
    Linking,
} from 'react-native';
import { showAlert, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';

const logger = createLogger('StrategySharingModal');

interface CoachProfile {
  id: string;
  user_id: string;
  display_name: string;
  bio: string;
  experience_years: number;
  certifications: string[];
  specializations: string[];
  hourly_rate: number;
  currency: string;
  is_verified: boolean;
  is_active: boolean;
  rating: number;
  total_sessions: number;
  location_name: string;
  location_region: string;
  languages: string[];
  profile_image_url: string;
}

interface CrewMember {
  id: string;
  user_id: string;
  name: string;
  role: string;
  profile_image_url?: string;
  status: 'active' | 'pending';
}

interface WeatherForecast {
  windSpeed?: number;
  windSpeedMax?: number;
  windDirection?: string;
  temperature?: number;
  waveHeight?: number;
  tideState?: string;
  tideHeight?: number;
  currentSpeed?: number;
  currentDirection?: string;
}

interface RigTuning {
  preset?: string;
  windRange?: string;
  settings?: {
    upperShrouds?: string;
    lowerShrouds?: string;
    forestay?: string;
    backstay?: string;
    mast?: string;
    cunningham?: string;
    outhaul?: string;
    vang?: string;
  };
  notes?: string;
}

interface RaceInfo {
  id: string;
  name: string;
  date: string;
  venue?: string;
  boatClass?: string;
  weather?: WeatherForecast;
  rigTuning?: RigTuning;
  raceType?: 'fleet' | 'distance';
  // Distance race specific
  totalDistanceNm?: number;
  waypoints?: { name: string; latitude: number; longitude: number; distanceFromPrev?: number }[];
  // Additional race details
  startTime?: string;
  warningSignal?: string;
  courseName?: string;
  courseType?: string;
  timeLimitHours?: number;
  // AI/Strategy content
  aiBriefing?: string;
  aiRecommendations?: string[];
}

interface StrategySharingModalProps {
  visible: boolean;
  onClose: () => void;
  onShareComplete?: (shareType: 'coach' | 'crew' | 'external', recipientName?: string) => void;
  sailorId: string;
  raceId: string;
  raceInfo: RaceInfo;
}

type ShareTab = 'preview' | 'public' | 'coach' | 'crew' | 'export';

export function StrategySharingModal({
  visible,
  onClose,
  onShareComplete,
  sailorId,
  raceId,
  raceInfo,
}: StrategySharingModalProps) {
  // Debug: Log props on mount and changes
  useEffect(() => {
    logger.info('[StrategySharingModal] Props received:', {
      visible,
      sailorId,
      raceId,
      raceInfoId: raceInfo?.id,
      raceInfoName: raceInfo?.name,
    });
  }, [visible, sailorId, raceId, raceInfo]);

  const [activeTab, setActiveTab] = useState<ShareTab>('preview');
  const [strategy, setStrategy] = useState<RacePreparationWithStrategy | null>(null);
  const [raceStrategy, setRaceStrategy] = useState<any>(null);
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [myCoaches, setMyCoaches] = useState<CoachProfile[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [_selectedCoach, _setSelectedCoach] = useState<CoachProfile | null>(null);
  const [selectedCrew, setSelectedCrew] = useState<string[]>([]);
  const [userNotes, setUserNotes] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState(false);
  const notesSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [publicSharingStatus, setPublicSharingStatus] = useState<PublicSharingStatus>({
    enabled: false,
    token: null,
    url: null,
    sharedAt: null,
  });
  const [togglingPublicShare, setTogglingPublicShare] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sailorId, raceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get the user_id from sailor_profiles (sailorId might be sailor_profiles.id OR user_id)
      // This is needed because RLS policies use auth.uid() = sailor_id
      let fetchedUserId: string | null = null;
      
      // First try looking up by sailor_profiles.id
      const { data: sailorProfile } = await supabase
        .from('sailor_profiles')
        .select('user_id')
        .eq('id', sailorId)
        .maybeSingle();

      if (sailorProfile?.user_id) {
        fetchedUserId = sailorProfile.user_id;
      } else {
        // If not found, try looking up by user_id (sailorId might already be the user_id)
        const { data: profileByUserId } = await supabase
          .from('sailor_profiles')
          .select('user_id')
          .eq('user_id', sailorId)
          .maybeSingle();
        
        if (profileByUserId?.user_id) {
          fetchedUserId = profileByUserId.user_id;
        } else {
          // Fallback: assume sailorId is the user_id directly
          fetchedUserId = sailorId;
        }
      }
      
      setUserId(fetchedUserId);
      logger.info('Resolved userId for sharing:', { sailorId, fetchedUserId });

      // Load strategy data from sailor_race_preparation using user_id (for RLS compatibility)
      if (fetchedUserId) {
        const prep = await strategicPlanningService.getPreparationWithStrategy(raceId, fetchedUserId);
        setStrategy(prep);
      } else {
        setStrategy(null);
      }

      // Also load from race_strategies table for AI-generated content
      // Note: race_strategies uses user_id (auth.users.id), not sailor_profiles.id
      const primaryRaceStrat = await supabase
        .from('race_strategies')
        .select('*')
        .eq('regatta_id', raceId)
        .eq('user_id', fetchedUserId || sailorId)
        .maybeSingle();
      let raceStrat = primaryRaceStrat.data;
      if (
        primaryRaceStrat.error &&
        isMissingIdColumn(primaryRaceStrat.error, 'race_strategies', 'regatta_id')
      ) {
        const fallbackRaceStrat = await supabase
          .from('race_strategies')
          .select('*')
          .eq('race_id', raceId)
          .eq('user_id', fetchedUserId || sailorId)
          .maybeSingle();
        raceStrat = fallbackRaceStrat.data;
      }
      setRaceStrategy(raceStrat);
      
      // Load user notes from race_strategies.notes or strategy_content.userNotes
      // Also check sailor_race_preparation for start/upwind/downwind strategy notes
      const existingNotes = raceStrat?.notes || raceStrat?.strategy_content?.userNotes || '';
      setUserNotes(existingNotes);
      
      logger.info('Loaded race strategy:', { 
        raceId, 
        sailorId, 
        userId: fetchedUserId,
        hasRaceStrategy: !!raceStrat,
        windStrategy: raceStrat?.wind_strategy,
        notes: existingNotes
      });

      // Load coaches
      const { data: allCoaches } = await supabase
        .from('coach_profiles')
        .select('*')
        .eq('is_active', true)
        .eq('is_verified', true)
        .order('rating', { ascending: false });

      // Load coaching sessions to identify "my coaches"
      const { data: sessions } = await supabase
        .from('coaching_sessions')
        .select('coach_id')
        .eq('sailor_id', sailorId);

      const myCoachIds = new Set(sessions?.map(s => s.coach_id) || []);
      setMyCoaches(allCoaches?.filter(c => myCoachIds.has(c.id)) || []);
      setCoaches(allCoaches?.filter(c => !myCoachIds.has(c.id)) || []);

      // Load crew members
      const { data: crew } = await supabase
        .from('crew_assignments')
        .select(`
          id,
          role,
          status,
          crew_member:crew_members(
            id,
            user_id,
            name,
            profile_image_url
          )
        `)
        .eq('sailor_id', sailorId)
        .in('status', ['active', 'pending']);

      const crewList = crew?.map(c => ({
        id: c.crew_member?.id || c.id,
        user_id: c.crew_member?.user_id || '',
        name: c.crew_member?.name || 'Unknown',
        role: c.role,
        profile_image_url: c.crew_member?.profile_image_url,
        status: c.status as 'active' | 'pending',
      })) || [];
      setCrewMembers(crewList);

      // Load public sharing status (in a separate try-catch to not block other data loading)
      if (fetchedUserId) {
        try {
          const sharingStatus = await strategicPlanningService.getPublicSharingStatus(raceId, fetchedUserId);
          setPublicSharingStatus(sharingStatus);
        } catch (sharingError) {
          // Public sharing columns may not exist yet - this is ok
          logger.warn('Could not load public sharing status (migration may not be run):', sharingError);
          setPublicSharingStatus({
            enabled: false,
            token: null,
            url: null,
            sharedAt: null,
          });
        }
      }

    } catch (error) {
      logger.error('Failed to load sharing data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save user notes to database
  const saveUserNotes = useCallback(async (notes: string) => {
    if (!userId || !raceId) return;
    
    setSavingNotes(true);
    try {
      // Update the notes in race_strategies table
      const primaryUpdate = await supabase
        .from('race_strategies')
        .update({ notes })
        .eq('regatta_id', raceId)
        .eq('user_id', userId);
      let error = primaryUpdate.error;
      if (error && isMissingIdColumn(error, 'race_strategies', 'regatta_id')) {
        const fallbackUpdate = await supabase
          .from('race_strategies')
          .update({ notes })
          .eq('race_id', raceId)
          .eq('user_id', userId);
        error = fallbackUpdate.error;
      }

      if (error) {
        logger.error('Failed to save notes:', error);
        // If no existing row, try to insert
        if (error.code === 'PGRST116') {
          const primaryInsert = await supabase
            .from('race_strategies')
            .insert({
              regatta_id: raceId,
              user_id: userId,
              notes,
              strategy_type: 'pre_race',
            });
          let insertError = primaryInsert.error;
          if (insertError && isMissingIdColumn(insertError, 'race_strategies', 'regatta_id')) {
            const fallbackInsert = await supabase
              .from('race_strategies')
              .insert({
                race_id: raceId,
                user_id: userId,
                notes,
                strategy_type: 'pre_race',
              } as any);
            insertError = fallbackInsert.error;
          }
          if (insertError) {
            logger.error('Failed to insert notes:', insertError);
          }
        }
      } else {
        logger.info('Notes saved successfully');
      }
    } catch (error) {
      logger.error('Error saving notes:', error);
    } finally {
      setSavingNotes(false);
    }
  }, [userId, raceId]);

  // Debounced save for notes
  const handleNotesChange = useCallback((text: string) => {
    setUserNotes(text);
    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current);
    }
    notesSaveTimeoutRef.current = setTimeout(() => {
      saveUserNotes(text);
    }, 1000);
  }, [saveUserNotes]);

  useEffect(() => {
    return () => {
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current);
        notesSaveTimeoutRef.current = null;
      }
    };
  }, []);

  const generateShareableText = useCallback(() => {
    const lines: string[] = [];
    
    lines.push(`🏁 PRE-RACE STRATEGY`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📍 ${raceInfo.name}`);
    lines.push(`📅 ${new Date(raceInfo.date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })}`);
    if (raceInfo.venue) lines.push(`🌊 ${raceInfo.venue}`);
    if (raceInfo.boatClass) lines.push(`⛵ ${raceInfo.boatClass}`);
    lines.push('');

    // Add weather forecast synopsis
    if (raceInfo.weather) {
      const w = raceInfo.weather;
      lines.push(`🌤️ FORECAST SYNOPSIS`);
      const forecastParts: string[] = [];
      if (w.windSpeed !== undefined) {
        const windStr = w.windSpeedMax 
          ? `Wind: ${w.windSpeed}-${w.windSpeedMax} kts`
          : `Wind: ${w.windSpeed} kts`;
        forecastParts.push(windStr + (w.windDirection ? ` from ${w.windDirection}` : ''));
      }
      if (w.tideState) {
        forecastParts.push(`Tide: ${w.tideState}${w.tideHeight ? ` (${w.tideHeight.toFixed(1)}m)` : ''}`);
      }
      if (w.currentSpeed !== undefined && w.currentSpeed > 0) {
        forecastParts.push(`Current: ${w.currentSpeed.toFixed(1)} kts${w.currentDirection ? ` ${w.currentDirection}` : ''}`);
      }
      if (w.waveHeight !== undefined && w.waveHeight > 0) {
        forecastParts.push(`Waves: ${w.waveHeight.toFixed(1)}m`);
      }
      if (w.temperature !== undefined) {
        forecastParts.push(`Temp: ${w.temperature}°C`);
      }
      lines.push(forecastParts.join(' • '));
      lines.push('');
    }

    // Add rig tuning settings
    if (raceInfo.rigTuning) {
      const rig = raceInfo.rigTuning;
      lines.push(`⚙️ RIG TUNING`);
      if (rig.preset) lines.push(`Preset: ${rig.preset}`);
      if (rig.windRange) lines.push(`Wind Range: ${rig.windRange}`);
      if (rig.settings) {
        const s = rig.settings;
        const settingsLines: string[] = [];
        if (s.upperShrouds) settingsLines.push(`Uppers: ${s.upperShrouds}`);
        if (s.lowerShrouds) settingsLines.push(`Lowers: ${s.lowerShrouds}`);
        if (s.forestay) settingsLines.push(`Forestay: ${s.forestay}`);
        if (s.backstay) settingsLines.push(`Backstay: ${s.backstay}`);
        if (s.mast) settingsLines.push(`Mast: ${s.mast}`);
        if (s.cunningham) settingsLines.push(`Cunningham: ${s.cunningham}`);
        if (s.outhaul) settingsLines.push(`Outhaul: ${s.outhaul}`);
        if (s.vang) settingsLines.push(`Vang: ${s.vang}`);
        if (settingsLines.length > 0) {
          lines.push(settingsLines.join(' | '));
        }
      }
      if (rig.notes) {
        lines.push(`Notes: ${rig.notes}`);
      }
      lines.push('');
    }

    // Add strategy sections helper
    const addSection = (emoji: string, title: string, content: string | undefined | null) => {
      if (content && content.trim()) {
        lines.push(`${emoji} ${title.toUpperCase()}`);
        lines.push(content.trim());
        lines.push('');
      }
    };

    // User's strategy notes (from state or database)
    if (userNotes && userNotes.trim()) {
      addSection('📝', 'My Strategy Notes', userNotes);
    } else if (raceStrategy?.notes) {
      addSection('📝', 'My Strategy Notes', raceStrategy.notes);
    }

    // User's manual strategy entries from sailor_race_preparation
    if (strategy) {
      addSection('🏁', 'Start Strategy', strategy.start_strategy);
      addSection('⬆️', 'Upwind Strategy', strategy.upwind_strategy);
      addSection('🔄', 'Windward Mark', strategy.windward_mark_strategy);
      addSection('⬇️', 'Downwind Strategy', strategy.downwind_strategy);
      addSection('🔃', 'Leeward Mark', strategy.leeward_mark_strategy);
      addSection('🏆', 'Finish Strategy', strategy.finish_strategy);
    }

    // AI-generated strategic recommendations
    if (raceStrategy) {
      if (raceStrategy.wind_strategy || raceStrategy.tide_strategy || raceStrategy.current_strategy) {
        lines.push(`🤖 AI STRATEGIC RECOMMENDATIONS`);
        if (raceStrategy.wind_strategy) lines.push(`Wind: ${raceStrategy.wind_strategy}`);
        if (raceStrategy.tide_strategy) lines.push(`Tide: ${raceStrategy.tide_strategy}`);
        if (raceStrategy.current_strategy) lines.push(`Current: ${raceStrategy.current_strategy}`);
        lines.push('');
      }
      
      if (raceStrategy.start_line_bias || raceStrategy.favored_end) {
        lines.push(`📐 START LINE ANALYSIS`);
        if (raceStrategy.start_line_bias) lines.push(`Bias: ${raceStrategy.start_line_bias}`);
        if (raceStrategy.favored_end) lines.push(`Favored End: ${raceStrategy.favored_end}`);
        lines.push('');
      }

      if (raceStrategy.upwind_tactics) {
        addSection('⬆️', 'Upwind Tactics', raceStrategy.upwind_tactics);
      }
      if (raceStrategy.downwind_tactics) {
        addSection('⬇️', 'Downwind Tactics', raceStrategy.downwind_tactics);
      }
    }

    // AI Insights from preparation
    if (strategy?.ai_strategy_suggestions) {
      const ai = strategy.ai_strategy_suggestions;
      if (ai.contextualInsights?.length) {
        lines.push(`💡 AI INSIGHTS`);
        ai.contextualInsights.forEach(insight => {
          lines.push(`• ${insight}`);
        });
        lines.push('');
      }
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`Generated by RegattaFlow`);

    return lines.join('\n');
  }, [strategy, raceStrategy, raceInfo, userNotes]);

  const handleShareWithCoach = async (coach: CoachProfile) => {
    setSharing(true);
    try {
      const success = await strategicPlanningService.shareWithCoach(
        raceId,
        sailorId,
        coach.id
      );

      if (success) {
        onShareComplete?.('coach', coach.display_name);
        showAlertWithButtons(
          'Strategy Shared!',
          `Your pre-race strategy has been shared with ${coach.display_name}. They will be notified and can provide feedback.`,
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        showAlert('Error', 'Failed to share strategy. Please try again.');
      }
    } catch (error) {
      logger.error('Failed to share with coach:', error);
      showAlert('Error', 'Failed to share strategy. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleShareWithCrew = async () => {
    if (selectedCrew.length === 0) {
      showAlert('Select Crew', 'Please select at least one crew member to share with.');
      return;
    }

    setSharing(true);
    try {
      // Create notifications for selected crew members
      const notifications = selectedCrew.map(crewId => {
        const crew = crewMembers.find(c => c.id === crewId);
        return {
          user_id: crew?.user_id,
          type: 'strategy_shared',
          title: 'Strategy Shared',
          message: `Race strategy for ${raceInfo.name} has been shared with you`,
          data: { race_id: raceId, sailor_id: sailorId },
          read: false,
        };
      }).filter(n => n.user_id);

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }

      const crewNames = selectedCrew
        .map(id => crewMembers.find(c => c.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      onShareComplete?.('crew', crewNames);
      showAlertWithButtons(
        'Strategy Shared!',
        `Your strategy has been shared with ${crewNames}.`,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      logger.error('Failed to share with crew:', error);
      showAlert('Error', 'Failed to share strategy. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const text = generateShareableText();
      await Clipboard.setStringAsync(text);
      showAlert('Copied!', 'Strategy copied to clipboard');
    } catch (error) {
      logger.error('Failed to copy:', error);
      showAlert('Error', 'Failed to copy to clipboard');
    }
  };

  const handleNativeShare = async () => {
    try {
      const text = generateShareableText();
      const title = `Race Strategy - ${raceInfo.name}`;
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav?.share) {
          await nav.share({ title, text });
        } else if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(text);
          showAlert('Copied', 'Strategy copied to clipboard');
        }
      } else {
        await Share.share({ message: text, title });
      }
      onShareComplete?.('external');
    } catch (error) {
      logger.error('Failed to share:', error);
    }
  };

  const handleShareViaWhatsApp = async () => {
    try {
      const text = generateShareableText();
      const encoded = encodeURIComponent(text);
      const url = `whatsapp://send?text=${encoded}`;
      
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
        onShareComplete?.('external', 'WhatsApp');
      } else {
        await handleNativeShare();
      }
    } catch (error) {
      logger.error('Failed to share via WhatsApp:', error);
      showAlert('Error', 'Failed to open WhatsApp');
    }
  };

  const handleShareViaEmail = async () => {
    try {
      const text = generateShareableText();
      const subject = encodeURIComponent(`Race Strategy - ${raceInfo.name}`);
      const body = encodeURIComponent(text);
      const url = `mailto:?subject=${subject}&body=${body}`;
      
      await Linking.openURL(url);
      onShareComplete?.('external', 'Email');
    } catch (error) {
      logger.error('Failed to share via email:', error);
      showAlert('Error', 'Failed to open email app');
    }
  };

  const renderStrategyPreview = () => {
    // Check what content is available
    const hasWeather = raceInfo.weather && (
      raceInfo.weather.windSpeed !== undefined || 
      raceInfo.weather.tideState ||
      raceInfo.weather.temperature !== undefined
    );
    // Check both raceInfo.rigTuning (metadata) and strategy (user's notes)
    const hasRigTuning = (raceInfo.rigTuning && (
      raceInfo.rigTuning.preset || 
      raceInfo.rigTuning.notes || 
      raceInfo.rigTuning.settings
    )) || (strategy && (
      strategy.rig_tuning_strategy ||
      strategy.rig_notes
    ));
    const hasUserStrategy = strategy && (
      strategy.start_strategy ||
      strategy.upwind_strategy ||
      strategy.downwind_strategy ||
      strategy.windward_mark_strategy ||
      strategy.leeward_mark_strategy ||
      strategy.finish_strategy
    );
    const hasAIStrategy = raceStrategy && (
      raceStrategy.wind_strategy ||
      raceStrategy.tide_strategy ||
      raceStrategy.upwind_tactics ||
      raceStrategy.downwind_tactics
    );
    const hasAIInsights = strategy?.ai_strategy_suggestions?.contextualInsights?.length > 0;

    return (
      <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
        {/* Race Header */}
        <View style={styles.previewHeader}>
          {/* Race Type Badge */}
          {raceInfo.raceType === 'distance' && (
            <View style={styles.raceTypeBadge}>
              <MaterialCommunityIcons name="sail-boat" size={14} color="#0369A1" />
              <Text style={styles.raceTypeBadgeText}>Distance Race</Text>
            </View>
          )}
          
          <Text style={styles.previewRaceName}>{raceInfo.name}</Text>
          <Text style={styles.previewRaceDate}>
            {new Date(raceInfo.date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          
          {/* Race Details Grid */}
          <View style={styles.raceDetailsGrid}>
            {raceInfo.venue && (
              <View style={styles.raceDetailItem}>
                <MaterialCommunityIcons name="map-marker" size={16} color="#6B7280" />
                <Text style={styles.raceDetailText}>{raceInfo.venue}</Text>
              </View>
            )}
            {raceInfo.boatClass && (
              <View style={styles.raceDetailItem}>
                <MaterialCommunityIcons name="sail-boat" size={16} color="#6B7280" />
                <Text style={styles.raceDetailText}>{raceInfo.boatClass}</Text>
              </View>
            )}
            {raceInfo.startTime && (
              <View style={styles.raceDetailItem}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#6B7280" />
                <Text style={styles.raceDetailText}>Start: {raceInfo.startTime}</Text>
              </View>
            )}
            {raceInfo.totalDistanceNm && (
              <View style={styles.raceDetailItem}>
                <MaterialCommunityIcons name="map-marker-distance" size={16} color="#6B7280" />
                <Text style={styles.raceDetailText}>{raceInfo.totalDistanceNm.toFixed(1)} nm</Text>
              </View>
            )}
            {raceInfo.timeLimitHours && (
              <View style={styles.raceDetailItem}>
                <MaterialCommunityIcons name="timer-sand" size={16} color="#6B7280" />
                <Text style={styles.raceDetailText}>Limit: {raceInfo.timeLimitHours}h</Text>
              </View>
            )}
            {raceInfo.courseName && (
              <View style={styles.raceDetailItem}>
                <MaterialCommunityIcons name="flag-triangle" size={16} color="#6B7280" />
                <Text style={styles.raceDetailText}>{raceInfo.courseName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Strategy Completeness Summary */}
        <View style={styles.completenessCard}>
          <Text style={styles.completenessTitle}>Strategy Overview</Text>
          <View style={styles.completenessGrid}>
            <View style={styles.completenessItem}>
              <MaterialCommunityIcons 
                name={hasWeather ? 'check-circle' : 'circle-outline'} 
                size={20} 
                color={hasWeather ? '#10B981' : '#CBD5E1'} 
              />
              <Text style={[styles.completenessLabel, !hasWeather && styles.completenessLabelEmpty]}>
                Weather
              </Text>
            </View>
            <View style={styles.completenessItem}>
              <MaterialCommunityIcons 
                name={hasRigTuning ? 'check-circle' : 'circle-outline'} 
                size={20} 
                color={hasRigTuning ? '#10B981' : '#CBD5E1'} 
              />
              <Text style={[styles.completenessLabel, !hasRigTuning && styles.completenessLabelEmpty]}>
                Rig Tuning
              </Text>
            </View>
            <View style={styles.completenessItem}>
              <MaterialCommunityIcons 
                name={hasUserStrategy ? 'check-circle' : 'circle-outline'} 
                size={20} 
                color={hasUserStrategy ? '#10B981' : '#CBD5E1'} 
              />
              <Text style={[styles.completenessLabel, !hasUserStrategy && styles.completenessLabelEmpty]}>
                Race Plan
              </Text>
            </View>
            <View style={styles.completenessItem}>
              <MaterialCommunityIcons 
                name={(hasAIStrategy || hasAIInsights) ? 'check-circle' : 'circle-outline'} 
                size={20} 
                color={(hasAIStrategy || hasAIInsights) ? '#10B981' : '#CBD5E1'} 
              />
              <Text style={[styles.completenessLabel, !(hasAIStrategy || hasAIInsights) && styles.completenessLabelEmpty]}>
                Insights
              </Text>
            </View>
          </View>
        </View>

        {/* Forecast Synopsis */}
        {hasWeather ? (
          <View style={styles.strategySection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="weather-partly-cloudy" size={18} color="#0EA5E9" />
              <Text style={[styles.sectionTitle, { color: '#0EA5E9' }]}>Forecast Synopsis</Text>
            </View>
            <View style={styles.forecastGrid}>
              {raceInfo.weather!.windSpeed !== undefined && (
                <View style={styles.forecastItem}>
                  <MaterialCommunityIcons name="weather-windy" size={20} color="#64748B" />
                  <Text style={styles.forecastValue}>
                    {raceInfo.weather!.windSpeedMax 
                      ? `${raceInfo.weather!.windSpeed}-${raceInfo.weather!.windSpeedMax}`
                      : raceInfo.weather!.windSpeed} kts
                  </Text>
                  {raceInfo.weather!.windDirection && (
                    <Text style={styles.forecastLabel}>{raceInfo.weather!.windDirection}</Text>
                  )}
                </View>
              )}
              {raceInfo.weather!.tideState && (
                <View style={styles.forecastItem}>
                  <MaterialCommunityIcons name="waves" size={20} color="#64748B" />
                  <Text style={styles.forecastValue}>{raceInfo.weather!.tideState}</Text>
                  {raceInfo.weather!.tideHeight !== undefined && (
                    <Text style={styles.forecastLabel}>{raceInfo.weather!.tideHeight.toFixed(1)}m</Text>
                  )}
                </View>
              )}
              {raceInfo.weather!.currentSpeed !== undefined && raceInfo.weather!.currentSpeed > 0 && (
                <View style={styles.forecastItem}>
                  <MaterialCommunityIcons name="swap-horizontal" size={20} color="#64748B" />
                  <Text style={styles.forecastValue}>{raceInfo.weather!.currentSpeed.toFixed(1)} kts</Text>
                  {raceInfo.weather!.currentDirection && (
                    <Text style={styles.forecastLabel}>{raceInfo.weather!.currentDirection}</Text>
                  )}
                </View>
              )}
              {raceInfo.weather!.waveHeight !== undefined && raceInfo.weather!.waveHeight > 0 && (
                <View style={styles.forecastItem}>
                  <MaterialCommunityIcons name="wave" size={20} color="#64748B" />
                  <Text style={styles.forecastValue}>{raceInfo.weather!.waveHeight.toFixed(1)}m</Text>
                  <Text style={styles.forecastLabel}>waves</Text>
                </View>
              )}
              {raceInfo.weather!.temperature !== undefined && (
                <View style={styles.forecastItem}>
                  <MaterialCommunityIcons name="thermometer" size={20} color="#64748B" />
                  <Text style={styles.forecastValue}>{raceInfo.weather!.temperature}°C</Text>
                  <Text style={styles.forecastLabel}>temp</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptySectionCard}>
            <MaterialCommunityIcons name="weather-partly-cloudy" size={24} color="#CBD5E1" />
            <View style={styles.emptySectionContent}>
              <Text style={styles.emptySectionTitle}>Weather Forecast</Text>
              <Text style={styles.emptySectionHint}>Will show wind, tide, and conditions when available</Text>
            </View>
          </View>
        )}

        {/* Rig Tuning */}
        {hasRigTuning ? (
          <View style={styles.strategySection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="cog" size={18} color="#F59E0B" />
              <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>Rig Tuning</Text>
            </View>
            {raceInfo.rigTuning?.preset && (
              <Text style={styles.rigPreset}>{raceInfo.rigTuning.preset}</Text>
            )}
            {raceInfo.rigTuning?.windRange && (
              <Text style={styles.rigWindRange}>Wind Range: {raceInfo.rigTuning.windRange}</Text>
            )}
            {raceInfo.rigTuning?.settings && (
              <View style={styles.rigSettingsGrid}>
                {Object.entries(raceInfo.rigTuning.settings).map(([key, value]) => value && (
                  <View key={key} style={styles.rigSettingItem}>
                    <Text style={styles.rigSettingLabel}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    </Text>
                    <Text style={styles.rigSettingValue}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
            {raceInfo.rigTuning?.notes && (
              <Text style={styles.rigNotes}>{raceInfo.rigTuning.notes}</Text>
            )}
            {/* Also show strategy-based rig tuning notes */}
            {strategy?.rig_tuning_strategy && (
              <Text style={styles.rigNotes}>{strategy.rig_tuning_strategy}</Text>
            )}
            {strategy?.rig_notes && !strategy?.rig_tuning_strategy && (
              <Text style={styles.rigNotes}>{strategy.rig_notes}</Text>
            )}
          </View>
        ) : (
          <View style={styles.emptySectionCard}>
            <MaterialCommunityIcons name="cog" size={24} color="#CBD5E1" />
            <View style={styles.emptySectionContent}>
              <Text style={styles.emptySectionTitle}>Rig Tuning</Text>
              <Text style={styles.emptySectionHint}>Will show rig settings and tuning notes</Text>
            </View>
          </View>
        )}

        {/* User's Strategy Notes - Editable */}
        <View style={styles.strategySection}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="pencil" size={18} color="#10B981" />
            <Text style={[styles.sectionTitle, { color: '#10B981' }]}>My Strategy Notes</Text>
            {savingNotes && (
              <ActivityIndicator size="small" color="#10B981" style={{ marginLeft: 8 }} />
            )}
          </View>
          <TextInput
            style={styles.notesInput}
            value={userNotes}
            onChangeText={handleNotesChange}
            placeholder="Add your race strategy notes here... (e.g., key focus areas, specific tactics, reminders)"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {userNotes.length > 0 && (
            <Text style={styles.notesHint}>✓ Notes will be saved automatically</Text>
          )}
        </View>

        {/* Race Strategy - Different for Fleet vs Distance */}
        {raceInfo.raceType === 'distance' ? (
          // Distance Racing Strategy
          <View style={styles.strategySection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="map-marker-path" size={18} color="#3B82F6" />
              <Text style={[styles.sectionTitle, { color: '#3B82F6' }]}>Distance Race Strategy</Text>
            </View>

            {/* Route Overview */}
            {(raceInfo.totalDistanceNm || raceInfo.waypoints?.length) && (
              <View style={styles.distanceOverview}>
                {raceInfo.totalDistanceNm && (
                  <View style={styles.distanceItem}>
                    <MaterialCommunityIcons name="map-marker-distance" size={20} color="#0EA5E9" />
                    <Text style={styles.distanceValue}>{raceInfo.totalDistanceNm.toFixed(1)} nm</Text>
                  </View>
                )}
                {raceInfo.waypoints && raceInfo.waypoints.length > 0 && (
                  <View style={styles.distanceItem}>
                    <MaterialCommunityIcons name="map-marker-multiple" size={20} color="#0EA5E9" />
                    <Text style={styles.distanceValue}>{raceInfo.waypoints.length} waypoints</Text>
                  </View>
                )}
              </View>
            )}

            {/* Waypoints List */}
            {raceInfo.waypoints && raceInfo.waypoints.length > 0 && (
              <View style={styles.waypointsList}>
                {raceInfo.waypoints.map((wp, idx) => (
                  <View key={idx} style={styles.waypointItem}>
                    <Text style={styles.waypointNumber}>{idx + 1}</Text>
                    <Text style={styles.waypointName}>{wp.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {strategy?.start_strategy ? (
              <StrategyPhaseCard icon="flag-variant" title="Start / Departure" content={strategy.start_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="flag-variant" title="Start / Departure" />
            )}

            {strategy?.upwind_strategy ? (
              <StrategyPhaseCard icon="weather-windy" title="Weather Routing" content={strategy.upwind_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="weather-windy" title="Weather Routing" />
            )}

            {strategy?.windward_mark_strategy ? (
              <StrategyPhaseCard icon="waves" title="Tide Gates & Current" content={strategy.windward_mark_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="waves" title="Tide Gates & Current" />
            )}

            {strategy?.downwind_strategy ? (
              <StrategyPhaseCard icon="account-group" title="Watch System / Crew" content={strategy.downwind_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="account-group" title="Watch System / Crew" />
            )}

            {strategy?.finish_strategy ? (
              <StrategyPhaseCard icon="trophy" title="Finishing Strategy" content={strategy.finish_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="trophy" title="Finishing Strategy" />
            )}
          </View>
        ) : (
          // Fleet Racing Strategy (default)
          <View style={styles.strategySection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="flag-checkered" size={18} color="#3B82F6" />
              <Text style={[styles.sectionTitle, { color: '#3B82F6' }]}>Race Phase Strategy</Text>
            </View>

            {strategy?.start_strategy ? (
              <StrategyPhaseCard icon="flag-checkered" title="Start" content={strategy.start_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="flag-checkered" title="Start" />
            )}

            {strategy?.upwind_strategy ? (
              <StrategyPhaseCard icon="arrow-up-bold" title="Upwind" content={strategy.upwind_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="arrow-up-bold" title="Upwind" />
            )}

            {strategy?.windward_mark_strategy ? (
              <StrategyPhaseCard icon="rotate-right" title="Windward Mark" content={strategy.windward_mark_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="rotate-right" title="Windward Mark" />
            )}

            {strategy?.downwind_strategy ? (
              <StrategyPhaseCard icon="arrow-down-bold" title="Downwind" content={strategy.downwind_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="arrow-down-bold" title="Downwind" />
            )}

            {strategy?.leeward_mark_strategy ? (
              <StrategyPhaseCard icon="rotate-left" title="Leeward Mark" content={strategy.leeward_mark_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="rotate-left" title="Leeward Mark" />
            )}

            {strategy?.finish_strategy ? (
              <StrategyPhaseCard icon="trophy" title="Finish" content={strategy.finish_strategy} />
            ) : (
              <StrategyPhasePlaceholder icon="trophy" title="Finish" />
            )}
          </View>
        )}

        {/* Strategic Recommendations */}
        {(raceStrategy?.wind_strategy || raceStrategy?.tide_strategy || raceStrategy?.current_strategy) && (
          <View style={styles.strategySection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="robot" size={18} color="#9333EA" />
              <Text style={[styles.sectionTitle, { color: '#9333EA' }]}>Strategic Recommendations</Text>
            </View>
            {raceStrategy?.wind_strategy && (
              <View style={styles.aiRecommendation}>
                <Text style={styles.aiRecommendationLabel}>Wind:</Text>
                <Text style={styles.aiRecommendationText}>{raceStrategy.wind_strategy}</Text>
              </View>
            )}
            {raceStrategy?.tide_strategy && (
              <View style={styles.aiRecommendation}>
                <Text style={styles.aiRecommendationLabel}>Tide:</Text>
                <Text style={styles.aiRecommendationText}>{raceStrategy.tide_strategy}</Text>
              </View>
            )}
            {raceStrategy?.current_strategy && (
              <View style={styles.aiRecommendation}>
                <Text style={styles.aiRecommendationLabel}>Current:</Text>
                <Text style={styles.aiRecommendationText}>{raceStrategy.current_strategy}</Text>
              </View>
            )}
          </View>
        )}

        {/* Start Line Info */}
        {(raceStrategy?.start_line_bias || raceStrategy?.favored_end) && (
          <View style={styles.strategySection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="ruler" size={18} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Start Line Analysis</Text>
            </View>
            <View style={styles.startLineInfo}>
              {raceStrategy.start_line_bias && (
                <View style={styles.startLineItem}>
                  <Text style={styles.startLineLabel}>Bias</Text>
                  <Text style={styles.startLineValue}>{raceStrategy.start_line_bias}</Text>
                </View>
              )}
              {raceStrategy.favored_end && (
                <View style={styles.startLineItem}>
                  <Text style={styles.startLineLabel}>Favored End</Text>
                  <Text style={styles.startLineValue}>{raceStrategy.favored_end}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* AI Upwind/Downwind Tactics */}
        {raceStrategy?.upwind_tactics && (
          <StrategySection icon="arrow-up-bold" title="Upwind Tactics" content={raceStrategy.upwind_tactics} isAI />
        )}
        {raceStrategy?.downwind_tactics && (
          <StrategySection icon="arrow-down-bold" title="Downwind Tactics" content={raceStrategy.downwind_tactics} isAI />
        )}

        {/* Insights */}
        {strategy?.ai_strategy_suggestions?.contextualInsights?.length > 0 && (
          <View style={styles.strategySection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="lightbulb" size={18} color="#9333EA" />
              <Text style={[styles.sectionTitle, { color: '#9333EA' }]}>Insights</Text>
            </View>
            {strategy.ai_strategy_suggestions.contextualInsights.map((insight, idx) => (
              <View key={idx} style={styles.insightItem}>
                <Text style={styles.insightBullet}>•</Text>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  const renderCoachTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {myCoaches.length > 0 && (
        <>
          <View style={styles.listSectionHeader}>
            <MaterialCommunityIcons name="account-heart" size={18} color="#3B82F6" />
            <Text style={styles.listSectionTitle}>My Coaches</Text>
          </View>
          {myCoaches.map(coach => (
            <CoachCard
              key={coach.id}
              coach={coach}
              onSelect={() => handleShareWithCoach(coach)}
              disabled={sharing}
            />
          ))}
        </>
      )}

      {coaches.length > 0 && (
        <>
          <View style={styles.listSectionHeader}>
            <MaterialCommunityIcons name="account-group" size={18} color="#64748B" />
            <Text style={styles.listSectionTitle}>All Coaches</Text>
          </View>
          {coaches.map(coach => (
            <CoachCard
              key={coach.id}
              coach={coach}
              onSelect={() => handleShareWithCoach(coach)}
              disabled={sharing}
            />
          ))}
        </>
      )}

      {coaches.length === 0 && myCoaches.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="account-search" size={64} color="#CBD5E1" />
          <Text style={styles.emptyStateTitle}>No Coaches Available</Text>
          <Text style={styles.emptyStateText}>
            No verified coaches are currently available.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderCrewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {crewMembers.length > 0 ? (
        <>
          <Text style={styles.crewInstructions}>
            Select crew members to share your strategy with:
          </Text>
          {crewMembers.map(crew => (
            <TouchableOpacity
              key={crew.id}
              style={[
                styles.crewCard,
                selectedCrew.includes(crew.id) && styles.crewCardSelected,
              ]}
              onPress={() => {
                setSelectedCrew(prev =>
                  prev.includes(crew.id)
                    ? prev.filter(id => id !== crew.id)
                    : [...prev, crew.id]
                );
              }}
            >
              <View style={styles.crewAvatar}>
                {crew.profile_image_url ? (
                  <Image source={{ uri: crew.profile_image_url }} style={styles.crewAvatarImage} />
                ) : (
                  <MaterialCommunityIcons name="account" size={24} color="#64748B" />
                )}
              </View>
              <View style={styles.crewInfo}>
                <Text style={styles.crewName}>{crew.name}</Text>
                <Text style={styles.crewRole}>{crew.role}</Text>
              </View>
              <View style={[
                styles.crewCheckbox,
                selectedCrew.includes(crew.id) && styles.crewCheckboxSelected,
              ]}>
                {selectedCrew.includes(crew.id) && (
                  <MaterialCommunityIcons name="check" size={16} color="white" />
                )}
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[
              styles.shareButton,
              selectedCrew.length === 0 && styles.shareButtonDisabled,
            ]}
            onPress={handleShareWithCrew}
            disabled={selectedCrew.length === 0 || sharing}
          >
            {sharing ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <MaterialCommunityIcons name="send" size={20} color="white" />
                <Text style={styles.shareButtonText}>
                  Share with {selectedCrew.length > 0 ? `${selectedCrew.length} Crew` : 'Selected'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="account-group-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyStateTitle}>No Crew Members</Text>
          <Text style={styles.emptyStateText}>
            Add crew members to your team to share strategies with them.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderExportTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.exportInstructions}>
        Share your strategy outside of RegattaFlow:
      </Text>

      <TouchableOpacity style={styles.exportOption} onPress={handleNativeShare}>
        <View style={[styles.exportIcon, { backgroundColor: '#3B82F6' }]}>
          <MaterialCommunityIcons name="share-variant" size={24} color="white" />
        </View>
        <View style={styles.exportInfo}>
          <Text style={styles.exportTitle}>Share</Text>
          <Text style={styles.exportDescription}>Use device share sheet</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#94A3B8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.exportOption} onPress={handleShareViaWhatsApp}>
        <View style={[styles.exportIcon, { backgroundColor: '#25D366' }]}>
          <MaterialCommunityIcons name="whatsapp" size={24} color="white" />
        </View>
        <View style={styles.exportInfo}>
          <Text style={styles.exportTitle}>WhatsApp</Text>
          <Text style={styles.exportDescription}>Send to chat or group</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#94A3B8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.exportOption} onPress={handleShareViaEmail}>
        <View style={[styles.exportIcon, { backgroundColor: '#EA4335' }]}>
          <MaterialCommunityIcons name="email" size={24} color="white" />
        </View>
        <View style={styles.exportInfo}>
          <Text style={styles.exportTitle}>Email</Text>
          <Text style={styles.exportDescription}>Send via email</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#94A3B8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.exportOption} onPress={handleCopyToClipboard}>
        <View style={[styles.exportIcon, { backgroundColor: '#64748B' }]}>
          <MaterialCommunityIcons name="content-copy" size={24} color="white" />
        </View>
        <View style={styles.exportInfo}>
          <Text style={styles.exportTitle}>Copy to Clipboard</Text>
          <Text style={styles.exportDescription}>Paste anywhere</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#94A3B8" />
      </TouchableOpacity>

      {/* Preview of what will be shared */}
      <View style={styles.previewBox}>
        <Text style={styles.previewBoxTitle}>Preview</Text>
        <ScrollView style={styles.previewBoxContent} nestedScrollEnabled>
          <Text style={styles.previewBoxText}>{generateShareableText()}</Text>
        </ScrollView>
      </View>
    </ScrollView>
  );

  // Handle toggling public sharing
  const handleTogglePublicSharing = async (enabled: boolean) => {
    logger.info('handleTogglePublicSharing called:', { enabled, userId, raceId });

    if (!userId) {
      logger.error('Cannot toggle public sharing: userId is not set');
      showAlert('Error', 'Unable to share. Please try reloading the page.');
      return;
    }

    if (!raceId) {
      logger.error('Cannot toggle public sharing: raceId is not set');
      showAlert('Error', 'No race selected. Please try again.');
      return;
    }

    setTogglingPublicShare(true);
    try {
      logger.info('Calling togglePublicSharing with:', { raceId, userId, enabled });
      const status = await strategicPlanningService.togglePublicSharing(raceId, userId, enabled);
      logger.info('Public sharing toggled successfully:', status);
      setPublicSharingStatus(status);

      if (enabled && status.url) {
        showAlert(
          'Public Link Created!',
          `Anyone with this link can view your strategy (read-only).\n\n${status.url}`
        );
      }
    } catch (error: any) {
      logger.error('Failed to toggle public sharing:', error);
      const errorMessage = error?.message || 'Unknown error';
      showAlert('Error', `Failed to update sharing settings: ${errorMessage}`);
    } finally {
      setTogglingPublicShare(false);
    }
  };

  // Copy public link to clipboard
  const handleCopyPublicLink = async () => {
    if (!publicSharingStatus.url) return;
    
    try {
      await Clipboard.setStringAsync(publicSharingStatus.url);
      showAlert('Copied!', 'Public link copied to clipboard');
    } catch (error) {
      logger.error('Failed to copy public link:', error);
      showAlert('Error', 'Failed to copy link');
    }
  };

  // Share public link via native share
  const handleSharePublicLink = async () => {
    if (!publicSharingStatus.url) return;

    const title = raceInfo.name ? `Race Strategy - ${raceInfo.name}` : 'Race Strategy';

    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({
          title,
          url: publicSharingStatus.url,
        });
      } else {
        await handleCopyPublicLink();
      }
    } else {
      await Share.share({
        message: `Check out my race strategy: ${publicSharingStatus.url}`,
        url: publicSharingStatus.url,
      });
    }
    onShareComplete?.('external', 'Public Link');
  };

  const renderPublicTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.publicInstructions}>
        Create a public link that anyone can view - no RegattaFlow account required.
      </Text>

      {/* Toggle Section */}
      <View style={styles.publicToggleSection}>
        <View style={styles.publicToggleHeader}>
          <MaterialCommunityIcons 
            name={publicSharingStatus.enabled ? 'link-variant' : 'link-variant-off'} 
            size={24} 
            color={publicSharingStatus.enabled ? '#10B981' : '#64748B'} 
          />
          <View style={styles.publicToggleInfo}>
            <Text style={styles.publicToggleTitle}>Public Sharing</Text>
            <Text style={styles.publicToggleSubtitle}>
              {publicSharingStatus.enabled 
                ? 'Anyone with the link can view your strategy' 
                : 'Your strategy is private'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[
            styles.publicToggleButton,
            publicSharingStatus.enabled && styles.publicToggleButtonEnabled,
          ]}
          onPress={() => handleTogglePublicSharing(!publicSharingStatus.enabled)}
          disabled={togglingPublicShare}
        >
          {togglingPublicShare ? (
            <ActivityIndicator size="small" color={publicSharingStatus.enabled ? '#10B981' : '#64748B'} />
          ) : (
            <Text style={[
              styles.publicToggleButtonText,
              publicSharingStatus.enabled && styles.publicToggleButtonTextEnabled,
            ]}>
              {publicSharingStatus.enabled ? 'Enabled' : 'Disabled'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Link Section - Only shown when enabled */}
      {publicSharingStatus.enabled && publicSharingStatus.url && (
        <>
          <View style={styles.publicLinkSection}>
            <Text style={styles.publicLinkLabel}>Your Public Link</Text>
            <View style={styles.publicLinkBox}>
              <MaterialCommunityIcons name="link" size={18} color="#3B82F6" />
              <Text style={styles.publicLinkText} numberOfLines={1}>
                {publicSharingStatus.url}
              </Text>
            </View>
            
            <View style={styles.publicLinkActions}>
              <TouchableOpacity
                style={styles.publicLinkActionButton}
                onPress={handleCopyPublicLink}
              >
                <MaterialCommunityIcons name="content-copy" size={20} color="#3B82F6" />
                <Text style={styles.publicLinkActionText}>Copy Link</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.publicLinkActionButton, styles.publicLinkActionButtonPrimary]}
                onPress={handleSharePublicLink}
              >
                <MaterialCommunityIcons name="share-variant" size={20} color="white" />
                <Text style={[styles.publicLinkActionText, styles.publicLinkActionTextPrimary]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Info Cards */}
          <View style={styles.publicInfoCard}>
            <MaterialCommunityIcons name="eye" size={20} color="#64748B" />
            <Text style={styles.publicInfoText}>
              Viewers can see your full strategy including weather conditions, rig tuning, and tactical plans.
            </Text>
          </View>

          <View style={styles.publicInfoCard}>
            <MaterialCommunityIcons name="lock" size={20} color="#64748B" />
            <Text style={styles.publicInfoText}>
              Read-only access - viewers cannot edit or modify your strategy.
            </Text>
          </View>

          <View style={styles.publicInfoCard}>
            <MaterialCommunityIcons name="link-off" size={20} color="#64748B" />
            <Text style={styles.publicInfoText}>
              You can disable sharing anytime to revoke access to this link.
            </Text>
          </View>

          {publicSharingStatus.sharedAt && (
            <Text style={styles.publicSharedAt}>
              Sharing enabled {new Date(publicSharingStatus.sharedAt).toLocaleDateString()}
            </Text>
          )}
        </>
      )}

      {/* Empty state when disabled */}
      {!publicSharingStatus.enabled && (
        <View style={styles.publicDisabledState}>
          <MaterialCommunityIcons name="earth-off" size={48} color="#CBD5E1" />
          <Text style={styles.publicDisabledTitle}>Public Sharing Disabled</Text>
          <Text style={styles.publicDisabledText}>
            Enable public sharing above to generate a link you can share with anyone.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const tabs: { key: ShareTab; label: string; icon: string }[] = [
    { key: 'preview', label: 'Preview', icon: 'eye' },
    { key: 'public', label: 'Public Link', icon: 'link-variant' },
    { key: 'coach', label: 'Coach', icon: 'school' },
    { key: 'crew', label: 'Crew', icon: 'account-group' },
    { key: 'export', label: 'Export', icon: 'export' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Share Strategy</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.key ? '#3B82F6' : '#64748B'}
              />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading strategy...</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {activeTab === 'preview' && renderStrategyPreview()}
            {activeTab === 'public' && renderPublicTab()}
            {activeTab === 'coach' && renderCoachTab()}
            {activeTab === 'crew' && renderCrewTab()}
            {activeTab === 'export' && renderExportTab()}
          </View>
        )}
      </View>
    </Modal>
  );
}

// Sub-components
function StrategySection({ icon, title, content, isAI }: {
  icon: string;
  title: string;
  content: string;
  isAI?: boolean;
}) {
  return (
    <View style={styles.strategySection}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon as any} size={18} color={isAI ? '#9333EA' : '#3B82F6'} />
        <Text style={[styles.sectionTitle, isAI && { color: '#9333EA' }]}>{title}</Text>
      </View>
      <Text style={styles.sectionContent}>{content}</Text>
    </View>
  );
}

function StrategyPhaseCard({ icon, title, content }: {
  icon: string;
  title: string;
  content: string;
}) {
  return (
    <View style={styles.phaseCard}>
      <View style={styles.phaseCardHeader}>
        <MaterialCommunityIcons name={icon as any} size={16} color="#3B82F6" />
        <Text style={styles.phaseCardTitle}>{title}</Text>
        <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
      </View>
      <Text style={styles.phaseCardContent}>{content}</Text>
    </View>
  );
}

function StrategyPhasePlaceholder({ icon, title }: {
  icon: string;
  title: string;
}) {
  return (
    <View style={styles.phasePlaceholder}>
      <MaterialCommunityIcons name={icon as any} size={16} color="#CBD5E1" />
      <Text style={styles.phasePlaceholderTitle}>{title}</Text>
      <Text style={styles.phasePlaceholderHint}>Not set</Text>
    </View>
  );
}

function CoachCard({ coach, onSelect, disabled }: { 
  coach: CoachProfile; 
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.coachCard, disabled && styles.coachCardDisabled]}
      onPress={onSelect}
      disabled={disabled}
    >
      <Image
        source={{ uri: coach.profile_image_url }}
        style={styles.coachAvatar}
      />
      <View style={styles.coachInfo}>
        <View style={styles.coachNameRow}>
          <Text style={styles.coachName}>{coach.display_name}</Text>
          {coach.is_verified && (
            <MaterialCommunityIcons name="check-decagram" size={16} color="#3B82F6" />
          )}
        </View>
        <View style={styles.coachMeta}>
          <MaterialCommunityIcons name="star" size={12} color="#FBBF24" />
          <Text style={styles.coachRating}>{coach.rating.toFixed(1)}</Text>
          <Text style={styles.coachSessions}>• {coach.total_sessions} sessions</Text>
        </View>
        <Text style={styles.coachSpecializations} numberOfLines={1}>
          {coach.specializations.slice(0, 3).join(' • ')}
        </Text>
      </View>
      <View style={styles.selectCoachButton}>
        <MaterialCommunityIcons name="send" size={18} color="#3B82F6" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3B82F6',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  previewScroll: {
    flex: 1,
    padding: 16,
  },
  previewHeader: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewRaceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  previewRaceDate: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  previewVenue: {
    fontSize: 14,
    color: '#64748B',
  },
  raceTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  raceTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  raceDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  raceDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  raceDetailText: {
    fontSize: 13,
    color: '#64748B',
  },
  strategySection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  sectionContent: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  startLineInfo: {
    flexDirection: 'row',
    gap: 24,
  },
  startLineItem: {},
  startLineLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  startLineValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  insightItem: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  insightBullet: {
    color: '#9333EA',
    fontSize: 14,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  // Forecast styles
  forecastGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  forecastItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  forecastValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  forecastLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  // Rig tuning styles
  rigPreset: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  rigWindRange: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  rigSettingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rigSettingItem: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rigSettingLabel: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
  },
  rigSettingValue: {
    fontSize: 13,
    color: '#78350F',
    fontWeight: '500',
  },
  rigNotes: {
    fontSize: 14,
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 12,
  },
  // Distance race styles
  distanceOverview: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
  },
  distanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369A1',
  },
  waypointsList: {
    marginBottom: 16,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  waypointNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '600',
  },
  waypointName: {
    fontSize: 14,
    color: '#1E293B',
  },
  // AI recommendation styles
  aiRecommendation: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  aiRecommendationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    marginRight: 8,
    minWidth: 60,
  },
  aiRecommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  coachCardDisabled: {
    opacity: 0.5,
  },
  coachAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  coachInfo: {
    flex: 1,
  },
  coachNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coachName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  coachMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  coachRating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  coachSessions: {
    fontSize: 12,
    color: '#64748B',
  },
  coachSpecializations: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  selectCoachButton: {
    padding: 8,
  },
  crewInstructions: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  crewCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  crewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  crewAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  crewInfo: {
    flex: 1,
  },
  crewName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  crewRole: {
    fontSize: 13,
    color: '#64748B',
  },
  crewCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crewCheckboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  shareButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  exportInstructions: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  exportIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exportInfo: {
    flex: 1,
  },
  exportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  exportDescription: {
    fontSize: 13,
    color: '#64748B',
  },
  previewBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  previewBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  previewBoxContent: {
    maxHeight: 200,
    padding: 12,
  },
  previewBoxText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#475569',
    lineHeight: 18,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  notesHint: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 6,
    fontStyle: 'italic',
  },
  // Strategy Completeness Card
  completenessCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  completenessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  completenessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  completenessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  completenessLabel: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  completenessLabelEmpty: {
    color: '#94A3B8',
  },
  // Empty Section Card
  emptySectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptySectionContent: {
    flex: 1,
  },
  emptySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  emptySectionHint: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  // Phase Card Styles
  phaseCard: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  phaseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  phaseCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
    flex: 1,
  },
  phaseCardContent: {
    fontSize: 13,
    color: '#15803D',
    lineHeight: 18,
  },
  // Phase Placeholder Styles
  phasePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  phasePlaceholderTitle: {
    fontSize: 13,
    color: '#94A3B8',
    flex: 1,
  },
  phasePlaceholderHint: {
    fontSize: 11,
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  // Public Link Tab Styles
  publicInstructions: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 20,
  },
  publicToggleSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  publicToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  publicToggleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  publicToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  publicToggleSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  publicToggleButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  publicToggleButtonEnabled: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  publicToggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  publicToggleButtonTextEnabled: {
    color: '#059669',
  },
  publicLinkSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  publicLinkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  publicLinkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  publicLinkText: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  publicLinkActions: {
    flexDirection: 'row',
    gap: 12,
  },
  publicLinkActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  publicLinkActionButtonPrimary: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  publicLinkActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  publicLinkActionTextPrimary: {
    color: 'white',
  },
  publicInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  publicInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  publicSharedAt: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
  publicDisabledState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  publicDisabledTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  publicDisabledText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
