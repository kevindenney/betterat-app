import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { AiDraftActions } from './AiDraftActions';
import type { ClaudeDocumentDraft, ClaudeDocumentType } from '@/hooks/ai/useClaudeDraft';
import { copyToClipboard } from '@/utils/clipboard';

interface AiDraftModalProps {
  visible: boolean;
  onClose: () => void;
  draft: ClaudeDocumentDraft | null;
  documentType: ClaudeDocumentType;
  isGenerating: boolean;
  error?: string | null;
  onGenerate: (documentType?: ClaudeDocumentType) => Promise<void> | void;
  onApply?: (draft: ClaudeDocumentDraft) => void;
  onDiscard?: () => void;
  lastGeneratedAt?: Date | null;
  onDocumentTypeChange?: (documentType: ClaudeDocumentType) => void;
}

const DOCUMENT_OPTIONS: {
  value: ClaudeDocumentType;
  label: string;
  helper: string;
}[] = [
  { value: 'nor', label: 'Notice of Race', helper: 'Eligibility, schedule, scoring, penalties' },
  { value: 'si', label: 'Sailing Instructions', helper: 'Courses, signals, time limits, safety' },
  { value: 'amendment', label: 'Amendment', helper: 'Update to NOR/SI with change log' },
  { value: 'notice', label: 'Notice', helper: 'General announcement or bulletin' },
  { value: 'results', label: 'Results Recap', helper: 'Podium summary & highlights' },
];

export function AiDraftModal({
  visible,
  onClose,
  draft,
  documentType,
  isGenerating,
  error,
  onGenerate,
  onApply,
  onDiscard,
  lastGeneratedAt,
  onDocumentTypeChange,
}: AiDraftModalProps) {
  const activeOption = useMemo(
    () => DOCUMENT_OPTIONS.find((option) => option.value === documentType) ?? DOCUMENT_OPTIONS[0],
    [documentType]
  );

  const handleGenerate = () => {
    onGenerate(documentType);
  };

  const handleCopy = async () => {
    if (!draft) return;
    const copied = await copyToClipboard(draft.markdown);
    if (copied) {
      showAlert('Copied', 'Draft markdown copied to your clipboard.');
    } else {
      showAlert('Clipboard unavailable', 'Copy is not supported on this device yet.');
    }
  };

  const handleApprove = () => {
    if (draft && onApply) {
      onApply(draft);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Document draft</Text>
            <Text style={styles.subtitle}>{activeOption.helper}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close draft modal">
            <Ionicons name="close" size={24} color="#475569" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.optionGroup}>
            {DOCUMENT_OPTIONS.map((option) => {
              const selected = option.value === documentType;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionChip, selected && styles.optionChipActive]}
                  onPress={() => onDocumentTypeChange?.(option.value)}
                >
                  <Ionicons
                    name={selected ? 'document-text' : 'document-text-outline'}
                    size={16}
                    color={selected ? '#007AFF' : '#475569'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {error && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {draft ? (
            <View style={styles.draftCard}>
              <View style={styles.draftHeader}>
                <Text style={styles.draftTitle}>{draft.title}</Text>
                {typeof draft.confidence === 'number' && (
                  <View style={styles.confidenceBadge}>
                    <Ionicons name="shield-checkmark-outline" size={14} color="#0EA5E9" />
                    <Text style={styles.confidenceText}>
                      Confidence {(draft.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                )}
              </View>

              {draft.sections.length > 0 && (
                <View style={styles.sections}>
                  {draft.sections.map((section, index) => (
                    <View key={`${section.heading}-${index}`} style={styles.sectionRow}>
                      <Ionicons name="bookmark-outline" size={16} color="#475569" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sectionHeading}>{section.heading}</Text>
                        <Text style={styles.sectionBody}>{section.body}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.markdownBlock}>
                <Text style={styles.markdownLabel}>Markdown output</Text>
                <View style={styles.codeContainer}>
                  <Text style={styles.code}>{draft.markdown}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.placeholderCard}>
              <Ionicons name="sparkles-outline" size={36} color="#007AFF" />
              <Text style={styles.placeholderTitle}>Generate a tailored document</Text>
              <Text style={styles.placeholderText}>
                Drafts use your event data, recent registrations, and club profile to produce
                compliant wording in seconds. Pick a document type, then tap Generate.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <AiDraftActions
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
            onApprove={draft && onApply ? handleApprove : undefined}
            onCopy={draft ? handleCopy : undefined}
            onDiscard={draft && onDiscard ? onDiscard : undefined}
            lastGeneratedAt={lastGeneratedAt}
            variant="vertical"
          />
        </View>
      </View>
    </Modal>
  );
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
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  closeButton: {
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 40,
    gap: 16,
  },
  optionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  optionChipActive: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  optionLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  optionLabelActive: {
    color: '#1D4ED8',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    flex: 1,
  },
  draftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  draftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  draftTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 12,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0369A1',
  },
  sections: {
    gap: 12,
    marginBottom: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  sectionBody: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  markdownBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
  },
  markdownLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  codeContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Courier' }),
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 20,
  },
  placeholderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
});
