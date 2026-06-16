/**
 * Event Document Publishing Screen
 * Upload and manage event documents (NOR, SIs, results, etc.)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, ActivityIndicator, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import EventService, { EventDocument, DocumentType } from '@/services/eventService';
import { format, formatDistanceToNow } from 'date-fns';
import { useClubWorkspace } from '@/hooks/useClubWorkspace';
import { useClaudeDraft, ClaudeDocumentType, ClaudeDocumentDraft } from '@/hooks/ai/useClaudeDraft';
import { AiDraftModal } from '@/components/ai/AiDraftModal';
import { supabase } from '@/services/supabase';
import { copyToClipboard } from '@/utils/clipboard';
import { showAlert, showConfirm, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';

type AiGeneratedDocument = {
  id: string;
  document_type: DocumentType | string;
  draft_text: string;
  status: string;
  confidence: number | null;
  created_at: string;
  metadata?: Record<string, any> | null;
};

const SUPPORTED_CLAUDE_TYPES: ClaudeDocumentType[] = [
  'nor',
  'si',
  'amendment',
  'notice',
  'course_map',
  'results',
  'other',
];
export default function EventDocumentsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const eventId = id as string;
    const { clubId, loading: personaLoading, refresh: refreshPersonaContext } = useClubWorkspace();
    const [documents, setDocuments] = useState<EventDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [aiDrafts, setAiDrafts] = useState<AiGeneratedDocument[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [draftModalVisible, setDraftModalVisible] = useState(false);
    const [overrideDraft, setOverrideDraft] = useState<ClaudeDocumentDraft | null>(null);
    const [overrideGeneratedAt, setOverrideGeneratedAt] = useState<Date | null>(null);
    const { draft, isGenerating, error: draftError, generate, reset, lastGeneratedAt, documentType, setDocumentType } = useClaudeDraft({
        eventId,
        enabled: !!clubId,
    });
    const loadAiDrafts = useCallback(async () => {
        if (!clubId)
            return;
        try {
            setAiLoading(true);
            const { data, error } = await supabase
                .from('ai_generated_documents')
                .select('id, document_type, draft_text, status, confidence, created_at, metadata')
                .eq('club_id', clubId)
                .eq('event_id', eventId)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error)
                throw error;
            setAiDrafts((data ?? []) as AiGeneratedDocument[]);
        }
        catch (error) {
            console.error('Error loading AI drafts:', error);
        }
        finally {
            setAiLoading(false);
        }
    }, [clubId, eventId]);
    const loadDocuments = useCallback(async () => {
        if (!clubId)
            return;
        try {
            setLoading(true);
            const docs = await EventService.getEventDocuments(eventId);
            setDocuments(docs);
        }
        catch (error) {
            console.error('Error loading documents:', error);
            showAlert('Error', 'Failed to load documents');
        }
        finally {
            setLoading(false);
        }
    }, [clubId, eventId]);
    const handleGenerateDraft = useCallback(async (overrides?: { documentType?: ClaudeDocumentType }) => {
        setOverrideDraft(null);
        setOverrideGeneratedAt(null);
        const generated = await generate(overrides);
        if (generated) {
            await loadAiDrafts();
        }
    }, [generate, loadAiDrafts]);
    useEffect(() => {
        if (!clubId)
            return;
        loadDocuments();
        loadAiDrafts();
    }, [eventId, clubId, loadDocuments, loadAiDrafts]);
    const handleUpload = async (documentType: DocumentType) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                copyToCacheDirectory: true,
            });
            if (result.canceled)
                return;
            const file = result.assets[0];
            setUploading(true);
            // Create File object from URI (for web compatibility)
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const fileObj = new File([blob], file.name, { type: file.mimeType || 'application/pdf' });
      const promptForTitle = async (): Promise<string> =>
        new Promise((resolve) => {
          if (Platform.OS === 'ios') {
            Alert.prompt(
              'Document Title',
              'Enter a title for this document:',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve('') },
                {
                  text: 'Upload',
                  onPress: (text?: string) => resolve(text?.trim() || file.name),
                },
              ],
              'plain-text',
              file.name
            );
          } else {
            showAlertWithButtons(
              'Document Title',
              'Enter a title for this document in the next step.',
              [
                {
                  text: 'OK',
                  onPress: () => resolve(file.name),
                },
              ]
            );
          }
        });
            const title = await promptForTitle();
            if (!title) {
                setUploading(false);
                return;
            }
            await EventService.uploadDocument(eventId, fileObj, documentType, title, undefined, false // Default to private
            );
            await loadDocuments();
            showAlert('Success', 'Document uploaded successfully');
        }
        catch (error) {
            console.error('Error uploading document:', error);
            showAlert('Error', 'Failed to upload document');
        }
        finally {
            setUploading(false);
        }
    };
    const handleCopyDraft = async (item: AiGeneratedDocument) => {
        const copied = await copyToClipboard(item.draft_text);
        if (copied) {
            showAlert('Copied', 'Draft copied to your clipboard.');
        }
        else {
            showAlert('Clipboard unavailable', 'Copy is not supported on this device yet.');
        }
    };
    const extractSections = (value: any): { heading: string; body: string }[] => {
        if (!Array.isArray(value))
            return [];
        return value
            .filter((section) => section && typeof section.heading === 'string' && typeof section.body === 'string')
            .map((section) => ({
            heading: section.heading,
            body: section.body,
        }));
    };
    const handlePreviewDraft = (item: AiGeneratedDocument) => {
        const type = SUPPORTED_CLAUDE_TYPES.includes(item.document_type as ClaudeDocumentType)
            ? (item.document_type as ClaudeDocumentType)
            : 'nor';
        const title = (item.metadata?.title as string) || getDocumentTypeName(type as DocumentType);
        setOverrideDraft({
            title,
            markdown: item.draft_text,
            sections: extractSections(item.metadata?.sections),
            confidence: item.confidence,
        });
        setOverrideGeneratedAt(new Date(item.created_at));
        setDocumentType(type);
        setDraftModalVisible(true);
    };
    const openGenerateModal = () => {
        setOverrideDraft(null);
        setOverrideGeneratedAt(null);
        setDraftModalVisible(true);
    };
    const handleCloseModal = () => {
        setDraftModalVisible(false);
        setOverrideDraft(null);
        setOverrideGeneratedAt(null);
        reset();
    };
    const handleDiscardDraft = () => {
        reset();
        setOverrideDraft(null);
        setOverrideGeneratedAt(null);
    };
    const handlePublish = async (documentId: string) => {
        showConfirm('Publish Document', 'Are you sure you want to make this document public?', async () => {
            try {
                await EventService.publishDocument(documentId);
                await loadDocuments();
                showAlert('Success', 'Document published');
            }
            catch (error) {
                console.error('Error publishing document:', error);
                showAlert('Error', 'Failed to publish document');
            }
        });
    };
    const handleDelete = async (documentId: string) => {
        showConfirm('Delete Document', 'Are you sure you want to delete this document?', async () => {
            try {
                await EventService.deleteDocument(documentId);
                await loadDocuments();
                showAlert('Success', 'Document deleted');
            }
            catch (error) {
                console.error('Error deleting document:', error);
                showAlert('Error', 'Failed to delete document');
            }
        }, { destructive: true });
    };
    const getDocumentIcon = (type: DocumentType) => {
        switch (type) {
            case 'nor':
                return 'document-text-outline';
            case 'si':
                return 'list-outline';
            case 'results':
                return 'trophy-outline';
            case 'course_map':
                return 'map-outline';
            case 'amendment':
                return 'create-outline';
            case 'notice':
                return 'megaphone-outline';
            default:
                return 'document-outline';
        }
    };
    const getDocumentTypeName = (type: DocumentType) => {
        switch (type) {
            case 'nor':
                return 'Notice of Race';
            case 'si':
                return 'Sailing Instructions';
            case 'results':
                return 'Results';
            case 'course_map':
                return 'Course Map';
            case 'amendment':
                return 'Amendment';
            case 'notice':
                return 'Notice';
            default:
                return 'Other';
        }
    };
    const groupedDocuments = documents.reduce((acc, doc) => {
        if (!acc[doc.document_type]) {
            acc[doc.document_type] = [];
        }
        acc[doc.document_type].push(doc);
        return acc;
    }, {} as Record<DocumentType, EventDocument[]>);
    const documentTypes: DocumentType[] = ['nor', 'si', 'course_map', 'amendment', 'notice', 'results', 'other'];
    if (personaLoading) {
        return (<ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0EA5E9"/>
        </View>
      </ThemedView>);
    }
    if (!clubId) {
        return (<ThemedView style={styles.container}>
        <View style={styles.missingContainer}>
          <Ionicons name="people-circle-outline" size={48} color="#94A3B8"/>
          <ThemedText style={styles.missingTitle}>Connect Your Club Workspace</ThemedText>
          <ThemedText style={styles.missingDescription}>
            You need an active club connection to publish event documents. Finish onboarding or refresh your workspace.
          </ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={refreshPersonaContext}>
            <ThemedText style={styles.retryButtonText}>Retry Connection</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryLink} onPress={() => router.push('/(auth)/club-onboarding-chat')}>
            <ThemedText style={styles.secondaryLinkText}>Open Club Onboarding</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>);
    }
    if (loading) {
        return (<ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF"/>
        </View>
      </ThemedView>);
    }
    return (<ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B"/>
        </TouchableOpacity>
        <ThemedText style={styles.title}>Event Documents</ThemedText>
        <View style={styles.placeholder}/>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.aiHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.sectionTitle}>Document drafting</ThemedText>
              <ThemedText style={styles.sectionHelper}>
                Generate NORs, SIs, notices, and amendments with your event data.
              </ThemedText>
            </View>
            <TouchableOpacity style={styles.aiButton} onPress={openGenerateModal}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <ThemedText style={styles.aiButtonText}>New draft</ThemedText>
            </TouchableOpacity>
          </View>

          {aiLoading ? (
            <View style={styles.aiLoadingRow}>
              <ActivityIndicator size="small" color="#007AFF" />
              <ThemedText style={styles.aiLoadingText}>Loading drafts…</ThemedText>
            </View>
          ) : aiDrafts.length === 0 ? (
            <View style={styles.aiEmptyState}>
              <ThemedText style={styles.aiEmptyTitle}>No drafts yet</ThemedText>
              <ThemedText style={styles.aiEmptySubtitle}>
                Drafts are stored here for review before you publish.
              </ThemedText>
            </View>
          ) : (
            aiDrafts.map((item) => (
              <View key={item.id} style={styles.aiDraftCard}>
                <View style={styles.aiDraftHeader}>
                  <View>
                    <ThemedText style={styles.aiDraftTitle}>
                      {getDocumentTypeName(item.document_type as DocumentType)}
                    </ThemedText>
                    <ThemedText style={styles.aiDraftMeta}>
                      Created {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })} •{' '}
                      {item.status}
                    </ThemedText>
                  </View>
                  {typeof item.confidence === 'number' && (
                    <View style={styles.aiConfidenceBadge}>
                      <Ionicons name="shield-checkmark-outline" size={14} color="#0EA5E9" />
                      <ThemedText style={styles.aiConfidenceText}>
                        {(item.confidence * 100).toFixed(0)}%
                      </ThemedText>
                    </View>
                  )}
                </View>

                <ThemedText numberOfLines={4} style={styles.aiDraftExcerpt}>
                  {item.draft_text}
                </ThemedText>

                <View style={styles.aiDraftActions}>
                  <TouchableOpacity style={styles.aiActionButton} onPress={() => handlePreviewDraft(item)}>
                    <Ionicons name="open-outline" size={16} color="#007AFF" />
                    <ThemedText style={styles.aiActionText}>Review</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.aiActionButton} onPress={() => handleCopyDraft(item)}>
                    <Ionicons name="copy-outline" size={16} color="#007AFF" />
                    <ThemedText style={styles.aiActionText}>Copy</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Quick Upload</ThemedText>
          <View style={styles.uploadGrid}>
            <TouchableOpacity style={styles.uploadButton} onPress={() => handleUpload('nor')} disabled={uploading}>
              <Ionicons name="document-text-outline" size={28} color="#007AFF"/>
              <ThemedText style={styles.uploadButtonText}>Notice of Race</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadButton} onPress={() => handleUpload('si')} disabled={uploading}>
              <Ionicons name="list-outline" size={28} color="#007AFF"/>
              <ThemedText style={styles.uploadButtonText}>Sailing Instructions</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadButton} onPress={() => handleUpload('course_map')} disabled={uploading}>
              <Ionicons name="map-outline" size={28} color="#007AFF"/>
              <ThemedText style={styles.uploadButtonText}>Course Map</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadButton} onPress={() => handleUpload('results')} disabled={uploading}>
              <Ionicons name="trophy-outline" size={28} color="#007AFF"/>
              <ThemedText style={styles.uploadButtonText}>Results</ThemedText>
            </TouchableOpacity>
          </View>

          {uploading && (<View style={styles.uploadingIndicator}>
              <ActivityIndicator size="small" color="#007AFF"/>
              <ThemedText style={styles.uploadingText}>Uploading...</ThemedText>
            </View>)}
        </View>

        {documentTypes.map((type) => {
            const docs = groupedDocuments[type];
            if (!docs || docs.length === 0)
                return null;
            return (<View key={type} style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                {getDocumentTypeName(type)}
              </ThemedText>

              {docs.map((doc) => (<View key={doc.id} style={styles.documentCard}>
                  <View style={styles.documentHeader}>
                    <View style={styles.documentInfo}>
                      <Ionicons name={getDocumentIcon(doc.document_type) as any} size={24} color="#007AFF"/>
                      <View style={styles.documentText}>
                        <ThemedText style={styles.documentTitle}>{doc.title}</ThemedText>
                        <ThemedText style={styles.documentMeta}>
                          {doc.file_name} • v{doc.version}
                        </ThemedText>
                        <ThemedText style={styles.documentDate}>
                          {doc.published_at
                        ? `Published ${format(new Date(doc.published_at), 'MMM dd, yyyy')}`
                        : 'Not published'}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.documentStatus}>
                      {doc.is_public ? (<View style={[styles.badge, styles.badgePublic]}>
                          <ThemedText style={styles.badgeTextPublic}>Public</ThemedText>
                        </View>) : (<View style={[styles.badge, styles.badgePrivate]}>
                          <ThemedText style={styles.badgeTextPrivate}>Private</ThemedText>
                        </View>)}
                    </View>
                  </View>

                  <View style={styles.documentActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => {
                        // Open document in browser/viewer
                        if (Platform.OS === 'web') {
                            window.open(doc.file_url, '_blank');
                        }
                    }}>
                      <Ionicons name="eye-outline" size={18} color="#007AFF"/>
                      <ThemedText style={styles.actionButtonText}>View</ThemedText>
                    </TouchableOpacity>

                    {!doc.is_public && (<TouchableOpacity style={styles.actionButton} onPress={() => handlePublish(doc.id)}>
                        <Ionicons name="globe-outline" size={18} color="#10B981"/>
                        <ThemedText style={[styles.actionButtonText, { color: '#10B981' }]}>
                          Publish
                        </ThemedText>
                      </TouchableOpacity>)}

                    <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(doc.id)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444"/>
                      <ThemedText style={[styles.actionButtonText, { color: '#EF4444' }]}>
                        Delete
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>))}
            </View>);
        })}

        {documents.length === 0 && (<View style={styles.emptyContainer}>
            <Ionicons name="documents-outline" size={48} color="#CBD5E1"/>
            <ThemedText style={styles.emptyText}>No documents uploaded yet</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Upload NOR, SIs, and other event documents
            </ThemedText>
          </View>)}
      </ScrollView>
      <AiDraftModal
        visible={draftModalVisible}
        onClose={handleCloseModal}
        draft={overrideDraft ?? draft ?? null}
        documentType={documentType}
        isGenerating={isGenerating}
        error={draftError}
        onGenerate={handleGenerateDraft}
        onDocumentTypeChange={setDocumentType}
        onDiscard={handleDiscardDraft}
        lastGeneratedAt={overrideGeneratedAt ?? lastGeneratedAt}
      />
    </ThemedView>);
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1E293B',
    },
    placeholder: {
        width: 32,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    missingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        backgroundColor: '#F8FAFC',
    },
    missingTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1E293B',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    missingDescription: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#0EA5E9',
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    secondaryLink: {
        marginTop: 16,
    },
    secondaryLinkText: {
        color: '#0EA5E9',
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 16,
    },
    sectionHelper: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 4,
    },
    aiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
    },
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#007AFF',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 12,
    },
    aiButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    aiLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 14,
    },
    aiLoadingText: {
        fontSize: 13,
        color: '#007AFF',
    },
    aiEmptyState: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 20,
        gap: 4,
    },
    aiEmptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    aiEmptySubtitle: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 20,
    },
    aiDraftCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 20,
        marginBottom: 12,
        gap: 12,
    },
    aiDraftHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
    },
    aiDraftTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    aiDraftMeta: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 4,
    },
    aiConfidenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
    },
    aiConfidenceText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0369A1',
    },
    aiDraftExcerpt: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 18,
    },
    aiDraftActions: {
        flexDirection: 'row',
        gap: 12,
    },
    aiActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#EFF6FF',
        borderRadius: 10,
    },
    aiActionText: {
        color: '#007AFF',
        fontSize: 13,
        fontWeight: '600',
    },
    uploadGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    uploadButton: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    uploadButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#007AFF',
        marginTop: 8,
        textAlign: 'center',
    },
    uploadingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 16,
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
    },
    uploadingText: {
        fontSize: 14,
        color: '#007AFF',
    },
    documentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    documentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    documentInfo: {
        flexDirection: 'row',
        flex: 1,
        gap: 12,
    },
    documentText: {
        flex: 1,
    },
    documentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 4,
    },
    documentMeta: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 2,
    },
    documentDate: {
        fontSize: 12,
        color: '#94A3B8',
    },
    documentStatus: {
        marginLeft: 12,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgePublic: {
        backgroundColor: '#DCFCE7',
    },
    badgeTextPublic: {
        fontSize: 12,
        fontWeight: '600',
        color: '#10B981',
    },
    badgePrivate: {
        backgroundColor: '#F1F5F9',
    },
    badgeTextPrivate: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    documentActions: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#007AFF',
    },
    emptyContainer: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 4,
    },
});
