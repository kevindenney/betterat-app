/**
 * CrewList — grouped table of crew/participants on a step. Single rounded
 * white card with 36px circular avatars, 17pt name, 14pt role, hairline
 * separators, chevron-right affordance.
 *
 * Display only. The picker variant lives at components/step/CollaboratorPicker.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

export interface CrewMember {
  id: string;
  name: string;
  role?: string;
  /** Pre-rendered avatar content, e.g. <Image> or <Text>SC</Text> */
  avatar?: React.ReactNode;
  /** Initials fallback when avatar is missing */
  initials?: string;
  /** Avatar background tint — defaults to a neutral slate */
  avatarColor?: string;
  onPress?: () => void;
}

interface Props {
  members: CrewMember[];
}

export function CrewList({ members }: Props) {
  return (
    <View style={styles.list}>
      {members.map((member, idx) => (
        <CrewRow key={member.id} member={member} isFirst={idx === 0} />
      ))}
    </View>
  );
}

function CrewRow({
  member,
  isFirst,
}: {
  member: CrewMember;
  isFirst: boolean;
}) {
  return (
    <Pressable
      onPress={member.onPress}
      style={[styles.row, !isFirst && styles.rowDivider]}
      disabled={!member.onPress}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: member.avatarColor ?? '#C9D2DC' },
        ]}
      >
        {member.avatar ?? (
          <Text style={styles.avatarText}>{member.initials ?? '·'}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{member.name}</Text>
        {member.role ? <Text style={styles.role}>{member.role}</Text> : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={17}
        color={IOS_REGISTER.labelTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...IOS_REGISTER_TEXT.crewName,
    color: IOS_REGISTER.label,
    lineHeight: 20,
  },
  role: {
    ...IOS_REGISTER_TEXT.crewRole,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
});
