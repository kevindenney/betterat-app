import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MessageCircle, GitFork, ExternalLink } from 'lucide-react-native';
import type { SharedInboxItem } from '@/types/sharing';
import { fontFamily } from '@/lib/design-tokens-editorial';

export interface SharedWithYouInboxProps {
  items: SharedInboxItem[];
  isLoading?: boolean;
  onView: (item: SharedInboxItem) => void;
  onFork: (item: SharedInboxItem) => Promise<void> | void;
  onComment: (item: SharedInboxItem) => void;
}

const AVATAR_PALETTE = ['#4338CA', '#9333EA', '#16A34A', '#E11D48', '#0EA5E9'];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function SharedWithYouInbox({ items, isLoading, onView, onFork, onComment }: SharedWithYouInboxProps) {
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Nothing shared with you yet</Text>
        <Text style={styles.emptyBody}>
          When a crew member or coach shares a step, it'll appear here so you can view, fork, or comment.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {items.map((item) => (
        <View key={item.id} style={[styles.card, !item.read_at && styles.cardUnread]}>
          <View style={styles.headerRow}>
            <View style={[styles.avatar, { backgroundColor: avatarColor(item.sender_user_id) }]}>
              <Text style={styles.avatarText}>{item.sender_initials.slice(0, 2)}</Text>
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.sender}>{item.sender_name}</Text>
              <Text style={styles.timestamp}>
                {new Date(item.shared_at).toLocaleString()}
              </Text>
            </View>
            {!item.read_at ? <View style={styles.unreadDot} /> : null}
          </View>

          <Text style={styles.title}>{item.step_title}</Text>
          {item.step_body ? <Text style={styles.body} numberOfLines={3}>{item.step_body}</Text> : null}

          {item.forked_to_step_id ? (
            <View style={styles.forkedNote}>
              <Text style={styles.forkedNoteText}>Forked into your timeline</Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable style={styles.action} onPress={() => onView(item)}>
              <ExternalLink size={14} color="#2563EB" />
              <Text style={styles.actionText}>View</Text>
            </Pressable>
            <Pressable
              style={[styles.action, item.forked_to_step_id ? styles.actionDisabled : null]}
              onPress={() => void onFork(item)}
              disabled={Boolean(item.forked_to_step_id)}
            >
              <GitFork size={14} color={item.forked_to_step_id ? '#9CA3AF' : '#16A34A'} />
              <Text style={[styles.actionText, item.forked_to_step_id ? styles.actionTextDisabled : null]}>
                {item.forked_to_step_id ? 'Forked' : 'Fork'}
              </Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => onComment(item)}>
              <MessageCircle size={14} color="#6B7280" />
              <Text style={styles.actionText}>Comment</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  emptyBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  cardUnread: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  headerCopy: {
    flex: 1,
  },
  sender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  timestamp: {
    fontSize: 11,
    color: '#6B7280',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  title: {
    fontSize: 18,
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    color: '#111827',
  },
  body: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  forkedNote: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  forkedNoteText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  actionTextDisabled: {
    color: '#9CA3AF',
  },
});
