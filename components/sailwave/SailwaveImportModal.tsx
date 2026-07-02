/**
 * Sailwave Import Modal
 *
 * A modal component for importing Sailwave .BLW files into BetterAt.
 * Provides file selection, validation feedback, and import progress.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { sailwaveService, ImportResult } from '@/services/sailwave';
import { useAuth } from '@/providers/AuthProvider';

// ============================================================================
// Types
// ============================================================================

interface SailwaveImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (regattaId: string) => void;
  championshipId?: string;
  clubId?: string;
}

// ============================================================================
// Component
// ============================================================================

export function SailwaveImportModal({
  visible,
  onClose,
  onSuccess,
  championshipId,
  clubId,
}: SailwaveImportModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setResult(null);
    setSelectedFile(null);
    setLoading(false);
    onClose();
  }, [onClose]);

  // Pick and import file
  const pickFile = useCallback(async () => {
    if (!user) {
      setResult({
        success: false,
        warnings: [],
        errors: ['You must be logged in to import files'],
        stats: { competitors: 0, races: 0, results: 0, skipped: 0 },
      });
      return;
    }

    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === 'web' ? '.blw' : '*/*',
        copyToCacheDirectory: true,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]) {
        return;
      }

      const file = pickerResult.assets[0];

      // Validate file extension
      if (!file.name.toLowerCase().endsWith('.blw')) {
        setResult({
          success: false,
          warnings: [],
          errors: ['Please select a Sailwave .BLW file'],
          stats: { competitors: 0, races: 0, results: 0, skipped: 0 },
        });
        return;
      }

      setSelectedFile(file.name);
      setLoading(true);
      setResult(null);

      // Fetch file content
      const response = await fetch(file.uri);
      const content = await response.text();

      // Import using the service
      const importResult = await sailwaveService.importBLW(content, {
        userId: user.id,
        championshipId,
        clubId,
      });

      setResult(importResult);

      // Auto-navigate on success after delay
      if (importResult.success && importResult.regattaId) {
        setTimeout(() => {
          onSuccess(importResult.regattaId!);
          handleClose();
        }, 2000);
      }
    } catch (error) {
      setResult({
        success: false,
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Failed to import file'],
        stats: { competitors: 0, races: 0, results: 0, skipped: 0 },
      });
    } finally {
      setLoading(false);
    }
  }, [user, championshipId, clubId, onSuccess, handleClose]);

  // Try again
  const handleRetry = useCallback(() => {
    setResult(null);
    setSelectedFile(null);
  }, []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="boat-outline" size={24} color="#007AFF" />
              <Text style={styles.title}>Import from Sailwave</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* File picker / Drop zone */}
            {!result && (
              <TouchableOpacity
                style={styles.dropZone}
                onPress={pickFile}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator size="large" color="#007AFF" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={48} color="#007AFF" />
                )}
                <Text style={styles.dropZoneText}>
                  {loading
                    ? 'Importing...'
                    : selectedFile || 'Tap to select a .BLW file'}
                </Text>
                <Text style={styles.dropZoneHint}>Sailwave series files (.blw)</Text>
              </TouchableOpacity>
            )}

            {/* Results */}
            {result && (
              <View
                style={[
                  styles.resultContainer,
                  result.success ? styles.successBg : styles.errorBg,
                ]}
              >
                <Ionicons
                  name={result.success ? 'checkmark-circle' : 'alert-circle'}
                  size={48}
                  color={result.success ? '#34C759' : '#FF3B30'}
                />
                <Text
                  style={[
                    styles.resultTitle,
                    { color: result.success ? '#34C759' : '#FF3B30' },
                  ]}
                >
                  {result.success ? 'Import Successful!' : 'Import Failed'}
                </Text>

                {/* Stats on success */}
                {result.success && (
                  <View style={styles.statsContainer}>
                    <View style={styles.statRow}>
                      <Ionicons name="people" size={18} color="#34C759" />
                      <Text style={styles.statText}>
                        {result.stats.competitors} competitors
                      </Text>
                    </View>
                    <View style={styles.statRow}>
                      <Ionicons name="flag" size={18} color="#34C759" />
                      <Text style={styles.statText}>{result.stats.races} races</Text>
                    </View>
                    <View style={styles.statRow}>
                      <Ionicons name="trophy" size={18} color="#34C759" />
                      <Text style={styles.statText}>{result.stats.results} results</Text>
                    </View>
                    {result.stats.skipped > 0 && (
                      <View style={styles.statRow}>
                        <Ionicons name="warning" size={18} color="#FF9500" />
                        <Text style={[styles.statText, { color: '#FF9500' }]}>
                          {result.stats.skipped} skipped
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <View style={styles.warningsContainer}>
                    <Text style={styles.warningsTitle}>Warnings:</Text>
                    {result.warnings.slice(0, 5).map((warning, i) => (
                      <Text key={i} style={styles.warningText}>
                        • {warning}
                      </Text>
                    ))}
                    {result.warnings.length > 5 && (
                      <Text style={styles.warningText}>
                        ... and {result.warnings.length - 5} more
                      </Text>
                    )}
                  </View>
                )}

                {/* Errors */}
                {result.errors.length > 0 && (
                  <View style={styles.errorsContainer}>
                    {result.errors.map((error, i) => (
                      <Text key={i} style={styles.errorText}>
                        • {error}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Retry button on failure */}
                {!result.success && (
                  <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Ionicons name="refresh" size={18} color="#fff" />
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                )}

                {/* Success message */}
                {result.success && (
                  <Text style={styles.redirectText}>
                    Redirecting to your regatta...
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Import your Sailwave series including competitors, races, and results. You
              can export back to .BLW format anytime.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#007AFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
  },
  dropZoneText: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  dropZoneHint: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 6,
  },
  resultContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  successBg: {
    backgroundColor: '#E8F5E9',
  },
  errorBg: {
    backgroundColor: '#FFEBEE',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  statsContainer: {
    marginTop: 16,
    width: '100%',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  statText: {
    fontSize: 15,
    color: '#34C759',
    fontWeight: '500',
  },
  warningsContainer: {
    marginTop: 16,
    width: '100%',
    padding: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
  },
  warningsTitle: {
    fontWeight: '600',
    color: '#FF9500',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 13,
    color: '#FF9500',
    marginVertical: 2,
  },
  errorsContainer: {
    marginTop: 12,
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginVertical: 2,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  redirectText: {
    marginTop: 16,
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F0F8FF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#007AFF',
    lineHeight: 18,
  },
});

export default SailwaveImportModal;
