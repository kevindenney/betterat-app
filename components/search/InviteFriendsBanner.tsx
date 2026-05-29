/**
 * InviteFriendsBanner - Strava-style invite friends CTA
 *
 * Shows a banner encouraging users to invite people to BetterAt.
 * Uses the native Share API with app store links.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Share,
  Platform,
  StyleSheet,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Users, Send } from 'lucide-react-native';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { useVocabulary } from '@/hooks/useVocabulary';

interface InviteFriendsBannerProps {
  /** Custom title text */
  title?: string;
  /** Custom description text */
  description?: string;
  /** Custom button text */
  buttonText?: string;
  /** Callback after successful share */
  onShare?: () => void;
}

export function InviteFriendsBanner({
  title,
  description,
  buttonText = 'Invite',
  onShare,
}: InviteFriendsBannerProps) {
  const { vocab } = useVocabulary();
  const resolvedTitle = title ?? 'Invite people to BetterAt';
  const resolvedDescription =
    description ??
    `Know ${vocab('Peers').toLowerCase()} who should join? Share the app with them!`;

  const handleInvite = useCallback(async () => {
    triggerHaptic('selection');

    // App store URLs - would be configured from env in production
    const iosUrl = process.env.EXPO_PUBLIC_IOS_APP_STORE_URL || 'https://apps.apple.com/app/betterat';
    const androidUrl = process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=at.better.app';
    const webUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://better.at';

    // Build share message
    const appLink = Platform.select({
      ios: iosUrl,
      android: androidUrl,
      default: webUrl,
    });

    const message = `Join me on BetterAt — the app for getting better at what you're working on. ${appLink}`;

    try {
      const result = await Share.share({
        message,
        title: 'Join BetterAt',
        url: Platform.OS === 'ios' ? appLink : undefined,
      });

      if (result.action === Share.sharedAction) {
        triggerHaptic('notificationSuccess');
        onShare?.();
      }
    } catch (error) {
      if ((error as Error).message !== 'User did not share') {
        showAlert('Error', 'Failed to open share sheet. Please try again.');
      }
    }
  }, [onShare]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Users size={24} color={IOS_COLORS.systemBlue} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{resolvedTitle}</Text>
          <Text style={styles.description}>{resolvedDescription}</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.inviteButton,
          pressed && styles.inviteButtonPressed,
        ]}
        onPress={handleInvite}
      >
        <Send size={16} color="#FFFFFF" />
        <Text style={styles.inviteButtonText}>{buttonText}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.lg,
    marginBottom: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    padding: IOS_SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: IOS_SPACING.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_COLORS.systemBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: IOS_SPACING.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...IOS_TYPOGRAPHY.subhead,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  description: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 16,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemOrange,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: IOS_RADIUS.md,
    gap: IOS_SPACING.xs,
  },
  inviteButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  inviteButtonText: {
    ...IOS_TYPOGRAPHY.subhead,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
