/**
 * NotificationsInboxSheet — Section F / Frame 17.
 *
 * Bottom sheet that wraps the existing <NotificationsList />. Owns
 * the useNotifications() call so the canvas bell + the sheet share
 * one source of truth (the bell reads from the same hook for its
 * unread badge).
 *
 * The lock-screen stack (Frame 18) is iOS-native — it's a system
 * push-notification cluster that the app doesn't draw itself.
 * PushNotificationService already configures rich push payloads
 * so iOS groups them naturally; nothing to build here for that.
 */

import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationsList } from '@/components/social/NotificationsList';

interface NotificationsInboxSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

export function NotificationsInboxSheet({
  visible,
  onDismiss,
}: NotificationsInboxSheetProps) {
  const {
    rawNotifications,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onDismiss} />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>Notifications</Text>
                {unreadCount > 0 ? (
                  <Text style={styles.unreadHint}>
                    {unreadCount === 1 ? '1 unread' : `${unreadCount} unread`}
                  </Text>
                ) : null}
              </View>
              <View style={styles.headerActions}>
                {unreadCount > 0 ? (
                  <Pressable
                    onPress={() => markAllAsRead().catch(() => {})}
                    hitSlop={6}
                    style={styles.markAllBtn}
                  >
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={onDismiss}
                  hitSlop={8}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeText}>Done</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.listHost}>
              {rawNotifications.length === 0 && !isLoading ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="notifications-outline"
                      size={28}
                      color={IOS_REGISTER.labelTertiary}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>You're all caught up</Text>
                  <Text style={styles.emptyText}>
                    Mentor messages, blueprint updates, and fleet activity
                    land here when they happen.
                  </Text>
                </View>
              ) : (
                <NotificationsList
                  notifications={rawNotifications}
                  isLoading={isLoading}
                  onLoadMore={loadMore}
                  isLoadingMore={isLoadingMore}
                  hasMore={hasMore}
                  onRefresh={async () => {
                    await refresh();
                  }}
                  onMarkRead={(id) => {
                    markAsRead(id).catch(() => {});
                  }}
                  onDelete={(id) => {
                    deleteNotification(id).catch(() => {});
                  }}
                />
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  backdropTap: { flex: 1 },
  sheetWrap: {
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: '85%',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 0 : 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separatorStrong,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  titleBlock: { flex: 1 },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  unreadHint: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  markAllText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.accentUserAction,
  },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
  listHost: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  emptyText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
