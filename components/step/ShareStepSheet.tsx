/**
 * ShareStepSheet
 *
 * Modal sheet for sharing a completed step as a follower post.
 * Shows a preview of the step content and lets the user add a note.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { enableStepSharing } from '@/services/TimelineStepService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_TYPOGRAPHY, IOS_SPACING, IOS_RADIUS } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import { triggerHaptic } from '@/lib/haptics';
import { useCreateFollowerPost } from '@/hooks/useFollowerPosts';
import type { StepPlanData, StepActData, StepReviewData, MediaUpload, StepMetadata } from '@/types/step-detail';
import { getReviewSections, getReviewSectionContent } from '@/lib/step/getReviewSections';

// =============================================================================
// TYPES
// =============================================================================

interface ShareStepSheetProps {
  isOpen: boolean;
  onClose: () => void;
  stepId: string;
  stepTitle: string;
  planData: StepPlanData;
  actData: StepActData;
  reviewData: StepReviewData;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ShareStepSheet({
  isOpen,
  onClose,
  stepId,
  stepTitle,
  planData,
  actData,
  reviewData,
}: ShareStepSheetProps) {
  const insets = useSafeAreaInsets();
  const createPost = useCreateFollowerPost();

  const [note, setNote] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copyingLink, setCopyingLink] = useState(false);

  const capabilityGoals = useMemo(() => planData.capability_goals ?? [], [planData.capability_goals]);
  const capabilityRatings = useMemo(() => reviewData.capability_progress ?? {}, [reviewData.capability_progress]);
  const mediaUploads: MediaUpload[] = useMemo(() => actData.media_uploads ?? [], [actData.media_uploads]);
  // Step Arch E — read via selector (sections[] preferred over flat field).
  const whatLearned =
    getReviewSectionContent(
      getReviewSections({ review: reviewData } as StepMetadata).sections,
      'what_did_you_learn',
    ) ?? reviewData.what_learned ?? '';
  const whatTheyDid = planData.what_will_you_do ?? '';

  // Build the post content from step data
  const buildPostContent = useCallback((): string => {
    const parts: string[] = [];

    if (note.trim()) {
      parts.push(note.trim());
      parts.push('');
    }

    parts.push(`Completed: ${stepTitle}`);

    if (whatTheyDid) {
      parts.push(`\nWhat I did: ${whatTheyDid}`);
    }

    if (whatLearned) {
      parts.push(`\nWhat I learned: ${whatLearned}`);
    }

    if (capabilityGoals.length > 0) {
      const ratingLines = capabilityGoals
        .filter((goal) => capabilityRatings[goal])
        .map((goal) => {
          const stars = capabilityRatings[goal] ?? 0;
          const starStr = Array.from({ length: 5 }, (_, i) => (i < stars ? '\u2605' : '\u2606')).join('');
          return `  ${goal}: ${starStr}`;
        });
      if (ratingLines.length > 0) {
        parts.push('\nProgress:');
        parts.push(...ratingLines);
      }
    }

    return parts.join('\n');
  }, [note, stepTitle, whatTheyDid, whatLearned, capabilityGoals, capabilityRatings]);

  // Share as follower post
  const handleSharePost = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      triggerHaptic('notificationSuccess');

      const imageUrls = mediaUploads
        .filter((m) => m.type === 'photo' && m.uri)
        .map((m) => m.uri);

      await createPost.mutateAsync({
        content: buildPostContent(),
        postType: 'milestone',
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      });

      setNote('');
      onClose();
    } catch (err) {
      console.error('Error sharing step:', err);
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, buildPostContent, createPost, mediaUploads, onClose]);

  // Cached share URL so we don't re-fetch every time
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Copy text to clipboard with fallback for web
  const copyToClipboard = useCallback(async (text: string) => {
    if (Platform.OS === 'web') {
      // Try modern API first, then fallback to execCommand
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // navigator.clipboard can fail if user-gesture context was lost
      }
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } else {
      await Clipboard.setStringAsync(text);
    }
  }, []);

  // Copy a public share link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (copyingLink) return;
    setCopyingLink(true);
    try {
      let url = shareUrl;
      if (!url) {
        const result = await enableStepSharing(stepId);
        url = result.url;
        setShareUrl(url);
      }
      await copyToClipboard(url);
      triggerHaptic('notificationSuccess');
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    } finally {
      setCopyingLink(false);
    }
  }, [stepId, copyingLink, shareUrl, copyToClipboard]);

  // Share via native share sheet as fallback / additional option
  const handleNativeShare = useCallback(async () => {
    try {
      triggerHaptic('selection');

      let message = `I completed "${stepTitle}" on BetterAt!`;
      if (whatLearned) {
        message += `\n\nWhat I learned: ${whatLearned}`;
      }
      if (whatTheyDid) {
        message += `\n\nWhat I did: ${whatTheyDid}`;
      }

      // Include public link if sharing is enabled
      let url = shareUrl;
      if (!url) {
        try {
          const result = await enableStepSharing(stepId);
          url = result.url;
          setShareUrl(url);
        } catch {
          // If sharing fails, send without link
        }
      }
      if (url) {
        message += `\n\n${url}`;
      }

      await Share.share({ message });
    } catch {
      // User cancelled or share failed — no action needed
    }
  }, [stepId, stepTitle, whatLearned, whatTheyDid, shareUrl]);

  const handleClose = useCallback(() => {
    setNote('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { paddingBottom: insets.bottom || IOS_SPACING.md }]}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.headerButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Share Step</Text>
            <Pressable
              onPress={handleSharePost}
              disabled={isSharing}
              style={[styles.headerButton, styles.shareButton]}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.shareButtonText}>Share</Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollContent}
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.scrollContentInner}
          >
            {/* Optional note input */}
            <View style={styles.noteSection}>
              <Text style={styles.noteLabel}>ADD A NOTE</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Say something about this step..."
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                value={note}
                onChangeText={setNote}
                multiline
                autoFocus
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{note.length}/500</Text>
            </View>

            {/* Step preview card */}
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons name="checkmark-circle" size={18} color={IOS_COLORS.systemGreen} />
                <Text style={styles.previewBadge}>Completed Step</Text>
              </View>

              <Text style={styles.previewTitle}>{stepTitle}</Text>

              {/* What they did */}
              {whatTheyDid ? (
                <View style={styles.previewSection}>
                  <Text style={styles.previewSectionLabel}>WHAT I DID</Text>
                  <Text style={styles.previewSectionText} numberOfLines={3}>
                    {whatTheyDid}
                  </Text>
                </View>
              ) : null}

              {/* What they learned */}
              {whatLearned ? (
                <View style={styles.previewSection}>
                  <Text style={styles.previewSectionLabel}>WHAT I LEARNED</Text>
                  <Text style={styles.previewSectionText} numberOfLines={3}>
                    {whatLearned}
                  </Text>
                </View>
              ) : null}

              {/* Evidence thumbnails */}
              {mediaUploads.length > 0 && (
                <View style={styles.mediaThumbnails}>
                  {mediaUploads.slice(0, 4).map((media, idx) => (
                    <View key={media.id || idx} style={styles.thumbnailWrapper}>
                      <Image source={{ uri: media.uri }} style={styles.thumbnail} />
                      {idx === 3 && mediaUploads.length > 4 && (
                        <View style={styles.thumbnailOverlay}>
                          <Text style={styles.thumbnailOverlayText}>
                            +{mediaUploads.length - 4}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Capability ratings */}
              {capabilityGoals.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={styles.previewSectionLabel}>PROGRESS</Text>
                  {capabilityGoals.map((goal) => {
                    const rating = capabilityRatings[goal] ?? 0;
                    if (rating === 0) return null;
                    return (
                      <View key={goal} style={styles.ratingRow}>
                        <Text style={styles.ratingLabel} numberOfLines={1}>
                          {goal}
                        </Text>
                        <View style={styles.starRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={star <= rating ? 'star' : 'star-outline'}
                              size={14}
                              color={
                                star <= rating
                                  ? IOS_COLORS.systemOrange
                                  : IOS_COLORS.systemGray3
                              }
                            />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Copy public link */}
            <Pressable
              style={[styles.nativeShareButton, linkCopied && styles.linkCopiedButton]}
              onPress={handleCopyLink}
              disabled={copyingLink}
            >
              {copyingLink ? (
                <ActivityIndicator size="small" color={STEP_COLORS.accent} />
              ) : (
                <Ionicons
                  name={linkCopied ? 'checkmark-circle' : 'link-outline'}
                  size={18}
                  color={linkCopied ? IOS_COLORS.systemGreen : STEP_COLORS.accent}
                />
              )}
              <Text style={[styles.nativeShareText, linkCopied && { color: IOS_COLORS.systemGreen }]}>
                {linkCopied ? 'Link copied!' : 'Copy Link'}
              </Text>
            </Pressable>

            {/* Native share option */}
            <Pressable
              style={styles.nativeShareButton}
              onPress={handleNativeShare}
            >
              <Ionicons
                name="share-outline"
                size={18}
                color={STEP_COLORS.accent}
              />
              <Text style={styles.nativeShareText}>Share via...</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  headerButton: {
    paddingVertical: IOS_SPACING.xs,
    paddingHorizontal: IOS_SPACING.sm,
  },
  headerTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  cancelText: {
    ...IOS_TYPOGRAPHY.body,
    color: STEP_COLORS.accent,
  },
  shareButton: {
    backgroundColor: STEP_COLORS.accent,
    borderRadius: IOS_RADIUS.lg,
    paddingHorizontal: IOS_SPACING.lg,
    minWidth: 60,
    alignItems: 'center',
  },
  shareButtonText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.md,
  },
  noteSection: {
    gap: IOS_SPACING.xs,
  },
  noteLabel: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },
  noteInput: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    minHeight: 80,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
    padding: IOS_SPACING.md,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {},
    }),
  },
  charCount: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'right',
  },
  previewCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewBadge: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
    color: IOS_COLORS.systemGreen,
  },
  previewTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  previewSection: {
    gap: IOS_SPACING.xs,
    paddingTop: IOS_SPACING.xs,
  },
  previewSectionLabel: {
    ...IOS_TYPOGRAPHY.caption2,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },
  previewSectionText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.label,
  },
  mediaThumbnails: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
    paddingTop: IOS_SPACING.xs,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: IOS_RADIUS.sm,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: IOS_RADIUS.sm,
    backgroundColor: IOS_COLORS.systemGray5,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: IOS_RADIUS.sm,
  },
  thumbnailOverlayText: {
    ...IOS_TYPOGRAPHY.subhead,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: IOS_SPACING.sm,
  },
  ratingLabel: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.label,
    flex: 1,
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
  },
  linkCopiedButton: {
    borderColor: IOS_COLORS.systemGreen,
    borderWidth: 1,
  },
  nativeShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
  },
  nativeShareText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: STEP_COLORS.accent,
    fontWeight: '500',
  },
});

export default ShareStepSheet;
