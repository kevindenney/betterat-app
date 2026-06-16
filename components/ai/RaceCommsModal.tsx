import React from 'react';
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
import { format, parseISO } from 'date-fns';
import { AiDraftActions } from './AiDraftActions';
import type { RaceCommsDraft } from '@/hooks/ai/useRaceCommsDraft';
import { copyToClipboard } from '@/utils/clipboard';

interface RaceCommsModalProps {
  visible: boolean;
  onClose: () => void;
  raceName?: string;
  draft: RaceCommsDraft | null;
  isGenerating: boolean;
  error?: string | null;
  onGenerate: () => Promise<void> | void;
  lastGeneratedAt?: Date | null;
}

const formatSuggestedSendTime = (value?: string | null) => {
  if (!value) return null;
  try {
    return format(parseISO(value), 'MMM dd, yyyy • h:mm a');
  } catch {
    return value;
  }
};

export function RaceCommsModal({
  visible,
  onClose,
  raceName,
  draft,
  isGenerating,
  error,
  onGenerate,
  lastGeneratedAt,
}: RaceCommsModalProps) {
  const copyContent = async (content: string) => {
    const copied = await copyToClipboard(content);
    showAlert(
      copied ? 'Copied' : 'Clipboard unavailable',
      copied ? 'Text copied to your clipboard.' : 'Copy is not supported on this device yet.'
    );
  };

  const handleCopyAll = async () => {
    if (!draft) return;
    const bundle = [
      `Urgency: ${draft.urgency.toUpperCase()}`,
      draft.suggested_send_time ? `Suggested send: ${formatSuggestedSendTime(draft.suggested_send_time)}` : null,
      '',
      'SMS:',
      draft.sms,
      '',
      'Email:',
      draft.email,
      '',
      'Notice board:',
      draft.notice_board,
    ]
      .filter(Boolean)
      .join('\n');

    const copied = await copyToClipboard(bundle);
    showAlert(
      copied ? 'Copied' : 'Clipboard unavailable',
      copied ? 'Draft copied to your clipboard.' : 'Copy is not supported on this device yet.'
    );
  };

  const urgencyBadgeColor = {
    low: '#22C55E',
    medium: '#F97316',
    high: '#EF4444',
  } as const;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Race update</Text>
            {raceName ? <Text style={styles.subtitle}>{raceName}</Text> : null}
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={22} color="#475569" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {error && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {draft ? (
            <View style={styles.draftCard}>
              <View style={styles.metadataRow}>
                <View style={[styles.urgencyBadge, { backgroundColor: `${urgencyBadgeColor[draft.urgency]}1A` }]}>
                  <Ionicons name="alert" size={16} color={urgencyBadgeColor[draft.urgency]} />
                  <Text style={[styles.urgencyText, { color: urgencyBadgeColor[draft.urgency] }]}>
                    {draft.urgency.toUpperCase()}
                  </Text>
                </View>
                {draft.suggested_send_time && (
                  <View style={styles.sendTime}>
                    <Ionicons name="time-outline" size={16} color="#0F172A" style={{ marginRight: 6 }} />
                    <Text style={styles.sendTimeText}>
                      {formatSuggestedSendTime(draft.suggested_send_time)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.channelCard}>
                <View style={styles.channelHeader}>
                  <View style={styles.channelTitleRow}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color="#0F172A" />
                    <Text style={styles.channelTitle}>SMS</Text>
                  </View>
                  <TouchableOpacity onPress={() => copyContent(draft.sms)}>
                    <Ionicons name="copy-outline" size={18} color="#007AFF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.channelBody}>{draft.sms}</Text>
              </View>

              <View style={styles.channelCard}>
                <View style={styles.channelHeader}>
                  <View style={styles.channelTitleRow}>
                    <Ionicons name="mail-outline" size={18} color="#0F172A" />
                    <Text style={styles.channelTitle}>Email</Text>
                  </View>
                  <TouchableOpacity onPress={() => copyContent(draft.email)}>
                    <Ionicons name="copy-outline" size={18} color="#007AFF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.channelBody}>{draft.email}</Text>
              </View>

              <View style={styles.channelCard}>
                <View style={styles.channelHeader}>
                  <View style={styles.channelTitleRow}>
                    <Ionicons name="megaphone-outline" size={18} color="#0F172A" />
                    <Text style={styles.channelTitle}>Notice board</Text>
                  </View>
                  <TouchableOpacity onPress={() => copyContent(draft.notice_board)}>
                    <Ionicons name="copy-outline" size={18} color="#007AFF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.channelBody}>{draft.notice_board}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="sparkles-outline" size={42} color="#007AFF" style={{ marginBottom: 12 }} />
              <Text style={styles.placeholderTitle}>Draft race-day comms instantly</Text>
              <Text style={styles.placeholderText}>
                Updates summarize weather, registrations, and schedule for SMS,
                email, and the dock notice board.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <AiDraftActions
            isGenerating={isGenerating}
            onGenerate={onGenerate}
            onCopy={draft ? handleCopyAll : undefined}
            lastGeneratedAt={lastGeneratedAt ?? null}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 24 : 16,
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
    gap: 16,
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
  },
  draftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sendTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendTimeText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '500',
  },
  channelCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  channelBody: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
  },
  placeholder: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
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
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
});
