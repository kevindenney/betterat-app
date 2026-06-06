/**
 * FollowOptionsSheet - Bottom sheet with follow options
 *
 * Shows options like:
 * - Add to Favorites
 * - Turn on Notifications
 * - Mute
 * - Unfollow
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Star,
  Bell,
  BellOff,
  VolumeX,
  UserMinus,
  X,
} from 'lucide-react-native';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

interface FollowOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
  isFavorite: boolean;
  notificationsEnabled: boolean;
  isMuted: boolean;
  onToggleFavorite: () => void;
  onToggleNotifications: () => void;
  onToggleMute: () => void;
  onUnfollow: () => void;
}

interface OptionItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  isActive?: boolean;
  isDestructive?: boolean;
  onPress: () => void;
}

export function FollowOptionsSheet({
  visible,
  onClose,
  userName,
  isFavorite,
  notificationsEnabled,
  isMuted,
  onToggleFavorite,
  onToggleNotifications,
  onToggleMute,
  onUnfollow,
}: FollowOptionsSheetProps) {
  const insets = useSafeAreaInsets();

  const handleOption = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose]
  );

  const options: OptionItem[] = [
    {
      icon: (
        <Star
          size={22}
          color={isFavorite ? IOS_COLORS.systemYellow : IOS_COLORS.label}
          fill={isFavorite ? IOS_COLORS.systemYellow : 'transparent'}
        />
      ),
      label: isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      description: isFavorite
        ? 'Their activities will show in normal order'
        : 'Their activities will appear first in your feed',
      isActive: isFavorite,
      onPress: () => handleOption(onToggleFavorite),
    },
    {
      icon: notificationsEnabled ? (
        <BellOff size={22} color={IOS_COLORS.label} />
      ) : (
        <Bell size={22} color={IOS_COLORS.label} />
      ),
      label: notificationsEnabled
        ? 'Turn Off Notifications'
        : 'Turn On Notifications',
      description: notificationsEnabled
        ? "You won't be notified when they race"
        : "Get notified when they add new races",
      isActive: notificationsEnabled,
      onPress: () => handleOption(onToggleNotifications),
    },
    {
      icon: <VolumeX size={22} color={isMuted ? IOS_COLORS.systemOrange : IOS_COLORS.label} />,
      label: isMuted ? 'Unmute' : 'Mute',
      description: isMuted
        ? 'Their activities will appear in your feed again'
        : 'Hide their activities from your feed',
      isActive: isMuted,
      onPress: () => handleOption(onToggleMute),
    },
    {
      icon: <UserMinus size={22} color={IOS_COLORS.systemRed} />,
      label: 'Unfollow',
      description: `Stop following ${userName}`,
      isDestructive: true,
      onPress: () => handleOption(onUnfollow),
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.sheetContainer,
            { paddingBottom: insets.bottom + IOS_SPACING.md },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Following {userName}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
                onPress={onClose}
              >
                <X size={20} color={IOS_COLORS.secondaryLabel} />
              </Pressable>
            </View>

            {/* Options */}
            <View style={styles.optionsList}>
              {options.map((option, index) => (
                <Pressable
                  key={option.label}
                  style={({ pressed }) => [
                    styles.optionRow,
                    pressed && styles.optionRowPressed,
                    index < options.length - 1 && styles.optionRowBorder,
                  ]}
                  onPress={option.onPress}
                >
                  <View style={styles.optionIcon}>{option.icon}</View>
                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionLabel,
                        option.isDestructive && styles.optionLabelDestructive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderTopLeftRadius: IOS_RADIUS.xl,
    borderTopRightRadius: IOS_RADIUS.xl,
    paddingTop: IOS_SPACING.sm,
  },
  handleBar: {
    width: 36,
    height: 5,
    backgroundColor: IOS_COLORS.tertiaryLabel,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  headerTitle: {
    ...IOS_TYPOGRAPHY.headline,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: IOS_COLORS.label,
  },
  closeButton: {
    padding: IOS_SPACING.xs,
    borderRadius: IOS_RADIUS.full,
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  closeButtonPressed: {
    backgroundColor: IOS_COLORS.quaternarySystemFill,
  },
  optionsList: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: IOS_SPACING.md,
  },
  optionRowPressed: {
    opacity: 0.7,
  },
  optionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  optionIcon: {
    width: 40,
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: IOS_SPACING.sm,
  },
  optionLabel: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  optionLabelDestructive: {
    color: IOS_COLORS.systemRed,
  },
  optionDescription: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
  },
});
