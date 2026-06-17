/**
 * LikeButton - Like/kudos button with animation
 *
 * Heart icon that animates on tap with count display.
 */

import React, { useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Animated, TouchableOpacity,
} from 'react-native';
import { Heart } from 'lucide-react-native';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';

interface LikeButtonProps {
  isLiked: boolean;
  likeCount: number;
  onToggle: () => void;
  isLoading?: boolean;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  compact?: boolean;
}

export function LikeButton({
  isLiked,
  likeCount,
  onToggle,
  isLoading = false,
  size = 'medium',
  showCount = true,
  compact = false,
}: LikeButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    if (isLoading) return;

    // Animate scale bounce
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.3,
        useNativeDriver: true,
        speed: 50,
        bounciness: 15,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 10,
      }),
    ]).start();

    onToggle();
  }, [isLoading, onToggle, scaleAnim]);

  const iconSize = size === 'small' ? 18 : size === 'medium' ? 22 : 26;

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactButton}
        activeOpacity={0.85}
        onPress={handlePress}
        disabled={isLoading}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Heart
            size={iconSize}
            color={isLiked ? IOS_COLORS.systemRed : IOS_COLORS.secondaryLabel}
            fill={isLiked ? IOS_COLORS.systemRed : 'transparent'}
          />
        </Animated.View>
        {showCount && likeCount > 0 && (
          <Text
            style={[
              styles.compactCount,
              isLiked && styles.countLiked,
            ]}
          >
            {formatCount(likeCount)}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, size === 'small' && styles.buttonSmall, size === 'large' && styles.buttonLarge]}
      activeOpacity={0.85}
      onPress={handlePress}
      disabled={isLoading}
    >
      <View style={styles.iconContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Heart
            size={iconSize}
            color={isLiked ? IOS_COLORS.systemRed : IOS_COLORS.secondaryLabel}
            fill={isLiked ? IOS_COLORS.systemRed : 'transparent'}
          />
        </Animated.View>
      </View>
      {showCount && (
        <Text
          style={[
            styles.count,
            size === 'small' && styles.countSmall,
            size === 'large' && styles.countLarge,
            isLiked && styles.countLiked,
          ]}
        >
          {likeCount > 0 ? formatCount(likeCount) : 'Like'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    borderRadius: IOS_RADIUS.md,
    gap: IOS_SPACING.xs,
  },
  buttonSmall: {
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs,
  },
  buttonLarge: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  countSmall: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '500',
  },
  countLarge: {
    ...IOS_TYPOGRAPHY.body,
    fontWeight: '500',
  },
  countLiked: {
    color: IOS_COLORS.systemRed,
  },
  // Compact style (icon only with count)
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    padding: IOS_SPACING.xs,
  },
  compactCount: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
  },
});
