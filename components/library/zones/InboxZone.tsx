/**
 * <InboxZone> — the capture-first Inbox surface (BETTERAT_INBOX_SPEC.md).
 *
 * The "dump now, refine later" pile. A compact composer at the top captures a
 * pasted link or a jotted note in one move (no classifying up front); below it,
 * the unsorted captures list newest-first with a two-button triage: Keep (I
 * want this) or Archive (not now). Graduating a capture into a
 * step/concept/resource/blueprint lands in a follow-up.
 *
 * Lives inside LibraryLanding's shared ScrollView, so no inner scroll view.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest, type Interest } from '@/providers/InterestProvider';
import { useToast } from '@/components/ui/AppToast';
import {
  useInbox,
  useDropLink,
  useDropNote,
  useTriageInsight,
  useRefineInsight,
} from '@/hooks/useInbox';
import { InspirationWizard } from '@/components/inspiration/InspirationWizard';
import type { PlaybookInsightRecord } from '@/services/QuickCaptureService';

// A capture is a link if it parses as an http(s) URL or bare domain. Kept
// permissive — the composer is one box, so we sniff rather than ask.
function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  if (/\s/.test(t)) return false;
  return /^(https?:\/\/|www\.)\S+$/i.test(t) || /^\S+\.\S{2,}(\/\S*)?$/.test(t);
}

function normalizeUrl(text: string): string {
  const t = text.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function hostOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function InboxZone() {
  const { currentInterest, userInterests, allInterests } = useInterest();
  const currentInterestId = currentInterest?.id ?? null;
  const toast = useToast();
  const { data: items = [], isLoading } = useInbox();
  const dropLink = useDropLink(null);
  const dropNote = useDropNote(null);
  const { keep, archive } = useTriageInsight();
  const { toStep, toConcept, toResource, toBlueprint } = useRefineInsight(currentInterestId);
  const interestOptions = useMemo(() => {
    return userInterests.length
      ? userInterests
      : allInterests.filter((interest) => interest.type !== 'domain');
  }, [allInterests, userInterests]);
  const interestById = useMemo(() => {
    return new Map(allInterests.map((interest) => [interest.id, interest]));
  }, [allInterests]);
  const defaultInterestId = currentInterestId ?? interestOptions[0]?.id ?? null;
  const canRefine = Boolean(defaultInterestId);

  // The capture being graduated into a blueprint via the Get Inspired wizard.
  const [blueprintInsight, setBlueprintInsight] = useState<PlaybookInsightRecord | null>(null);
  const [blueprintDraftSource, setBlueprintDraftSource] = useState<{
    content: string;
    contentType: 'text' | 'url';
  } | null>(null);
  const [blueprintTargetInterestId, setBlueprintTargetInterestId] = useState<string | null>(null);
  const [refineDraft, setRefineDraft] = useState<RefineDraft | null>(null);
  const blueprintSource = blueprintInsight
    ? blueprintDraftSource ||
      (blueprintInsight.kind === 'link' && blueprintInsight.source_url
        ? { content: blueprintInsight.source_url, contentType: 'url' as const }
        : { content: blueprintInsight.content, contentType: 'text' as const })
    : null;

  const [draft, setDraft] = useState('');
  const capturing = dropLink.isPending || dropNote.isPending;

  const handleCapture = useCallback(() => {
    const text = draft.trim();
    if (!text || capturing) return;
    const onDone = () => setDraft('');
    if (looksLikeUrl(text)) {
      dropLink.mutate(
        { url: normalizeUrl(text) },
        {
          onSuccess: () => {
            onDone();
            toast.show('Link captured', 'success');
          },
          onError: (e) => toast.show(e.message, 'error'),
        },
      );
    } else {
      dropNote.mutate(
        { text },
        {
          onSuccess: () => {
            onDone();
            toast.show('Note captured', 'success');
          },
          onError: (e) => toast.show(e.message, 'error'),
        },
      );
    }
  }, [draft, capturing, dropLink, dropNote, toast]);

  return (
    <View style={styles.container}>
      {/* Composer — one box, paste-and-go. */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Paste a link or jot a note…"
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleCapture}
          blurOnSubmit
        />
        <Pressable
          style={[styles.captureBtn, (!draft.trim() || capturing) && styles.captureBtnDisabled]}
          onPress={handleCapture}
          disabled={!draft.trim() || capturing}
          accessibilityRole="button"
          accessibilityLabel="Capture to inbox"
        >
          {capturing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      {isLoading && items.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={IOS_COLORS.tertiaryLabel} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="file-tray-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
          <Text style={styles.emptyTitle}>Inbox zero</Text>
          <Text style={styles.emptyBody}>
            Dump a link or a half-formed idea here without deciding what it is yet.
            Sort it into a step, concept, or resource later.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item, idx) => (
            <InboxRow
              key={item.id}
              item={item}
              first={idx === 0}
              canRefine={canRefine}
              keeping={keep.isPending && keep.variables?.insightId === item.id}
              archiving={archive.isPending && archive.variables?.insightId === item.id}
              steppingTo={toStep.isPending && toStep.variables?.insight.id === item.id}
              conceptingTo={toConcept.isPending && toConcept.variables?.insight.id === item.id}
              resourcingTo={toResource.isPending && toResource.variables?.insight.id === item.id}
              blueprintingTo={
                (toBlueprint.isPending && toBlueprint.variables?.insight.id === item.id) ||
                blueprintInsight?.id === item.id ||
                (refineDraft?.kind === 'blueprint' && refineDraft.item.id === item.id)
              }
              interestName={
                item.interest_id ? interestById.get(item.interest_id)?.name ?? null : null
              }
              onKeep={() =>
                keep.mutate(
                  { insightId: item.id },
                  { onError: (e) => toast.show(e.message, 'error') },
                )
              }
              onArchive={() =>
                archive.mutate(
                  { insightId: item.id },
                  { onError: (e) => toast.show(e.message, 'error') },
                )
              }
              onMakeStep={() => setRefineDraft(makeRefineDraft('step', item, defaultInterestId))}
              onMakeConcept={() =>
                setRefineDraft(makeRefineDraft('concept', item, defaultInterestId))
              }
              onMakeResource={() =>
                setRefineDraft(makeRefineDraft('resource', item, defaultInterestId))
              }
              onMakeBlueprint={() =>
                setRefineDraft(makeRefineDraft('blueprint', item, defaultInterestId))
              }
            />
          ))}
        </View>
      )}

      <RefineDialog
        draft={refineDraft}
        busy={
          toStep.isPending ||
          toConcept.isPending ||
          toResource.isPending ||
          blueprintInsight != null
        }
        onChange={setRefineDraft}
        interestOptions={interestOptions}
        interestById={interestById}
        onClose={() => setRefineDraft(null)}
        onSubmit={(draftValue) => {
          if (draftValue.kind === 'step') {
            toStep.mutate(
              {
                insight: draftValue.item,
                interestId: draftValue.interestId,
                title: draftValue.title,
                description: draftValue.body,
              },
              {
                onSuccess: () => {
                  setRefineDraft(null);
                  toast.show('Made a step', 'success');
                },
                onError: (e) => toast.show(e.message, 'error'),
              },
            );
            return;
          }
          if (draftValue.kind === 'concept') {
            toConcept.mutate(
              {
                insight: draftValue.item,
                interestId: draftValue.interestId,
                title: draftValue.title,
                body: draftValue.body,
              },
              {
                onSuccess: () => {
                  setRefineDraft(null);
                  toast.show('Made a concept', 'success');
                },
                onError: (e) => toast.show(e.message, 'error'),
              },
            );
            return;
          }
          if (draftValue.kind === 'resource') {
            toResource.mutate(
              {
                insight: draftValue.item,
                interestId: draftValue.interestId,
                title: draftValue.title,
              },
              {
                onSuccess: () => {
                  setRefineDraft(null);
                  toast.show('Saved as resource', 'success');
                },
                onError: (e) => toast.show(e.message, 'error'),
              },
            );
            return;
          }
          const source = [
            `Blueprint focus: ${draftValue.title.trim()}`,
            draftValue.body.trim() || null,
          ]
            .filter(Boolean)
            .join('\n\n');
          setBlueprintDraftSource({ content: source, contentType: 'text' });
          setBlueprintTargetInterestId(draftValue.interestId);
          setRefineDraft(null);
          setBlueprintInsight(draftValue.item);
        }}
      />

      {blueprintInsight && blueprintSource ? (
        <InspirationWizard
          visible
          initialSource={blueprintSource}
          initialSelectedExistingInterestId={blueprintTargetInterestId}
          onActivated={(result) =>
            toBlueprint.mutate(
              { insight: blueprintInsight, blueprintId: result.blueprintId },
              { onError: (e) => toast.show(e.message, 'error') },
            )
          }
          onClose={() => {
            setBlueprintInsight(null);
            setBlueprintDraftSource(null);
            setBlueprintTargetInterestId(null);
          }}
        />
      ) : null}
    </View>
  );
}

type RefineKind = 'step' | 'concept' | 'resource' | 'blueprint';

interface RefineDraft {
  kind: RefineKind;
  item: PlaybookInsightRecord;
  interestId: string | null;
  title: string;
  body: string;
}

function titleForInboxItem(item: PlaybookInsightRecord, fallback: string): string {
  if (item.kind === 'link' && item.source_url) {
    return item.title?.trim() || hostOf(item.source_url) || fallback;
  }
  const content = item.content.trim();
  const firstLine = content.split(/[.!?\n]/)[0]?.trim();
  return firstLine || content.slice(0, 80) || fallback;
}

function bodyForInboxItem(item: PlaybookInsightRecord): string {
  const note = item.content.trim();
  if (item.kind === 'link' && item.source_url) {
    return [note || null, `Source: ${item.source_url}`].filter(Boolean).join('\n\n');
  }
  return note;
}

function makeRefineDraft(
  kind: RefineKind,
  item: PlaybookInsightRecord,
  defaultInterestId: string | null,
): RefineDraft {
  const fallback =
    kind === 'step'
      ? 'Untitled step'
      : kind === 'concept'
        ? 'Untitled concept'
      : kind === 'resource'
        ? 'Untitled resource'
      : 'New blueprint';
  return {
    kind,
    item,
    interestId: item.interest_id ?? defaultInterestId,
    title: titleForInboxItem(item, fallback),
    body: bodyForInboxItem(item),
  };
}

function RefineDialog({
  draft,
  busy,
  onChange,
  interestOptions,
  interestById,
  onClose,
  onSubmit,
}: {
  draft: RefineDraft | null;
  busy: boolean;
  onChange: (draft: RefineDraft | null) => void;
  interestOptions: Interest[];
  interestById: Map<string, Interest>;
  onClose: () => void;
  onSubmit: (draft: RefineDraft) => void;
}) {
  if (!draft) return null;
  const config = refineDialogConfig[draft.kind];
  const selectedInterest = draft.interestId ? interestById.get(draft.interestId) ?? null : null;
  const dialogInterestOptions =
    selectedInterest && !interestOptions.some((interest) => interest.id === selectedInterest.id)
      ? [selectedInterest, ...interestOptions]
      : interestOptions;
  const canSubmit = draft.title.trim().length > 0 && !!draft.interestId && !busy;
  const isResource = draft.kind === 'resource';
  const isBlueprint = draft.kind === 'blueprint';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.dialogBackdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
        <View style={styles.dialogCard}>
          <View style={styles.dialogHeader}>
            <View style={[styles.dialogIcon, { backgroundColor: config.tint }]}>
              <Ionicons name={config.icon} size={18} color={config.color} />
            </View>
            <View style={styles.dialogTitleWrap}>
              <Text style={styles.dialogTitle}>{config.title}</Text>
              <Text style={styles.dialogSubtitle}>{config.subtitle}</Text>
            </View>
            <Pressable
              style={styles.dialogClose}
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={IOS_COLORS.secondaryLabel} />
            </Pressable>
          </View>

          <Text style={styles.dialogLabel}>{config.titleLabel}</Text>
          <TextInput
            value={draft.title}
            onChangeText={(title) => onChange({ ...draft, title })}
            style={styles.dialogInput}
            placeholder={config.titlePlaceholder}
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            editable={!busy}
            autoFocus
          />

          <Text style={styles.dialogLabel}>Interest</Text>
          {dialogInterestOptions.length > 0 ? (
            <View style={styles.dialogInterestGrid}>
              {dialogInterestOptions.map((interest) => {
                const selected = draft.interestId === interest.id;
                return (
                  <Pressable
                    key={interest.id}
                    style={[
                      styles.dialogInterestChip,
                      selected && {
                        borderColor: interest.accent_color,
                        backgroundColor: `${interest.accent_color}18`,
                      },
                    ]}
                    onPress={() => onChange({ ...draft, interestId: interest.id })}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${interest.name}`}
                  >
                    <View
                      style={[
                        styles.dialogInterestDot,
                        { backgroundColor: interest.accent_color },
                      ]}
                    />
                    <Text style={styles.dialogInterestText} numberOfLines={1}>
                      {interest.name}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={14} color={interest.accent_color} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.dialogHint}>
              Add an interest before sorting this inbox item.
            </Text>
          )}

          {!isResource ? (
            <>
              <Text style={styles.dialogLabel}>{config.bodyLabel}</Text>
              <TextInput
                value={draft.body}
                onChangeText={(body) => onChange({ ...draft, body })}
                style={[styles.dialogInput, styles.dialogTextArea]}
                placeholder={config.bodyPlaceholder}
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                editable={!busy}
                multiline
              />
            </>
          ) : null}

          {isBlueprint ? (
            <Text style={styles.dialogHint}>
              This opens the blueprint builder with this focus and source text.
            </Text>
          ) : null}

          <View style={styles.dialogActions}>
            <Pressable
              style={[styles.dialogButton, styles.dialogCancel]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.dialogButton,
                styles.dialogSubmit,
                { backgroundColor: config.color },
                !canSubmit && styles.dialogSubmitDisabled,
              ]}
              onPress={() => onSubmit(draft)}
              disabled={!canSubmit}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.dialogSubmitText}>{config.submitLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const refineDialogConfig: Record<
  RefineKind,
  {
    title: string;
    subtitle: string;
    titleLabel: string;
    titlePlaceholder: string;
    bodyLabel: string;
    bodyPlaceholder: string;
    submitLabel: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    tint: string;
  }
> = {
  step: {
    title: 'Make a step',
    subtitle: 'Turn this inbox item into something you can do next.',
    titleLabel: 'Step title',
    titlePlaceholder: 'What will you do?',
    bodyLabel: 'Starting note',
    bodyPlaceholder: 'Add context, source, or what success looks like.',
    submitLabel: 'Create step',
    icon: 'list-outline',
    color: '#007AFF',
    tint: 'rgba(0,122,255,0.12)',
  },
  concept: {
    title: 'Make a concept',
    subtitle: 'Save the idea as something you are learning or noticing.',
    titleLabel: 'Concept name',
    titlePlaceholder: 'What idea is this?',
    bodyLabel: 'Seed note',
    bodyPlaceholder: 'Capture the useful part in your own words.',
    submitLabel: 'Create concept',
    icon: 'bulb-outline',
    color: '#8E5BE8',
    tint: 'rgba(142,91,232,0.13)',
  },
  resource: {
    title: 'Save as resource',
    subtitle: 'Keep this link in your library for later reference.',
    titleLabel: 'Resource title',
    titlePlaceholder: 'What should this be called?',
    bodyLabel: '',
    bodyPlaceholder: '',
    submitLabel: 'Save resource',
    icon: 'library-outline',
    color: '#34C759',
    tint: 'rgba(52,199,89,0.13)',
  },
  blueprint: {
    title: 'Build a blueprint',
    subtitle: 'Use this as raw material for a reusable plan.',
    titleLabel: 'Blueprint starting point',
    titlePlaceholder: 'What should the builder focus on?',
    bodyLabel: 'Source going into the builder',
    bodyPlaceholder: 'Source text or link',
    submitLabel: 'Open builder',
    icon: 'sparkles-outline',
    color: '#FF9500',
    tint: 'rgba(255,149,0,0.14)',
  },
};

function InboxRow({
  item,
  first,
  canRefine,
  interestName,
  keeping,
  archiving,
  steppingTo,
  conceptingTo,
  resourcingTo,
  blueprintingTo,
  onKeep,
  onArchive,
  onMakeStep,
  onMakeConcept,
  onMakeResource,
  onMakeBlueprint,
}: {
  item: PlaybookInsightRecord;
  first: boolean;
  canRefine: boolean;
  interestName: string | null;
  keeping: boolean;
  archiving: boolean;
  steppingTo: boolean;
  conceptingTo: boolean;
  resourcingTo: boolean;
  blueprintingTo: boolean;
  onKeep: () => void;
  onArchive: () => void;
  onMakeStep: () => void;
  onMakeConcept: () => void;
  onMakeResource: () => void;
  onMakeBlueprint: () => void;
}) {
  const [sorting, setSorting] = useState(false);
  const isLink = item.kind === 'link' && !!item.source_url;
  const primary = isLink
    ? item.title?.trim() || hostOf(item.source_url!)
    : item.content.trim() || 'Untitled note';
  const secondary = isLink
    ? item.content.trim() || item.source_url!
    : null;
  const rowMeta = [
    secondary,
    interestName ? `In ${interestName}` : 'Unfiled',
  ].filter(Boolean).join(' · ');
  const refining = steppingTo || conceptingTo || resourcingTo || blueprintingTo;
  const busy = keeping || archiving || refining;

  return (
    <View style={[styles.rowWrap, first && styles.rowFirst]}>
      <View style={styles.row}>
        <View style={[styles.kindBadge, isLink ? styles.kindLink : styles.kindNote]}>
          <Ionicons
            name={isLink ? 'link' : item.kind === 'voice' ? 'mic' : 'document-text'}
            size={15}
            color={isLink ? '#0A84FF' : '#8E5BE8'}
          />
        </View>
        <Pressable
          style={styles.rowBody}
          disabled={!isLink}
          onPress={() => isLink && Linking.openURL(normalizeUrl(item.source_url!))}
        >
          <Text style={styles.rowPrimary} numberOfLines={2}>
            {primary}
          </Text>
          {rowMeta ? (
            <Text style={styles.rowSecondary} numberOfLines={1}>
              {rowMeta}
            </Text>
          ) : null}
        </Pressable>
        <View style={styles.rowActions}>
          {canRefine ? (
            <Pressable
              style={styles.actionBtn}
              onPress={() => setSorting((s) => !s)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Sort into a step or concept"
              hitSlop={6}
            >
              <Ionicons
                name={sorting ? 'chevron-up' : 'git-branch-outline'}
                size={20}
                color="#007AFF"
              />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.actionBtn}
            onPress={onKeep}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Keep"
            hitSlop={6}
          >
            {keeping ? (
              <ActivityIndicator size="small" color="#34C759" />
            ) : (
              <Ionicons name="bookmark-outline" size={20} color="#34C759" />
            )}
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={onArchive}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Archive"
            hitSlop={6}
          >
            {archiving ? (
              <ActivityIndicator size="small" color={IOS_COLORS.systemGray} />
            ) : (
              <Ionicons name="archive-outline" size={20} color={IOS_COLORS.systemGray} />
            )}
          </Pressable>
        </View>
      </View>

      {sorting && canRefine ? (
        <View style={styles.refinePanel}>
          <Pressable
            style={styles.refineBtn}
            onPress={onMakeStep}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Make a step"
          >
            {steppingTo ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="list-outline" size={17} color="#007AFF" />
            )}
            <Text style={styles.refineBtnText}>Make a step</Text>
          </Pressable>
          <Pressable
            style={styles.refineBtn}
            onPress={onMakeConcept}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Make a concept"
          >
            {conceptingTo ? (
              <ActivityIndicator size="small" color="#8E5BE8" />
            ) : (
              <Ionicons name="bulb-outline" size={17} color="#8E5BE8" />
            )}
            <Text style={[styles.refineBtnText, { color: '#8E5BE8' }]}>Make a concept</Text>
          </Pressable>
        </View>
      ) : null}

      {sorting && canRefine ? (
        <View style={styles.refinePanelSecond}>
          {isLink ? (
            <Pressable
              style={styles.refineBtn}
              onPress={onMakeResource}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save as resource"
            >
              {resourcingTo ? (
                <ActivityIndicator size="small" color="#34C759" />
              ) : (
                <Ionicons name="library-outline" size={17} color="#34C759" />
              )}
              <Text style={[styles.refineBtnText, { color: '#34C759' }]}>Save as resource</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.refineBtn}
            onPress={onMakeBlueprint}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Build a blueprint"
          >
            {blueprintingTo ? (
              <ActivityIndicator size="small" color="#FF9500" />
            ) : (
              <Ionicons name="sparkles-outline" size={17} color="#FF9500" />
            )}
            <Text style={[styles.refineBtnText, { color: '#FF9500' }]}>Build a blueprint</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.lg,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: IOS_COLORS.label,
    paddingVertical: 6,
    maxHeight: 120,
  },
  captureBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  captureBtnDisabled: {
    backgroundColor: IOS_COLORS.systemGray3,
  },
  dialogBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  dialogCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dialogIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  dialogSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  dialogClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemGray6,
  },
  dialogLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
  },
  dialogInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.18)',
    backgroundColor: IOS_COLORS.systemGray6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  dialogTextArea: {
    minHeight: 96,
    maxHeight: 180,
    textAlignVertical: 'top',
  },
  dialogInterestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dialogInterestChip: {
    minHeight: 34,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.16)',
    backgroundColor: IOS_COLORS.systemGray6,
    paddingHorizontal: 10,
  },
  dialogInterestDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dialogInterestText: {
    maxWidth: 170,
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  dialogHint: {
    fontSize: 12,
    lineHeight: 17,
    color: IOS_COLORS.secondaryLabel,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  dialogButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancel: {
    backgroundColor: IOS_COLORS.systemGray6,
  },
  dialogCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  dialogSubmit: {
    backgroundColor: '#007AFF',
  },
  dialogSubmitDisabled: {
    opacity: 0.45,
  },
  dialogSubmitText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loading: {
    alignItems: 'center',
    paddingVertical: IOS_SPACING.xl,
  },
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: IOS_SPACING.xl,
    paddingHorizontal: IOS_SPACING.lg,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: IOS_COLORS.secondaryLabel,
  },
  list: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
    overflow: 'hidden',
  },
  rowWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.12)',
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  refinePanel: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 11,
    paddingTop: 1,
  },
  refinePanelSecond: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 11,
  },
  refineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
  },
  refineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  kindBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindLink: {
    backgroundColor: 'rgba(10,132,255,0.12)',
  },
  kindNote: {
    backgroundColor: 'rgba(142,91,232,0.12)',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 19,
  },
  rowSecondary: {
    fontSize: 12.5,
    color: IOS_COLORS.tertiaryLabel,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
