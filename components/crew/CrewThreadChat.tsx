/**
 * CrewThreadChat
 *
 * Full-screen chat interface for crew thread conversations.
 * Apple Messages-style chat with realtime updates.
 * Supports light and dark mode via useIOSColors hook.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import * as Haptics from 'expo-haptics';
import { ChatMessageSkeleton } from './MessagingSkeleton';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
} from '@/lib/design-tokens-ios';
import { useIOSColors } from '@/hooks/useIOSColors';
import type { CrewThreadMessage } from '@/services/CrewThreadService';

// =============================================================================
// TYPES
// =============================================================================

type IOSColorsType = typeof IOS_COLORS;

interface CrewThreadChatProps {
  messages: CrewThreadMessage[];
  currentUserId?: string;
  onSendMessage: (text: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  isSending?: boolean;
  isLoading?: boolean;
  threadName?: string;
  /** Whether there are more older messages to load */
  hasMore?: boolean;
  /** Whether older messages are currently being loaded */
  isLoadingMore?: boolean;
  /** Callback to load older messages */
  onLoadMore?: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  if (d.toDateString() === today) return 'Today';
  if (d.toDateString() === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function shouldShowDateHeader(
  messages: CrewThreadMessage[],
  index: number
): boolean {
  if (index === 0) return true;
  const curr = new Date(messages[index].createdAt).toDateString();
  const prev = new Date(messages[index - 1].createdAt).toDateString();
  return curr !== prev;
}

function getAvatarColor(userId: string): string {
  const colors = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#F97316',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

// =============================================================================
// MESSAGE BUBBLE
// =============================================================================

function SystemMessageRow({
  message,
  colors,
}: {
  message: CrewThreadMessage;
  colors: IOSColorsType;
}) {
  return (
    <View style={staticStyles.systemMessageRow}>
      <Text style={[staticStyles.systemMessageText, { color: colors.secondaryLabel }]}>
        {message.message}
      </Text>
      <Text style={[staticStyles.systemMessageTime, { color: colors.tertiaryLabel }]}>
        {formatMessageTime(message.createdAt)}
      </Text>
    </View>
  );
}

function MessageBubble({
  message,
  isOwnMessage,
  showAvatar,
  onDelete,
  colors,
}: {
  message: CrewThreadMessage;
  isOwnMessage: boolean;
  showAvatar: boolean;
  onDelete?: (messageId: string) => Promise<void>;
  colors: IOSColorsType;
}) {
  const initials = message.profile?.fullName
    ? message.profile.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : '??';

  const handleLongPress = () => {
    if (!isOwnMessage || !onDelete) return;
    // Haptic feedback on long press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showConfirm(
      'Delete Message',
      'Are you sure you want to delete this message?',
      () => {
        onDelete(message.id).catch(() => {
          showAlert('Error', 'Could not delete message.');
        });
      },
      { destructive: true }
    );
  };

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={[
        staticStyles.messageBubbleRow,
        isOwnMessage && staticStyles.messageBubbleRowOwn,
      ]}
    >
      {/* Avatar (only for others' messages, with spacing) */}
      {!isOwnMessage && showAvatar && (
        <View
          style={[
            staticStyles.bubbleAvatar,
            {
              backgroundColor:
                message.profile?.avatarColor || getAvatarColor(message.userId),
            },
          ]}
        >
          <Text style={staticStyles.bubbleAvatarText}>
            {message.profile?.avatarEmoji || initials}
          </Text>
        </View>
      )}
      {!isOwnMessage && !showAvatar && <View style={staticStyles.bubbleAvatarSpacer} />}

      <View style={{ flex: 1, maxWidth: '78%' }}>
        {/* Sender name (for others' messages, when avatar shown) */}
        {!isOwnMessage && showAvatar && (
          <Text style={[staticStyles.senderName, { color: colors.secondaryLabel }]}>
            {message.profile?.fullName || 'Unknown'}
          </Text>
        )}

        {/* Bubble */}
        <View
          style={[
            staticStyles.bubble,
            isOwnMessage
              ? [staticStyles.bubbleOwn, { backgroundColor: colors.systemBlue }]
              : [staticStyles.bubbleOther, { backgroundColor: colors.systemGray6 }],
          ]}
        >
          <Text
            style={[
              staticStyles.bubbleText,
              isOwnMessage
                ? staticStyles.bubbleTextOwn
                : { color: colors.label },
            ]}
          >
            {message.message}
          </Text>
        </View>

        {/* Timestamp */}
        <Text
          style={[
            staticStyles.bubbleTime,
            { color: colors.tertiaryLabel },
            isOwnMessage && staticStyles.bubbleTimeOwn,
          ]}
        >
          {formatMessageTime(message.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CrewThreadChat({
  messages,
  currentUserId,
  onSendMessage,
  onDeleteMessage,
  isSending = false,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: CrewThreadChatProps) {
  const colors = useIOSColors();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const isLoadingMoreRef = useRef(false);

  // Handle scroll to detect when user scrolls near the top
  const handleScroll = useCallback(
    (event: any) => {
      const { contentOffset } = event.nativeEvent;
      const distanceFromTop = contentOffset.y;

      // Load more when within 100px of the top
      if (
        distanceFromTop < 100 &&
        hasMore &&
        !isLoadingMoreRef.current &&
        onLoadMore
      ) {
        isLoadingMoreRef.current = true;
        onLoadMore();
      }
    },
    [hasMore, onLoadMore]
  );

  // Reset loading ref when isLoadingMore changes
  useEffect(() => {
    if (!isLoadingMore) {
      isLoadingMoreRef.current = false;
    }
  }, [isLoadingMore]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    // Light haptic feedback on send
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setInputText('');
    try {
      await onSendMessage(text);
    } catch {
      // Error haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Restore text on failure
      setInputText(text);
      showAlert(
        'Message not sent',
        'Could not deliver your message. Check your connection and try again.'
      );
    }
  }, [inputText, isSending, onSendMessage]);

  const renderMessage = useCallback(
    ({ item, index }: { item: CrewThreadMessage; index: number }) => {
      const isOwnMessage = item.userId === currentUserId;

      // Show avatar when sender differs from previous message
      const showAvatar =
        index === 0 ||
        messages[index - 1].userId !== item.userId ||
        messages[index - 1].messageType === 'system';

      if (item.messageType === 'system') {
        return <SystemMessageRow message={item} colors={colors} />;
      }

      return (
        <MessageBubble
          message={item}
          isOwnMessage={isOwnMessage}
          showAvatar={showAvatar}
          onDelete={onDeleteMessage}
          colors={colors}
        />
      );
    },
    [currentUserId, messages, onDeleteMessage, colors]
  );

  const renderDateHeader = useCallback(
    ({ item, index }: { item: CrewThreadMessage; index: number }) => {
      if (!shouldShowDateHeader(messages, index)) return null;
      return (
        <View style={staticStyles.dateHeader}>
          <Text style={[staticStyles.dateHeaderText, { color: colors.secondaryLabel }]}>
            {formatDateHeader(item.createdAt)}
          </Text>
        </View>
      );
    },
    [messages, colors]
  );

  const canSend = inputText.trim().length > 0 && !isSending;

  if (isLoading) {
    return (
      <View style={[staticStyles.loadingContainer, { backgroundColor: colors.systemBackground }]}>
        <ChatMessageSkeleton groups={2} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[staticStyles.container, { backgroundColor: colors.systemBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View>
            {renderDateHeader({ item, index })}
            {renderMessage({ item, index })}
          </View>
        )}
        contentContainerStyle={staticStyles.messageList}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        ListHeaderComponent={
          isLoadingMore ? (
            <View style={staticStyles.loadMoreContainer}>
              <ActivityIndicator size="small" color={colors.systemBlue} />
              <Text style={[staticStyles.loadMoreText, { color: colors.secondaryLabel }]}>
                Loading older messages...
              </Text>
            </View>
          ) : hasMore && messages.length > 0 ? (
            <Pressable
              style={staticStyles.loadMoreContainer}
              onPress={onLoadMore}
            >
              <Text style={[staticStyles.loadMoreButton, { color: colors.systemBlue }]}>
                Load older messages
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View style={staticStyles.emptyState}>
            <Text style={staticStyles.emptyEmoji}>💬</Text>
            <Text style={[staticStyles.emptyTitle, { color: colors.secondaryLabel }]}>
              No messages yet
            </Text>
            <Text style={[staticStyles.emptySubtitle, { color: colors.tertiaryLabel }]}>
              Start a conversation with your crew
            </Text>
          </View>
        }
      />

      {/* Composer */}
      <View
        style={[
          staticStyles.composerRow,
          {
            borderTopColor: colors.separator,
            backgroundColor: colors.systemBackground,
            paddingBottom: Math.max(insets.bottom, IOS_SPACING.sm),
          },
        ]}
      >
        <TextInput
          style={[
            staticStyles.composerInput,
            {
              backgroundColor: colors.systemGray6,
              color: colors.label,
            },
          ]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message your crew..."
          placeholderTextColor={colors.tertiaryLabel}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
        />
        {/* Static style array, not function form — Fabric drops the static
            circle styles from function-form Pressable styles (see
            feedback_pressable_margin_row_stripping). */}
        <Pressable
          style={[
            staticStyles.sendButton,
            { backgroundColor: canSend ? colors.systemBlue : colors.systemGray5 },
          ]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Send size={18} color={canSend ? '#FFFFFF' : colors.systemGray3} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// =============================================================================
// STATIC STYLES (non-color dependent)
// =============================================================================

const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    flexGrow: 1,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
  },
  loadMoreText: {
    ...IOS_TYPOGRAPHY.caption1,
  },
  loadMoreButton: {
    ...IOS_TYPOGRAPHY.subhead,
    fontWeight: '500',
  },

  // Date headers
  dateHeader: {
    alignItems: 'center',
    marginVertical: IOS_SPACING.md,
  },
  dateHeaderText: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '500',
  },

  // System messages
  systemMessageRow: {
    alignItems: 'center',
    marginVertical: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.xl,
  },
  systemMessageText: {
    ...IOS_TYPOGRAPHY.footnote,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  systemMessageTime: {
    ...IOS_TYPOGRAPHY.caption2,
    marginTop: 2,
  },

  // Message bubbles
  messageBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
    gap: IOS_SPACING.sm,
  },
  messageBubbleRowOwn: {
    flexDirection: 'row-reverse',
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleAvatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  bubbleAvatarSpacer: {
    width: 28,
  },
  senderName: {
    ...IOS_TYPOGRAPHY.caption2,
    fontWeight: '500',
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 18,
    maxWidth: '100%',
  },
  bubbleOwn: {
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  bubbleText: {
    ...IOS_TYPOGRAPHY.body,
    lineHeight: 20,
  },
  bubbleTextOwn: {
    color: '#FFFFFF',
  },
  bubbleTime: {
    ...IOS_TYPOGRAPHY.caption2,
    marginTop: 2,
    marginLeft: 4,
  },
  bubbleTimeOwn: {
    textAlign: 'right',
    marginRight: 4,
    marginLeft: 0,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IOS_SPACING.xxxxl,
    gap: IOS_SPACING.xs,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: IOS_SPACING.sm,
  },
  emptyTitle: {
    ...IOS_TYPOGRAPHY.headline,
  },
  emptySubtitle: {
    ...IOS_TYPOGRAPHY.subhead,
  },

  // Composer
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    borderRadius: 18,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    ...IOS_TYPOGRAPHY.body,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonPressed: {
    opacity: 0.8,
  },
});

export default CrewThreadChat;
