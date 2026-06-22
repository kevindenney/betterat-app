import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Stack, useLocalSearchParams, useRouter} from 'expo-router';
import {useAuth} from '@/providers/AuthProvider';
import {supabase} from '@/services/supabase';
import {IOSListItem} from '@/components/ui/ios/IOSListItem';
import {IOSListSection} from '@/components/ui/ios/IOSListSection';
import {IOS_COLORS} from '@/lib/design-tokens-ios';
import {showAlert, showConfirm} from '@/lib/utils/crossPlatformAlert';
import {createLogger} from '@/lib/utils/logger';

const logger = createLogger('WhatsAppSettings');
const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

interface WhatsAppLink {
  id: string;
  whatsapp_phone: string;
  whatsapp_profile_name: string | null;
  linked_at: string | null;
  is_active: boolean;
}

export default function WhatsAppSettingsScreen(): React.ReactElement {
  const {user, session, ready} = useAuth();
  const {code} = useLocalSearchParams<{code?: string}>();
  const router = useRouter();

  const headerLeft = useCallback(
    () => (
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
        hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
        style={{flexDirection: 'row', alignItems: 'center'}}
      >
        <Ionicons name="chevron-back" size={26} color={IOS_COLORS.systemBlue} />
        <Text style={{color: IOS_COLORS.systemBlue, fontSize: 17}}>Settings</Text>
      </Pressable>
    ),
    [router],
  );

  const [link, setLink] = useState<WhatsAppLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);

  const loadLink = useCallback(async () => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const {data} = await supabase
        .from('whatsapp_links')
        .select('id, whatsapp_phone, whatsapp_profile_name, linked_at, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      setLink(data as WhatsAppLink | null);
    } catch (err) {
      logger.error('Failed to load WhatsApp link', err);
    } finally {
      setLoading(false);
    }
  }, [ready, user]);

  useEffect(() => {
    loadLink();
  }, [loadLink]);

  const handleLink = useCallback(async () => {
    if (!code) {
      showAlert('Error', 'No link code found.');
      return;
    }

    const {data: sessionData} = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || session?.access_token;
    if (!token) {
      showAlert('Not Logged In', 'Please log into BetterAt first, then try this link again.');
      return;
    }

    setLinking(true);
    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({code}),
      });

      const data = await response.json();
      if (!response.ok) {
        showAlert('Link Failed', data.error || 'Failed to link WhatsApp account');
        return;
      }

      setLinkSuccess(true);
      await loadLink();
    } catch (err) {
      logger.error('Failed to link WhatsApp', err);
      showAlert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLinking(false);
    }
  }, [code, session, loadLink]);

  const handleDisconnect = useCallback(() => {
    if (!link || !user?.id) return;
    showConfirm(
      'Disconnect WhatsApp',
      'BetterAt will stop sending and receiving messages via WhatsApp. You can reconnect any time.',
      async () => {
        try {
          const {data, error} = await supabase
            .from('whatsapp_links')
            .update({is_active: false})
            .eq('id', link.id)
            .eq('user_id', user.id)
            .select('id')
            .maybeSingle();
          if (error) throw error;
          if (!data) throw new Error('WhatsApp link not found.');
          setLink(null);
        } catch (err) {
          logger.error('Failed to disconnect WhatsApp', err);
          showAlert('Error', 'Failed to disconnect. Please try again.');
        }
      },
      {destructive: true},
    );
  }, [link, user?.id]);

  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: IOS_COLORS.systemGroupedBackground}}>
        <Stack.Screen options={{title: 'WhatsApp', headerShown: true, headerLeft}} />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (linkSuccess && link) {
    return (
      <View style={{flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground}}>
        <Stack.Screen options={{title: 'WhatsApp', headerShown: true, headerLeft}} />
        <ScrollView contentContainerStyle={{paddingTop: 32}}>
          <IOSListSection header="" footer="Your WhatsApp account is now connected. Go back to WhatsApp and send a message to start chatting.">
            <IOSListItem
              title="Connected"
              subtitle={link.whatsapp_profile_name || link.whatsapp_phone || 'WhatsApp user'}
              leadingIcon="checkmark-circle"
              leadingIconBackgroundColor={IOS_COLORS.systemGreen}
            />
          </IOSListSection>

          <View style={{paddingHorizontal: 16, paddingTop: 16}}>
            <Pressable
              onPress={() => router.back()}
              style={{
                backgroundColor: IOS_COLORS.systemGreen,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{color: '#FFFFFF', fontSize: 17, fontWeight: '600'}}>Done</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (link?.linked_at) {
    return (
      <View style={{flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground}}>
        <Stack.Screen options={{title: 'WhatsApp', headerShown: true, headerLeft}} />
        <ScrollView contentContainerStyle={{paddingTop: 32}}>
          <IOSListSection header="CONNECTED ACCOUNT" footer="Messages you send to the BetterAt WhatsApp assistant are logged to your timeline and replied to automatically.">
            <IOSListItem
              title="WhatsApp"
              subtitle={link.whatsapp_profile_name || link.whatsapp_phone || 'Connected'}
              leadingIcon="logo-whatsapp"
              leadingIconBackgroundColor={IOS_COLORS.systemGreen}
            />
          </IOSListSection>

          <IOSListSection header="">
            <IOSListItem
              title="Disconnect"
              onPress={handleDisconnect}
              titleStyle={{color: IOS_COLORS.systemRed}}
            />
          </IOSListSection>
        </ScrollView>
      </View>
    );
  }

  if (code) {
    return (
      <View style={{flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground}}>
        <Stack.Screen options={{title: 'Link WhatsApp', headerShown: true, headerLeft}} />
        <ScrollView contentContainerStyle={{paddingTop: 32}}>
          <IOSListSection header="LINK YOUR ACCOUNT" footer={`Code: ${code}\n\nThis will connect your WhatsApp account to BetterAt so you can manage your timeline via chat.`}>
            <IOSListItem
              title={linking ? 'Linking...' : 'Confirm Link'}
              onPress={linking ? undefined : handleLink}
              leadingIcon="link"
              leadingIconBackgroundColor={IOS_COLORS.systemGreen}
            />
          </IOSListSection>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground}}>
      <Stack.Screen options={{title: 'WhatsApp', headerShown: true, headerLeft}} />
      <ScrollView contentContainerStyle={{paddingTop: 32}}>
        <IOSListSection
          header="CONNECT WHATSAPP"
          footer={"To connect your WhatsApp account:\n\n1. Send any message to the BetterAt WhatsApp assistant\n2. Follow the link the assistant sends you\n3. Confirm the link while logged into BetterAt\n\nOnce connected, you can capture notes, media, and reflections directly from WhatsApp."}
        >
          <IOSListItem
            title="Not Connected"
            subtitle="Follow steps below"
            leadingIcon="logo-whatsapp"
            leadingIconBackgroundColor={IOS_COLORS.systemGray}
          />
        </IOSListSection>
      </ScrollView>
    </View>
  );
}
