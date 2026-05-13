/**
 * Recent Race Analysis Component
 * Displays AI-powered race analysis from RaceAnalysisAgent
 */

import { useAuth } from '@/providers/AuthProvider';
import { RaceAnalysisService } from '@/services/RaceAnalysisService';
import { RaceTimerService } from '@/services/RaceTimerService';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface RaceAnalysis {
  overall_summary: string;
  start_analysis: string;
  upwind_analysis: string;
  downwind_analysis: string;
  recommendations: string[];
  confidence_score: number;
}

export function RecentRaceAnalysis() {
  const { user } = useAuth();
  const router = useRouter();

  const [analysis, setAnalysis] = useState<RaceAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const loadRecentAnalysis = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Get unanalyzed sessions
      const sessions = await RaceTimerService.getUnanalyzedSessions(user.id);

      if (sessions.length > 0) {
        setSessionId(sessions[0].id);
        // No analysis yet, show analyze button
        setAnalysis(null);
      } else {
        // Get most recent analyzed session
        const recentSessions = await RaceTimerService.getSailorSessions(user.id, 1);
        if (recentSessions.length > 0) {
          // Load existing analysis
          // This would normally fetch from ai_coach_analysis table
          // For now, show placeholder
          setSessionId(recentSessions[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading race analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeRace = async () => {
    if (!sessionId) return;

    setIsAnalyzing(true);
    try {
      const analysisResult = await RaceAnalysisService.analyzeRaceSession(sessionId);
      if (analysisResult) {
        setAnalysis({
          overall_summary: analysisResult.overall_summary,
          start_analysis: analysisResult.start_analysis,
          upwind_analysis: analysisResult.upwind_analysis,
          downwind_analysis: analysisResult.downwind_analysis,
          recommendations: analysisResult.recommendations,
          confidence_score: analysisResult.confidence_score,
        });
      }
    } catch (error) {
      console.error('Error analyzing race:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    loadRecentAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0077be" />
        <Text style={styles.loadingText}>Loading analysis...</Text>
      </View>
    );
  }

  if (!sessionId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏁</Text>
        <Text style={styles.emptyTitle}>No Recent Races</Text>
        <Text style={styles.emptyText}>
          Race data will appear here after you complete a race with GPS tracking
        </Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Race Analysis</Text>
        </View>

        <View style={styles.pendingSection}>
          <Text style={styles.pendingText}>
            Your last race is ready for analysis
          </Text>
          <TouchableOpacity
            style={styles.analyzeButton}
            onPress={analyzeRace}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.analyzeButtonText}>Analyze Race</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const getConfidenceColor = (score: number): string => {
    if (score >= 0.8) return '#4caf50';
    if (score >= 0.6) return '#ff9800';
    return '#f44336';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Race Analysis</Text>
        </View>
        <View
          style={[
            styles.confidenceBadge,
            { backgroundColor: getConfidenceColor(analysis.confidence_score) },
          ]}
        >
          <Text style={styles.confidenceText}>
            {Math.round(analysis.confidence_score * 100)}%
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overall Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Overall</Text>
          <Text style={styles.sectionText}>{analysis.overall_summary}</Text>
        </View>

        {/* Start Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚦 Start</Text>
          <Text style={styles.sectionText}>{analysis.start_analysis}</Text>
        </View>

        {/* Upwind */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⬆️ Upwind</Text>
          <Text style={styles.sectionText}>{analysis.upwind_analysis}</Text>
        </View>

        {/* Downwind */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⬇️ Downwind</Text>
          <Text style={styles.sectionText}>{analysis.downwind_analysis}</Text>
        </View>

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <View style={styles.recommendationsSection}>
            <Text style={styles.recommendationsTitle}>💡 Recommendations</Text>
            {analysis.recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Text style={styles.recommendationBullet}>•</Text>
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* View Full Button */}
      <TouchableOpacity
        style={styles.viewFullButton}
        onPress={() => router.push(`/analysis/${sessionId}`)}
      >
        <Text style={styles.viewFullButtonText}>View Full Analysis →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
    maxHeight: 500,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pendingSection: {
    alignItems: 'center',
    padding: 20,
  },
  pendingText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  analyzeButton: {
    backgroundColor: '#0077be',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 150,
    alignItems: 'center',
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    marginBottom: 12,
  },
  section: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  recommendationsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
    marginTop: 4,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  recommendationBullet: {
    fontSize: 16,
    color: '#0077be',
    marginRight: 8,
    fontWeight: 'bold',
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  viewFullButton: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewFullButtonText: {
    fontSize: 14,
    color: '#0077be',
    fontWeight: '600',
  },
});
