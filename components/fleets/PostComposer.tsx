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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PostType } from '@/services/FleetSocialService';

interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (params: { postType: PostType; content: string; metadata?: any }) => Promise<void>;
  defaultType?: PostType;
  fleetName?: string;
}

const POST_TYPES: { type: PostType; label: string; icon: string; color: string }[] = [
  { type: 'discussion', label: 'Discussion', icon: 'message-text-outline', color: '#64748B' },
  { type: 'tuning_guide', label: 'Tuning Guide', icon: 'file-document-outline', color: '#007AFF' },
  { type: 'race_result', label: 'Race Result', icon: 'trophy-outline', color: '#059669' },
  { type: 'event', label: 'Event', icon: 'calendar-star', color: '#7C3AED' },
  { type: 'check_in', label: 'Check In', icon: 'map-marker-check', color: '#0891B2' },
];

export function PostComposer({ visible, onClose, onSubmit, defaultType = 'discussion', fleetName }: PostComposerProps) {
  const [postType, setPostType] = useState<PostType>(defaultType);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setLoading(true);
    try {
      await onSubmit({ postType, content: content.trim() });
      setContent('');
      setPostType('discussion');
      onClose();
    } catch (err) {
      console.error('Error creating post:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setContent('');
    setPostType('discussion');
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
            <Text style={styles.headerTitle}>New Post</Text>
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
          {/* Post Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Post Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
              {POST_TYPES.map((type) => {
                const isSelected = postType === type.type;
                return (
                  <TouchableOpacity
                    key={type.type}
                    onPress={() => setPostType(type.type)}
                    style={[
                      styles.typeButton,
                      isSelected && { backgroundColor: `${type.color}15`, borderColor: type.color },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={type.icon as any}
                      size={20}
                      color={isSelected ? type.color : '#94A3B8'}
                    />
                    <Text style={[styles.typeButtonText, isSelected && { color: type.color }]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Content Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>What's on your mind?</Text>
            <TextInput
              style={styles.textInput}
              placeholder={`Share with your fleet...`}
              placeholderTextColor="#94A3B8"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          </View>

          {/* Tips based on post type */}
          <View style={styles.tipBox}>
            <MaterialCommunityIcons name="lightbulb-outline" size={18} color="#0891B2" />
            <Text style={styles.tipText}>{getPostTypeTip(postType)}</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function getPostTypeTip(postType: PostType): string {
  switch (postType) {
    case 'tuning_guide':
      return 'Share boat setup details, trim settings, or sail configurations.';
    case 'race_result':
      return 'Share your race finish, key learnings, or conditions report.';
    case 'event':
      return 'Announce upcoming races, social events, or fleet gatherings.';
    case 'check_in':
      return 'Let fleet members know where you are sailing.';
    case 'discussion':
    default:
      return 'Start a conversation with your fleet members.';
  }
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  postButton: {
    backgroundColor: '#007AFF',
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
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    minHeight: 160,
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
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#0E7490',
    lineHeight: 20,
  },
});
