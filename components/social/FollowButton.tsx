/**
 * FollowButton - Enhanced follow button with options on long press
 *
 * Tap: Follow/Unfollow
 * Long press when following: Show FollowOptionsSheet
 */

import React, { useState, useCallback } from 'react';
import {
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { UserPlus, UserCheck, ChevronDown } from 'lucide-react-native';
import { FollowOptionsSheet } from './FollowOptionsSheet';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';

interface FollowButtonProps {
  isFollowing: boolean;
  isLoading?: boolean;
  userName: string;
  // Follow options state
  isFavorite?: boolean;
  notificationsEnabled?: boolean;
  isMuted?: boolean;
  // Actions
  onFollow: () => void;
  onUnfollow: () => void;
  onToggleFavorite?: () => void;
  onToggleNotifications?: () => void;
  onToggleMute?: () => void;
  // Styling
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  showDropdown?: boolean;
}

export function FollowButton({
  isFollowing,
  isLoading = false,
  userName,
  isFavorite = false,
  notificationsEnabled = false,
  isMuted = false,
  onFollow,
  onUnfollow,
  onToggleFavorite,
  onToggleNotifications,
  onToggleMute,
  size = 'medium',
  showIcon = true,
  showDropdown = true,
}: FollowButtonProps) {
  const [showOptions, setShowOptions] = useState(false);

  const handlePress = useCallback(() => {
    if (isLoading) return;

    if (isFollowing) {
      // Show options sheet instead of immediate unfollow
      setShowOptions(true);
    } else {
      onFollow();
    }
  }, [isFollowing, isLoading, onFollow]);

  const handleLongPress = useCallback(() => {
    if (isFollowing) {
      setShowOptions(true);
    }
  }, [isFollowing]);

  const handleUnfollow = useCallback(() => {
    onUnfollow();
    setShowOptions(false);
  }, [onUnfollow]);

  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite?.();
  }, [onToggleFavorite]);

  const handleToggleNotifications = useCallback(() => {
    onToggleNotifications?.();
  }, [onToggleNotifications]);

  const handleToggleMute = useCallback(() => {
    onToggleMute?.();
  }, [onToggleMute]);

  const sizeStyles = {
    small: styles.buttonSmall,
    medium: styles.buttonMedium,
    large: styles.buttonLarge,
  };

  const textStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

  const iconSize = size === 'small' ? 14 : size === 'medium' ? 16 : 18;

  return (
    <>
      <TouchableOpacity
        style={[styles.button, sizeStyles[size], isFollowing ? styles.buttonFollowing : styles.buttonNotFollowing]}
        activeOpacity={0.85}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isFollowing ? IOS_COLORS.systemBlue : '#FFFFFF'}
          />
        ) : (
          <>
            {showIcon && !isFollowing && (
              <UserPlus
                size={iconSize}
                color={'#FFFFFF'}
                style={styles.icon}
              />
            )}
            {showIcon && isFollowing && (
              <UserCheck
                size={iconSize}
                color={IOS_COLORS.systemBlue}
                style={styles.icon}
              />
            )}
            <Text
              style={[
                styles.text,
                textStyles[size],
                isFollowing ? styles.textFollowing : styles.textNotFollowing,
              ]}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
            {isFollowing && showDropdown && (
              <ChevronDown
                size={14}
                color={IOS_COLORS.systemBlue}
                style={styles.dropdown}
              />
            )}
          </>
        )}
      </TouchableOpacity>

      {/* Follow Options Sheet */}
      <FollowOptionsSheet
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        userName={userName}
        isFavorite={isFavorite}
        notificationsEnabled={notificationsEnabled}
        isMuted={isMuted}
        onToggleFavorite={handleToggleFavorite}
        onToggleNotifications={handleToggleNotifications}
        onToggleMute={handleToggleMute}
        onUnfollow={handleUnfollow}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: IOS_RADIUS.md,
  },
  buttonSmall: {
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs,
    minWidth: 70,
  },
  buttonMedium: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    minWidth: 90,
  },
  buttonLarge: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    minWidth: 120,
  },
  buttonNotFollowing: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  buttonFollowing: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemBlue,
  },
  icon: {
    marginRight: IOS_SPACING.xs,
  },
  dropdown: {
    marginLeft: 2,
  },
  text: {
    fontWeight: '600',
  },
  textSmall: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
  },
  textMedium: {
    ...IOS_TYPOGRAPHY.subhead,
    fontWeight: '600',
  },
  textLarge: {
    ...IOS_TYPOGRAPHY.body,
    fontWeight: '600',
  },
  textNotFollowing: {
    color: '#FFFFFF',
  },
  textFollowing: {
    color: IOS_COLORS.systemBlue,
  },
});
