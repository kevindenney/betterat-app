/**
 * StepPeopleSheet — the one place that answers "who's on this step?"
 *
 * Replaces the cluster of access-card, cohort-avatar-stack, and "N
 * peers" chip with a single dedup'd list. Each row shows the person's
 * avatar + display name + the relationships that apply (Owner /
 * Invited / Cohort) and a small marker when they've left a reflection
 * on this step.
 */

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { StepPerson } from '@/hooks/useStepWithPeople';

interface StepPeopleSheetProps {
  visible: boolean;
  people: StepPerson[];
  onDismiss: () => void;
}

export function StepPeopleSheet({
  visible,
  people,
  onDismiss,
}: StepPeopleSheetProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={styles.host}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {people.length === 1 ? '1 person' : `${people.length} people`} on this step
          </Text>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={IOS_REGISTER.label} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {people.map((person) => (
            <PersonRow key={person.userId} person={person} />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function PersonRow({ person }: { person: StepPerson }) {
  const tags: { label: string; tone: 'owner' | 'invited' | 'cohort' }[] = [];
  if (person.isOwner) tags.push({ label: 'Owner', tone: 'owner' });
  if (person.inAccess && !person.isOwner) tags.push({ label: 'Invited', tone: 'invited' });
  if (person.inCohort) tags.push({ label: 'Cohort', tone: 'cohort' });

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: person.avatarColor ?? '#8E8E93' },
        ]}
      >
        <Text style={styles.avatarText}>{person.initials}</Text>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {person.isViewer ? `${person.displayName} (you)` : person.displayName}
          </Text>
          {person.hasReflected ? (
            <View style={styles.reflectMark}>
              <Ionicons
                name="chatbubble"
                size={10}
                color={IOS_REGISTER.accentUserAction}
              />
              <Text style={styles.reflectMarkText}>reflected</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <View
              key={tag.label}
              style={[
                styles.tag,
                tag.tone === 'owner' && styles.tagOwner,
                tag.tone === 'invited' && styles.tagInvited,
                tag.tone === 'cohort' && styles.tagCohort,
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  tag.tone === 'owner' && styles.tagTextOwner,
                  tag.tone === 'invited' && styles.tagTextInvited,
                  tag.tone === 'cohort' && styles.tagTextCohort,
                ]}
              >
                {tag.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.25,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: IOS_REGISTER.cardBg,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 12,
    marginBottom: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.label,
  },
  reflectMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
  },
  reflectMarkText: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: 0.2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagOwner: {
    backgroundColor: 'rgba(52, 199, 89, 0.14)',
  },
  tagInvited: {
    backgroundColor: 'rgba(255, 159, 10, 0.16)',
  },
  tagCohort: {
    backgroundColor: 'rgba(118, 118, 128, 0.14)',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tagTextOwner: {
    color: '#1F7A3A',
  },
  tagTextInvited: {
    color: '#9C5400',
  },
  tagTextCohort: {
    color: IOS_REGISTER.labelSecondary,
  },
});

export default StepPeopleSheet;
