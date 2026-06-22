/**
 * MessagingService
 *
 * Handles coach-sailor messaging: conversations, messages, read receipts,
 * and real-time subscription helpers.
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('MessagingService');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageType = 'text' | 'session_note' | 'debrief_share' | 'schedule_request' | 'system';

export interface CoachingMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  metadata: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

export interface CoachingConversation {
  id: string;
  coach_id: string;
  sailor_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  coach_unread_count: number;
  sailor_unread_count: number;
  created_at: string;
  /** Joined data — the other party's profile */
  other_user?: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class MessagingService {
  // -----------------------------------------------------------------------
  // getOrCreateConversation
  // -----------------------------------------------------------------------

  /**
   * Find an existing conversation between two users, or create one.
   * Returns the conversation id.
   */
  async getOrCreateConversation(coachId: string, sailorId: string): Promise<string> {
    // Try to find existing
    const { data: existing } = await supabase
      .from('coaching_conversations')
      .select('id')
      .eq('coach_id', coachId)
      .eq('sailor_id', sailorId)
      .maybeSingle();

    if (existing) return existing.id;

    // Create new
    const { data: created, error } = await supabase
      .from('coaching_conversations')
      .insert({ coach_id: coachId, sailor_id: sailorId })
      .select('id')
      .single();

    if (error) {
      // Race condition: another insert beat us — try select again
      if (error.code === '23505') {
        const { data: retry } = await supabase
          .from('coaching_conversations')
          .select('id')
          .eq('coach_id', coachId)
          .eq('sailor_id', sailorId)
          .single();
        if (retry) return retry.id;
      }
      throw error;
    }

    return created.id;
  }

  // -----------------------------------------------------------------------
  // getConversations
  // -----------------------------------------------------------------------

  /**
   * Return all conversations for a user with the other party's profile info,
   * ordered by most recent message.
   */
  async getConversations(userId: string): Promise<CoachingConversation[]> {
    const { data, error } = await supabase
      .from('coaching_conversations')
      .select(`
        *,
        coach_user:users!coaching_conversations_coach_id_fkey(id, full_name, email, avatar_url),
        sailor_user:users!coaching_conversations_sailor_id_fkey(id, full_name, email, avatar_url)
      `)
      .or(`coach_id.eq.${userId},sailor_id.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw error;

    // Flatten: attach the *other* user's profile as `other_user`
    return (data || []).map((c: any) => {
      const isCoach = c.coach_id === userId;
      const other = isCoach ? c.sailor_user : c.coach_user;
      return {
        id: c.id,
        coach_id: c.coach_id,
        sailor_id: c.sailor_id,
        last_message_at: c.last_message_at,
        last_message_preview: c.last_message_preview,
        coach_unread_count: c.coach_unread_count,
        sailor_unread_count: c.sailor_unread_count,
        created_at: c.created_at,
        other_user: other
          ? { id: other.id, full_name: other.full_name, email: other.email, avatar_url: other.avatar_url }
          : undefined,
      } as CoachingConversation;
    });
  }

  // -----------------------------------------------------------------------
  // getMessages
  // -----------------------------------------------------------------------

  /**
   * Paginated messages for a conversation, newest first.
   * Pass `before` (ISO timestamp) for cursor-based pagination.
   */
  async getMessages(
    conversationId: string,
    limit = 50,
    before?: string
  ): Promise<CoachingMessage[]> {
    let query = supabase
      .from('coaching_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CoachingMessage[];
  }

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------

  /**
   * Send a message in a conversation.
   * Updates conversation metadata (last_message_at, preview, unread counts).
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    messageType: MessageType = 'text',
    metadata: Record<string, any> = {}
  ): Promise<CoachingMessage> {
    // Insert the message
    const { data: message, error: msgError } = await supabase
      .from('coaching_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        message_type: messageType,
        metadata,
      })
      .select('*')
      .single();

    if (msgError) throw msgError;

    // Atomically update conversation metadata and increment the recipient's unread count
    const preview = content.length > 100 ? content.slice(0, 100) : content;
    await supabase.rpc('increment_unread_count', {
      p_conversation_id: conversationId,
      p_sender_id: senderId,
      p_last_message_at: message.created_at,
      p_last_message_preview: preview,
    });

    // Send push notification to the recipient (skip for system messages to avoid double-alerts)
    if (messageType !== 'system') {
      this.sendMessagePushNotification(conversationId, senderId, preview).catch(() => {});
    }

    return message as CoachingMessage;
  }

  // -----------------------------------------------------------------------
  // Push notification helper for messages
  // -----------------------------------------------------------------------

  private async sendMessagePushNotification(
    conversationId: string,
    senderId: string,
    preview: string
  ): Promise<void> {
    try {
      // Get conversation to determine recipient
      const { data: convo } = await supabase
        .from('coaching_conversations')
        .select('coach_id, sailor_id')
        .eq('id', conversationId)
        .single();

      if (!convo) return;

      const recipientId = senderId === convo.coach_id ? convo.sailor_id : convo.coach_id;

      // Get sender name
      const { data: senderProfile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', senderId)
        .single();

      const senderName = senderProfile?.full_name || 'Someone';
      const truncatedPreview = preview.length > 80 ? preview.slice(0, 80) + '…' : preview;

      const { PushNotificationService } = await import('./PushNotificationService');
      await PushNotificationService.sendPushNotification(
        recipientId,
        `Message from ${senderName}`,
        truncatedPreview,
        {
          type: 'new_message',
          route: `/coach/conversation/${conversationId}`,
          conversation_id: conversationId,
          sender_id: senderId,
        },
        'messages'
      );
    } catch (error) {
      // Non-fatal — don't let push failure break messaging
      logger.error('[MessagingService] Push notification error:', error);
    }
  }

  // -----------------------------------------------------------------------
  // markConversationRead
  // -----------------------------------------------------------------------

  /**
   * Mark all messages from the other party as read and reset the user's
   * unread count to 0.
   */
  async markConversationRead(conversationId: string, userId: string): Promise<void> {
    // Fetch conversation to determine role
    const { data: convo } = await supabase
      .from('coaching_conversations')
      .select('coach_id, sailor_id')
      .eq('id', conversationId)
      .single();

    if (!convo) return;

    const isCoach = userId === convo.coach_id;
    const otherUserId = isCoach ? convo.sailor_id : convo.coach_id;

    // Set read_at on unread messages sent by the other party
    const { error: messagesError } = await supabase
      .from('coaching_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_id', otherUserId)
      .is('read_at', null);
    if (messagesError) throw messagesError;

    // Reset the user's unread counter
    const { data: updatedConversation, error: conversationError } = await supabase
      .from('coaching_conversations')
      .update(isCoach ? { coach_unread_count: 0 } : { sailor_unread_count: 0 })
      .eq('id', conversationId)
      .select('id')
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!updatedConversation) throw new Error('Conversation not found.');
  }

  // -----------------------------------------------------------------------
  // getUnreadCount
  // -----------------------------------------------------------------------

  /**
   * Total unread message count across all conversations for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('coaching_conversations')
      .select('coach_id, sailor_id, coach_unread_count, sailor_unread_count')
      .or(`coach_id.eq.${userId},sailor_id.eq.${userId}`);

    if (error) throw error;

    return (data || []).reduce((total, c) => {
      const isCoach = c.coach_id === userId;
      return total + (isCoach ? c.coach_unread_count : c.sailor_unread_count);
    }, 0);
  }

  // -----------------------------------------------------------------------
  // sendSystemMessage (helper)
  // -----------------------------------------------------------------------

  /**
   * Convenience method to send a system-type message in a conversation.
   * Creates the conversation if it doesn't exist.
   */
  async sendSystemMessage(
    coachId: string,
    sailorId: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<CoachingMessage> {
    const conversationId = await this.getOrCreateConversation(coachId, sailorId);

    // System messages use a special sender — we use the coach_id but mark as 'system' type
    // so the UI renders them centered rather than as a chat bubble
    const { data: message, error } = await supabase
      .from('coaching_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: coachId, // attributed to coach for RLS but rendered as system
        content,
        message_type: 'system' as MessageType,
        metadata,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Update conversation preview without incrementing unread counts for system messages
    const preview = content.length > 100 ? content.slice(0, 100) : content;
    const { data: updatedConversation, error: updateError } = await supabase
      .from('coaching_conversations')
      .update({
        last_message_at: message.created_at,
        last_message_preview: preview,
      })
      .eq('id', conversationId)
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedConversation) throw new Error('Conversation not found.');

    return message as CoachingMessage;
  }
}

// Export singleton
export const messagingService = new MessagingService();
