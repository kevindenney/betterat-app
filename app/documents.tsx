/**
 * Documents Tab - AI-powered document management for sailing strategy
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DocumentUploadCard } from '@/components/documents/DocumentUploadCard';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { SubscriptionManager } from '@/components/subscription/SubscriptionManager';
import { DeveloperDocumentUploader } from '@/components/developer/DeveloperDocumentUploader';
import { useAuth } from '@/providers/AuthProvider';
import { useSailingDocuments } from '@/hooks/useSailingDocuments';

export default function DocumentsScreen() {

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'documents' | 'library' | 'developer' | 'subscription'>('documents');

  // Initialize sailing documents hook
  const {
    uploadProgress,
    documents,
    recommendations,
    error,
    clearError,
  } = useSailingDocuments(user?.id);

  // Temporary debug mode - show DocumentViewer even without auth to test database
  const debugMode = true;

  if (!user && !debugMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authRequired}>
          <Text style={styles.authText}>Please sign in to access Document Processing</Text>
          <Text style={styles.authSubtext}>
            Upload valuable sailing documents like tides/current strategy books, sailing instructions,
            and tactical guides for AI-powered insights
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>📚 Sailing Document Library</Text>
          <Text style={styles.subtitle}>
            Upload valuable sailing documents for AI-powered strategic insights and knowledge extraction
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'documents' && styles.activeTab]}
              onPress={() => setActiveTab('documents')}
            >
              <Text style={[styles.tabText, activeTab === 'documents' && styles.activeTabText]}>
                Documents
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'library' && styles.activeTab]}
              onPress={() => setActiveTab('library')}
            >
              <Text style={[styles.tabText, activeTab === 'library' && styles.activeTabText]}>
                Library ({documents.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'developer' && styles.activeTab]}
              onPress={() => setActiveTab('developer')}
            >
              <Text style={[styles.tabText, activeTab === 'developer' && styles.activeTabText]}>
                🔧 Training
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'subscription' && styles.activeTab]}
              onPress={() => setActiveTab('subscription')}
            >
              <Text style={[styles.tabText, activeTab === 'subscription' && styles.activeTabText]}>
                Subscription
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError}>
              <Text style={styles.errorDismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'documents' ? (
          <>
            {/* Enhanced Upload Progress */}
            {uploadProgress && (
              <View style={styles.uploadProgressContainer}>
                <Text style={styles.uploadProgressPhase}>
                  {uploadProgress.phase === 'uploading' && '📤 Uploading...'}
                  {uploadProgress.phase === 'processing' && '🧠 Processing with AI...'}
                  {uploadProgress.phase === 'analyzing' && '⚡ Extracting sailing intelligence...'}
                  {uploadProgress.phase === 'complete' && '✅ Complete!'}
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${uploadProgress.progress}%` }]} />
                </View>
                <Text style={styles.uploadProgressMessage}>{uploadProgress.message}</Text>
              </View>
            )}

            {/* Document Upload Section */}
            <View style={styles.section}>
              <DocumentUploadCard
                onDocumentUploaded={(_doc) => {

                }}
                onAnalysisComplete={(_analysis) => {
                }}
                onCourseExtracted={(_course) => {

                }}
              />
            </View>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💡 Recommended Documents</Text>
                {recommendations.slice(0, 3).map((doc) => (
                  <View key={doc.id} style={styles.recommendationCard}>
                    <Text style={styles.recommendationTitle}>{doc.title}</Text>
                    <Text style={styles.recommendationCategory}>{doc.category.replace('_', ' ')}</Text>
                    <Text style={styles.recommendationValue}>
                      Strategic Value: {doc.intelligence.strategicValue}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Document Viewer Section */}
            <View style={styles.section}>
              <DocumentViewer
                onInsightSelect={(_insight) => {

                }}
              />
            </View>
          </>
        ) : activeTab === 'library' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📖 Your Sailing Document Library</Text>

            {documents.length === 0 ? (
              <View style={styles.emptyLibrary}>
                <Text style={styles.emptyLibraryTitle}>No documents yet</Text>
                <Text style={styles.emptyLibraryText}>
                  Upload documents like tides/current strategy books, sailing instructions,
                  or tactical guides to build your personal sailing knowledge library.
                </Text>
              </View>
            ) : (
              documents.map((doc) => (
                <View key={doc.id} style={styles.libraryDocumentCard}>
                  <View style={styles.libraryDocumentHeader}>
                    <Text style={styles.libraryDocumentTitle}>{doc.title}</Text>
                    <Text style={styles.libraryDocumentType}>
                      {doc.type.replace('_', ' ')} • {doc.category.replace('_', ' ')}
                    </Text>
                  </View>
                  <Text style={styles.libraryDocumentSummary} numberOfLines={2}>
                    {doc.content.summary}
                  </Text>
                  <View style={styles.libraryDocumentFooter}>
                    <Text style={styles.libraryDocumentInsights}>
                      {doc.content.extractedInsights.length} insights
                    </Text>
                    <Text style={styles.libraryDocumentValue}>
                      {doc.intelligence.strategicValue} value
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : activeTab === 'developer' ? (
          <DeveloperDocumentUploader />
        ) : (
          <View style={styles.section}>
            <SubscriptionManager />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  authRequired: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  authText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  authSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  tabContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabs: {
    flexDirection: 'row',
    gap: 24,
  },
  tab: {
    paddingBottom: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  activeTabText: {
    color: '#007AFF',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#D32F2F',
    flex: 1,
  },
  errorDismiss: {
    color: '#D32F2F',
    fontWeight: '600',
  },
  uploadProgressContainer: {
    backgroundColor: '#E3F2FD',
    margin: 20,
    padding: 16,
    borderRadius: 8,
  },
  uploadProgressPhase: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#BBDEFB',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 3,
  },
  uploadProgressMessage: {
    fontSize: 14,
    color: '#1976D2',
  },
  recommendationCard: {
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  recommendationCategory: {
    fontSize: 14,
    color: '#4CAF50',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  recommendationValue: {
    fontSize: 12,
    color: '#558B2F',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  emptyLibrary: {
    alignItems: 'center',
    padding: 40,
  },
  emptyLibraryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  emptyLibraryText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  libraryDocumentCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    boxShadow: '0px 2px',
    elevation: 2,
  },
  libraryDocumentHeader: {
    marginBottom: 8,
  },
  libraryDocumentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  libraryDocumentType: {
    fontSize: 12,
    color: '#007AFF',
    textTransform: 'capitalize',
  },
  libraryDocumentSummary: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  libraryDocumentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  libraryDocumentInsights: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  libraryDocumentValue: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});