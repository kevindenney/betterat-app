/**
 * StepCombinatorsSheet — bottom sheet behind StepCombinatorsRow's count
 * pills. Renders a flat list of rows; row shape and the on-tap handler
 * differ per `mode`.
 *
 *   - peers: list of platform users on the same blueprint. Tap →
 *     /discover/person/[userId].
 *   - related: list of the viewer's other steps that share blueprint
 *     or category with this step. Tap → /step/[stepId].
 *   - near: proximity-derived peer steps within ~5km. Tap → Atlas
 *     focused on that step's location ("see what's nearby").
 *   - cross: a single AI cross-interest suggestion. Shows the "why this
 *     connects" reasoning so the chip isn't an opaque claim, plus an
 *     action to open the other interest's timeline.
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
import type { AtlasPeerStep, AtlasPeerRelationship } from '@/hooks/useAtlasPeerSteps';
import type { CrossInterestSuggestion } from '@/types/step-detail';

interface PeersMode {
  mode: 'peers';
  peers: FellowSubscriber[];
}

interface RelatedMode {
  mode: 'related';
  relatedSteps: {
    step: TimelineStepRecord;
    reasons: string[];
  }[];
}

interface NearMode {
  mode: 'near';
  nearbySteps: AtlasPeerStep[];
}

interface CrossMode {
  mode: 'cross';
  cross: CrossInterestSuggestion;
  onOpenInterest: () => void;
}

type StepCombinatorsSheetProps = (PeersMode | RelatedMode | NearMode | CrossMode) & {
  visible: boolean;
  onDismiss: () => void;
};

const NEAR_RELATIONSHIP_LABEL: Record<AtlasPeerRelationship, string> = {
  self: 'You',
  crew: 'Crew',
  cohort: 'Cohort',
  fleet: 'Fleet',
  following: 'Following',
  public: 'Nearby',
};

export function StepCombinatorsSheet(props: StepCombinatorsSheetProps) {
  const { visible, onDismiss } = props;

  let title: string;
  let subtitle: string;
  switch (props.mode) {
    case 'peers':
      title = props.peers.length === 1 ? '1 peer' : `${props.peers.length} peers`;
      subtitle = 'Others on the same blueprint';
      break;
    case 'related':
      title =
        props.relatedSteps.length === 1
          ? '1 related step'
          : `${props.relatedSteps.length} related steps`;
      subtitle = 'In your timeline — same blueprint, category, or capability';
      break;
    case 'near':
      title = props.nearbySteps.length === 1 ? '1 nearby' : `${props.nearbySteps.length} nearby`;
      subtitle = 'Peers working within ~5km — tap to see on Atlas';
      break;
    case 'cross':
      title = `Also relevant for ${props.cross.sourceInterestName}`;
      subtitle = 'Why this connects';
      break;
  }

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
              {props.mode === 'peers' ? (
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
              ) : props.mode === 'related' ? (
                props.relatedSteps.length === 0 ? (
                  <Text style={styles.emptyText}>No related steps.</Text>
                ) : (
                  props.relatedSteps.map(({ step: s, reasons }) => (
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
                        {(reasons.length > 0 || s.category) ? (
                          <Text style={styles.rowMeta}>
                            {reasons.length > 0 ? reasons.join(' · ') : s.category}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={IOS_REGISTER.labelTertiary}
                      />
                    </Pressable>
                  ))
                )
              ) : props.mode === 'near' ? (
                props.nearbySteps.length === 0 ? (
                  <Text style={styles.emptyText}>Nobody nearby right now.</Text>
                ) : (
                  props.nearbySteps.map((n) => (
                    <Pressable
                      key={n.step_id}
                      style={styles.row}
                      onPress={() => {
                        onDismiss();
                        router.push(
                          `/(tabs)/atlas?lat=${n.lat}&lng=${n.lng}` as never,
                        );
                      }}
                    >
                      <View style={styles.stepIcon}>
                        <Ionicons name="location-outline" size={16} color="#0A84FF" />
                      </View>
                      <View style={styles.rowTextBlock}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {n.preview_name || 'A peer nearby'}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {NEAR_RELATIONSHIP_LABEL[n.relationship]}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={IOS_REGISTER.labelTertiary}
                      />
                    </Pressable>
                  ))
                )
              ) : (
                <View style={styles.crossBlock}>
                  {props.cross.relevance ? (
                    <Text style={styles.crossReason}>{props.cross.relevance}</Text>
                  ) : null}
                  {props.cross.suggestion ? (
                    <Text style={styles.crossSuggestion}>{props.cross.suggestion}</Text>
                  ) : null}
                  <Pressable
                    style={styles.crossCta}
                    onPress={() => {
                      onDismiss();
                      props.onOpenInterest();
                    }}
                  >
                    <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" />
                    <Text style={styles.crossCtaText}>
                      Open {props.cross.sourceInterestName}
                    </Text>
                  </Pressable>
                </View>
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
    minHeight: 240,
    maxHeight: '80%',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
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
  scrollContent: { paddingTop: 8, paddingBottom: 18 },
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
  crossBlock: {
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 12,
  },
  crossReason: {
    fontSize: 15,
    lineHeight: 21,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  crossSuggestion: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  crossCta: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#7B3FB0',
  },
  crossCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
