/**
 * ProfileQRCodeSection - Display user's QR code for sharing
 *
 * Shows:
 * - User's profile QR code
 * - Share button
 * - Instructions
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable, Share, StyleSheet } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Share2 } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_SHADOWS,
} from '@/lib/design-tokens-ios';
import { useVocabulary } from '@/hooks/useVocabulary';
import { triggerHaptic } from '@/lib/haptics';

interface ProfileQRCodeSectionProps {
  userId: string;
}

export function ProfileQRCodeSection({ userId }: ProfileQRCodeSectionProps) {
  const { vocab } = useVocabulary();
  const profileUrl = useMemo(
    () => `https://regattaflow.app/sailor/${userId}`,
    [userId]
  );

  const handleShare = useCallback(async () => {
    try {
      triggerHaptic('selection');
      await Share.share({
        message: `Follow me on BetterAt! ${profileUrl}`,
        url: profileUrl,
        title: 'My BetterAt Profile',
      });
    } catch (error) {
      if ((error as Error).message !== 'User did not share') {
        showAlert('Error', 'Failed to share profile');
      }
    }
  }, [profileUrl]);

  return (
    <View style={styles.container}>
      {/* QR Code Card */}
      <View style={styles.qrCard}>
        {/* QR Code */}
        <View style={styles.qrCodeContainer}>
          <View style={styles.qrCodeWrapper}>
            <QRCode
              value={profileUrl}
              size={180}
              backgroundColor="white"
              color={IOS_COLORS.label}
              quietZone={10}
            />
          </View>
          <Text style={styles.qrNote}>
            Scan to follow
          </Text>
        </View>

        {/* Share Button */}
        <Pressable
          style={({ pressed }) => [
            styles.shareButton,
            pressed && styles.shareButtonPressed,
          ]}
          onPress={handleShare}
        >
          <Share2 size={18} color={IOS_COLORS.systemBlue} />
          <Text style={styles.shareButtonText}>Share Profile Link</Text>
        </Pressable>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>How it works</Text>
        <Text style={styles.instructionsText}>
          Let other {vocab('Peers').toLowerCase()} scan your QR code to
          quickly follow you on BetterAt. They'll see your activity and
          progress in their discovery feed.
        </Text>
      </View>

      {/* Profile Link */}
      <View style={styles.linkContainer}>
        <Text style={styles.linkLabel}>Your profile link</Text>
        <Text style={styles.linkUrl} selectable>
          {profileUrl}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: IOS_SPACING.lg,
  },
  qrCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    padding: IOS_SPACING.xl,
    alignItems: 'center',
    ...IOS_SHADOWS.sm,
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: IOS_SPACING.lg,
  },
  qrCodeWrapper: {
    padding: IOS_SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: IOS_RADIUS.lg,
    ...IOS_SHADOWS.sm,
  },
  qrNote: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
    marginTop: IOS_SPACING.sm,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemBlue + '15',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    borderRadius: IOS_RADIUS.md,
    gap: IOS_SPACING.xs,
  },
  shareButtonPressed: {
    opacity: 0.7,
  },
  shareButtonText: {
    ...IOS_TYPOGRAPHY.body,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  instructionsContainer: {
    marginTop: IOS_SPACING.xl,
    padding: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
  },
  instructionsTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.sm,
  },
  instructionsText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 22,
  },
  linkContainer: {
    marginTop: IOS_SPACING.lg,
    padding: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
  },
  linkLabel: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: IOS_SPACING.xs,
  },
  linkUrl: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.systemBlue,
  },
});
