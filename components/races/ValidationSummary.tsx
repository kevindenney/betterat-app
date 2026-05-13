/**
 * Validation Summary Component
 * Shows overall data quality and extraction statistics
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react-native';

interface ValidationSummaryProps {
  totalFields: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  missingFields: number;
  overallConfidence: number;
}

export function ValidationSummary({
  totalFields,
  highConfidence,
  mediumConfidence,
  lowConfidence,
  missingFields,
  overallConfidence,
}: ValidationSummaryProps) {
  const filledFields = totalFields - missingFields;
  const percentage = Math.round(overallConfidence * 100);

  // Determine overall quality level
  const getQualityLevel = () => {
    if (overallConfidence >= 0.8) return 'excellent';
    if (overallConfidence >= 0.65) return 'good';
    if (overallConfidence >= 0.5) return 'fair';
    return 'poor';
  };

  const qualityLevel = getQualityLevel();

  const qualityColors = {
    excellent: '#10b981',
    good: '#3b82f6',
    fair: '#f59e0b',
    poor: '#ef4444',
  };

  const qualityBgColors = {
    excellent: '#d1fae5',
    good: '#dbeafe',
    fair: '#fef3c7',
    poor: '#fee2e2',
  };

  const qualityLabels = {
    excellent: 'Excellent Extraction',
    good: 'Good Extraction',
    fair: 'Fair Extraction',
    poor: 'Poor Extraction',
  };

  const qualityMessages = {
    excellent: 'Extracted most data with high confidence. Review and confirm.',
    good: 'Extracted data successfully. Please verify key fields.',
    fair: 'Some data extracted but needs verification. Check all fields carefully.',
    poor: 'Data extraction was incomplete. Manual input may be needed.',
  };

  return (
    <View style={styles.container}>
      {/* Overall Quality Header */}
      <View style={[
        styles.header,
        { backgroundColor: qualityBgColors[qualityLevel] }
      ]}>
        <View style={styles.headerLeft}>
          {qualityLevel === 'excellent' || qualityLevel === 'good' ? (
            <CheckCircle size={24} color={qualityColors[qualityLevel]} strokeWidth={2} />
          ) : qualityLevel === 'fair' ? (
            <AlertTriangle size={24} color={qualityColors[qualityLevel]} strokeWidth={2} />
          ) : (
            <Info size={24} color={qualityColors[qualityLevel]} strokeWidth={2} />
          )}
          <View style={styles.headerText}>
            <Text style={[
              styles.qualityLabel,
              { color: qualityColors[qualityLevel] }
            ]}>
              {qualityLabels[qualityLevel]}
            </Text>
            <Text style={styles.percentage}>{percentage}% confidence</Text>
          </View>
        </View>
      </View>

      {/* Quality Message */}
      <Text style={styles.message}>{qualityMessages[qualityLevel]}</Text>

      {/* Statistics Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{filledFields}/{totalFields}</Text>
          <Text style={styles.statLabel}>Fields Extracted</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>{highConfidence}</Text>
          <Text style={styles.statLabel}>High Confidence</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>{mediumConfidence}</Text>
          <Text style={styles.statLabel}>Medium Confidence</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>{lowConfidence}</Text>
          <Text style={styles.statLabel}>Low Confidence</Text>
        </View>
      </View>

      {/* Missing Fields Warning */}
      {missingFields > 0 && (
        <View style={styles.warningBox}>
          <AlertTriangle size={16} color="#f59e0b" strokeWidth={2} />
          <Text style={styles.warningText}>
            {missingFields} field{missingFields > 1 ? 's' : ''} could not be extracted and will need manual input.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  qualityLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  percentage: {
    fontSize: 14,
    color: '#6b7280',
  },
  message: {
    padding: 16,
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fffbeb',
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
  },
});
