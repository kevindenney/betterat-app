/**
 * FleetPostRaceInsights
 * Shows a lightweight snapshot of other sailors' post-race activity for the selected race.
 * Highlights who logged notes, who generated AI analysis, and provides quick navigation to their sessions.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Users, Navigation, NotebookPen } from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';

interface FleetEntry {
  sessionId: string;
  sailorId: string | null;
  sailorName: string;
  hasTrack: boolean;
  hasNotes: boolean;
  hasAnalysis: boolean; // Has race_analysis data (even without GPS track)
  notesSnippet: string | null;
  aiSummary: string | null;
  overallSatisfaction?: number | null;
  keyLearning?: string | null;
  updatedAt?: string | null;
  isCurrentUser: boolean;
}

interface FleetPostRaceInsightsProps {
  raceId: string;
  currentUserId?: string | null;
  onViewSession?: (sessionId: string) => void;
  limit?: number;
}

const logger = createLogger('FleetPostRaceInsights');

function truncate(text: string | null | undefined, maxLength = 140): string | null {
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function extractFirstLine(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value) && value.length > 0) {
    return typeof value[0] === 'string' ? value[0] : null;
  }
  if (typeof value === 'string') {
    return value.split('\n')[0];
  }

  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed) && parsed.length > 0) {
      return typeof parsed[0] === 'string' ? parsed[0] : null;
    }
  } catch {
    // Ignore JSON parse errors
  }

  return null;
}

export function FleetPostRaceInsights({
  raceId,
  currentUserId,
  onViewSession,
  limit = 6,
}: FleetPostRaceInsightsProps) {
  const [entries, setEntries] = useState<FleetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFleetInsights() {
      if (!raceId) {
        if (isMounted) {
          setEntries([]);
          setError(null);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Query 1: Get race_timer_sessions (sailors who tracked their race)
        logger.debug('[FleetPostRaceInsights] 🔍 Querying race_timer_sessions for regatta_id:', raceId);
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('race_timer_sessions')
          .select('id, sailor_id, notes, track_points, created_at, updated_at, end_time')
          .eq('regatta_id', raceId)
          .order('end_time', { ascending: false })
          .limit(limit * 3);

        if (sessionsError) {
          logger.error('[FleetPostRaceInsights] ❌ Sessions query error:', sessionsError);
          // Don't throw - continue to check race_analysis
        }

        const sessions = sessionsData ?? [];
        logger.debug('[FleetPostRaceInsights] 📊 Found', sessions.length, 'race sessions');

        // Query 2: Get race_analysis directly for this race (includes sailors without GPS tracks)
        logger.debug('[FleetPostRaceInsights] 🔍 Querying race_analysis for race_id/regatta_id:', raceId);
        let allAnalysisData: any[] | null = null;
        let allAnalysisError: any = null;
        const primaryAnalysis = await supabase
          .from('race_analysis')
          .select('id, sailor_id, overall_satisfaction, key_learnings, updated_at')
          .eq('race_id', raceId)
          .limit(limit * 3);
        allAnalysisData = primaryAnalysis.data;
        allAnalysisError = primaryAnalysis.error;

        if (isMissingIdColumn(allAnalysisError, 'race_analysis', 'race_id')) {
          const fallbackAnalysis = await supabase
            .from('race_analysis')
            .select('id, sailor_id, overall_satisfaction, key_learnings, updated_at')
            .eq('regatta_id', raceId)
            .limit(limit * 3);
          allAnalysisData = fallbackAnalysis.data;
          allAnalysisError = fallbackAnalysis.error;
        }

        if (allAnalysisError) {
          logger.warn('[FleetPostRaceInsights] Unable to load race analysis:', allAnalysisError);
        }

        const allAnalyses = allAnalysisData ?? [];
        logger.debug('[FleetPostRaceInsights] 📊 Found', allAnalyses.length, 'race analyses');

        // If no sessions AND no analyses, show empty state
        if (sessions.length === 0 && allAnalyses.length === 0) {
          logger.info('[FleetPostRaceInsights] No sessions or analyses found for regatta:', raceId);
          if (isMounted) {
            setEntries([]);
          }
          return;
        }

        // Collect all unique user IDs from both sources
        const sessionUserIds = sessions
          .map((session) => session.sailor_id)
          .filter((value): value is string => typeof value === 'string');
        
        const analysisSailorProfileIds = allAnalyses
          .map((a) => a.sailor_id)
          .filter((value): value is string => typeof value === 'string');

        const sessionIds = sessions
          .map((session) => session.id)
          .filter((value): value is string => typeof value === 'string');

        // Build sailor profiles from both sources
        let sailorProfiles: {
          id: string;
          user_id: string;
          home_club?: string | null;
          boat_class_preferences?: any;
        }[] = [];

        // Resolve sailor profiles for analysis rows (race_analysis.sailor_id points to sailor_profiles.id)
        let profilesFromAnalysis: {
          id: string;
          user_id: string;
          home_club?: string | null;
          boat_class_preferences?: any;
        }[] = [];
        if (analysisSailorProfileIds.length > 0) {
          const { data: analysisProfiles, error: analysisProfilesError } = await supabase
            .from('sailor_profiles')
            .select('id, user_id, home_club, boat_class_preferences')
            .in('id', analysisSailorProfileIds);

          if (analysisProfilesError) {
            logger.warn('[FleetPostRaceInsights] Unable to resolve analysis sailor profiles', analysisProfilesError);
          } else {
            profilesFromAnalysis = (analysisProfiles || []).filter(
              (p): p is { id: string; user_id: string; home_club?: string; boat_class_preferences?: any } =>
                Boolean(p?.id && p?.user_id)
            );
          }
        }

        const analysisProfileById = new Map(profilesFromAnalysis.map((p) => [p.id, p]));
        const analysisUserIds = analysisSailorProfileIds
          .map((profileId) => analysisProfileById.get(profileId)?.user_id)
          .filter((value): value is string => typeof value === 'string');
        const uniqueUserIds = Array.from(new Set([...sessionUserIds, ...analysisUserIds]));

        // Get additional profiles for session users not in analysis
        const analysisUserIdSet = new Set(analysisUserIds);
        const sessionOnlyUserIds = sessionUserIds.filter(id => !analysisUserIdSet.has(id));

        if (sessionOnlyUserIds.length > 0) {
          logger.debug('[FleetPostRaceInsights] 🔍 Querying sailor_profiles for', sessionOnlyUserIds.length, 'session-only sailors');
          const { data: profileData, error: profileError } = await supabase
            .from('sailor_profiles')
            .select('id, user_id, home_club, boat_class_preferences')
            .in('user_id', sessionOnlyUserIds);

          if (profileError) {
            logger.warn('[FleetPostRaceInsights] Unable to load sailor profiles', profileError);
          } else if (profileData) {
            sailorProfiles = [...profilesFromAnalysis, ...profileData];
          }
        } else {
          sailorProfiles = profilesFromAnalysis;
        }

        // Deduplicate profiles by user_id
        const profileMap = new Map<string, typeof sailorProfiles[0]>();
        for (const profile of sailorProfiles) {
          if (!profileMap.has(profile.user_id)) {
            profileMap.set(profile.user_id, profile);
          }
        }
        sailorProfiles = Array.from(profileMap.values());
        logger.debug('[FleetPostRaceInsights] ✅ Loaded', sailorProfiles.length, 'unique sailor profiles');

        // Get user names
        let userDirectory: { id: string; full_name?: string | null }[] = [];
        if (uniqueUserIds.length > 0) {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, full_name')
            .in('id', uniqueUserIds);

          if (usersError) {
            logger.warn('[FleetPostRaceInsights] Unable to load user directory', usersError);
          } else if (usersData) {
            userDirectory = usersData;
          }
        }

        // Build structured analyses map from the direct query
        let structuredAnalyses: {
          sailor_id: string;
          overall_satisfaction?: number | null;
          key_learnings?: any;
          updated_at?: string | null;
        }[] = allAnalyses.map(a => ({
          sailor_id: a.sailor_id,
          overall_satisfaction: a.overall_satisfaction,
          key_learnings: a.key_learnings,
          updated_at: a.updated_at,
        }));

        // Get AI summaries for sessions
        let aiSummaries: {
          timer_session_id: string;
          overall_summary?: string | null;
          created_at?: string | null;
        }[] = [];

        if (sessionIds.length > 0) {
          const { data: aiData, error: aiError } = await supabase
            .from('ai_coach_analysis')
            .select('timer_session_id, overall_summary, created_at')
            .in('timer_session_id', sessionIds);

          if (aiError) {
            logger.warn('[FleetPostRaceInsights] Unable to load AI summaries', aiError);
          } else if (aiData) {
            aiSummaries = aiData;
          }
        }

        if (!isMounted) {
          return;
        }

        const profilesByUserId = new Map(
          sailorProfiles.map((profile) => [profile.user_id, profile])
        );
        const userNameById = new Map(
          userDirectory.map((user) => [user.id, user.full_name ?? null])
        );
        const analysisByProfileId = new Map(
          structuredAnalyses.map((analysis) => [analysis.sailor_id, analysis])
        );
        
        // Also create a map by user_id for easier lookup
        const analysisByUserId = new Map<string, typeof structuredAnalyses[0]>();
        for (const analysis of structuredAnalyses) {
          const profile = sailorProfiles.find(p => p.id === analysis.sailor_id);
          if (profile) {
            analysisByUserId.set(profile.user_id, analysis);
          }
        }
        const aiSummaryBySessionId = new Map(
          aiSummaries.map((summary) => [summary.timer_session_id, summary])
        );

        // Deduplicate sessions by sailor - keep only the best session per sailor
        // Best = has notes/track/end_time, then most recent
        const bestSessionBySailor = new Map<string, typeof sessions[0]>();
        
        for (const session of sessions) {
          const sailorKey = session.sailor_id || session.id; // Use session id as fallback for anonymous
          const existing = bestSessionBySailor.get(sailorKey);
          
          if (!existing) {
            bestSessionBySailor.set(sailorKey, session);
            continue;
          }
          
          // Score sessions: prefer those with data
          const scoreSession = (s: typeof session) => {
            let score = 0;
            if (typeof s.notes === 'string' && s.notes.trim().length > 0) score += 100;
            if (s.end_time) score += 50;
            if (Array.isArray(s.track_points) && s.track_points.length > 0) score += 25;
            // Add recency as tiebreaker (newer = higher score, but less weight)
            score += new Date(s.created_at || 0).getTime() / 1e12;
            return score;
          };
          
          if (scoreSession(session) > scoreSession(existing)) {
            bestSessionBySailor.set(sailorKey, session);
          }
        }
        
        const deduplicatedSessions = Array.from(bestSessionBySailor.values());
        logger.debug('[FleetPostRaceInsights] Deduplicated from', sessions.length, 'to', deduplicatedSessions.length, 'sessions');

        // Build entries from sessions
        const computedEntries: FleetEntry[] = deduplicatedSessions.map((session) => {
          const profile = session.sailor_id ? profilesByUserId.get(session.sailor_id) : undefined;
          const analysis = profile ? analysisByProfileId.get(profile.id) : undefined;
          const aiSummary = aiSummaryBySessionId.get(session.id);
          const displayName =
            userNameById.get(session.sailor_id ?? '') ||
            (session.sailor_id ? session.sailor_id.slice(0, 8) : 'Sailor');

          return {
            sessionId: session.id,
            sailorId: session.sailor_id ?? null,
            sailorName:
              session.sailor_id && session.sailor_id === currentUserId
                ? `${displayName} (You)`
                : displayName,
            hasTrack: Array.isArray(session.track_points) && session.track_points.length > 0,
            hasNotes: typeof session.notes === 'string' && session.notes.trim().length > 0,
            hasAnalysis: !!analysis,
            notesSnippet: truncate(extractFirstLine(session.notes)),
            aiSummary: truncate(aiSummary?.overall_summary),
            overallSatisfaction: analysis?.overall_satisfaction ?? null,
            keyLearning: extractFirstLine(analysis?.key_learnings),
            updatedAt: aiSummary?.created_at || analysis?.updated_at || session.updated_at || session.end_time || session.created_at,
            isCurrentUser: !!currentUserId && session.sailor_id === currentUserId,
          };
        });

        // Find sailors who have analysis but NO timer session (no GPS track)
        const sailorsWithSessions = new Set(deduplicatedSessions.map(s => s.sailor_id).filter(Boolean));
        const analysisOnlySailors = allAnalyses.filter((analysis) => {
          const userId = analysisByProfileId.get(analysis.sailor_id)?.user_id;
          return !!userId && !sailorsWithSessions.has(userId);
        });

        logger.debug('[FleetPostRaceInsights] Found', analysisOnlySailors.length, 'sailors with analysis but no GPS track');

        // Add entries for analysis-only sailors
        for (const analysis of analysisOnlySailors) {
          const userId = analysisByProfileId.get(analysis.sailor_id)?.user_id;
          if (!userId) continue;

          const displayName = userNameById.get(userId) || 'Sailor';

          computedEntries.push({
            sessionId: `analysis-${analysis.id}`, // Synthetic ID for analysis-only entries
            sailorId: userId,
            sailorName: userId === currentUserId ? `${displayName} (You)` : displayName,
            hasTrack: false, // No GPS track
            hasNotes: false, // No session notes (but has analysis)
            hasAnalysis: true, // Has race_analysis data
            notesSnippet: null,
            aiSummary: null, // AI summaries are tied to timer sessions
            overallSatisfaction: analysis.overall_satisfaction ?? null,
            keyLearning: extractFirstLine(analysis.key_learnings),
            updatedAt: analysis.updated_at || null,
            isCurrentUser: !!currentUserId && userId === currentUserId,
          });
        }

        // Sort entries: current user first, then by updatedAt
        computedEntries.sort((a, b) => {
          if (a.isCurrentUser && !b.isCurrentUser) return -1;
          if (!a.isCurrentUser && b.isCurrentUser) return 1;
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return dateB - dateA;
        });

        setEntries(computedEntries);
      } catch (error: any) {
        logger.warn('[FleetPostRaceInsights] Failed to load fleet data', error);
        if (isMounted) {
          setEntries([]);
          setError('Unable to load fleet insights right now.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadFleetInsights();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, limit, raceId]);

  const entriesToDisplay = useMemo(() => {
    return entries.slice(0, limit);
  }, [entries, limit]);

  if (!raceId) {
    return null;
  }

  return (
    <View className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Users size={18} color="#0F172A" />
          <Text className="text-base font-semibold text-slate-900">Fleet Insights</Text>
        </View>
        {loading && <ActivityIndicator size="small" color="#0F172A" />}
      </View>

      {error ? (
        <Text className="text-sm text-rose-600">{error}</Text>
      ) : entriesToDisplay.length === 0 ? (
        <Text className="text-sm text-slate-500">
          No other sailors have logged post-race data yet. Invite your fleet to share their notes!
        </Text>
      ) : (
        entriesToDisplay.map((entry) => (
          <View
            key={entry.sessionId}
            className="mb-3 last:mb-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-slate-900">{entry.sailorName}</Text>
              <View className="flex-row items-center gap-2">
                <View
                  className={`rounded-full px-2 py-0.5 ${
                    entry.hasTrack ? 'bg-emerald-100' : 'bg-slate-200'
                  }`}
                >
                  <Text className="text-[11px] font-semibold text-slate-700">
                    {entry.hasTrack ? 'Track logged' : 'No track'}
                  </Text>
                </View>
                <View
                  className={`rounded-full px-2 py-0.5 ${
                    entry.hasNotes ? 'bg-sky-100' : entry.hasAnalysis ? 'bg-purple-100' : 'bg-slate-200'
                  }`}
                >
                  <Text className={`text-[11px] font-semibold ${
                    entry.hasNotes ? 'text-slate-700' : entry.hasAnalysis ? 'text-purple-700' : 'text-slate-700'
                  }`}>
                    {entry.hasNotes ? 'Interview' : entry.hasAnalysis ? 'Analysis' : 'No data'}
                  </Text>
                </View>
              </View>
            </View>

            {entry.aiSummary ? (
              <Text className="text-sm text-slate-700 mt-2">
                {entry.aiSummary}
              </Text>
            ) : entry.keyLearning ? (
              <Text className="text-sm text-slate-600 mt-2">
                {entry.keyLearning}
              </Text>
            ) : entry.notesSnippet ? (
              <Text className="text-sm text-slate-600 mt-2">
                {entry.notesSnippet}
              </Text>
            ) : (
              <Text className="text-sm text-slate-500 mt-2">
                Awaiting analysis and notes.
              </Text>
            )}

            <View className="flex-row gap-2 mt-3">
              <Pressable
                className={`flex-row items-center gap-2 rounded-lg px-3 py-2 border ${
                  entry.hasTrack ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-100'
                }`}
                disabled={!onViewSession || !entry.hasTrack}
                onPress={() => onViewSession?.(entry.sessionId)}
              >
                <Navigation size={16} color="#0F172A" />
                <Text
                  className={`text-sm font-semibold ${
                    entry.hasTrack ? 'text-slate-800' : 'text-slate-500'
                  }`}
                >
                  View Track
                </Text>
              </Pressable>

              <Pressable
                className="flex-row items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
                disabled={!entry.hasNotes && !entry.aiSummary}
                onPress={() => {
                  if (entry.hasNotes || entry.aiSummary) {
                    onViewSession?.(entry.sessionId);
                  }
                }}
              >
                <NotebookPen size={16} color="#0F172A" />
                <Text
                  className={`text-sm font-semibold ${
                    entry.hasNotes || entry.aiSummary ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  Fleet Notes
                </Text>
              </Pressable>
            </View>

            {entry.overallSatisfaction ? (
              <Text className="text-xs text-slate-500 mt-2">
                Satisfaction: {entry.overallSatisfaction}/5
                {entry.updatedAt ? ` • Updated ${new Date(entry.updatedAt).toLocaleDateString()}` : ''}
              </Text>
            ) : entry.updatedAt ? (
              <Text className="text-xs text-slate-500 mt-2">
                Updated {new Date(entry.updatedAt).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}
