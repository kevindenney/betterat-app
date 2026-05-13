/**
 * ExtractionProgress Component
 *
 * Shows extraction progress with status messages and spinner.
 * Supports batch mode for processing multiple URLs.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CheckCircle, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react-native';
import { TUFTE_FORM_COLORS } from '@/components/races/AddRaceDialog/tufteFormStyles';

export type ExtractionStatus = 'idle' | 'fetching' | 'extracting' | 'completed' | 'failed';

export interface BatchUrlResult {
  url: string;
  success: boolean;
  error?: string;
  extractedFieldCount?: number;
}

export interface BatchProgress {
  current: number;
  total: number;
  results: BatchUrlResult[];
}

interface ExtractionProgressProps {
  status: ExtractionStatus;
  error?: string | null;
  /** Number of fields extracted (shown on completion) */
  extractedFieldCount?: number;
  /** Document type that was processed */
  documentType?: string;
  /** Batch progress when processing multiple URLs */
  batchProgress?: BatchProgress | null;
}

const STATUS_MESSAGES: Record<ExtractionStatus, string> = {
  idle: '',
  fetching: 'Fetching document...',
  extracting: 'Analyzing...',
  completed: 'Extraction complete',
  failed: 'Extraction failed',
};

export function ExtractionProgress({
  status,
  error,
  extractedFieldCount,
  documentType,
  batchProgress,
}: ExtractionProgressProps) {
  if (status === 'idle') {
    return null;
  }

  const isProcessing = status === 'fetching' || status === 'extracting';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  // Batch mode helpers
  const isBatchMode = batchProgress && batchProgress.total > 1;
  const batchSuccessCount = batchProgress?.results.filter(r => r.success).length || 0;
  const batchFailCount = batchProgress?.results.filter(r => !r.success).length || 0;
  const hasPartialFailures = isCompleted && batchFailCount > 0 && batchSuccessCount > 0;

  // Get status message (batch-aware)
  const getStatusMessage = () => {
    if (isBatchMode && isProcessing) {
      return `Processing URL ${batchProgress!.current} of ${batchProgress!.total}...`;
    }
    if (isBatchMode && isCompleted) {
      if (hasPartialFailures) {
        return `Completed with ${batchFailCount} error${batchFailCount !== 1 ? 's' : ''}`;
      }
      return `${batchProgress!.total} URLs processed`;
    }
    return STATUS_MESSAGES[status];
  };

  // Get sub message (batch-aware)
  const getSubMessage = () => {
    if (isBatchMode && isProcessing) {
      const currentUrl = batchProgress!.results[batchProgress!.current - 1]?.url || '';
      const displayUrl = currentUrl.length > 50 ? currentUrl.substring(0, 50) + '...' : currentUrl;
      return status === 'fetching'
        ? `Fetching: ${displayUrl}`
        : 'Analyzing...';
    }
    if (isProcessing) {
      return status === 'fetching'
        ? 'Downloading and parsing content...'
        : 'Extracting race details, VHF channels, marks...';
    }
    if (isBatchMode && isCompleted) {
      const totalFields = batchProgress!.results.reduce((acc, r) => acc + (r.extractedFieldCount || 0), 0);
      return `${totalFields} fields extracted from ${batchSuccessCount} document${batchSuccessCount !== 1 ? 's' : ''}`;
    }
    if (isCompleted && extractedFieldCount !== undefined) {
      return `${extractedFieldCount} fields extracted${documentType ? ` from ${documentType.toUpperCase()}` : ''}`;
    }
    return null;
  };

  return (
    <View style={[
      styles.container,
      isProcessing && styles.containerProcessing,
      isCompleted && !hasPartialFailures && styles.containerCompleted,
      isCompleted && hasPartialFailures && styles.containerPartial,
      isFailed && styles.containerFailed,
    ]}>
      <View style={styles.content}>
        {/* Icon/Spinner */}
        <View style={styles.iconContainer}>
          {isProcessing && (
            <ActivityIndicator
              size="small"
              color={TUFTE_FORM_COLORS.aiAccent}
            />
          )}
          {isCompleted && !hasPartialFailures && (
            <CheckCircle size={20} color={TUFTE_FORM_COLORS.success} />
          )}
          {isCompleted && hasPartialFailures && (
            <AlertTriangle size={20} color="#F59E0B" />
          )}
          {isFailed && (
            <AlertCircle size={20} color={TUFTE_FORM_COLORS.error} />
          )}
        </View>

        {/* Text */}
        <View style={styles.textContainer}>
          <Text style={[
            styles.statusText,
            isCompleted && !hasPartialFailures && styles.statusTextSuccess,
            isCompleted && hasPartialFailures && styles.statusTextWarning,
            isFailed && styles.statusTextError,
          ]}>
            {getStatusMessage()}
          </Text>

          {getSubMessage() && (
            <Text style={styles.subText}>{getSubMessage()}</Text>
          )}

          {isFailed && error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {/* Batch results summary (on completion with failures) */}
          {isBatchMode && isCompleted && batchFailCount > 0 && (
            <View style={styles.batchErrorSummary}>
              {batchProgress!.results
                .filter(r => !r.success)
                .map((r, idx) => (
                  <Text key={idx} style={styles.batchErrorItem}>
                    • {r.url.length > 40 ? r.url.substring(0, 40) + '...' : r.url}: {r.error || 'Failed'}
                  </Text>
                ))}
            </View>
          )}
        </View>
      </View>

      {/* AI Badge / Progress Badge */}
      {isProcessing && (
        <View style={styles.aiBadge}>
          <Sparkles size={12} color={TUFTE_FORM_COLORS.aiAccent} />
          <Text style={styles.aiBadgeText}>
            {isBatchMode ? `${batchProgress!.current}/${batchProgress!.total}` : 'AI'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: TUFTE_FORM_COLORS.separator,
  },
  containerProcessing: {
    backgroundColor: '#FAF5FF', // Very light purple
    borderColor: '#DDD6FE', // Light purple border
  },
  containerCompleted: {
    backgroundColor: '#F0FDF4', // Very light green
    borderColor: '#BBF7D0', // Light green border
  },
  containerFailed: {
    backgroundColor: '#FEF2F2', // Very light red
    borderColor: '#FECACA', // Light red border
  },
  containerPartial: {
    backgroundColor: '#FFFBEB', // Very light amber
    borderColor: '#FDE68A', // Light amber border
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: TUFTE_FORM_COLORS.label,
  },
  statusTextSuccess: {
    color: TUFTE_FORM_COLORS.success,
  },
  statusTextError: {
    color: TUFTE_FORM_COLORS.error,
  },
  statusTextWarning: {
    color: '#D97706', // Amber-600
  },
  subText: {
    fontSize: 12,
    color: TUFTE_FORM_COLORS.secondaryLabel,
  },
  errorText: {
    fontSize: 12,
    color: TUFTE_FORM_COLORS.error,
    marginTop: 2,
  },
  batchErrorSummary: {
    marginTop: 8,
    gap: 2,
  },
  batchErrorItem: {
    fontSize: 11,
    color: TUFTE_FORM_COLORS.error,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE', // Light purple
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: TUFTE_FORM_COLORS.aiAccent,
  },
});

export default ExtractionProgress;
