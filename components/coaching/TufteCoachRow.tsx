/**
 * TufteCoachRow
 *
 * Dense, typography-driven coach row following Tufte principles:
 * - Small or no avatar (text initials)
 * - Specialties as plain text, not chips
 * - Text link instead of button
 * - Hairline borders, no shadows
 *
 * Target layout:
 * Emily Carter
 *   Olympic strategist · Match racing
 *   ★ 4.9 (127)    $220/hr    Hong Kong       Contact
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IOS_COLORS } from '@/components/cards/constants';

interface TufteCoachRowProps {
  name: string;
  bio?: string;
  specialties?: string[];
  rating?: number;
  totalSessions?: number;
  hourlyRate?: number; // in cents
  currency?: string;
  location?: string;
  onPress?: () => void;
  onContact?: () => void;
  isLast?: boolean;
}

export function TufteCoachRow({
  name,
  bio,
  specialties = [],
  rating,
  totalSessions,
  hourlyRate,
  currency: _currency = 'USD',
  location,
  onPress,
  onContact,
  isLast = false,
}: TufteCoachRowProps) {
  // Format specialties as plain text
  const specialtiesText = specialties
    .slice(0, 2)
    .map(s => s.replace(/_/g, ' '))
    .join(' · ');

  // Format price
  const priceText = hourlyRate
    ? `$${Math.round(hourlyRate / 100)}/hr`
    : null;

  // Get initials for avatar
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.row, isLast && styles.rowLast]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      {/* Small initials avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.content}>
        {/* Name */}
        <Text style={styles.name} numberOfLines={1}>{name}</Text>

        {/* Bio or specialties */}
        <Text style={styles.subtitle} numberOfLines={1}>
          {bio || specialtiesText || 'Performance coach'}
        </Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {rating !== undefined && (
            <Text style={styles.rating}>
              ★ {rating.toFixed(1)}
              {totalSessions !== undefined && (
                <Text style={styles.sessionCount}> ({totalSessions})</Text>
              )}
            </Text>
          )}
          {priceText && (
            <Text style={styles.price}>{priceText}</Text>
          )}
          {location && (
            <Text style={styles.location} numberOfLines={1}>{location}</Text>
          )}
        </View>
      </View>

      {/* Contact link */}
      {onContact && (
        <TouchableOpacity
          style={styles.contactButton}
          onPress={(e) => {
            e.stopPropagation?.();
            onContact();
          }}
        >
          <Text style={styles.contactText}>Contact</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    minHeight: 72,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  rating: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F59E0B',
  },
  sessionCount: {
    color: IOS_COLORS.tertiaryLabel,
    fontWeight: '400',
  },
  price: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  location: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    flex: 1,
  },
  contactButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  contactText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
});

export default TufteCoachRow;
