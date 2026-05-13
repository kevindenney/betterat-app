/**
 * Equipment Alerts Component
 * AI-generated maintenance alerts and optimization recommendations
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface EquipmentAlert {
  id: string;
  equipmentName?: string;
  alertType: 'maintenance_due' | 'replacement_recommended' | 'performance_degradation' | 'optimization_opportunity';
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  message: string;
  aiGenerated: boolean;
  aiConfidence?: number;
  aiReasoning?: string;
  recommendedAction?: string;
  estimatedCost?: number;
  dueDate?: string;
  status: 'active' | 'dismissed' | 'completed';
}

interface EquipmentAlertsProps {
  boatId: string;
}

export function EquipmentAlerts({ boatId }: EquipmentAlertsProps) {
  const [alerts, setAlerts] = useState<EquipmentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'urgent'>('all');

  useEffect(() => {
    loadAlerts();
  }, [boatId]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      // TODO: Fetch from Supabase
      setAlerts([
        {
          id: '1',
          equipmentName: 'Bottom Paint - Micron Extra',
          alertType: 'maintenance_due',
          severity: 'urgent',
          title: 'Bottom Paint Recoating Due',
          message: 'Your bottom paint was applied on August 15, 2023 (25 months ago). Akzo Nobel Micron Extra typically requires recoating every 24 months for optimal performance.',
          aiGenerated: true,
          aiConfidence: 0.95,
          aiReasoning: 'Based on manufacturer specifications and Hong Kong tropical water conditions, bottom paint effectiveness degrades significantly after 24 months due to biofouling.',
          recommendedAction: 'Schedule haul-out and recoating before next major regatta series',
          estimatedCost: 2100.00,
          dueDate: '2025-10-15',
          status: 'active',
        },
        {
          id: '2',
          equipmentName: 'Main #1 - All Purpose',
          alertType: 'optimization_opportunity',
          severity: 'info',
          title: 'Performance Optimization Detected',
          message: 'Analysis shows you consistently finish 1.2 positions better when using Main #1 in 10-15 knot conditions compared to your backup sail. Consider using Main #1 more frequently in these conditions.',
          aiGenerated: true,
          aiConfidence: 0.88,
          aiReasoning: 'Statistical analysis of 28 races shows significant performance improvement (p<0.05) when using Main #1 in moderate conditions.',
          recommendedAction: 'Prioritize Main #1 for upcoming races in 10-15 knot forecast',
          status: 'active',
        },
        {
          id: '3',
          equipmentName: 'Jib #2 - Heavy Air',
          alertType: 'maintenance_due',
          severity: 'warning',
          title: 'Sail Inspection Recommended',
          message: 'This sail has 32 racing hours since the last repair. Previous tear at clew occurred at 45 hours. Proactive inspection recommended to catch any developing issues.',
          aiGenerated: true,
          aiConfidence: 0.72,
          aiReasoning: 'Historical maintenance pattern suggests vulnerability. Early detection can prevent race-day failures.',
          recommendedAction: 'Schedule inspection with Quantum Sails Hong Kong',
          estimatedCost: 150.00,
          status: 'active',
        },
        {
          id: '4',
          alertType: 'optimization_opportunity',
          severity: 'info',
          title: 'Venue-Specific Equipment Recommendation',
          message: 'For your upcoming regatta at Royal Hong Kong Yacht Club, sailors using Micron CSC bottom paint averaged 1.2 positions better than Micron Extra in similar wind conditions due to warm water biofouling resistance.',
          aiGenerated: true,
          aiConfidence: 0.81,
          aiReasoning: 'Analysis of 156 race results at this venue shows correlation between bottom paint type and performance in tropical conditions.',
          recommendedAction: 'Consider switching to Micron CSC for Hong Kong racing',
          estimatedCost: 2200.00,
          status: 'active',
        },
        {
          id: '5',
          equipmentName: 'Mast - Original',
          alertType: 'maintenance_due',
          severity: 'warning',
          title: 'Annual Mast Inspection Approaching',
          message: 'Last mast inspection was May 10, 2024 (5 months ago). Annual inspection due by May 10, 2025.',
          aiGenerated: false,
          recommendedAction: 'Schedule inspection within next 5 months',
          dueDate: '2025-05-10',
          status: 'active',
        },
      ]);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const _getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'urgent': return 'alert-circle';
      case 'warning': return 'warning';
      case 'info': return 'information-circle';
      default: return 'information-circle';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'urgent': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'info': return '#3B82F6';
      default: return '#64748B';
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'maintenance_due': return 'build';
      case 'replacement_recommended': return 'swap-horizontal';
      case 'performance_degradation': return 'trending-down';
      case 'optimization_opportunity': return 'bulb';
      default: return 'alert';
    }
  };

  const filteredAlerts = filter === 'all'
    ? alerts.filter(a => a.status === 'active')
    : alerts.filter(a => a.status === 'active' && a.severity === filter);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    );
  }

  const urgentCount = alerts.filter(a => a.severity === 'urgent' && a.status === 'active').length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && a.status === 'active').length;
  const infoCount = alerts.filter(a => a.severity === 'info' && a.status === 'active').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Equipment Alerts</Text>
        <View style={styles.aiIndicator}>
          <MaterialCommunityIcons name="robot" size={16} color="#8B5CF6" />
          <Text style={styles.aiText}>AI-Powered</Text>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <TouchableOpacity
          style={[styles.summaryCard, filter === 'urgent' && styles.summaryCardActive]}
          onPress={() => setFilter(filter === 'urgent' ? 'all' : 'urgent')}
        >
          <View style={[styles.summaryIconContainer, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
          </View>
          <Text style={styles.summaryCount}>{urgentCount}</Text>
          <Text style={styles.summaryLabel}>Urgent</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.summaryCard, filter === 'warning' && styles.summaryCardActive]}
          onPress={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
        >
          <View style={[styles.summaryIconContainer, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="warning" size={20} color="#F59E0B" />
          </View>
          <Text style={styles.summaryCount}>{warningCount}</Text>
          <Text style={styles.summaryLabel}>Warning</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.summaryCard, filter === 'info' && styles.summaryCardActive]}
          onPress={() => setFilter(filter === 'info' ? 'all' : 'info')}
        >
          <View style={[styles.summaryIconContainer, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
          </View>
          <Text style={styles.summaryCount}>{infoCount}</Text>
          <Text style={styles.summaryLabel}>Info</Text>
        </TouchableOpacity>
      </View>

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
          <Text style={styles.emptyTitle}>All Clear!</Text>
          <Text style={styles.emptyText}>
            No active alerts. Your equipment is in good shape.
          </Text>
        </View>
      ) : (
        <View style={styles.alertsList}>
          {filteredAlerts.map((alert) => {
            const severityColor = getSeverityColor(alert.severity);

            return (
              <View key={alert.id} style={[styles.alertCard, { borderLeftColor: severityColor }]}>
                <View style={styles.alertHeader}>
                  <View style={styles.alertTitleRow}>
                    <View style={[styles.alertIcon, { backgroundColor: `${severityColor}15` }]}>
                      <Ionicons
                        name={getAlertTypeIcon(alert.alertType)}
                        size={18}
                        color={severityColor}
                      />
                    </View>
                    <View style={styles.alertTitleContainer}>
                      {alert.equipmentName && (
                        <Text style={styles.equipmentName}>{alert.equipmentName}</Text>
                      )}
                      <Text style={styles.alertTitle}>{alert.title}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => {
                      // TODO: Implement dismiss alert
                      alert('Dismissing alert...');
                    }}
                  >
                    <Ionicons name="close" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.alertMessage}>{alert.message}</Text>

                {alert.aiGenerated && alert.aiConfidence && (
                  <View style={styles.aiConfidence}>
                    <MaterialCommunityIcons name="robot" size={14} color="#8B5CF6" />
                    <Text style={styles.aiConfidenceText}>
                      Confidence: {(alert.aiConfidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                )}

                {alert.recommendedAction && (
                  <View style={styles.recommendedAction}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
                    <Text style={styles.recommendedActionText}>{alert.recommendedAction}</Text>
                  </View>
                )}

                {(alert.estimatedCost || alert.dueDate) && (
                  <View style={styles.alertFooter}>
                    {alert.estimatedCost && (
                      <View style={styles.footerItem}>
                        <Ionicons name="cash-outline" size={14} color="#64748B" />
                        <Text style={styles.footerText}>~${alert.estimatedCost.toFixed(0)}</Text>
                      </View>
                    )}
                    {alert.dueDate && (
                      <View style={styles.footerItem}>
                        <Ionicons name="calendar-outline" size={14} color="#64748B" />
                        <Text style={styles.footerText}>
                          Due {new Date(alert.dueDate).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      // TODO: Implement action based on alert type
                      alert(`Taking action for: ${alert.title}`);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Take Action</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={() => {
                      // TODO: Implement dismiss alert
                      alert('Dismissing alert...');
                    }}
                  >
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  aiIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  aiText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  summaryCardActive: {
    borderColor: '#3B82F6',
  },
  summaryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  alertsList: {
    gap: 16,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0px 2px',
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  alertTitleRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitleContainer: {
    flex: 1,
  },
  equipmentName: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  aiConfidence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  aiConfidenceText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  recommendedAction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  recommendedActionText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  alertFooter: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});