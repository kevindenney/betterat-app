/**
 * StepCombinatorsSheet — bottom sheet behind StepCombinatorsRow's two
 * count pills (peers / related). Renders a flat list of rows; row
 * shape and the on-tap handler differ per `mode`.
 *
 *   - peers: list of platform users on the same blueprint. Tap →
 *     /discover/person/[userId].
 *   - related: list of the viewer's other steps that share blueprint
 *     or category with this step. Tap → /step/[stepId].
 */

import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { FellowSubscriber } from '@/hooks/useStepFellowSubscribers';
import type { TimelineStepRecord } from '@/types/timeline-steps';

interface PeersMode {
  mode: 'peers';
  peers: FellowSubscriber[];
}

interface RelatedMode {
  mode: 'related';
  relatedSteps: TimelineStepRecord[];
}

type StepCombinatorsSheetProps = (PeersMode | RelatedMode) & {
  visible: boolean;
  onDismiss: () => void;
};

export function StepCombinatorsSheet(props: StepCombinatorsSheetProps) {
  const { visible, onDismiss } = props;
  const isPeers = props.mode === 'peers';
  const count = isPeers ? props.peers.length : props.relatedSteps.length;
  const title = isPeers
    ? count === 1
      ? '1 peer'
      : `${count} peers`
    : count === 1
      ? '1 related step'
      : `${count} related steps`;
  const subtitle = isPeers
    ? 'Others on the same blueprint'
    : 'In your timeline — same blueprint or capability';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onDismiss} />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
              <Pressable hitSlop={8} onPress={onDismiss} style={styles.closeBtn}>
                <Text style={styles.closeText}>Done</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {isPeers ? (
                props.peers.length === 0 ? (
                  <Text style={styles.emptyText}>No peers yet.</Text>
                ) : (
                  props.peers.map((p) => (
                    <Pressable
                      key={p.userId}
                      style={styles.row}
                      onPress={() => {
                        onDismiss();
                        router.push(`/discover/person/${p.userId}` as never);
                      }}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {initials(p.displayName)}
                        </Text>
                      </View>
                      <Text style={styles.rowName}>{p.displayName}</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={IOS_REGISTER.labelTertiary}
                      />
                    </Pressable>
                  ))
                )
              ) : props.relatedSteps.length === 0 ? (
                <Text style={styles.emptyText}>No related steps.</Text>
              ) : (
                props.relatedSteps.map((s) => (
                  <Pressable
                    key={s.id}
                    style={styles.row}
                    onPress={() => {
                      onDismiss();
                      router.push(`/step/${s.id}` as never);
                    }}
                  >
                    <View style={styles.stepIcon}>
                      <Ionicons
                        name="layers-outline"
                        size={16}
                        color={IOS_REGISTER.labelSecondary}
                      />
                    </View>
                    <View style={styles.rowTextBlock}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {s.title || 'Untitled step'}
                      </Text>
                      {s.category ? (
                        <Text style={styles.rowMeta}>{s.category}</Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={IOS_REGISTER.labelTertiary}
                    />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function initials(name: string): string {
  const parts = name.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  backdropTap: { flex: 1 },
  sheetWrap: { backgroundColor: 'transparent' },
  sheet: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '80%',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 0 : 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separatorStrong,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
  scroll: { maxHeight: 500 },
  scrollContent: { paddingVertical: 8 },
  emptyText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    padding: 24,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextBlock: { flex: 1, minWidth: 0 },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
});
