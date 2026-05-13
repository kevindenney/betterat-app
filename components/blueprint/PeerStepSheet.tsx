/**
 * PeerStepSheet — Bottom-sheet that opens when a user taps a peer's step tile
 * inside a BlueprintPanel's "Following" row.
 *
 * Shows the peer's status for that curriculum step and offers three actions:
 *   1. Adopt the curriculum step into the user's own timeline (reuses the
 *      existing blueprint adopt mutation — the peer is contextual inspiration,
 *      the adopted step is still a copy of the blueprint's canonical step).
 *   2. Open the user's adopted version — only surfaced if already adopted;
 *      routes to the step detail screen where the AI Coach & full planning
 *      chrome live. This is our "ask questions / get guidance" surface.
 *   3. View the peer's profile — routes to /person/[userId] so the user can
 *      see the peer's full timeline and other steps.
 */

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAdoptBlueprintStep } from '@/hooks/useBlueprint';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import type { PeerTimeline, PeerTimelineStep } from '@/types/blueprint';
import type { TimelineStepRecord } from '@/types/timeline-steps';

export interface PeerStepSheetProps {
  visible: boolean;
  onClose: () => void;

  /** The peer whose tile was tapped. */
  peer: PeerTimeline;
  /** The peer's step for this curriculum position (null if the peer hasn't engaged with it yet). */
  peerStep: PeerTimelineStep | null;
  /** The canonical curriculum step this tile represents. */
  curriculumStep: TimelineStepRecord;

  /** Wiring for the adopt mutation. */
  interestId: string;
  subscriptionId: string;
  blueprintId: string;

  /**
   * If the user has already adopted this curriculum step, the id of their
   * adopted timeline step — enables the "Open in my timeline" affordance.
   */
  alreadyAdoptedStepId?: string | null;

  /**
   * Optional direct callback to select the user's adopted step in the parent
   * timeline. When provided, this is preferred over router navigation because
   * we're already on the races tab — router.push to the same tab with
   * ?selected= doesn't reliably re-trigger the deep-link effect.
   */
  onOpenAdoptedStep?: (stepId: string) => void;
}

function statusLabel(status: string | undefined): { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] } {
  if (status === 'completed') return { label: 'Completed', color: '#34C759', icon: 'checkmark-circle' };
  if (status === 'in_progress') return { label: 'In progress', color: '#007AFF', icon: 'time-outline' };
  return { label: 'Not started', color: '#8E8E93', icon: 'ellipse-outline' };
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function PeerStepSheet({
  visible,
  onClose,
  peer,
  peerStep,
  curriculumStep,
  interestId,
  subscriptionId,
  blueprintId,
  alreadyAdoptedStepId,
  onOpenAdoptedStep,
}: PeerStepSheetProps) {
  const router = useRouter();
  const adoptMutation = useAdoptBlueprintStep();

  const status = statusLabel(peerStep?.status);
  const completedOn = formatDate(peerStep?.completed_at);
  const peerName = peer.subscriber_name ?? 'Peer';
  const isAdopted = !!alreadyAdoptedStepId;
  const isAdopting = adoptMutation.isPending;

  const handleAdopt = () => {
    adoptMutation.mutate(
      {
        sourceStepId: curriculumStep.id,
        interestId,
        subscriptionId,
        blueprintId,
      },
      {
        onError: (err) => {
          showAlert('Could not adopt step', err.message ?? 'Something went wrong. Please try again.');
        },
      },
    );
  };

  const handleOpenMyStep = () => {
    if (!alreadyAdoptedStepId) return;
    onClose();
    // Prefer direct callback when parent can select the step in-place —
    // avoids expo-router desync caused by pushing the same ?selected= value
    // twice in a row. Falls back to router.push only when no callback is
    // wired (shouldn't happen in the current tree, but keeps the sheet
    // usable in isolation).
    if (onOpenAdoptedStep) {
      onOpenAdoptedStep(alreadyAdoptedStepId);
      return;
    }
    router.push(`/(tabs)/races?selected=${alreadyAdoptedStepId}` as any);
  };

  const handleViewProfile = () => {
    onClose();
    router.push(`/person/${peer.subscriber_id}` as any);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop propagation so tapping the sheet itself doesn't dismiss it. */}
        <Pressable style={styles.sheetWrapper} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {/* Peer row */}
            <View style={styles.peerRow}>
              <View style={styles.peerAvatar}>
                <Text style={styles.peerAvatarText}>
                  {peer.subscriber_avatar_emoji ??
                    (peer.subscriber_name ?? 'P').slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.peerMeta}>
                <Text style={styles.peerName} numberOfLines={1}>
                  {peerName}
                </Text>
                <Text style={styles.peerProgress}>
                  {peer.completed_count} of {peer.total_count} done
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.closeButton}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color="#8E8E93" />
              </Pressable>
            </View>

            {/* Step */}
            <View style={styles.stepBlock}>
              <Text style={styles.stepLabel}>Step</Text>
              <Text style={styles.stepTitle}>{curriculumStep.title}</Text>
              {curriculumStep.description ? (
                <Text style={styles.stepDescription} numberOfLines={4}>
                  {curriculumStep.description}
                </Text>
              ) : null}
            </View>

            {/* Peer's status */}
            <View style={styles.statusBlock}>
              <Text style={styles.statusHeader}>{peerName}&apos;s progress</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusPill, { backgroundColor: status.color + '18' }]}>
                  <Ionicons name={status.icon} size={14} color={status.color} />
                  <Text style={[styles.statusText, { color: status.color }]}>
                    {status.label}
                  </Text>
                </View>
                {completedOn ? (
                  <Text style={styles.statusDate}>{completedOn}</Text>
                ) : null}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              {!isAdopted ? (
                <Pressable
                  style={[styles.primaryButton, isAdopting && styles.buttonDisabled]}
                  onPress={handleAdopt}
                  disabled={isAdopting}
                  accessibilityRole="button"
                  accessibilityLabel="Adopt to my timeline"
                >
                  {isAdopting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>Adopt to my timeline</Text>
                    </>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleOpenMyStep}
                  accessibilityRole="button"
                  accessibilityLabel="Open my version and ask for help"
                >
                  <Ionicons name="chatbubbles-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Open & ask for help</Text>
                </Pressable>
              )}

              {isAdopted ? (
                <View style={styles.adoptedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                  <Text style={styles.adoptedText}>Already on your timeline</Text>
                </View>
              ) : null}

              <Pressable
                style={styles.secondaryButton}
                onPress={handleViewProfile}
                accessibilityRole="button"
                accessibilityLabel={`View ${peerName}'s profile`}
              >
                <Ionicons name="person-circle-outline" size={18} color="#007AFF" />
                <Text style={styles.secondaryButtonText}>
                  View {peerName}&apos;s profile
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    // Transparent wrapper to absorb taps on the sheet body.
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E4E1',
    marginBottom: 8,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  peerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  peerMeta: {
    flex: 1,
    minWidth: 0,
  },
  peerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  peerProgress: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  stepBlock: {
    gap: 6,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  stepDescription: {
    fontSize: 14,
    color: '#3A3A3C',
    lineHeight: 20,
    marginTop: 2,
  },
  statusBlock: {
    gap: 8,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E4E1',
  },
  statusHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingTop: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  actions: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E4E1',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adoptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  adoptedText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E4E1',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
  },
});
