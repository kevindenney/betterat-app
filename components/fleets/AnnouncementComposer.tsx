import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AnnouncementComposerProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (params: { content: string; isPinned: boolean }) => Promise<void>;
  fleetName?: string;
}

export function AnnouncementComposer({ visible, onClose, onSubmit, fleetName }: AnnouncementComposerProps) {
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setLoading(true);
    try {
      await onSubmit({ content: content.trim(), isPinned });
      setContent('');
      setIsPinned(false);
      onClose();
    } catch (err) {
      console.error('Error creating announcement:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setContent('');
    setIsPinned(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.announcementBadge}>
              <MaterialCommunityIcons name="bullhorn" size={16} color="#DC2626" />
              <Text style={styles.headerTitle}>Announcement</Text>
            </View>
            {fleetName && <Text style={styles.headerSubtitle}>{fleetName}</Text>}
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!content.trim() || loading}
            style={[styles.postButton, (!content.trim() || loading) && styles.postButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#DC2626" />
            <Text style={styles.warningText}>
              This announcement will be visible to all fleet members and may trigger notifications.
            </Text>
          </View>

          {/* Pin Option */}
          <View style={styles.optionCard}>
            <View style={styles.optionContent}>
              <MaterialCommunityIcons name="pin" size={22} color={isPinned ? '#007AFF' : '#64748B'} />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Pin to top</Text>
                <Text style={styles.optionDescription}>
                  Keep this announcement at the top of the feed
                </Text>
              </View>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={isPinned ? '#007AFF' : '#F1F5F9'}
            />
          </View>

          {/* Content Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Announcement Message</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Important update, race notice, or fleet communication..."
              placeholderTextColor="#94A3B8"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
            />
          </View>

          {/* Tips */}
          <View style={styles.tipBox}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#0891B2" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Announcement Best Practices:</Text>
              <Text style={styles.tipText}>• Keep it clear and concise</Text>
              <Text style={styles.tipText}>• Include relevant dates and times</Text>
              <Text style={styles.tipText}>• Add action items or next steps if needed</Text>
            </View>
          </View>
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  announcementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#DC2626',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  postButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#991B1B',
    lineHeight: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  optionDescription: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ECFEFF',
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0891B2',
  },
  tipContent: {
    flex: 1,
    gap: 4,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0E7490',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: '#0E7490',
    lineHeight: 18,
  },
});
