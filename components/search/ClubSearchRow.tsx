/**
 * ClubSearchRow - Individual club search result row
 *
 * Displays:
 * - Club logo/initials
 * - Name and location
 * - Member count
 * - Join/Joined button
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Users, Check, ChevronRight } from 'lucide-react-native';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_TOUCH,
  IOS_LIST_INSETS,
} from '@/lib/design-tokens-ios';

const CLUB_COLORS = [
  IOS_COLORS.systemBlue,
  IOS_COLORS.systemGreen,
  IOS_COLORS.systemOrange,
  IOS_COLORS.systemPurple,
  IOS_COLORS.systemTeal,
  IOS_COLORS.systemIndigo,
] as const;

function getClubColor(clubId: string): string {
  return CLUB_COLORS[clubId.charCodeAt(0) % CLUB_COLORS.length];
}

function getClubInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export interface ClubSearchResult {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  location?: string;
  logoUrl?: string;
  memberCount: number;
  boatClassName?: string;
  isJoined: boolean;
  source?: 'platform' | 'directory' | 'org';
  official?: boolean;
}

interface ClubSearchRowProps {
  club: ClubSearchResult;
  onPress: () => void;
  onToggleJoin: () => void;
  showSeparator?: boolean;
}

export function ClubSearchRow({
  club,
  onPress,
  onToggleJoin,
  showSeparator = true,
}: ClubSearchRowProps) {
  const clubColor = getClubColor(club.id);
  const initials = getClubInitials(club.name);
  const isOrg = club.source === 'org';

  // Build subtitle
  const subtitleParts: string[] = [];
  if (club.location) {
    subtitleParts.push(club.location);
  }
  if (club.boatClassName) {
    subtitleParts.push(club.boatClassName);
  }
  const subtitle = subtitleParts.join(' \u00B7 ');

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
        onPress={onPress}
      >
        {/* Club Logo */}
        <View style={[styles.logo, { backgroundColor: clubColor }]}>
          {club.logoUrl ? (
            // Could use Image here with club.logoUrl
            <Text style={styles.logoInitials}>{initials}</Text>
          ) : (
            <Text style={styles.logoInitials}>{initials}</Text>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {club.name}
            </Text>
            {isOrg && (
              <View style={[styles.badge, club.official && styles.badgeVerified]}>
                <Text
                  style={[styles.badgeText, club.official && styles.badgeTextVerified]}
                >
                  {club.official ? 'Verified' : 'Org'}
                </Text>
              </View>
            )}
          </View>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          {!isOrg && (
            <View style={styles.memberInfo}>
              <Users size={12} color={IOS_COLORS.tertiaryLabel} />
              <Text style={styles.memberCount}>
                {club.memberCount} member{club.memberCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Join Button (clubs) — orgs route to their page instead */}
        {isOrg ? (
          <ChevronRight size={20} color={IOS_COLORS.tertiaryLabel} />
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.joinButton,
              club.isJoined ? styles.joinedButton : styles.notJoinedButton,
              pressed && styles.joinButtonPressed,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onToggleJoin();
            }}
            hitSlop={8}
          >
            {club.isJoined ? (
              <>
                <Check size={14} color={IOS_COLORS.secondaryLabel} />
                <Text style={styles.joinedText}>Joined</Text>
              </>
            ) : (
              <Text style={styles.joinText}>Join</Text>
            )}
          </Pressable>
        )}

        {/* Separator */}
        {showSeparator && <View style={styles.separator} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: IOS_LIST_INSETS.insetGrouped.marginHorizontal,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    minHeight: IOS_TOUCH.listItemHeight + 12,
  },
  pressed: {
    backgroundColor: IOS_COLORS.quaternarySystemFill,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: IOS_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: IOS_SPACING.md,
  },
  logoInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    marginRight: IOS_SPACING.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    ...IOS_TYPOGRAPHY.body,
    fontWeight: '600',
    color: IOS_COLORS.label,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  badgeVerified: {
    backgroundColor: IOS_COLORS.systemBlue + '1A',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: IOS_COLORS.secondaryLabel,
  },
  badgeTextVerified: {
    color: IOS_COLORS.systemBlue,
  },
  subtitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  memberCount: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.tertiaryLabel,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.xs + 2,
    borderRadius: IOS_RADIUS.sm,
    gap: 4,
    minWidth: 70,
    justifyContent: 'center',
  },
  notJoinedButton: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  joinedButton: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  joinButtonPressed: {
    opacity: 0.7,
  },
  joinText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  joinedText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  separator: {
    position: 'absolute',
    left: IOS_SPACING.lg + 50 + IOS_SPACING.md,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
  },
});
