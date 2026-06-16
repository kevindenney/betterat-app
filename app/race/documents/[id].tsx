/**
 * Race Documents Route
 *
 * Document management screen for a specific race.
 * Shows all source documents with provenance tracking.
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DocumentManagementScreen } from '@/components/documents/management';
import { supabase } from '@/services/supabase';

interface RegattaInfo {
  id: string;
  name: string;
}

export default function RaceDocumentsScreen() {
  const { id, documentId } = useLocalSearchParams<{ id: string; documentId?: string }>();
  const router = useRouter();
  const [regatta, setRegatta] = useState<RegattaInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isMountedRef = React.useRef(true);
  const loadRunIdRef = React.useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadRegatta = React.useCallback(async () => {
    const runId = ++loadRunIdRef.current;
    const canCommit = () => isMountedRef.current && loadRunIdRef.current === runId;

    if (!id) {
      if (canCommit()) {
        setLoadError('Missing race ID.');
        setIsLoading(false);
      }
      return;
    }

    try {
      if (canCommit()) {
        setIsLoading(true);
        setLoadError(null);
      }
      const { data, error } = await supabase
        .from('regattas')
        .select('id, name')
        .eq('id', id)
        .single();

      if (error) {
        console.error('[RaceDocumentsScreen] Failed to load regatta:', error);
        if (canCommit()) {
          setLoadError(error.message || 'Failed to load race details.');
        }
        return;
      }

      if (canCommit()) {
        setRegatta(data);
      }
    } catch (error) {
      console.error('[RaceDocumentsScreen] Error:', error);
      if (canCommit()) {
        setLoadError(error instanceof Error ? error.message : 'Unexpected error loading race.');
      }
    } finally {
      if (canCommit()) {
        setIsLoading(false);
      }
    }
  }, [id]);

  // Load regatta info
  useEffect(() => {
    void loadRegatta();
  }, [loadRegatta]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/races');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!id || loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to open race documents</Text>
        <Text style={styles.errorText}>{loadError || 'Missing race ID.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRegatta}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <DocumentManagementScreen
      regattaId={id}
      regattaName={regatta?.name}
      initialDocumentId={typeof documentId === 'string' ? documentId : undefined}
      onBack={handleBack}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F9FAFB',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  backButton: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
});
