/**
 * StepDrawContent — Active session content for the Draw/Act phase.
 * Shows sub-step checklist from plan, linked resources, media links,
 * session notes, and plan summary.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet, Platform, Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import { ResourceTypeIcon } from '@/components/library/ResourceTypeIcon';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useUpdateStep } from '@/hooks/useTimelineSteps';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { getResourcesByIds } from '@/services/LibraryService';
import type { StepPlanData, StepActData, StepMetadata, MediaLink, MediaLinkPlatform, MediaUpload, Observation } from '@/types/step-detail';
import { ObservationLog } from './ObservationLog';
import type { LibraryResourceRecord } from '@/types/library';
import { TrainChatPanel } from '@/components/practice/phases/TrainChatPanel';

const IS_NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';
const IS_WEB = Platform.OS === 'web';
const MAX_IMAGE_WIDTH = 1200; // Resize to keep storage small

/**
 * Convert a YouTube URL to an embeddable URL.
 * Returns null if the URL is not a YouTube link.
 */
function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      videoId = u.searchParams.get('v');
    } else if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}
const IMAGE_QUALITY = 0.6;   // JPEG quality — balance size vs clarity
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB cap

/**
 * Client-side image resize on web using Canvas.
 * Returns a small JPEG/WebP blob suitable for upload.
 */
function resizeImageOnWeb(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_IMAGE_WIDTH) {
        height = Math.round(height * (MAX_IMAGE_WIDTH / width));
        width = MAX_IMAGE_WIDTH;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        IMAGE_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Platform detection from URL
// ---------------------------------------------------------------------------

function detectPlatform(url: string): MediaLinkPlatform {
  const lower = url.toLowerCase();
  if (lower.includes('photos.google.com') || lower.includes('photos.app.goo.gl')) return 'google_photos';
  if (lower.includes('icloud.com/photos') || lower.includes('apple.com/photos')) return 'apple_photos';
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'instagram';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('tiktok.com')) return 'tiktok';
  return 'other';
}

const PLATFORM_INFO: Record<MediaLinkPlatform, { icon: string; label: string; color: string }> = {
  google_photos: { icon: 'images', label: 'Google Photos', color: '#4285F4' },
  apple_photos: { icon: 'image', label: 'Apple Photos', color: '#007AFF' },
  instagram: { icon: 'logo-instagram', label: 'Instagram', color: '#E1306C' },
  youtube: { icon: 'logo-youtube', label: 'YouTube', color: '#FF0000' },
  tiktok: { icon: 'musical-notes', label: 'TikTok', color: '#000000' },
  other: { icon: 'link', label: 'Link', color: STEP_COLORS.accent },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StepDrawContentProps {
  stepId: string;
  readOnly?: boolean;
  interestId?: string;
  interestName?: string;
  interestSlug?: string;
}

export function StepDrawContent({ stepId, readOnly, interestId, interestName, interestSlug }: StepDrawContentProps) {
  const { data: step } = useStepDetail(stepId);
  const updateMetadata = useUpdateStepMetadata(stepId);
  const updateStep = useUpdateStep();
  const { user } = useAuth();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localNotes, setLocalNotes] = useState('');
  const [linkedResources, setLinkedResources] = useState<LibraryResourceRecord[]>([]);
  const initializedRef = useRef(false);

  // Media link form state
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewResource, setPreviewResource] = useState<LibraryResourceRecord | null>(null);

  const metadata = (step?.metadata ?? {}) as StepMetadata;
  const planData: StepPlanData = metadata.plan ?? {};
  const actData: StepActData = metadata.act ?? {};
  // Only show sub-steps with actual text on the Act tab (empty planning slots are hidden)
  const subSteps = (planData.how_sub_steps ?? []).filter((s) => s.text.trim());
  const subStepProgress = actData.sub_step_progress ?? {};
  const linkedIds = planData.linked_resource_ids ?? [];
  const mediaLinks = actData.media_links ?? [];

  // Seed local notes from server
  useEffect(() => {
    if (step && !initializedRef.current) {
      setLocalNotes(actData.notes ?? '');
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Auto-transition to in_progress when Draw tab is first viewed (owner only)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!step || autoStartedRef.current || readOnly) return;
    if (step.status === 'pending' || (!actData.started_at && step.status !== 'completed')) {
      autoStartedRef.current = true;
      updateMetadata.mutate({
        act: { ...(metadata.act ?? {}), started_at: new Date().toISOString() },
      });
      if (step.status === 'pending') {
        updateStep.mutate({ stepId, input: { status: 'in_progress' } });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Load linked resources
  const linkedIdsKey = linkedIds.join(',');
  useEffect(() => {
    if (linkedIds.length === 0) { setLinkedResources([]); return; }
    getResourcesByIds(linkedIds).then(setLinkedResources).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedIdsKey]);

  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  const saveAct = useCallback((partial: Partial<StepActData>) => {
    const current = metadataRef.current;
    updateMetadata.mutate({ act: { ...(current.act ?? {}), ...partial } });
  }, [updateMetadata]);

  const debouncedSaveAct = useCallback((partial: Partial<StepActData>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAct(partial), 600);
  }, [saveAct]);

  const handleToggleSubStep = useCallback((subStepId: string) => {
    const current = metadataRef.current.act?.sub_step_progress ?? {};
    const updated = { ...current, [subStepId]: !current[subStepId] };
    debouncedSaveAct({ sub_step_progress: updated });
  }, [debouncedSaveAct]);

  // --- Sub-step expanded actions ---
  const [expandedSubStep, setExpandedSubStep] = useState<string | null>(null);
  const [editingSubStep, setEditingSubStep] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deviatingSubStep, setDeviatingSubStep] = useState<string | null>(null);
  const [deviationText, setDeviationText] = useState('');
  const [pendingAiQuestion, setPendingAiQuestion] = useState('');
  const chatSectionRef = useRef<View>(null);
  const scrollViewRef = useRef<any>(null);

  const subStepDeviations = useMemo(() => actData.sub_step_deviations ?? {}, [actData.sub_step_deviations]);
  const subStepOverrides = useMemo(() => actData.sub_step_overrides ?? {}, [actData.sub_step_overrides]);

  const handleToggleExpand = useCallback((subStepId: string) => {
    setExpandedSubStep((prev) => prev === subStepId ? null : subStepId);
    setEditingSubStep(null);
    setDeviatingSubStep(null);
  }, []);

  const handleStartDeviation = useCallback((subStepId: string) => {
    setDeviatingSubStep(subStepId);
    setDeviationText(subStepDeviations[subStepId] ?? '');
  }, [subStepDeviations]);

  const handleSaveDeviation = useCallback((subStepId: string) => {
    const current = metadataRef.current.act?.sub_step_deviations ?? {};
    const trimmed = deviationText.trim();
    const updated = { ...current };
    if (trimmed) {
      updated[subStepId] = trimmed;
    } else {
      delete updated[subStepId];
    }
    saveAct({ sub_step_deviations: updated });
    // Also mark as completed since they did it (differently)
    const progress = metadataRef.current.act?.sub_step_progress ?? {};
    if (trimmed && !progress[subStepId]) {
      saveAct({ sub_step_progress: { ...progress, [subStepId]: true }, sub_step_deviations: updated });
    }
    setDeviatingSubStep(null);
  }, [deviationText, saveAct]);

  const handleStartEdit = useCallback((subStepId: string, currentText: string) => {
    setEditingSubStep(subStepId);
    setEditingText(subStepOverrides[subStepId] ?? currentText);
  }, [subStepOverrides]);

  const handleSaveEdit = useCallback((subStepId: string) => {
    const current = metadataRef.current.act?.sub_step_overrides ?? {};
    const trimmed = editingText.trim();
    if (trimmed) {
      saveAct({ sub_step_overrides: { ...current, [subStepId]: trimmed } });
    }
    setEditingSubStep(null);
  }, [editingText, saveAct]);

  const handleAskAi = useCallback((subStepText: string) => {
    setPendingAiQuestion(`About this sub-step: "${subStepText}" — can you help me with this?`);
    setExpandedSubStep(null);
    // Scroll to chat section
    setTimeout(() => {
      chatSectionRef.current?.measureLayout?.(
        scrollViewRef.current as any,
        (_x: number, y: number) => {
          scrollViewRef.current?.scrollTo?.({ y, animated: true });
        },
        () => {},
      );
    }, 150);
  }, []);

  const handleClearPendingQuestion = useCallback(() => {
    setPendingAiQuestion('');
  }, []);

  const handleNotesChange = useCallback((text: string) => {
    setLocalNotes(text);
    debouncedSaveAct({ notes: text });
  }, [debouncedSaveAct]);

  // Media link handlers
  const handleAddMediaLink = useCallback(() => {
    const trimmedUrl = mediaUrl.trim();
    if (!trimmedUrl) return;

    const newLink: MediaLink = {
      id: `ml_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      url: trimmedUrl,
      caption: mediaCaption.trim() || undefined,
      platform: detectPlatform(trimmedUrl),
      added_at: new Date().toISOString(),
    };

    const currentLinks = metadataRef.current.act?.media_links ?? [];
    saveAct({ media_links: [...currentLinks, newLink] });
    setMediaUrl('');
    setMediaCaption('');
    setShowAddMedia(false);
  }, [mediaUrl, mediaCaption, saveAct]);

  const handleRemoveMediaLink = useCallback((linkId: string) => {
    const currentLinks = metadataRef.current.act?.media_links ?? [];
    saveAct({ media_links: currentLinks.filter((l) => l.id !== linkId) });
  }, [saveAct]);

  // Native photo/video picker + upload
  const handlePickMedia = useCallback(async (useCamera: boolean) => {
    if (!user?.id) return;

    const pickerFn = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await pickerFn({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: IMAGE_QUALITY,
      videoMaxDuration: 30, // 30s max to keep storage small
      ...(useCamera ? {} : { allowsMultipleSelection: false }),
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    const ext = asset.uri.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fileName = `${user.id}/${stepId}/${fileId}.${ext}`;

    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('step-media')
        .upload(fileName, arrayBuffer, {
          contentType: blob.type || (isVideo ? `video/${ext}` : `image/${ext}`),
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('step-media')
        .getPublicUrl(fileName);

      const newUpload: MediaUpload = {
        id: fileId,
        uri: publicUrl,
        type: isVideo ? 'video' : 'photo',
        caption: undefined,
      };

      const currentUploads = metadataRef.current.act?.media_uploads ?? [];
      saveAct({ media_uploads: [...currentUploads, newUpload] });
    } catch (err) {
      console.error('Media upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [user?.id, stepId, saveAct]);

  const handleRemoveUpload = useCallback(async (uploadId: string) => {
    const currentUploads = metadataRef.current.act?.media_uploads ?? [];
    const upload = currentUploads.find((u) => u.id === uploadId);

    // Try to delete from storage
    if (upload && user?.id) {
      const pathMatch = upload.uri.match(/step-media\/(.+?)(\?|$)/);
      if (pathMatch?.[1]) {
        await supabase.storage.from('step-media').remove([decodeURIComponent(pathMatch[1])]).catch(() => {});
      }
    }

    saveAct({ media_uploads: currentUploads.filter((u) => u.id !== uploadId) });
  }, [user?.id, saveAct]);

  const handleUpdateUploadCaption = useCallback((uploadId: string, caption: string) => {
    const currentUploads = metadataRef.current.act?.media_uploads ?? [];
    const updated = currentUploads.map((u) =>
      u.id === uploadId ? { ...u, caption: caption || undefined } : u,
    );
    debouncedSaveAct({ media_uploads: updated });
  }, [debouncedSaveAct]);

  const handleUpdateMediaLinkCaption = useCallback((linkId: string, caption: string) => {
    const currentLinks = metadataRef.current.act?.media_links ?? [];
    const updated = currentLinks.map((l) =>
      l.id === linkId ? { ...l, caption: caption || undefined } : l,
    );
    debouncedSaveAct({ media_links: updated });
  }, [debouncedSaveAct]);

  // Web file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleWebFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) return;

    setUploading(true);
    try {
      let uploadBlob: Blob;
      let ext: string;

      if (isImage) {
        uploadBlob = await resizeImageOnWeb(file);
        ext = 'jpg';
      } else {
        // For video, enforce size cap but don't re-encode
        if (file.size > MAX_FILE_SIZE) {
          console.warn('Video exceeds 5 MB limit');
          return;
        }
        uploadBlob = file;
        ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      }

      const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const fileName = `${user.id}/${stepId}/${fileId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('step-media')
        .upload(fileName, uploadBlob, {
          contentType: isImage ? 'image/jpeg' : file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('step-media')
        .getPublicUrl(fileName);

      const newUpload: MediaUpload = {
        id: fileId,
        uri: publicUrl,
        type: isVideo ? 'video' : 'photo',
        caption: undefined,
      };

      const currentUploads = metadataRef.current.act?.media_uploads ?? [];
      saveAct({ media_uploads: [...currentUploads, newUpload] });
    } catch (err) {
      console.error('Web media upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [user?.id, stepId, saveAct]);

  const mediaUploads = actData.media_uploads ?? [];
  const observations = actData.observations ?? [];

  const handleAddObservation = useCallback((obs: Observation) => {
    const current = metadataRef.current.act?.observations ?? [];
    const updated = [...current, obs];
    // Also append to legacy notes string for Telegram compatibility
    const existingNotes = metadataRef.current.act?.notes ?? '';
    const formatted = `[${new Date(obs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${obs.text}`;
    const updatedNotes = existingNotes ? `${existingNotes}\n${formatted}` : formatted;
    saveAct({ observations: updated, notes: updatedNotes });
  }, [saveAct]);

  const handleRemoveObservation = useCallback((obsId: string) => {
    const current = metadataRef.current.act?.observations ?? [];
    saveAct({ observations: current.filter((o) => o.id !== obsId) });
  }, [saveAct]);

  const completedCount = subSteps.filter((s) => subStepProgress[s.id]).length;
  const totalSteps = subSteps.length;
  const progressPct = totalSteps > 0 ? completedCount / totalSteps : 0;

  if (!step) return null;

  const hasAnyActContent = Boolean(
    completedCount > 0 || localNotes.trim() || mediaLinks.length > 0 ||
    (actData.observations?.length ?? 0) > 0
  );

  return (
    <View style={styles.container}>
      {/* Welcome prompt when nothing recorded yet */}
      {!hasAnyActContent && !readOnly && (
        <View style={styles.emptyWelcome}>
          <Ionicons name="rocket-outline" size={20} color={STEP_COLORS.accent} />
          <View style={styles.emptyWelcomeContent}>
            <Text style={styles.emptyWelcomeTitle}>Time to do the work</Text>
            <Text style={styles.emptyWelcomeSubtitle}>
              {subSteps.length > 0
                ? 'Check off sub-steps as you go, capture notes and observations below.'
                : 'Record what happens — add notes, photos, or observations as you go.'}
            </Text>
          </View>
        </View>
      )}

      {/* Sub-step checklist */}
      {subSteps.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SUB-STEPS</Text>
            <Text style={styles.progressText}>{completedCount}/{totalSteps}</Text>
          </View>
          {totalSteps > 0 && (
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPct * 100}%` as any }]} />
            </View>
          )}
          {subSteps.map((s) => {
            const isDone = subStepProgress[s.id];
            const isExpanded = expandedSubStep === s.id;
            const hasDeviation = !!subStepDeviations[s.id];
            const displayText = subStepOverrides[s.id] || s.text || 'Untitled sub-step';
            const isDeviating = deviatingSubStep === s.id;
            const isEditing = editingSubStep === s.id;

            return (
              <View key={s.id} style={[styles.subStepContainer, isExpanded && styles.subStepContainerExpanded]}>
                {/* Main row */}
                <View style={styles.checklistRow}>
                  <Pressable
                    onPress={readOnly ? undefined : () => handleToggleSubStep(s.id)}
                    disabled={readOnly}
                    hitSlop={4}
                  >
                    <Ionicons
                      name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isDone ? IOS_COLORS.systemGreen : IOS_COLORS.systemGray3}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.checklistTextWrapper}
                    onPress={readOnly ? undefined : () => handleToggleExpand(s.id)}
                    disabled={readOnly}
                  >
                    <View style={styles.checklistTextRow}>
                      <Text style={[styles.checklistText, isDone && styles.checklistTextDone, hasDeviation && styles.checklistTextDeviated]}>
                        {displayText}
                      </Text>
                      {hasDeviation && (
                        <View style={styles.deviationBadge}>
                          <Ionicons name="swap-horizontal" size={10} color={IOS_COLORS.systemOrange} />
                        </View>
                      )}
                    </View>
                    {hasDeviation && !isExpanded && (
                      <Text style={styles.deviationPreview} numberOfLines={1}>
                        Did instead: {subStepDeviations[s.id]}
                      </Text>
                    )}
                  </Pressable>
                  {!readOnly && (
                    <Pressable
                      onPress={() => handleToggleExpand(s.id)}
                      hitSlop={8}
                      style={styles.expandButton}
                    >
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'ellipsis-horizontal'}
                        size={18}
                        color={IOS_COLORS.systemGray3}
                      />
                    </Pressable>
                  )}
                </View>

                {/* Expanded actions */}
                {isExpanded && !readOnly && (
                  <View style={styles.subStepActions}>
                    {/* Deviation section */}
                    {isDeviating ? (
                      <View style={styles.deviationForm}>
                        <Text style={styles.deviationLabel}>What did you do instead?</Text>
                        <TextInput
                          style={styles.deviationInput}
                          value={deviationText}
                          onChangeText={setDeviationText}
                          placeholder="Describe what you actually did..."
                          placeholderTextColor={IOS_COLORS.tertiaryLabel}
                          multiline
                          autoFocus
                        />
                        <View style={styles.deviationFormActions}>
                          <Pressable
                            style={styles.deviationCancelBtn}
                            onPress={() => setDeviatingSubStep(null)}
                          >
                            <Text style={styles.deviationCancelText}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            style={styles.deviationSaveBtn}
                            onPress={() => handleSaveDeviation(s.id)}
                          >
                            <Text style={styles.deviationSaveText}>Save</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.actionRow}
                        onPress={() => handleStartDeviation(s.id)}
                      >
                        <Ionicons name="swap-horizontal" size={16} color={IOS_COLORS.systemOrange} />
                        <Text style={styles.actionText}>
                          {hasDeviation ? 'Edit what I did instead' : "Didn't follow plan"}
                        </Text>
                      </Pressable>
                    )}

                    {/* Edit sub-step */}
                    {isEditing ? (
                      <View style={styles.deviationForm}>
                        <Text style={styles.deviationLabel}>Edit this sub-step</Text>
                        <TextInput
                          style={styles.deviationInput}
                          value={editingText}
                          onChangeText={setEditingText}
                          placeholder="Update the sub-step..."
                          placeholderTextColor={IOS_COLORS.tertiaryLabel}
                          multiline
                          autoFocus
                        />
                        <View style={styles.deviationFormActions}>
                          <Pressable
                            style={styles.deviationCancelBtn}
                            onPress={() => setEditingSubStep(null)}
                          >
                            <Text style={styles.deviationCancelText}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.deviationSaveBtn, !editingText.trim() && styles.deviationSaveBtnDisabled]}
                            onPress={() => handleSaveEdit(s.id)}
                            disabled={!editingText.trim()}
                          >
                            <Text style={[styles.deviationSaveText, !editingText.trim() && styles.deviationSaveTextDisabled]}>Save</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : !isDeviating ? (
                      <Pressable
                        style={styles.actionRow}
                        onPress={() => handleStartEdit(s.id, s.text)}
                      >
                        <Ionicons name="create-outline" size={16} color={STEP_COLORS.accent} />
                        <Text style={styles.actionText}>Edit sub-step</Text>
                      </Pressable>
                    ) : null}

                    {/* Ask AI */}
                    {!isDeviating && !isEditing && (
                      <Pressable
                        style={styles.actionRow}
                        onPress={() => handleAskAi(displayText)}
                      >
                        <Ionicons name="sparkles" size={16} color={IOS_COLORS.systemPurple} />
                        <Text style={[styles.actionText, { color: IOS_COLORS.systemPurple }]}>Ask AI about this</Text>
                      </Pressable>
                    )}

                    {/* Show saved deviation */}
                    {hasDeviation && !isDeviating && (
                      <View style={styles.savedDeviation}>
                        <Ionicons name="swap-horizontal" size={12} color={IOS_COLORS.systemOrange} />
                        <Text style={styles.savedDeviationText}>Did instead: {subStepDeviations[s.id]}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Linked resources */}
      {linkedResources.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESOURCES</Text>
          {linkedResources.map((resource) => (
            <Pressable
              key={resource.id}
              style={styles.resourceRow}
              onPress={() => { if (resource.url) setPreviewResource(resource); }}
            >
              <ResourceTypeIcon type={resource.resource_type} size={18} />
              <View style={styles.resourceInfo}>
                <Text style={styles.resourceTitle} numberOfLines={1}>{resource.title}</Text>
                {resource.author_or_creator && (
                  <Text style={styles.resourceAuthor} numberOfLines={1}>{resource.author_or_creator}</Text>
                )}
              </View>
              <Ionicons name="eye-outline" size={16} color={STEP_COLORS.accent} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Evidence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EVIDENCE</Text>
        {!readOnly && (
          <Text style={styles.sectionHint}>Add photos, videos, or links to show what you made</Text>
        )}

        {/* Uploaded photos/videos */}
        {mediaUploads.length > 0 && (
          <View style={styles.thumbnailGrid}>
            {mediaUploads.map((upload) => (
              <View key={upload.id} style={styles.thumbnailColumn}>
                <Pressable
                  style={styles.thumbnailWrapper}
                  onPress={() => upload.type === 'photo' ? setPreviewUri(upload.uri) : undefined}
                >
                  <Image source={{ uri: upload.uri }} style={styles.thumbnail} />
                  <View style={styles.thumbnailBadge}>
                    <Ionicons
                      name={upload.type === 'video' ? 'videocam' : 'image'}
                      size={10}
                      color="#FFFFFF"
                    />
                  </View>
                  {!readOnly && (
                    <Pressable
                      style={styles.thumbnailRemove}
                      onPress={() => handleRemoveUpload(upload.id)}
                      hitSlop={6}
                    >
                      <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.9)" />
                    </Pressable>
                  )}
                </Pressable>
                {!readOnly ? (
                  <TextInput
                    style={styles.captionInput}
                    defaultValue={upload.caption ?? ''}
                    onChangeText={(text) => handleUpdateUploadCaption(upload.id, text)}
                    placeholder="Add caption..."
                    placeholderTextColor={IOS_COLORS.tertiaryLabel}
                    numberOfLines={1}
                    multiline={false}
                  />
                ) : upload.caption ? (
                  <Text style={styles.captionInput}>{upload.caption}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Fullscreen image preview modal */}
        <Modal
          visible={!!previewUri}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewUri(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setPreviewUri(null)}>
            <Pressable style={styles.modalCloseButton} onPress={() => setPreviewUri(null)}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
            {previewUri && (
              <Image
                source={{ uri: previewUri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
          </Pressable>
        </Modal>

        {/* Resource preview modal */}
        <Modal
          visible={!!previewResource}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewResource(null)}
        >
          <View style={styles.resourceModalOverlay}>
            <View style={styles.resourceModalContainer}>
              {/* Header */}
              <View style={styles.resourceModalHeader}>
                <View style={styles.resourceModalHeaderLeft}>
                  {previewResource && <ResourceTypeIcon type={previewResource.resource_type} size={18} />}
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.resourceModalTitle} numberOfLines={1}>
                      {previewResource?.title}
                    </Text>
                    {previewResource?.author_or_creator && (
                      <Text style={styles.resourceModalAuthor} numberOfLines={1}>
                        {previewResource.author_or_creator}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.resourceModalActions}>
                  {previewResource?.url && (
                    <Pressable
                      style={styles.resourceModalOpenBtn}
                      onPress={() => { if (previewResource.url) Linking.openURL(previewResource.url); }}
                    >
                      <Ionicons name="open-outline" size={16} color={STEP_COLORS.accent} />
                      <Text style={styles.resourceModalOpenText}>Open</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.resourceModalCloseBtn}
                    onPress={() => setPreviewResource(null)}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={22} color={IOS_COLORS.secondaryLabel} />
                  </Pressable>
                </View>
              </View>
              {/* Content — iframe for web */}
              {IS_WEB && previewResource?.url && (
                <View style={styles.resourceModalBody}>
                  {(() => {
                    const embedUrl = getYouTubeEmbedUrl(previewResource.url);
                    const src = embedUrl || previewResource.url;
                    return (
                      <iframe
                        src={src}
                        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 } as any}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    );
                  })()}
                </View>
              )}
              {/* Fallback for native — show description + open button */}
              {IS_NATIVE && previewResource && (
                <View style={styles.resourceModalBody}>
                  {previewResource.description ? (
                    <Text style={{ fontSize: 14, color: IOS_COLORS.label, lineHeight: 20, padding: IOS_SPACING.md }}>
                      {previewResource.description}
                    </Text>
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: IOS_SPACING.sm }}>
                      <Ionicons name="globe-outline" size={40} color={IOS_COLORS.systemGray3} />
                      <Text style={{ fontSize: 14, color: IOS_COLORS.secondaryLabel }}>
                        Tap "Open" to view in browser
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Linked media */}
        {mediaLinks.map((link) => {
          const info = PLATFORM_INFO[link.platform];
          return (
            <View key={link.id} style={styles.mediaLinkColumn}>
              <View style={styles.mediaLinkRow}>
                <Pressable
                  style={styles.mediaLinkContent}
                  onPress={() => Linking.openURL(link.url)}
                >
                  <View style={[styles.mediaLinkIcon, { backgroundColor: `${info.color}15` }]}>
                    <Ionicons name={info.icon as any} size={18} color={info.color} />
                  </View>
                  <View style={styles.mediaLinkInfo}>
                    <Text style={styles.mediaLinkLabel} numberOfLines={1}>
                      {link.caption || info.label}
                    </Text>
                    <Text style={styles.mediaLinkUrl} numberOfLines={1}>
                      {link.url}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={14} color={STEP_COLORS.accent} />
                </Pressable>
                <Pressable
                  onPress={() => handleRemoveMediaLink(link.id)}
                  hitSlop={8}
                  style={styles.mediaLinkRemove}
                >
                  <Ionicons name="close-circle" size={18} color={IOS_COLORS.systemGray3} />
                </Pressable>
              </View>
              <TextInput
                style={styles.mediaLinkCaptionInput}
                defaultValue={link.caption ?? ''}
                onChangeText={(text) => handleUpdateMediaLinkCaption(link.id, text)}
                placeholder="Add caption..."
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                numberOfLines={1}
                multiline={false}
              />
            </View>
          );
        })}

        {readOnly ? null : showAddMedia ? (
          <View style={styles.addMediaForm}>
            <TextInput
              style={styles.mediaInput}
              value={mediaUrl}
              onChangeText={setMediaUrl}
              placeholder="Paste photo/video URL..."
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            <TextInput
              style={styles.mediaInput}
              value={mediaCaption}
              onChangeText={setMediaCaption}
              placeholder="Caption (optional)"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
            />
            {mediaUrl.trim() !== '' && (
              <View style={styles.detectedPlatform}>
                <Ionicons
                  name={PLATFORM_INFO[detectPlatform(mediaUrl)].icon as any}
                  size={14}
                  color={PLATFORM_INFO[detectPlatform(mediaUrl)].color}
                />
                <Text style={styles.detectedPlatformText}>
                  {PLATFORM_INFO[detectPlatform(mediaUrl)].label}
                </Text>
              </View>
            )}
            <View style={styles.addMediaActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => { setShowAddMedia(false); setMediaUrl(''); setMediaCaption(''); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, !mediaUrl.trim() && styles.saveButtonDisabled]}
                onPress={handleAddMediaLink}
                disabled={!mediaUrl.trim()}
              >
                <Text style={[styles.saveButtonText, !mediaUrl.trim() && styles.saveButtonTextDisabled]}>
                  Add
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.addMediaRow}>
            {IS_NATIVE && (
              <>
                <Pressable
                  style={styles.addMediaChip}
                  onPress={() => handlePickMedia(true)}
                  disabled={uploading}
                >
                  <Ionicons name="camera" size={18} color={STEP_COLORS.accent} />
                  <Text style={styles.addMediaChipText}>Camera</Text>
                </Pressable>
                <Pressable
                  style={styles.addMediaChip}
                  onPress={() => handlePickMedia(false)}
                  disabled={uploading}
                >
                  <Ionicons name="images" size={18} color={STEP_COLORS.accent} />
                  <Text style={styles.addMediaChipText}>Gallery</Text>
                </Pressable>
              </>
            )}
            {IS_WEB && (
              <>
                <input
                  ref={fileInputRef as any}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime"
                  style={{ display: 'none' }}
                  onChange={handleWebFileUpload as any}
                />
                <Pressable
                  style={styles.addMediaChip}
                  onPress={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Ionicons name="cloud-upload" size={18} color={STEP_COLORS.accent} />
                  <Text style={styles.addMediaChipText}>Upload</Text>
                </Pressable>
              </>
            )}
            <Pressable
              style={styles.addMediaChip}
              onPress={() => setShowAddMedia(true)}
            >
              <Ionicons name="link" size={18} color={STEP_COLORS.accent} />
              <Text style={styles.addMediaChipText}>Paste Link</Text>
            </Pressable>
          </View>
        )}

        {uploading && (
          <View style={styles.uploadingBadge}>
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}
      </View>

      {/* Observation log */}
      <View style={styles.section}>
        <ObservationLog
          observations={observations}
          onAdd={handleAddObservation}
          onRemove={handleRemoveObservation}
          readOnly={readOnly}
        />
      </View>

      {/* Session notes — AI chat when context available, plain textarea fallback */}
      {interestId && interestName && !readOnly ? (
        <View ref={chatSectionRef} style={styles.section}>
          <TrainChatPanel
            interestId={interestId}
            interestName={interestName}
            interestSlug={interestSlug}
            stepId={stepId}
            stepTitle={step?.title || planData.what_will_you_do || 'This step'}
            planWhat={planData.what_will_you_do}
            onUpdateNotes={handleNotesChange}
            pendingQuestion={pendingAiQuestion}
            onPendingQuestionConsumed={handleClearPendingQuestion}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STEP NOTES</Text>
          <TextInput
            style={styles.textArea}
            value={localNotes}
            onChangeText={readOnly ? undefined : handleNotesChange}
            placeholder={readOnly ? '' : "Capture thoughts as you work..."}
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            multiline
            textAlignVertical="top"
            editable={!readOnly}
          />
        </View>
      )}

      {/* Plan summary */}
      {planData.what_will_you_do && (
        <View style={styles.planSummary}>
          <Ionicons name="bulb-outline" size={16} color={IOS_COLORS.secondaryLabel} />
          <Text style={styles.planSummaryText} numberOfLines={3}>
            {planData.what_will_you_do}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.md,
    gap: IOS_SPACING.md,
  },
  emptyWelcome: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${STEP_COLORS.accent}08`,
    borderRadius: 10,
    padding: 12,
  },
  emptyWelcomeContent: {
    flex: 1,
    gap: 2,
  },
  emptyWelcomeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  emptyWelcomeSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  section: {
    gap: IOS_SPACING.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    lineHeight: 18,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: STEP_COLORS.accent,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: IOS_COLORS.systemGreen,
    borderRadius: 2,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  checklistText: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  checklistTextDone: {
    textDecorationLine: 'line-through',
    color: IOS_COLORS.secondaryLabel,
  },
  checklistTextDeviated: {
    fontStyle: 'italic',
  },
  checklistTextWrapper: {
    flex: 1,
    gap: 2,
  },
  checklistTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subStepContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  subStepContainerExpanded: {
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 10,
    borderBottomWidth: 0,
    marginVertical: 2,
  },
  expandButton: {
    padding: 4,
  },
  deviationBadge: {
    backgroundColor: `${IOS_COLORS.systemOrange}18`,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  deviationPreview: {
    fontSize: 12,
    color: IOS_COLORS.systemOrange,
    fontStyle: 'italic',
    paddingLeft: 2,
  },
  subStepActions: {
    paddingHorizontal: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.sm,
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  deviationForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: IOS_SPACING.sm,
    gap: IOS_SPACING.xs,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
  },
  deviationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.3,
  },
  deviationInput: {
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
    padding: IOS_SPACING.sm,
    minHeight: 60,
    textAlignVertical: 'top',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  deviationFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: IOS_SPACING.sm,
  },
  deviationCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deviationCancelText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  deviationSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: STEP_COLORS.accent,
  },
  deviationSaveBtnDisabled: {
    backgroundColor: IOS_COLORS.systemGray5,
  },
  deviationSaveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deviationSaveTextDisabled: {
    color: IOS_COLORS.systemGray3,
  },
  savedDeviation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: `${IOS_COLORS.systemOrange}10`,
    borderRadius: 8,
    padding: IOS_SPACING.xs,
    marginTop: 2,
  },
  savedDeviationText: {
    flex: 1,
    fontSize: 12,
    color: IOS_COLORS.systemOrange,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 10,
    padding: IOS_SPACING.sm,
  },
  resourceInfo: {
    flex: 1,
    gap: 1,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  resourceAuthor: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  // Uploaded media thumbnails
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbnailColumn: {
    width: 80,
    gap: 2,
  },
  thumbnailWrapper: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: IOS_COLORS.systemGray5,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  captionInput: {
    fontSize: 10,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: 2,
    paddingVertical: 2,
    textAlign: 'center',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  // Fullscreen preview modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 24,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '90%',
    height: '80%',
  },
  thumbnailBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 2,
  },
  thumbnailRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  // Media links
  mediaLinkColumn: {
    gap: 2,
  },
  mediaLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mediaLinkContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 10,
    padding: IOS_SPACING.sm,
  },
  mediaLinkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaLinkInfo: {
    flex: 1,
    gap: 1,
  },
  mediaLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  mediaLinkUrl: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  mediaLinkRemove: {
    padding: 4,
  },
  mediaLinkCaptionInput: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: 2,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  addMediaRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
    flexWrap: 'wrap',
  },
  addMediaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: STEP_COLORS.accentLight,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addMediaChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: STEP_COLORS.accent,
  },
  uploadingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: STEP_COLORS.accentLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  uploadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: STEP_COLORS.accent,
  },
  addMediaForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    padding: IOS_SPACING.sm,
    gap: IOS_SPACING.xs,
  },
  mediaInput: {
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
    padding: IOS_SPACING.sm,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  detectedPlatform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  detectedPlatformText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  addMediaActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: IOS_SPACING.sm,
    paddingTop: 4,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: STEP_COLORS.accent,
  },
  saveButtonDisabled: {
    backgroundColor: IOS_COLORS.systemGray5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonTextDisabled: {
    color: IOS_COLORS.systemGray3,
  },
  textArea: {
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    padding: IOS_SPACING.sm,
    minHeight: 100,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'vertical' } as any,
    }),
  },
  planSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: IOS_SPACING.xs,
    backgroundColor: STEP_COLORS.accentLight,
    borderRadius: 8,
    padding: IOS_SPACING.sm,
  },
  planSummaryText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  // Resource preview modal
  resourceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resourceModalContainer: {
    width: '100%',
    maxWidth: 720,
    height: '80%',
    maxHeight: 600,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.2)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
      },
    }),
  },
  resourceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
    gap: IOS_SPACING.sm,
  },
  resourceModalHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  resourceModalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  resourceModalAuthor: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  resourceModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  resourceModalOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: STEP_COLORS.accentLight,
  },
  resourceModalOpenText: {
    fontSize: 13,
    fontWeight: '600',
    color: STEP_COLORS.accent,
  },
  resourceModalCloseBtn: {
    padding: 4,
  },
  resourceModalBody: {
    flex: 1,
  },
});
