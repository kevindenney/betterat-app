/**
 * ShareActivityButton - Share race results and activity
 *
 * Provides a button for sharing race results with customizable
 * share content, similar to Strava's activity sharing feature.
 */

import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Share,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SHADOWS } from '@/lib/design-tokens-ios';

// Share content types
export interface RaceShareData {
  raceName: string;
  raceDate: string;
  venueName?: string;
  position: number;
  fleetSize: number;
  boatClass?: string;
  notes?: string;
}

export interface ActivityShareData {
  type: 'race' | 'achievement' | 'milestone' | 'weekly_summary';
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string | number }[];
  imageUrl?: string;
}

interface ShareActivityButtonProps {
  // For simple race sharing
  raceData?: RaceShareData;
  // For custom activity sharing
  activityData?: ActivityShareData;
  // Custom share message (overrides auto-generated)
  customMessage?: string;
  // Button variants
  variant?: 'icon' | 'text' | 'full';
  size?: 'small' | 'medium' | 'large';
  // Callbacks
  onShareStart?: () => void;
  onShareComplete?: (success: boolean) => void;
  onShareError?: (error: Error) => void;
  // Styling
  style?: any;
  disabled?: boolean;
}

function getOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

function formatRaceDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function generateRaceShareMessage(data: RaceShareData): string {
  const lines: string[] = [];

  // Title line
  lines.push(`🏆 ${data.raceName}`);

  // Result line
  const positionText = `${getOrdinal(data.position)} of ${data.fleetSize}`;
  lines.push(`📍 ${positionText}${data.boatClass ? ` • ${data.boatClass}` : ''}`);

  // Venue and date
  if (data.venueName) {
    lines.push(`⛵ ${data.venueName}`);
  }
  lines.push(`📅 ${formatRaceDate(data.raceDate)}`);

  // Notes if provided
  if (data.notes) {
    lines.push('');
    lines.push(`"${data.notes}"`);
  }

  // Hashtag
  lines.push('');
  lines.push('#RegattaFlow #Sailing');

  return lines.join('\n');
}

function generateActivityShareMessage(data: ActivityShareData): string {
  const lines: string[] = [];

  // Emoji based on type
  const emoji = {
    race: '🏆',
    achievement: '🎖️',
    milestone: '⭐',
    weekly_summary: '📊',
  }[data.type];

  // Title
  lines.push(`${emoji} ${data.title}`);

  // Subtitle if provided
  if (data.subtitle) {
    lines.push(data.subtitle);
  }

  // Stats if provided
  if (data.stats && data.stats.length > 0) {
    lines.push('');
    data.stats.forEach((stat) => {
      lines.push(`${stat.label}: ${stat.value}`);
    });
  }

  // Hashtag
  lines.push('');
  lines.push('#RegattaFlow #Sailing');

  return lines.join('\n');
}

export function ShareActivityButton({
  raceData,
  activityData,
  customMessage,
  variant = 'icon',
  size = 'medium',
  onShareStart,
  onShareComplete,
  onShareError,
  style,
  disabled = false,
}: ShareActivityButtonProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (disabled || isSharing) return;

    setIsSharing(true);
    onShareStart?.();

    try {
      // Generate share message
      let message = customMessage;

      if (!message) {
        if (raceData) {
          message = generateRaceShareMessage(raceData);
        } else if (activityData) {
          message = generateActivityShareMessage(activityData);
        } else {
          message = 'Check out my sailing progress on RegattaFlow! #RegattaFlow #Sailing';
        }
      }

      const result = await Share.share({
        message,
      });

      const success = result.action === Share.sharedAction;
      onShareComplete?.(success);
    } catch (error) {
      const err = error as Error;
      onShareError?.(err);
      showAlert('Share Failed', 'Could not share this activity. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  // Size configurations
  const sizes = {
    small: { iconSize: 16, buttonSize: 28, fontSize: 13 },
    medium: { iconSize: 20, buttonSize: 36, fontSize: 15 },
    large: { iconSize: 24, buttonSize: 48, fontSize: 17 },
  };

  const { iconSize, buttonSize, fontSize } = sizes[size];

  // Render based on variant
  if (variant === 'icon') {
    return (
      <Pressable
        style={[
          styles.iconButton,
          {
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
        onPress={handleShare}
        disabled={disabled || isSharing}
      >
        {isSharing ? (
          <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
        ) : (
          <Ionicons name="share-outline" size={iconSize} color={IOS_COLORS.systemBlue} />
        )}
      </Pressable>
    );
  }

  if (variant === 'text') {
    return (
      <TouchableOpacity
        style={[styles.textButton, { opacity: disabled ? 0.5 : 1 }, style]}
        activeOpacity={0.85}
        onPress={handleShare}
        disabled={disabled || isSharing}
      >
        {isSharing ? (
          <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
        ) : (
          <>
            <Ionicons name="share-outline" size={iconSize} color={IOS_COLORS.systemBlue} />
            <Text style={[styles.textButtonLabel, { fontSize }]}>Share</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  // Full variant
  return (
    <TouchableOpacity
      style={[styles.fullButton, { opacity: disabled ? 0.5 : 1 }, style]}
      activeOpacity={0.85}
      onPress={handleShare}
      disabled={disabled || isSharing}
    >
      {isSharing ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          <Ionicons name="share-outline" size={iconSize} color="#FFFFFF" />
          <Text style={[styles.fullButtonLabel, { fontSize }]}>Share Activity</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// Pre-built share button variants for common use cases
export function ShareRaceButton({
  race,
  ...props
}: Omit<ShareActivityButtonProps, 'raceData'> & {
  race: RaceShareData;
}) {
  return <ShareActivityButton raceData={race} {...props} />;
}

export function ShareAchievementButton({
  achievement,
  ...props
}: Omit<ShareActivityButtonProps, 'activityData'> & {
  achievement: { title: string; description: string };
}) {
  return (
    <ShareActivityButton
      activityData={{
        type: 'achievement',
        title: achievement.title,
        subtitle: achievement.description,
      }}
      {...props}
    />
  );
}

export function ShareMilestoneButton({
  milestone,
  ...props
}: Omit<ShareActivityButtonProps, 'activityData'> & {
  milestone: { title: string; value: string | number };
}) {
  return (
    <ShareActivityButton
      activityData={{
        type: 'milestone',
        title: milestone.title,
        stats: [{ label: 'Milestone', value: milestone.value }],
      }}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  iconButton: {
    backgroundColor: IOS_COLORS.systemBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textButtonLabel: {
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
  fullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    ...IOS_SHADOWS.sm,
  },
  fullButtonLabel: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ShareActivityButton;
