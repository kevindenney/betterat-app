/**
 * NotificationService
 *
 * Service for social notifications:
 * - Fetching notifications
 * - Marking as read
 * - Real-time subscription
 * - Notification preferences
 */

import { supabase } from '@/services/supabase';
import { realtimeService } from '@/services/RealtimeService';
import { createLogger } from '@/lib/utils/logger';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const logger = createLogger('NotificationService');

// =============================================================================
// TYPES
// =============================================================================

export type SocialNotificationType =
  | 'new_follower'
  | 'followed_user_race'
  | 'race_like'
  | 'race_comment'
  | 'race_comment_reply'
  | 'race_result_posted'
  | 'achievement_earned'
  | 'new_message'
  | 'thread_mention'
  | 'activity_comment'
  | 'org_membership_approved'
  | 'org_membership_rejected'
  | 'followed_user_step_completed'
  | 'step_collaborator_added'
  | 'org_invite_accepted'
  | 'org_invite_received'
  | 'blueprint_subscribed'
  | 'step_suggested'
  | 'step_reviewed'
  | 'cohort_discussion_post'
  | 'step_discussion_post';

export interface SocialNotification {
  id: string;
  type: SocialNotificationType;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
  // Related entities
  actorId?: string;
  actorName?: string;
  actorAvatarUrl?: string;
  actorAvatarEmoji?: string;
  actorAvatarColor?: string;
  regattaId?: string;
  regattaName?: string;
  commentId?: string;
  achievementId?: string;
  data?: Record<string, any>;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  newFollower: boolean;
  followedUserRace: boolean;
  raceLikes: boolean;
  raceComments: boolean;
  achievements: boolean;
  directMessages: boolean;
  groupMessages: boolean;
  quietHoursStart?: string | null; // HH:MM format
  quietHoursEnd?: string | null;
}

export interface NotificationStats {
  unreadCount: number;
  totalCount: number;
}

const CANONICAL_NOTIFICATION_TYPES: ReadonlySet<SocialNotificationType> = new Set([
  'new_follower',
  'followed_user_race',
  'race_like',
  'race_comment',
  'race_comment_reply',
  'race_result_posted',
  'achievement_earned',
  'new_message',
  'thread_mention',
  'activity_comment',
  'org_membership_approved',
  'org_membership_rejected',
  'org_invite_accepted',
  'org_invite_received',
  'step_collaborator_added',
  'blueprint_subscribed',
  'step_suggested',
  'step_reviewed',
  'cohort_discussion_post',
  'step_discussion_post',
]);

function normalizeMembershipDecisionType(
  rawType: string,
  data: Record<string, any> | null | undefined,
  title: string | null | undefined,
  body: string | null | undefined
): SocialNotificationType | null {
  const normalizedRaw = String(rawType || '').trim().toLowerCase();
  if (normalizedRaw !== 'org_membership_decision') return null;

  const decision = String(data?.decision || data?.membership_decision || '')
    .trim()
    .toLowerCase();
  if (decision === 'rejected' || decision === 'declined') return 'org_membership_rejected';
  if (decision === 'approved' || decision === 'accepted') return 'org_membership_approved';

  const signal = `${String(title || '')} ${String(body || '')}`.toLowerCase();
  if (
    signal.includes('not approved') ||
    signal.includes('rejected') ||
    signal.includes('declined')
  ) {
    return 'org_membership_rejected';
  }

  return 'org_membership_approved';
}

function normalizeNotificationType(
  rawType: string,
  data: Record<string, any> | null | undefined,
  title: string | null | undefined,
  body: string | null | undefined
): SocialNotificationType {
  const decisionType = normalizeMembershipDecisionType(rawType, data, title, body);
  if (decisionType) return decisionType;

  const normalizedRaw = String(rawType || '').trim().toLowerCase();
  if (CANONICAL_NOTIFICATION_TYPES.has(normalizedRaw as SocialNotificationType)) {
    return normalizedRaw as SocialNotificationType;
  }

  return 'activity_comment';
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class NotificationServiceClass {
  private realtimeChannel: RealtimeChannel | null = null;
  private realtimeUserId: string | null = null;
  private realtimeChannelName: string | null = null;
  private realtimeNotificationHandler: ((payload: RealtimePostgresChangesPayload<any>) => void) | null = null;
  private realtimeStatusHandler: ((status: string) => void) | null = null;
  private realtimeChannelRunId = 0;
  private recentlyDeliveredNotificationIds = new Set<string>();
  private recentlyDeliveredOrder: string[] = [];
  private listeners: Set<(notification: SocialNotification) => void> =
    new Set();

  private rememberDeliveredNotification(notificationId: string): void {
    if (!notificationId) return;
    if (this.recentlyDeliveredNotificationIds.has(notificationId)) return;
    this.recentlyDeliveredNotificationIds.add(notificationId);
    this.recentlyDeliveredOrder.push(notificationId);
    if (this.recentlyDeliveredOrder.length > 500) {
      const removed = this.recentlyDeliveredOrder.shift();
      if (removed) this.recentlyDeliveredNotificationIds.delete(removed);
    }
  }

  private resetDeliveredNotificationCache(): void {
    this.recentlyDeliveredNotificationIds.clear();
    this.recentlyDeliveredOrder = [];
  }

  private clearRealtimeSubscription(): void {
    if (
      this.realtimeChannelName &&
      this.realtimeNotificationHandler &&
      this.realtimeStatusHandler
    ) {
      void realtimeService.unsubscribe(
        this.realtimeChannelName,
        this.realtimeNotificationHandler,
        this.realtimeStatusHandler
      );
    } else if (this.realtimeChannelName) {
      void realtimeService.unsubscribe(this.realtimeChannelName);
    }

    this.realtimeChannel = null;
    this.realtimeChannelName = null;
    this.realtimeNotificationHandler = null;
    this.realtimeStatusHandler = null;
    this.realtimeUserId = null;
    this.realtimeChannelRunId += 1;
  }

  private async backfillNotificationsAfterReconnect(
    userId: string,
    channelRunId: number
  ): Promise<void> {
    if (!userId) return;
    if (this.realtimeChannelRunId !== channelRunId || this.realtimeUserId !== userId) return;
    if (this.listeners.size === 0) return;

    try {
      const { notifications } = await this.getNotifications(userId, {
        limit: 25,
        offset: 0,
      });
      if (this.realtimeChannelRunId !== channelRunId || this.realtimeUserId !== userId) return;
      if (!Array.isArray(notifications) || notifications.length === 0) return;

      const missing = notifications.filter(
        (notification) => !this.recentlyDeliveredNotificationIds.has(notification.id)
      );
      if (missing.length === 0) return;

      const ordered = [...missing].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return aTime - bTime;
      });

      for (const notification of ordered) {
        this.rememberDeliveredNotification(notification.id);
        this.listeners.forEach((listener) => {
          try {
            listener(notification);
          } catch (error) {
            logger.error('Error in notification listener during reconnect backfill', { error });
          }
        });
      }
    } catch (error) {
      logger.warn('Notification reconnect backfill failed', { userId, error });
    }
  }

  // ===========================================================================
  // NOTIFICATIONS CRUD
  // ===========================================================================

  /**
   * Get notifications for a user (paginated)
   */
  async getNotifications(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      types?: SocialNotificationType[];
    }
  ): Promise<{ notifications: SocialNotification[]; hasMore: boolean }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = supabase
      .from('social_notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (options?.types && options.types.length > 0) {
      query = query.in('type', options.types);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to get notifications', { userId, error });
      throw error;
    }

    if (!data || data.length === 0) {
      return { notifications: [], hasMore: false };
    }

    // Fetch actor info
    const actorIds = [
      ...new Set(data.map((n: any) => n.actor_id).filter(Boolean)),
    ];
    let actorMap = new Map<
      string,
      { name: string; avatarUrl?: string; avatarEmoji?: string; avatarColor?: string }
    >();

    if (actorIds.length > 0) {
      // Fetch from users table (includes avatar_url)
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .in('id', actorIds);

      const { data: sailorProfiles } = await supabase
        .from('sailor_profiles')
        .select('user_id, avatar_emoji, avatar_color')
        .in('user_id', actorIds);

      const usersMap = new Map((users || []).map((u: any) => [u.id, u]));
      const sailorProfilesMap = new Map(
        (sailorProfiles || []).map((sp: any) => [sp.user_id, sp])
      );

      actorIds.forEach((id) => {
        const sailorProfile = sailorProfilesMap.get(id);
        const user = usersMap.get(id);
        actorMap.set(id, {
          name: user?.full_name || 'Sailor',
          avatarUrl: user?.avatar_url,
          avatarEmoji: sailorProfile?.avatar_emoji,
          avatarColor: sailorProfile?.avatar_color,
        });
      });
    }

    // Fetch regatta names
    const regattaIds = [
      ...new Set(data.map((n: any) => n.regatta_id).filter(Boolean)),
    ];
    let regattaMap = new Map<string, string>();

    if (regattaIds.length > 0) {
      const { data: regattas } = await supabase
        .from('regattas')
        .select('id, name')
        .in('id', regattaIds);

      regattaMap = new Map((regattas || []).map((r: any) => [r.id, r.name]));
    }

    const notifications: SocialNotification[] = data.map((n: any) => {
      const actor = n.actor_id ? actorMap.get(n.actor_id) : undefined;
      const normalizedType = normalizeNotificationType(
        String(n.type || ''),
        (n.data || null) as Record<string, any> | null,
        n.title || null,
        n.body || null
      );

      return {
        id: n.id,
        type: normalizedType,
        title: n.title,
        body: n.body,
        isRead: n.is_read,
        createdAt: n.created_at,
        actorId: n.actor_id,
        actorName: actor?.name,
        actorAvatarUrl: actor?.avatarUrl,
        actorAvatarEmoji: actor?.avatarEmoji,
        actorAvatarColor: actor?.avatarColor,
        regattaId: n.regatta_id,
        regattaName: n.regatta_id ? regattaMap.get(n.regatta_id) : undefined,
        commentId: n.comment_id,
        achievementId: n.achievement_id,
        data: n.data,
      };
    });

    return {
      notifications,
      hasMore: count !== null ? offset + limit < count : false,
    };
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('social_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      logger.warn('Error getting unread count', { userId, error });
      return 0;
    }

    return count || 0;
  }

  /**
   * Get notification stats
   */
  async getStats(userId: string): Promise<NotificationStats> {
    const [unreadResult, totalResult] = await Promise.all([
      supabase
        .from('social_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false),
      supabase
        .from('social_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    return {
      unreadCount: unreadResult.count || 0,
      totalCount: totalResult.count || 0,
    };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const { data, error } = await supabase
      .from('social_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to mark notification as read', {
        userId,
        notificationId,
        error,
      });
      throw error;
    }
    if (!data) {
      throw new Error('Notification not found.');
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('social_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      logger.error('Failed to mark all notifications as read', {
        userId,
        error,
      });
      throw error;
    }

    logger.info('Marked all notifications as read', { userId });
  }

  async markManyAsRead(userId: string, notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;
    const { error } = await supabase
      .from('social_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .in('id', notificationIds);

    if (error) {
      logger.error('Failed to mark notifications as read', {
        userId,
        count: notificationIds.length,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    userId: string,
    notificationId: string
  ): Promise<void> {
    const { data, error } = await supabase
      .from('social_notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to delete notification', {
        userId,
        notificationId,
        error,
      });
      throw error;
    }
    if (!data) {
      throw new Error('Notification not found.');
    }
  }

  /**
   * Delete all notifications
   */
  async deleteAllNotifications(userId: string): Promise<void> {
    const { error } = await supabase
      .from('social_notifications')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete all notifications', { userId, error });
      throw error;
    }

    logger.info('Deleted all notifications', { userId });
  }

  // ===========================================================================
  // NOTIFICATION PREFERENCES
  // ===========================================================================

  /**
   * Get notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.warn('Error getting preferences', { userId, error });
    }

    // Return defaults if no preferences exist
    if (!data) {
      return {
        pushEnabled: true,
        emailEnabled: false,
        newFollower: true,
        followedUserRace: true,
        raceLikes: true,
        raceComments: true,
        achievements: true,
        directMessages: true,
        groupMessages: true,
      };
    }

    return {
      pushEnabled: data.push_enabled ?? true,
      emailEnabled: data.email_enabled ?? false,
      newFollower: data.new_follower ?? true,
      followedUserRace: data.followed_user_race ?? true,
      raceLikes: data.race_likes ?? true,
      raceComments: data.race_comments ?? true,
      achievements: data.achievements ?? true,
      directMessages: data.direct_messages ?? true,
      groupMessages: data.group_messages ?? true,
      quietHoursStart: data.quiet_hours_start ?? null,
      quietHoursEnd: data.quiet_hours_end ?? null,
    };
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    const updates: Record<string, any> = { user_id: userId };

    if (preferences.pushEnabled !== undefined) {
      updates.push_enabled = preferences.pushEnabled;
    }
    if (preferences.emailEnabled !== undefined) {
      updates.email_enabled = preferences.emailEnabled;
    }
    if (preferences.newFollower !== undefined) {
      updates.new_follower = preferences.newFollower;
    }
    if (preferences.followedUserRace !== undefined) {
      updates.followed_user_race = preferences.followedUserRace;
    }
    if (preferences.raceLikes !== undefined) {
      updates.race_likes = preferences.raceLikes;
    }
    if (preferences.raceComments !== undefined) {
      updates.race_comments = preferences.raceComments;
    }
    if (preferences.achievements !== undefined) {
      updates.achievements = preferences.achievements;
    }
    if (preferences.directMessages !== undefined) {
      updates.direct_messages = preferences.directMessages;
    }
    if (preferences.groupMessages !== undefined) {
      updates.group_messages = preferences.groupMessages;
    }
    if (preferences.quietHoursStart !== undefined) {
      updates.quiet_hours_start = preferences.quietHoursStart;
    }
    if (preferences.quietHoursEnd !== undefined) {
      updates.quiet_hours_end = preferences.quietHoursEnd;
    }

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(updates, { onConflict: 'user_id' });

    if (error) {
      logger.error('Failed to update preferences', { userId, error });
      throw error;
    }

    logger.info('Updated notification preferences', { userId });
  }

  // ===========================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ===========================================================================

  /**
   * Subscribe to real-time notifications for a user
   */
  subscribeToNotifications(
    userId: string,
    callback: (notification: SocialNotification) => void
  ): () => void {
    logger.info('Subscribing to notifications', { userId });

    // Add listener
    this.listeners.add(callback);

    // If the active realtime channel is bound to a different user,
    // rotate it to avoid cross-account notification streams.
    if (this.realtimeChannel && this.realtimeUserId && this.realtimeUserId !== userId) {
      this.clearRealtimeSubscription();
      this.resetDeliveredNotificationCache();
    }

    // Set up Supabase realtime channel if not already done
    if (!this.realtimeChannel) {
      const channelRunId = ++this.realtimeChannelRunId;
      const channelUserId = userId;
      const channelName = `notifications:${userId}`;
      this.realtimeUserId = userId;
      this.realtimeChannelName = channelName;

      const handleNotificationInsert = async (payload: RealtimePostgresChangesPayload<any>) => {
        if (
          this.realtimeChannelRunId !== channelRunId ||
          this.realtimeUserId !== channelUserId
        ) {
          return;
        }
        logger.info('Received realtime notification', { payload });

        const n = payload.new as any;

        // Fetch actor info
        let actorInfo: {
          name?: string;
          avatarEmoji?: string;
          avatarColor?: string;
        } = {};
        if (n.actor_id) {
          const [{ data: profile }, { data: userProfile }, { data: sailorProfile }] =
            await Promise.all([
              supabase
                .from('profiles')
                .select('full_name')
                .eq('id', n.actor_id)
                .maybeSingle(),
              supabase
                .from('users')
                .select('full_name,email')
                .eq('id', n.actor_id)
                .maybeSingle(),
              supabase
                .from('sailor_profiles')
                .select('avatar_emoji, avatar_color')
                .eq('user_id', n.actor_id)
                .maybeSingle(),
            ]);

          actorInfo = {
            name: profile?.full_name || userProfile?.full_name || userProfile?.email || 'User',
            avatarEmoji: sailorProfile?.avatar_emoji,
            avatarColor: sailorProfile?.avatar_color,
          };
        }

        const notification: SocialNotification = {
          id: n.id,
          type: normalizeNotificationType(
            String(n.type || ''),
            (n.data || null) as Record<string, any> | null,
            n.title || null,
            n.body || null
          ),
          title: n.title,
          body: n.body,
          isRead: n.is_read,
          createdAt: n.created_at,
          actorId: n.actor_id,
          actorName: actorInfo.name,
          actorAvatarEmoji: actorInfo.avatarEmoji,
          actorAvatarColor: actorInfo.avatarColor,
          regattaId: n.regatta_id,
          commentId: n.comment_id,
          achievementId: n.achievement_id,
          data: n.data,
        };

        // Notify all listeners
        if (
          this.realtimeChannelRunId !== channelRunId ||
          this.realtimeUserId !== channelUserId
        ) {
          return;
        }
        this.rememberDeliveredNotification(notification.id);
        this.listeners.forEach((listener) => {
          try {
            listener(notification);
          } catch (e) {
            logger.error('Error in notification listener', { error: e });
          }
        });
      };
      const handleRealtimeStatus = (status: string) => {
        if (
          this.realtimeChannelRunId !== channelRunId ||
          this.realtimeUserId !== channelUserId
        ) {
          return;
        }

        if (status === 'SUBSCRIBED') {
          void this.backfillNotificationsAfterReconnect(channelUserId, channelRunId);
        }
      };

      this.realtimeNotificationHandler = handleNotificationInsert;
      this.realtimeStatusHandler = handleRealtimeStatus;
      this.realtimeChannel = realtimeService.subscribe(
        channelName,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'social_notifications',
          filter: `user_id=eq.${userId}`,
          onStatus: handleRealtimeStatus,
        },
        handleNotificationInsert
      );
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);

      // Unsubscribe from realtime if no more listeners
      if (this.listeners.size === 0 && this.realtimeChannel) {
        this.clearRealtimeSubscription();
        this.resetDeliveredNotificationCache();
      }
    };
  }

  /**
   * Unsubscribe from all notifications
   */
  unsubscribeAll(): void {
    this.listeners.clear();
    if (this.realtimeChannel) {
      this.clearRealtimeSubscription();
    }
    this.resetDeliveredNotificationCache();
    logger.info('Unsubscribed from all notifications');
  }

  // ===========================================================================
  // MANUAL NOTIFICATION CREATION
  // ===========================================================================

  /**
   * Create a custom notification (for testing or manual triggers)
   */
  async createNotification(
    userId: string,
    notification: {
      type: SocialNotificationType;
      title: string;
      body?: string;
      actorId?: string;
      regattaId?: string;
      commentId?: string;
      achievementId?: string;
      data?: Record<string, any>;
    }
  ): Promise<string> {
    // Use SECURITY DEFINER RPC to bypass RLS — authenticated users
    // need to create notifications for other users (e.g., invite notifications).
    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: notification.type,
      p_title: notification.title,
      p_body: notification.body || null,
      p_actor_id: notification.actorId || null,
      p_data: notification.data || null,
    });

    if (error) {
      logger.error('Failed to create notification', { userId, error });
      throw error;
    }

    return data as string;
  }

  /**
   * Notify a platform user that they were added as a collaborator on a step.
   */
  async notifyStepCollaboratorAdded(input: {
    targetUserId: string;
    actorId: string;
    actorName: string;
    stepId: string;
    stepTitle: string;
  }): Promise<string> {
    return this.createNotification(input.targetUserId, {
      type: 'step_collaborator_added',
      title: 'Added as collaborator',
      body: `${input.actorName} added you as a collaborator on "${input.stepTitle}"`,
      actorId: input.actorId,
      data: { step_id: input.stepId },
    });
  }

  /**
   * Notify a blueprint owner that someone subscribed to their blueprint.
   */
  async notifyBlueprintSubscribed(input: {
    blueprintOwnerId: string;
    subscriberId: string;
    subscriberName: string;
    blueprintId: string;
    blueprintTitle: string;
  }): Promise<string> {
    return this.createNotification(input.blueprintOwnerId, {
      type: 'blueprint_subscribed',
      title: 'New blueprint subscriber',
      body: `${input.subscriberName} subscribed to "${input.blueprintTitle}"`,
      actorId: input.subscriberId,
      data: { blueprint_id: input.blueprintId, blueprint_title: input.blueprintTitle },
    });
  }

  /**
   * Notify a user that their org membership request was approved/rejected.
   * Uses a SECURITY DEFINER RPC so authenticated org admins/managers can trigger this safely.
   */
  async notifyOrgMembershipDecision(input: {
    targetUserId: string;
    organizationId: string;
    organizationName: string;
    decision: 'approved' | 'rejected';
  }): Promise<string> {
    const { data, error } = await supabase.rpc('notify_org_membership_decision', {
      p_target_user_id: input.targetUserId,
      p_organization_id: input.organizationId,
      p_organization_name: input.organizationName,
      p_decision: input.decision,
    });

    if (error) {
      logger.warn('Failed to notify org membership decision', { input, error });
      throw error;
    }

    return String(data);
  }

  /**
   * Notify the inviter that someone accepted their organization invite.
   */
  async notifyOrgInviteAccepted(input: {
    inviterId: string;
    accepterName: string;
    accepterId: string;
    organizationId: string;
    organizationName: string;
    roleLabel: string;
  }): Promise<string> {
    return this.createNotification(input.inviterId, {
      type: 'org_invite_accepted',
      title: 'Invite accepted',
      body: `${input.accepterName} accepted your invite to ${input.organizationName} as ${input.roleLabel}`,
      actorId: input.accepterId,
      data: {
        organization_id: input.organizationId,
        organization_name: input.organizationName,
        role_label: input.roleLabel,
      },
    });
  }

  /**
   * Notify a mentee that their step was reviewed by the blueprint author.
   * This triggers a cache invalidation on the mentee side so the feedback
   * appears in real time.
   */
  async notifyStepReviewed(input: {
    targetUserId: string;
    actorId: string;
    actorName: string;
    stepId: string;
    stepTitle: string;
    reviewStatus: 'approved' | 'needs_revision';
  }): Promise<string> {
    const verb = input.reviewStatus === 'approved' ? 'approved' : 'requested changes on';
    return this.createNotification(input.targetUserId, {
      type: 'step_reviewed',
      title: 'Step reviewed',
      body: `${input.actorName} ${verb} "${input.stepTitle}"`,
      actorId: input.actorId,
      data: {
        step_id: input.stepId,
        step_title: input.stepTitle,
        review_status: input.reviewStatus,
      },
    });
  }

  /**
   * Get suggestions sent by a specific actor to a specific user.
   * Used by the mentor dashboard to show suggestion history.
   */
  async getSentSuggestions(
    actorId: string,
    targetUserId: string,
  ): Promise<{
    id: string;
    stepTitle: string;
    stepDescription: string | null;
    isRead: boolean;
    createdAt: string;
  }[]> {
    const { data, error } = await supabase
      .from('social_notifications')
      .select('id, data, is_read, created_at')
      .eq('type', 'step_suggested')
      .eq('actor_id', actorId)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      stepTitle: row.data?.step_title || 'Untitled',
      stepDescription: row.data?.step_description || null,
      isRead: row.is_read,
      createdAt: row.created_at,
    }));
  }

  /**
   * Notify a user that they've been invited to an organization (if they have an account).
   */
  async notifyOrgInviteReceived(input: {
    targetUserId: string;
    inviterName: string;
    inviterId: string;
    organizationId: string;
    organizationName: string;
    roleLabel: string;
    inviteToken: string;
  }): Promise<string> {
    return this.createNotification(input.targetUserId, {
      type: 'org_invite_received',
      title: 'Organization invite',
      body: `${input.inviterName} invited you to join ${input.organizationName} as ${input.roleLabel}`,
      actorId: input.inviterId,
      data: {
        organization_id: input.organizationId,
        organization_name: input.organizationName,
        role_label: input.roleLabel,
        invite_token: input.inviteToken,
      },
    });
  }
}

// Export singleton instance
export const NotificationService = new NotificationServiceClass();

// Export type for dependency injection
export type NotificationServiceType = typeof NotificationService;
