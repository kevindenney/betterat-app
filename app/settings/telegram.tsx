import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { IOSListSection } from '@/components/ui/ios/IOSListSection';
import { IOSListItem } from '@/components/ui/ios/IOSListItem';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('TelegramSettings');

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

// =============================================================================
// Types
// =============================================================================

interface TelegramLink {
  id: string;
  telegram_user_id: number;
  telegram_username: string | null;
  linked_at: string | null;
  is_active: boolean;
}

// =============================================================================
// Screen
// =============================================================================

export default function TelegramSettingsScreen(): React.ReactElement {
  const { user, session, ready } = useAuth();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();

  // Settings screens are pushed onto the root stack (headerShown:false), and
  // the native back button is unreliable when arriving via the Account modal
  // or a direct deep-link. Always render an explicit back affordance that
  // falls back to /settings so the user is never trapped.
  const headerLeft = useCallback(
    () => (
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <Ionicons name="chevron-back" size={26} color={IOS_COLORS.systemBlue} />
        <Text style={{ color: IOS_COLORS.systemBlue, fontSize: 17 }}>Settings</Text>
      </Pressable>
    ),
    [router],
  );

  const [link, setLink] = useState<TelegramLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);

  // ---------------------------------------------------------------------------
  // Load existing link
  // ---------------------------------------------------------------------------

  const loadLink = useCallback(async () => {
    // Spinner only while auth hydrates; effect re-runs on ready/user change.
    // Once ready with no user, stop loading instead of hanging.
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('telegram_links')
        .select('id, telegram_user_id, telegram_username, linked_at, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      setLink(data as TelegramLink | null);
    } catch (err) {
      logger.error('Failed to load telegram link', err);
    } finally {
      setLoading(false);
    }
  }, [user, ready]);

  useEffect(() => {
    loadLink();
  }, [loadLink]);

  // ---------------------------------------------------------------------------
  // Link with code
  // ---------------------------------------------------------------------------

  const handleLink = useCallback(async () => {
    if (!code) {
      showAlert('Error', 'No link code found.');
      return;
    }

    // Get fresh session token
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || session?.access_token;
    if (!token) {
      showAlert('Not Logged In', 'Please log into BetterAt first, then try this link again.');
      return;
    }

    setLinking(true);
    try {
      const response = await fetch(`${API_BASE}/api/telegram/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      if (!response.ok) {
        showAlert('Link Failed', data.error || 'Failed to link Telegram account');
        return;
      }

      setLinkSuccess(true);
      await loadLink();
    } catch (err) {
      logger.error('Failed to link telegram', err);
      showAlert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLinking(false);
    }
  }, [code, session, loadLink]);

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  const handleDisconnect = useCallback(() => {
    if (!link) return;
    showConfirm(
      'Disconnect Telegram',
      'You will no longer be able to interact with BetterAt via Telegram. You can reconnect at any time.',
      async () => {
        try {
          await supabase
            .from('telegram_links')
            .update({ is_active: false })
            .eq('id', link.id);
          setLink(null);
        } catch (err) {
          logger.error('Failed to disconnect telegram', err);
          showAlert('Error', 'Failed to disconnect. Please try again.');
        }
      },
      { destructive: true },
    );
  }, [link]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: IOS_COLORS.systemGroupedBackground }}>
        <Stack.Screen options={{ title: 'Telegram', headerShown: true, headerLeft }} />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // State: linked successfully just now
  if (linkSuccess && link) {
    return (
      <View style={{ flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground }}>
        <Stack.Screen options={{ title: 'Telegram', headerShown: true, headerLeft }} />
        <ScrollView contentContainerStyle={{ paddingTop: 32 }}>
          <IOSListSection header="" footer="Your Telegram account is now connected. Go back to Telegram and send a message to start chatting.">
            <IOSListItem
              title="Connected"
              value={link.telegram_username ? `@${link.telegram_username}` : 'Telegram User'}
              iconName="checkmark.circle.fill"
              iconBackground={IOS_COLORS.systemGreen}
            />
          </IOSListSection>

          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                backgroundColor: IOS_COLORS.systemBlue,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // State: already linked
  if (link?.linked_at) {
    return (
      <View style={{ flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground }}>
        <Stack.Screen options={{ title: 'Telegram', headerShown: true, headerLeft }} />
        <ScrollView contentContainerStyle={{ paddingTop: 32 }}>
          <IOSListSection header="CONNECTED ACCOUNT" footer="Messages you send to the BetterAt bot on Telegram are logged to your timeline and replied to automatically.">
            <IOSListItem
              title="Telegram"
              value={link.telegram_username ? `@${link.telegram_username}` : 'Connected'}
              iconName="paperplane.fill"
              iconBackground={IOS_COLORS.systemBlue}
            />
          </IOSListSection>

          <IOSListSection header="">
            <IOSListItem
              title="Disconnect"
              onPress={handleDisconnect}
              titleStyle={{ color: IOS_COLORS.systemRed }}
            />
          </IOSListSection>
        </ScrollView>
      </View>
    );
  }

  // State: have a code to link
  if (code) {
    return (
      <View style={{ flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground }}>
        <Stack.Screen options={{ title: 'Link Telegram', headerShown: true, headerLeft }} />
        <ScrollView contentContainerStyle={{ paddingTop: 32 }}>
          <IOSListSection header="LINK YOUR ACCOUNT" footer={`Code: ${code}\n\nThis will connect your Telegram account to BetterAt so you can manage your timeline via chat.`}>
            <IOSListItem
              title={linking ? 'Linking...' : 'Confirm Link'}
              onPress={linking ? undefined : handleLink}
              iconName="link"
              iconBackground={IOS_COLORS.systemBlue}
            />
          </IOSListSection>
        </ScrollView>
      </View>
    );
  }

  // State: not linked, no code — show instructions
  return (
    <View style={{ flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground }}>
      <Stack.Screen options={{ title: 'Telegram', headerShown: true, headerLeft }} />
      <ScrollView contentContainerStyle={{ paddingTop: 32 }}>
        <IOSListSection
          header="CONNECT TELEGRAM"
          footer={"To connect your Telegram account:\n\n1. Open Telegram\n2. Search for the BetterAt bot\n3. Send any message\n4. Follow the link the bot sends you\n\nOnce connected, you can manage your timeline, track progress, and capture sessions directly from Telegram."}
        >
          <IOSListItem
            title="Not Connected"
            value="Follow steps below"
            iconName="paperplane"
            iconBackground={IOS_COLORS.systemGray}
          />
        </IOSListSection>
      </ScrollView>
    </View>
  );
}
