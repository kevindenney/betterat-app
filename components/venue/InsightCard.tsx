/**
 * InsightCard - Display an AI-extracted or user-contributed insight
 */

import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import {
  VenueKnowledgeInsight,
  InsightCategory,
  ConditionsContext,
} from '@/services/venue/VenueDocumentService';
import { useVerifyInsight, useInsightCategories } from '@/hooks/useVenueDocuments';
import { useAuth } from '@/providers/AuthProvider';

interface InsightCardProps {
  insight: VenueKnowledgeInsight;
  venueId: string;
  onShowOnMap?: (coords: { lat: number; lng: number }, name?: string) => void;
  compact?: boolean;
}

export function InsightCard({
  insight,
  venueId,
  onShowOnMap,
  compact = false,
}: InsightCardProps) {
  const { user } = useAuth();
  const categories = useInsightCategories();
  const verifyMutation = useVerifyInsight();

  const categoryInfo = categories.find((c) => c.value === insight.category);

  const getCategoryColor = (category: InsightCategory): string => {
    const colors: Record<InsightCategory, string> = {
      wind_pattern: '#0EA5E9',
      tide_strategy: '#2563EB',
      current_pattern: '#7C3AED',
      mark_tactic: '#059669',
      start_line: '#DC2626',
      hazard: '#EA580C',
      shore_effect: '#84CC16',
      seasonal: '#D97706',
      general: '#6B7280',
    };
    return colors[category] || '#6B7280';
  };

  const handleVerify = (verified: boolean) => {
    if (!user) {
      showAlert('Sign in required', 'Please sign in to verify insights');
      return;
    }

    verifyMutation.mutate({
      insightId: insight.id,
      verified,
      venueId,
    });
  };

  const formatConditionsContext = (context: ConditionsContext): string => {
    const parts: string[] = [];

    if (context.wind_direction) {
      parts.push(`${context.wind_direction} wind`);
    }
    if (context.wind_speed_range) {
      parts.push(`${context.wind_speed_range[0]}-${context.wind_speed_range[1]} kt`);
    }
    if (context.tide_phase) {
      const phaseLabels: Record<string, string> = {
        flood: 'Flood tide',
        ebb: 'Ebb tide',
        slack_high: 'High slack',
        slack_low: 'Low slack',
      };
      parts.push(phaseLabels[context.tide_phase] || context.tide_phase);
    }
    if (context.season) {
      parts.push(context.season.charAt(0).toUpperCase() + context.season.slice(1));
    }

    return parts.join(' · ');
  };

  const color = getCategoryColor(insight.category);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Category Badge */}
      <View style={[styles.categoryBadge, { backgroundColor: color + '15' }]}>
        <Ionicons name={categoryInfo?.icon as any || 'information-circle'} size={14} color={color} />
        <ThemedText style={[styles.categoryText, { color }]}>
          {categoryInfo?.label || insight.category}
        </ThemedText>
        {insight.ai_extracted && (
          <View style={styles.aiTag}>
            <Ionicons name="sparkles" size={10} color="#7C3AED" />
            <ThemedText style={styles.aiTagText}>AI</ThemedText>
          </View>
        )}
      </View>

      {/* Title if present */}
      {insight.title && (
        <ThemedText style={styles.title}>{insight.title}</ThemedText>
      )}

      {/* Content */}
      <ThemedText style={[styles.content, compact && styles.contentCompact]} numberOfLines={compact ? 3 : undefined}>
        {insight.content}
      </ThemedText>

      {/* Conditions Context */}
      {insight.conditions_context && Object.keys(insight.conditions_context).length > 0 && (
        <View style={styles.conditionsRow}>
          <Ionicons name="cloud-outline" size={14} color="#6B7280" />
          <ThemedText style={styles.conditionsText}>
            {formatConditionsContext(insight.conditions_context)}
          </ThemedText>
        </View>
      )}

      {/* Location */}
      {insight.location_name && (
        <TouchableOpacity
          style={styles.locationRow}
          onPress={() => {
            if (insight.location_coords && onShowOnMap) {
              onShowOnMap(insight.location_coords, insight.location_name || undefined);
            }
          }}
          disabled={!insight.location_coords || !onShowOnMap}
        >
          <Ionicons name="location" size={14} color="#007AFF" />
          <ThemedText style={styles.locationText}>{insight.location_name}</ThemedText>
          {insight.location_coords && onShowOnMap && (
            <ThemedText style={styles.showOnMapText}>Show on map</ThemedText>
          )}
        </TouchableOpacity>
      )}

      {/* Verification Row */}
      {!compact && (
        <View style={styles.verificationRow}>
          {insight.community_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <ThemedText style={styles.verifiedText}>Community Verified</ThemedText>
            </View>
          )}

          <View style={styles.verificationActions}>
            <TouchableOpacity
              style={styles.verifyButton}
              onPress={() => handleVerify(true)}
            >
              <Ionicons name="checkmark" size={16} color="#059669" />
              <ThemedText style={styles.verifyCount}>{insight.verified_count || 0}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.verifyButton}
              onPress={() => handleVerify(false)}
            >
              <Ionicons name="close" size={16} color="#DC2626" />
              <ThemedText style={styles.disputeCount}>{insight.disputed_count || 0}</ThemedText>
            </TouchableOpacity>

            <View style={styles.spacer} />

            {insight.upvotes > 0 && (
              <View style={styles.upvotes}>
                <Ionicons name="arrow-up" size={14} color="#6B7280" />
                <ThemedText style={styles.upvoteText}>{insight.upvotes}</ThemedText>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Confidence indicator for AI-extracted */}
      {insight.ai_extracted && insight.confidence_score && !compact && (
        <View style={styles.confidenceRow}>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${insight.confidence_score * 100}%`,
                  backgroundColor:
                    insight.confidence_score > 0.8
                      ? '#059669'
                      : insight.confidence_score > 0.5
                      ? '#D97706'
                      : '#DC2626',
                },
              ]}
            />
          </View>
          <ThemedText style={styles.confidenceText}>
            {Math.round(insight.confidence_score * 100)}% confidence
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  containerCompact: {
    padding: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
    gap: 2,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7C3AED',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  content: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  contentCompact: {
    marginBottom: 8,
  },
  conditionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  conditionsText: {
    fontSize: 13,
    color: '#6B7280',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 13,
    color: '#007AFF',
    flex: 1,
  },
  showOnMapText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  verificationActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  verifyCount: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
  },
  disputeCount: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  upvotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  upvoteText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
});
