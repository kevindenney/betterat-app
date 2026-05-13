/**
 * Contingency Plans Card
 * Shows AI-generated scenario-based contingency plans based on weather forecast and venue conditions
 */

import { colors, Spacing } from '@/constants/designSystem';
import { supabase } from '@/services/supabase';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ContingencyScenario {
  scenario: string;
  trigger: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

interface ContingencyPlansCardProps {
  raceId: string;
  scenarios?: ContingencyScenario[];
}

// Empty state - no default scenarios, we want AI-generated ones
const EMPTY_SCENARIOS: ContingencyScenario[] = [];

export function ContingencyPlansCard({ raceId, scenarios: propScenarios }: ContingencyPlansCardProps) {
  const [scenarios, setScenarios] = useState<ContingencyScenario[]>(propScenarios || EMPTY_SCENARIOS);
  const [loading, setLoading] = useState(!propScenarios);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // If scenarios were passed as props, use those
    if (propScenarios && propScenarios.length > 0) {
      setScenarios(propScenarios);
      setLoading(false);
      return;
    }

    // Otherwise, try to load from the race's strategy_content
    async function loadContingencies() {
      if (!raceId) {
        setLoading(false);
        return;
      }

      try {
        setError(null);
        // Load from race_strategies table (regatta_id = raceId)
        const primary = await supabase
          .from('race_strategies')
          .select('strategy_content')
          .eq('regatta_id', raceId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        let planData = primary.data;
        let planError = primary.error;
        if (planError && isMissingIdColumn(planError, 'race_strategies', 'regatta_id')) {
          const fallback = await supabase
            .from('race_strategies')
            .select('strategy_content')
            .eq('race_id', raceId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          planData = fallback.data;
          planError = fallback.error;
        }
        if (planError) throw planError;

        if (planData?.strategy_content) {
          const content = planData.strategy_content as any;
          
          // Check for AI-generated contingencies in fullAIStrategy
          if (content.fullAIStrategy?.contingencies?.rawScenarios) {
            const rawScenarios = content.fullAIStrategy.contingencies.rawScenarios;
            setScenarios(rawScenarios.map((s: any) => ({
              scenario: s.scenario,
              trigger: s.trigger,
              action: s.action,
              priority: s.priority || 'medium'
            })));
            setIsAIGenerated(true);
            setLoading(false);
            return;
          }

          // Fallback: convert structured contingencies to scenarios
          if (content.fullAIStrategy?.contingencies) {
            const contingencies = content.fullAIStrategy.contingencies;
            const extractedScenarios: ContingencyScenario[] = [];

            // Extract from each category
            const categories = ['windShift', 'windDrop', 'windIncrease', 'currentChange', 'equipmentIssue'];
            for (const category of categories) {
              const items = contingencies[category] || [];
              for (const item of items) {
                extractedScenarios.push({
                  scenario: item.conditions?.[0] || category.replace(/([A-Z])/g, ' $1').trim(),
                  trigger: item.rationale || item.conditions?.[0] || '',
                  action: item.action,
                  priority: item.priority === 'critical' ? 'high' : item.priority === 'important' ? 'medium' : 'low'
                });
              }
            }

            if (extractedScenarios.length > 0) {
              setScenarios(extractedScenarios);
              setIsAIGenerated(true);
              setLoading(false);
              return;
            }
          }
        }

        // No AI-generated contingencies found
        setScenarios(EMPTY_SCENARIOS);
        setLoading(false);
      } catch (error) {
        console.warn('[ContingencyPlansCard] Error loading contingencies:', error);
        setError('Unable to load contingency plans right now.');
        setScenarios(EMPTY_SCENARIOS);
        setLoading(false);
      }
    }

    loadContingencies();
  }, [raceId, propScenarios, reloadKey]);
  const getPriorityColor = (priority: ContingencyScenario['priority']) => {
    switch (priority) {
      case 'high':
        return colors.danger[600];
      case 'medium':
        return colors.warning[600];
      case 'low':
        return colors.info[600];
    }
  };

  const getPriorityIcon = (priority: ContingencyScenario['priority']) => {
    switch (priority) {
      case 'high':
        return 'alert-circle';
      case 'medium':
        return 'alert';
      case 'low':
        return 'information';
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="shield-alert" size={24} color={colors.warning[600]} />
            <Text style={styles.title}>Contingency Plans</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading contingencies...</Text>
        </View>
      </View>
    );
  }

  // Empty state - no contingencies generated yet
  if (scenarios.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="shield-alert" size={24} color={colors.warning[600]} />
            <Text style={styles.title}>Contingency Plans</Text>
          </View>
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name={error ? 'alert-circle-outline' : 'shield-outline'}
            size={48}
            color={error ? colors.error[600] : colors.text.tertiary}
          />
          <Text style={styles.emptyTitle}>{error ? 'Contingency Plans Unavailable' : 'No Contingency Plans Yet'}</Text>
          <Text style={styles.emptyDescription}>
            {error
              ? error
              : "Contingency plans will be generated by AI when you generate a race strategy. They'll be tailored to the specific weather forecast and venue conditions."}
          </Text>
          {error ? (
            <TouchableOpacity style={styles.retryButton} onPress={() => setReloadKey((prev) => prev + 1)}>
              <MaterialCommunityIcons name="refresh" size={16} color={colors.background.primary} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="shield-alert" size={24} color={colors.warning[600]} />
          <Text style={styles.title}>Contingency Plans</Text>
        </View>
        <View style={styles.headerRight}>
          {isAIGenerated && (
            <View style={styles.aiBadge}>
              <MaterialCommunityIcons name="brain" size={14} color={colors.ai[700]} />
            </View>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{scenarios.length} scenarios</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scenariosList} showsVerticalScrollIndicator={false}>
        {scenarios.map((scenario, index) => (
          <View key={index} style={styles.scenarioCard}>
            {/* Priority Indicator */}
            <View style={styles.scenarioHeader}>
              <MaterialCommunityIcons
                name={getPriorityIcon(scenario.priority)}
                size={20}
                color={getPriorityColor(scenario.priority)}
              />
              <Text style={styles.scenarioTitle}>{scenario.scenario}</Text>
            </View>

            {/* Trigger */}
            <View style={styles.triggerSection}>
              <Text style={styles.triggerLabel}>Trigger:</Text>
              <Text style={styles.triggerText}>{scenario.trigger}</Text>
            </View>

            {/* Action */}
            <View style={styles.actionSection}>
              <MaterialCommunityIcons name="arrow-right-bold" size={16} color={colors.primary[600]} />
              <Text style={styles.actionText}>{scenario.action}</Text>
            </View>

            {/* Priority Badge */}
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(scenario.priority) + '20' }]}>
              <Text style={[styles.priorityText, { color: getPriorityColor(scenario.priority) }]}>
                {scenario.priority.toUpperCase()} PRIORITY
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  badge: {
    backgroundColor: colors.warning[100],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning[700],
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.ai[100],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  emptyDescription: {
    fontSize: 14,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    backgroundColor: colors.primary[600],
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background.primary,
  },
  scenariosList: {
    maxHeight: 400,
  },
  scenarioCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  scenarioTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  triggerSection: {
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.md,
  },
  triggerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 2,
  },
  triggerText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  actionSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: colors.primary[50],
    padding: Spacing.sm,
    borderRadius: 6,
    marginBottom: Spacing.sm,
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[700],
    lineHeight: 20,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
