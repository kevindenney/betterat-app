/**
 * ConditionsBriefCard — AI-generated personalized race conditions brief.
 *
 * Shows a Gemini-powered brief that combines current weather/tide conditions
 * with the sailor's Playbook concepts and recent debriefs. Rendered inside
 * the Race Intel section of DaysBeforeContent.
 *
 * States: idle → loading → loaded | error
 * The brief is fetched on-demand when the user taps "Generate brief".
 */

import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { Sparkles, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react-native';
import {
  PlaybookAIService,
  type RaceConditionsBriefInput,
  type RaceConditionsBriefResponse,
} from '@/services/ai/PlaybookAIService';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ConditionsBriefCard');

const COLORS = {
  blue: '#007AFF',
  purple: '#AF52DE',
  green: '#34C759',
  orange: '#FF9500',
  gray: '#8E8E93',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#48484A',
  background: '#FFFFFF',
};

interface ConditionsBriefCardProps {
  interestId: string;
  weather: RaceConditionsBriefInput['weather'];
  tide?: RaceConditionsBriefInput['tide'];
  raceTitle?: string;
  boatClass?: string;
}

export function ConditionsBriefCard({
  interestId,
  weather,
  tide,
  raceTitle,
  boatClass,
}: ConditionsBriefCardProps) {
  const [brief, setBrief] = useState<RaceConditionsBriefResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const generateBrief = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await PlaybookAIService.raceConditionsBrief({
        interest_id: interestId,
        weather,
        tide,
        race_title: raceTitle,
        boat_class: boatClass,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setBrief(result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate brief';
      logger.error('generateBrief failed', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [interestId, weather, tide, raceTitle, boatClass]);

  // Not yet generated — show a button
  if (!brief && !loading && !error) {
    return (
      <Pressable style={styles.generateButton} onPress={generateBrief}>
        <Sparkles size={16} color={COLORS.purple} />
        <Text style={styles.generateButtonText}>Conditions Brief</Text>
        <Text style={styles.generateButtonHint}>Personal tactics from your Playbook</Text>
      </Pressable>
    );
  }

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.purple} />
          <Text style={styles.loadingText}>Generating your conditions brief...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorRow}>
          <AlertCircle size={14} color={COLORS.orange} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
        <Pressable style={styles.retryButton} onPress={generateBrief}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Show the brief
  if (!brief) return null;

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setExpanded(!expanded)}>
        <Sparkles size={14} color={COLORS.purple} />
        <Text style={styles.headerText}>Conditions Brief</Text>
        {expanded
          ? <ChevronUp size={16} color={COLORS.gray} />
          : <ChevronDown size={16} color={COLORS.gray} />}
      </Pressable>

      {expanded && (
        <>
          {/* Key points — quick-scan bullets */}
          {brief.key_points.length > 0 && (
            <View style={styles.keyPoints}>
              {brief.key_points.map((point, i) => (
                <View key={i} style={styles.keyPointRow}>
                  <Text style={styles.bullet}>{'  \u2022  '}</Text>
                  <Text style={styles.keyPointText}>{point}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Full brief markdown (rendered as plain text for now) */}
          <Text style={styles.briefBody}>{brief.brief_md}</Text>

          {/* Refresh button */}
          <Pressable style={styles.refreshRow} onPress={generateBrief}>
            <Sparkles size={12} color={COLORS.blue} />
            <Text style={styles.refreshText}>Regenerate</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray5,
    padding: 14,
    marginTop: 10,
  },
  generateButton: {
    backgroundColor: '#F5F0FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DDF2',
    padding: 14,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.purple,
  },
  generateButtonHint: {
    fontSize: 12,
    color: COLORS.gray,
    width: '100%',
    marginLeft: 24,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.secondaryLabel,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.orange,
    flex: 1,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.blue,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.purple,
    flex: 1,
  },
  keyPoints: {
    marginTop: 10,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  keyPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 13,
    color: COLORS.purple,
    lineHeight: 18,
  },
  keyPointText: {
    fontSize: 13,
    color: COLORS.label,
    lineHeight: 18,
    flex: 1,
  },
  briefBody: {
    fontSize: 13,
    color: COLORS.tertiaryLabel,
    lineHeight: 19,
    marginTop: 10,
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray5,
  },
  refreshText: {
    fontSize: 12,
    color: COLORS.blue,
  },
});
