import { supabase } from './supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('RealtimeService');

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface RealtimeSubscriptionConfig {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  schema?: string;
  onStatus?: (status: string) => void;
}

class RealtimeService {
  private channels: Map<string, {
    channel: RealtimeChannel;
    callbacks: Set<(payload: RealtimePostgresChangesPayload<any>) => void>;
    statusCallbacks: Set<(status: string) => void>;
    configSignature: string;
  }> = new Map();
  private connectionStatus: ConnectionStatus = 'disconnected';
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private async safeRemoveChannel(channel: RealtimeChannel, context: string): Promise<boolean> {
    try {
      await supabase.removeChannel(channel);
      return true;
    } catch (error) {
      logger.error(`${context}:`, error);
      return false;
    }
  }

  private getConfigSignature(config: RealtimeSubscriptionConfig): string {
    return JSON.stringify({
      table: config.table,
      event: config.event || '*',
      schema: config.schema || 'public',
      filter: config.filter || '',
    });
  }

  private isMatchingTopic(topic: string, channelName: string): boolean {
    if (!topic) return false;
    return (
      topic === channelName ||
      topic.endsWith(`:${channelName}`) ||
      topic.endsWith(channelName)
    );
  }

  private findSupabaseChannels(channelName: string): RealtimeChannel[] {
    return supabase
      .getChannels()
      .filter((ch) => {
        const topic = (ch as unknown as { topic?: unknown }).topic;
        return this.isMatchingTopic(String(topic || ''), channelName);
      });
  }

  constructor() {
    // TEMPORARILY DISABLED for diagnostics - investigating memory crash
    // this.initializeConnectionMonitoring();
    logger.debug('Service initialized (connection monitoring disabled for diagnostics)');
  }

/**
   * Initialize connection monitoring
   * Note: Supabase v2+ monitors connection through individual channels
   */
  private initializeConnectionMonitoring() {
    // In Supabase v2+, connection status is monitored per-channel
    // The subscribe() method handles status updates via channel callbacks
    logger.debug('Connection monitoring initialized');
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect() {
    // If a reconnect is already scheduled, don't stack attempts due to multiple channel errors.
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.setConnectionStatus('disconnected');
      return;
    }

    this.setConnectionStatus('reconnecting');
    this.reconnectAttempts++;

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    logger.debug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      logger.debug('Attempting to reconnect...');
      // Resubscribe all channels
      void this.resubscribeAll();
    }, delay);
  }

  /**
   * Resubscribe all active channels
   */
  private async resubscribeAll() {
    const channelIds = Array.from(this.channels.keys());
    logger.debug(`Resubscribing ${channelIds.length} channels`);

    for (const channelId of channelIds) {
      const channelEntry = this.channels.get(channelId);
      if (channelEntry) {
        try {
          await channelEntry.channel.subscribe();
        } catch (error) {
          logger.error(`Failed to resubscribe channel ${channelId}:`, error);
        }
      }
    }
  }

  /**
   * Set connection status and notify listeners
   */
  private setConnectionStatus(status: ConnectionStatus) {
    if (this.connectionStatus === status) return;

    this.connectionStatus = status;
    logger.debug(`Connection status changed to: ${status}`);

    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        logger.error('Error notifying status listener:', error);
      }
    });
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    // Immediately notify with current status
    callback(this.connectionStatus);

    return () => {
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Subscribe to database changes
   */
  subscribe<T extends { [key: string]: any } = { [key: string]: any }>(
    channelName: string,
    config: RealtimeSubscriptionConfig,
    callback: (payload: RealtimePostgresChangesPayload<T>) => void
  ): RealtimeChannel {
    const configSignature = this.getConfigSignature(config);

    // Check if channel already exists in our map
    const existingEntry = this.channels.get(channelName);
    if (existingEntry) {
      // Defensive: if same channel name is reused with a different query config,
      // tear down and recreate so listeners receive the intended event stream.
      if (existingEntry.configSignature !== configSignature) {
        logger.warn(`Channel config changed, recreating channel: ${channelName}`);
        void this.safeRemoveChannel(existingEntry.channel, `Failed removing channel ${channelName} during config change`);
        this.channels.delete(channelName);
      } else {
        logger.debug(`Reusing existing channel: ${channelName}`);
        existingEntry.callbacks.add(callback as (payload: RealtimePostgresChangesPayload<any>) => void);
        if (config.onStatus) {
          existingEntry.statusCallbacks.add(config.onStatus);
        }
        return existingEntry.channel;
      }
    }

    // Check if Supabase already has this channel and remove it
    const existingChannels = this.findSupabaseChannels(channelName);
    if (existingChannels.length > 0) {
      logger.debug(`Removing ${existingChannels.length} stale Supabase channel(s): ${channelName}`);
      existingChannels.forEach((existingChannel) => {
        void this.safeRemoveChannel(existingChannel, `Failed removing stale channel ${channelName}`);
      });
    }

    logger.debug(`Creating subscription: ${channelName}`);

    const callbacks = new Set<(payload: RealtimePostgresChangesPayload<any>) => void>();
    callbacks.add(callback as (payload: RealtimePostgresChangesPayload<any>) => void);
    const statusCallbacks = new Set<(status: string) => void>();
    if (config.onStatus) {
      statusCallbacks.add(config.onStatus);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event: config.event || '*',
          schema: config.schema || 'public',
          table: config.table,
          filter: config.filter,
        },
        (payload) => {
          logger.debug(`${channelName} event received`);
          const channelEntry = this.channels.get(channelName);
          if (!channelEntry) return;
          channelEntry.callbacks.forEach((cb) => {
            try {
              cb(payload as unknown as RealtimePostgresChangesPayload<any>);
            } catch (error) {
              logger.error(`Error in ${channelName} callback:`, error);
            }
          });
        }
      )
      .subscribe((status) => {
        logger.debug(`${channelName} subscription status: ${status}`);
        const channelEntry = this.channels.get(channelName);
        channelEntry?.statusCallbacks.forEach((cb) => {
          try {
            cb(status);
          } catch (error) {
            logger.error(`Error in ${channelName} status callback:`, error);
          }
        });
        if (status === 'SUBSCRIBED') {
          this.reconnectAttempts = 0;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.setConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.setConnectionStatus('reconnecting');
          this.attemptReconnect();
        } else if (status === 'CLOSED') {
          if (this.channels.size > 0) {
            this.setConnectionStatus('reconnecting');
            this.attemptReconnect();
          } else {
            this.setConnectionStatus('disconnected');
          }
        }
      });

    this.channels.set(channelName, {
      channel,
      callbacks,
      statusCallbacks,
      configSignature,
    });
    return channel;
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(
    channelName: string,
    callback?: (payload: RealtimePostgresChangesPayload<any>) => void,
    statusCallback?: (status: string) => void
  ): Promise<void> {
    const channelEntry = this.channels.get(channelName);
    if (!channelEntry) {
      logger.debug(`Channel ${channelName} already unsubscribed`);
      return;
    }

    if (callback) {
      channelEntry.callbacks.delete(callback);
    } else {
      // Backward-compatible behavior: no callback means remove the full channel.
      channelEntry.callbacks.clear();
    }
    if (statusCallback) {
      channelEntry.statusCallbacks.delete(statusCallback);
    } else if (!callback) {
      channelEntry.statusCallbacks.clear();
    }

    if (channelEntry.callbacks.size > 0) {
      logger.debug(`Retaining channel ${channelName} (${channelEntry.callbacks.size} callback(s) remaining)`);
      return;
    }

    logger.debug(`Unsubscribing from: ${channelName}`);
    try {
      await this.safeRemoveChannel(channelEntry.channel, `Failed removing channel ${channelName}`);
    } finally {
      // Always clear registry entry even if Supabase removal fails to avoid callback leaks.
      this.channels.delete(channelName);
      if (this.channels.size === 0) {
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.setConnectionStatus('disconnected');
      }
    }

    // Defensive cleanup: remove any stale duplicate channels with matching topic.
    const staleChannels = this.findSupabaseChannels(channelName);
    if (staleChannels.length > 0) {
      logger.debug(`Removing ${staleChannels.length} duplicate stale channel(s): ${channelName}`);
      await Promise.allSettled(
        staleChannels.map((channel) =>
          this.safeRemoveChannel(channel, `Failed removing duplicate stale channel ${channelName}`)
        )
      );
    }
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribeAll(): Promise<void> {
    logger.debug(`Unsubscribing from all ${this.channels.size} channels`);

    const unsubscribePromises = Array.from(this.channels.keys()).map(
      channelName => this.unsubscribe(channelName)
    );

    await Promise.allSettled(unsubscribePromises);
  }

  /**
   * Manually trigger reconnection
   */
  forceReconnect(): void {
    logger.debug('Forcing reconnection');
    this.reconnectAttempts = 0;
    this.attemptReconnect();
  }

  /**
   * Clean up all subscriptions and timers
   */
  async cleanup(): Promise<void> {
    logger.debug('Cleaning up service');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    await this.unsubscribeAll();
    this.statusListeners.clear();
    this.setConnectionStatus('disconnected');
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();

// Export helper function for creating unique channel names
export const createChannelName = (prefix: string, id?: string): string => {
  return id ? `${prefix}:${id}` : prefix;
};
