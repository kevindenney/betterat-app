/**
 * AddToStepPlanSheet — iOS-register modal sheet for adding items to a step plan.
 *
 * Two doors, one destination:
 *   1. From library — pick existing concepts/resources from the user's Playbook.
 *   2. Capture new — paste a URL (or upload/photo/paste) to create a new resource
 *      that lands in the step AND the library at the same time (toggleable).
 *
 * A pinned blue destination chip under the grabber row tells the user where the
 * picked thing will land. It is determined by call site, never editable from the
 * sheet itself. See design "Add to step plan - Felix sailing - iOS register".
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import {
  useAddPlaybookResource,
  usePlaybook,
  usePlaybookConcepts,
  usePlaybookResources,
} from '@/hooks/usePlaybook';
import type {
  PlaybookConceptRecord,
  PlaybookResourceRecord,
  ResourceType,
  StepPlaybookLinkType,
} from '@/types/playbook';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AddToStepPlanSelection {
  item_type: StepPlaybookLinkType;
  item_id: string;
  label: string;
}

export type AddToStepPlanFilter = 'all' | 'concept' | 'source' | 'video' | 'pdf';

export interface AddToStepPlanSheetProps {
  visible: boolean;
  /** Destination this sheet writes into, e.g. "Before the race" */
  destinationLabel: string;
  /** Optional context tail shown after a middot, e.g. "Race 5" */
  destinationContext?: string;
  /** Interest used to scope library queries; falls back to current interest. */
  interestId: string | undefined;
  /** "{type}:{id}" keys already linked to the step — hidden from library list. */
  excludeKeys?: string[];
  /** Which door opens first. Defaults to library. */
  initialMode?: 'library' | 'capture';
  /** Persist & return the selection. */
  onSelect: (selections: AddToStepPlanSelection[]) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Format mapping — keeps source-glyph hue tied to the design tokens.
// ---------------------------------------------------------------------------

type FormatKey = 'video' | 'pdf' | 'book' | 'link' | 'audio' | 'concept';

interface FormatStyle {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tint: string;
}

const FORMAT_STYLES: Record<FormatKey, FormatStyle> = {
  video:   { label: 'VIDEO',   icon: 'play-outline',          color: '#7A4FB5', tint: 'rgba(122, 79, 181, 0.10)' },
  pdf:     { label: 'PDF',     icon: 'document-text-outline', color: '#C24A4A', tint: 'rgba(194, 74, 74, 0.10)'  },
  book:    { label: 'BOOK',    icon: 'book-outline',          color: '#3A6FA1', tint: 'rgba(58, 111, 161, 0.10)' },
  link:    { label: 'LINK',    icon: 'link-outline',          color: '#5B6470', tint: 'rgba(91, 100, 112, 0.10)' },
  audio:   { label: 'AUDIO',   icon: 'headset-outline',       color: '#2E7D6B', tint: 'rgba(46, 125, 107, 0.10)' },
  concept: { label: 'CONCEPT', icon: 'book-outline',          color: '#007AFF', tint: 'rgba(0, 122, 255, 0.10)'  },
};

function classifyResource(resource: PlaybookResourceRecord): FormatKey {
  switch (resource.resource_type) {
    case 'youtube_video':
    case 'youtube_channel':
      return 'video';
    case 'pdf':
      return 'pdf';
    case 'book_digital':
    case 'book_physical':
      return 'book';
    case 'website':
    case 'social_media':
    case 'cloud_folder':
    case 'image':
    case 'document':
    case 'note':
    case 'online_course':
    case 'other':
    default:
      return 'link';
  }
}

function detectFromUrl(url: string): { type: ResourceType; format: FormatKey; source: string | null; title: string } {
  const trimmed = url.trim();
  let source: string | null = null;
  try {
    source = new URL(trimmed).hostname.replace(/^www\./, '');
  } catch {
    source = null;
  }
  if (/youtube\.com|youtu\.be/i.test(trimmed)) {
    return { type: 'youtube_video', format: 'video', source: 'YouTube', title: trimmed };
  }
  if (/\.pdf(\?|$)/i.test(trimmed)) {
    return { type: 'pdf', format: 'pdf', source, title: trimmed };
  }
  return { type: 'website', format: 'link', source, title: trimmed };
}

// ---------------------------------------------------------------------------
// Highlight helper for search-match marks (iOS Notes yellow style)
// ---------------------------------------------------------------------------

function renderHighlighted(title: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return title;
  const tokens = Array.from(new Set(q.split(/\s+/).filter((t) => t.length >= 2)));
  if (tokens.length === 0) return title;
  const splitPattern = new RegExp(`(${tokens.map(escapeRegex).join('|')})`, 'gi');
  const tokensLower = tokens.map((t) => t.toLowerCase());
  const parts = title.split(splitPattern);
  return parts.map((part, idx) => {
    const isMatch = tokensLower.includes(part.toLowerCase());
    return isMatch ? (
      <Text key={idx} style={styles.mark}>{part}</Text>
    ) : (
      <Text key={idx}>{part}</Text>
    );
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AddToStepPlanSheet({
  visible,
  destinationLabel,
  destinationContext,
  interestId,
  excludeKeys = [],
  initialMode = 'library',
  onSelect,
  onClose,
}: AddToStepPlanSheetProps) {
  const { currentInterest } = useInterest();
  const resolvedInterestId = interestId || currentInterest?.id;
  const { data: playbook } = usePlaybook(resolvedInterestId);
  const playbookId = playbook?.id;

  const { data: resources = [], isLoading: resourcesLoading } = usePlaybookResources(playbookId);
  const { data: concepts = [], isLoading: conceptsLoading } = usePlaybookConcepts(
    playbookId,
    resolvedInterestId,
  );
  const addResource = useAddPlaybookResource();

  const [mode, setMode] = useState<'library' | 'capture'>(initialMode);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AddToStepPlanFilter>('all');
  const [selected, setSelected] = useState<Map<string, AddToStepPlanSelection>>(new Map());

  // Capture-new state
  const [captureMode, setCaptureMode] = useState<'link' | 'upload' | 'photo' | 'paste'>('link');
  const [captureUrl, setCaptureUrl] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(true);

  const excludeSet = useMemo(() => new Set(excludeKeys), [excludeKeys]);

  const reset = () => {
    setMode(initialMode);
    setQuery('');
    setFilter('all');
    setSelected(new Map());
    setCaptureMode('link');
    setCaptureUrl('');
    setSaveToLibrary(true);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggle = (sel: AddToStepPlanSelection) => {
    const k = `${sel.item_type}:${sel.item_id}`;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(k)) next.delete(k);
      else next.set(k, sel);
      return next;
    });
  };

  const handleAddSelection = () => {
    if (selected.size === 0) return;
    onSelect(Array.from(selected.values()));
    reset();
  };

  const detected = useMemo(() => (captureUrl.trim() ? detectFromUrl(captureUrl) : null), [captureUrl]);

  const handleCaptureSubmit = async () => {
    const url = captureUrl.trim();
    if (!url || !detected || !playbookId) return;
    try {
      const created = await addResource.mutateAsync({
        playbook_id: playbookId,
        title: detected.title,
        url,
        resource_type: detected.type,
        source_platform: detected.source ?? undefined,
      });
      onSelect([
        { item_type: 'resource', item_id: created.id, label: created.title },
      ]);
      reset();
    } catch (err) {
      console.error('[AddToStepPlanSheet] capture failed', err);
    }
  };

  // ---------- Library list filtering & grouping ----------
  const filteredConcepts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return concepts.filter((c) => {
      if (excludeSet.has(`concept:${c.id}`)) return false;
      if (filter !== 'all' && filter !== 'concept') return false;
      if (!q) return true;
      return c.title.toLowerCase().includes(q) || (c.body_md ?? '').toLowerCase().includes(q);
    });
  }, [concepts, query, filter, excludeSet]);

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      if (excludeSet.has(`resource:${r.id}`)) return false;
      if (filter === 'concept') return false;
      if (filter !== 'all' && filter !== 'source') {
        const fmt = classifyResource(r);
        if (fmt !== filter) return false;
      }
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q)
        || (r.author_or_creator ?? '').toLowerCase().includes(q)
        || (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [resources, query, filter, excludeSet]);

  // "In play this week" — best-effort signal: most recently updated resources.
  const inPlayResources = useMemo(() => {
    if (filteredResources.length === 0) return [] as PlaybookResourceRecord[];
    return [...filteredResources]
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
      .slice(0, 2);
  }, [filteredResources]);

  const moreResources = useMemo(() => {
    const inPlayIds = new Set(inPlayResources.map((r) => r.id));
    return filteredResources.filter((r) => !inPlayIds.has(r.id));
  }, [filteredResources, inPlayResources]);

  const isLoading = resourcesLoading || conceptsLoading;
  const showCaptureSaveToggle = mode === 'capture';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          {/* Grabber */}
          <View style={styles.grabberRow}>
            <View style={styles.grabber} />
          </View>

          {/* Chrome */}
          <View style={styles.sheetChrome}>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>Add</Text>
            <Text style={styles.cancelPlaceholder}>Cancel</Text>
          </View>

          {/* Destination chip */}
          <View style={styles.destChipRow}>
            <View style={styles.destChip}>
              <Ionicons name="arrow-down" size={12} color={IOS_COLORS.systemBlue} />
              <Text style={styles.destChipText}>
                into <Text style={styles.destChipStrong}>{destinationLabel}</Text>
                {destinationContext ? ` · ${destinationContext}` : ''}
              </Text>
            </View>
          </View>

          {/* Primary segmented */}
          <View style={styles.priSeg}>
            <Pressable
              style={[styles.priSegBtn, mode === 'library' && styles.priSegBtnOn]}
              onPress={() => setMode('library')}
            >
              <Ionicons
                name="bookmarks-outline"
                size={14}
                color={mode === 'library' ? IOS_COLORS.label : IOS_COLORS.secondaryLabel}
              />
              <Text style={[styles.priSegLabel, mode === 'library' && styles.priSegLabelOn]}>From library</Text>
            </Pressable>
            <Pressable
              style={[styles.priSegBtn, mode === 'capture' && styles.priSegBtnOn]}
              onPress={() => setMode('capture')}
            >
              <Ionicons name="sparkles-outline" size={14} color="#E85A5A" />
              <Text style={[styles.priSegLabel, mode === 'capture' && styles.priSegLabelOn]}>Capture new</Text>
            </Pressable>
          </View>

          {mode === 'library' ? (
            <LibraryDoor
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              onFilterChange={setFilter}
              isLoading={isLoading}
              inPlayResources={inPlayResources}
              moreResources={moreResources}
              concepts={filteredConcepts}
              selectedKeys={selected}
              onToggle={toggle}
            />
          ) : (
            <CaptureDoor
              captureMode={captureMode}
              onCaptureModeChange={setCaptureMode}
              url={captureUrl}
              onUrlChange={setCaptureUrl}
              detected={detected}
              saveToLibrary={saveToLibrary}
              onSaveToLibraryChange={setSaveToLibrary}
              showSaveToggle={showCaptureSaveToggle}
            />
          )}

          {/* CTA footer */}
          <View style={styles.footer}>
            {mode === 'library' ? (
              <Pressable
                style={[styles.cta, selected.size === 0 && styles.ctaDisabled]}
                disabled={selected.size === 0}
                onPress={handleAddSelection}
              >
                <Text style={[styles.ctaLabel, selected.size === 0 && styles.ctaLabelDisabled]}>
                  {selected.size === 0
                    ? 'Add to step'
                    : `Add ${selected.size} item${selected.size === 1 ? '' : 's'} to step`}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.cta, (!detected || addResource.isPending) && styles.ctaDisabled]}
                disabled={!detected || addResource.isPending}
                onPress={handleCaptureSubmit}
              >
                {addResource.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={15} color="#FF6B6B" />
                    <Text style={styles.ctaLabel}>
                      {saveToLibrary ? 'Add to step & save to Library' : 'Add to step only'}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Library door
// ---------------------------------------------------------------------------

interface LibraryDoorProps {
  query: string;
  onQueryChange: (q: string) => void;
  filter: AddToStepPlanFilter;
  onFilterChange: (f: AddToStepPlanFilter) => void;
  isLoading: boolean;
  inPlayResources: PlaybookResourceRecord[];
  moreResources: PlaybookResourceRecord[];
  concepts: PlaybookConceptRecord[];
  selectedKeys: Map<string, AddToStepPlanSelection>;
  onToggle: (sel: AddToStepPlanSelection) => void;
}

const FILTER_OPTIONS: { key: AddToStepPlanFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'concept', label: 'Concepts' },
  { key: 'source', label: 'Sources' },
  { key: 'video', label: 'Video' },
  { key: 'pdf', label: 'PDF' },
];

function LibraryDoor({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  isLoading,
  inPlayResources,
  moreResources,
  concepts,
  selectedKeys,
  onToggle,
}: LibraryDoorProps) {
  const hasResults = inPlayResources.length + moreResources.length + concepts.length > 0;

  return (
    <>
      {/* Search */}
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={IOS_COLORS.secondaryLabel} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search your library"
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          style={styles.searchInput}
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => onQueryChange('')} hitSlop={6}>
            <Ionicons name="close-circle" size={17} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        ) : (
          <Ionicons name="mic-outline" size={17} color={IOS_COLORS.secondaryLabel} />
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterChipsRow}>
        {FILTER_OPTIONS.map((opt) => {
          const on = filter === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.filterChip, on && styles.filterChipOn]}
              onPress={() => onFilterChange(opt.key)}
            >
              <Text style={[styles.filterChipLabel, on && styles.filterChipLabelOn]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Body */}
      <ScrollView
        style={styles.sheetBody}
        contentContainerStyle={styles.sheetBodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={IOS_COLORS.systemBlue} />
          </View>
        ) : !hasResults ? (
          <View style={styles.empty}>
            <Ionicons name="library-outline" size={28} color={IOS_COLORS.systemGray2} />
            <Text style={styles.emptyTitle}>
              {query ? 'No matches yet' : 'Nothing in your library yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {query
                ? 'Try a different term, or capture something new.'
                : 'Capture a link, PDF, video, or note — it lands here and in your step at the same time.'}
            </Text>
          </View>
        ) : (
          <>
            {inPlayResources.length > 0 && (
              <PickGroup label="In play this week">
                {inPlayResources.map((r) => (
                  <ResourceRow
                    key={r.id}
                    resource={r}
                    query={query}
                    selected={selectedKeys.has(`resource:${r.id}`)}
                    inPlay
                    onPress={() =>
                      onToggle({ item_type: 'resource', item_id: r.id, label: r.title })
                    }
                  />
                ))}
              </PickGroup>
            )}

            {concepts.length > 0 && (
              <PickGroup label={query ? 'Concepts · matches' : 'Concepts'}>
                {concepts.map((c) => (
                  <ConceptRow
                    key={c.id}
                    concept={c}
                    query={query}
                    selected={selectedKeys.has(`concept:${c.id}`)}
                    onPress={() =>
                      onToggle({ item_type: 'concept', item_id: c.id, label: c.title })
                    }
                  />
                ))}
              </PickGroup>
            )}

            {moreResources.length > 0 && (
              <PickGroup label={query ? 'More sources · matches' : 'More sources'}>
                {moreResources.map((r) => (
                  <ResourceRow
                    key={r.id}
                    resource={r}
                    query={query}
                    selected={selectedKeys.has(`resource:${r.id}`)}
                    onPress={() =>
                      onToggle({ item_type: 'resource', item_id: r.id, label: r.title })
                    }
                  />
                ))}
              </PickGroup>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Capture door
// ---------------------------------------------------------------------------

interface CaptureDoorProps {
  captureMode: 'link' | 'upload' | 'photo' | 'paste';
  onCaptureModeChange: (m: 'link' | 'upload' | 'photo' | 'paste') => void;
  url: string;
  onUrlChange: (u: string) => void;
  detected: ReturnType<typeof detectFromUrl> | null;
  saveToLibrary: boolean;
  onSaveToLibraryChange: (v: boolean) => void;
  showSaveToggle: boolean;
}

const CAP_MODES: { key: CaptureDoorProps['captureMode']; label: string }[] = [
  { key: 'link', label: 'Link' },
  { key: 'upload', label: 'Upload' },
  { key: 'photo', label: 'Photo' },
  { key: 'paste', label: 'Paste' },
];

function CaptureDoor({
  captureMode,
  onCaptureModeChange,
  url,
  onUrlChange,
  detected,
  saveToLibrary,
  onSaveToLibraryChange,
  showSaveToggle,
}: CaptureDoorProps) {
  return (
    <>
      {/* Cap-mode segmented */}
      <View style={styles.capSeg}>
        {CAP_MODES.map((opt) => {
          const on = captureMode === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.capSegBtn, on && styles.capSegBtnOn]}
              onPress={() => onCaptureModeChange(opt.key)}
            >
              <Text style={[styles.capSegLabel, on && styles.capSegLabelOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {captureMode === 'link' ? (
        <View style={styles.urlInput}>
          <Ionicons name="link-outline" size={16} color={IOS_COLORS.secondaryLabel} />
          <TextInput
            value={url}
            onChangeText={onUrlChange}
            placeholder="Paste a URL"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            style={styles.urlInputText}
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="url"
          />
          {url ? (
            <Pressable onPress={() => onUrlChange('')} hitSlop={6}>
              <Ionicons name="close-circle" size={17} color={IOS_COLORS.secondaryLabel} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.captureStub}>
          <Ionicons
            name={
              captureMode === 'upload'
                ? 'cloud-upload-outline'
                : captureMode === 'photo'
                  ? 'camera-outline'
                  : 'clipboard-outline'
            }
            size={28}
            color={IOS_COLORS.systemGray2}
          />
          <Text style={styles.captureStubTitle}>
            {captureMode === 'upload' && 'Pick a file to upload'}
            {captureMode === 'photo' && 'Take a photo or pick from camera roll'}
            {captureMode === 'paste' && 'Paste from clipboard'}
          </Text>
          <Text style={styles.captureStubBody}>
            Coming soon — for now, paste a link.
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.sheetBody}
        contentContainerStyle={styles.sheetBodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {detected && (
          <View style={styles.detectCard}>
            <View style={styles.detectEb}>
              <Ionicons name="sparkles" size={12} color="#E85A5A" />
              <Text style={styles.detectEbText}>
                {`Detected${detected.source ? ` · ${detected.source}` : ''}`}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <View style={[styles.thumb, detected.format === 'video' ? styles.thumbVideo : styles.thumbLink]}>
                <View style={styles.thumbPlay}>
                  <Ionicons
                    name={detected.format === 'video' ? 'play' : 'link'}
                    size={13}
                    color="#FFFFFF"
                  />
                </View>
              </View>
              <View style={styles.detectBody}>
                <View style={styles.fmtRow}>
                  <FormatChip format={detected.format} />
                  {detected.source && (
                    <Text style={styles.detectSrc}>{detected.source.toUpperCase()}</Text>
                  )}
                </View>
                <Text style={styles.detectTitle} numberOfLines={2}>
                  {detected.title}
                </Text>
              </View>
            </View>
          </View>
        )}

        {showSaveToggle && detected && (
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>Also save to your Library</Text>
              <Text style={styles.toggleSub}>
                Keep it after this step — for future steps and concepts.
              </Text>
            </View>
            <Pressable
              style={[styles.toggle, saveToLibrary && styles.toggleOn]}
              onPress={() => onSaveToLibraryChange(!saveToLibrary)}
            >
              <View style={[styles.toggleKnob, saveToLibrary && styles.toggleKnobOn]} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Row & group primitives
// ---------------------------------------------------------------------------

function PickGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.pickGroup}>
      <Text style={styles.pickGroupEyebrow}>{label}</Text>
      <View style={styles.pickList}>{children}</View>
    </View>
  );
}

interface ResourceRowProps {
  resource: PlaybookResourceRecord;
  query: string;
  selected: boolean;
  inPlay?: boolean;
  onPress: () => void;
}

function ResourceRow({ resource, query, selected, inPlay, onPress }: ResourceRowProps) {
  const fmt = classifyResource(resource);
  const style = FORMAT_STYLES[fmt];
  const author = resource.author_or_creator || resource.source_platform;
  return (
    <Pressable style={styles.pickRow} onPress={onPress}>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
      </View>
      <View style={[styles.srcGlyph, { backgroundColor: style.tint }]}>
        <Ionicons name={style.icon} size={15} color={style.color} />
      </View>
      <View style={styles.pickBody}>
        <Text style={styles.pickTitle} numberOfLines={2}>
          {renderHighlighted(resource.title, query)}
        </Text>
        <View style={styles.pickMeta}>
          <Text style={[styles.pickMetaFmt, { color: style.color }]}>{style.label}</Text>
          {author ? (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.pickMetaText} numberOfLines={1}>{author}</Text>
            </>
          ) : null}
        </View>
      </View>
      {inPlay ? <View style={styles.inPlayDot} /> : null}
    </Pressable>
  );
}

interface ConceptRowProps {
  concept: PlaybookConceptRecord;
  query: string;
  selected: boolean;
  onPress: () => void;
}

function ConceptRow({ concept, query, selected, onPress }: ConceptRowProps) {
  const style = FORMAT_STYLES.concept;
  const stateLabel = concept.state ?? 'forming';
  return (
    <Pressable style={styles.pickRow} onPress={onPress}>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
      </View>
      <View style={[styles.srcGlyph, styles.srcGlyphConcept, { backgroundColor: style.tint }]}>
        <Ionicons name={style.icon} size={15} color={style.color} />
      </View>
      <View style={styles.pickBody}>
        <Text style={styles.pickTitle} numberOfLines={2}>
          {renderHighlighted(concept.title, query)}
        </Text>
        <View style={styles.pickMeta}>
          <Text style={[styles.pickMetaFmt, { color: style.color }]}>{style.label}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.pickMetaText}>{stateLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function FormatChip({ format }: { format: FormatKey }) {
  const style = FORMAT_STYLES[format];
  return (
    <View style={[styles.fmtChip, { backgroundColor: style.tint }]}>
      <Ionicons name={style.icon} size={10} color={style.color} />
      <Text style={[styles.fmtChipLabel, { color: style.color }]}>{style.label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: '88%',
    minHeight: '60%',
    flexDirection: 'column',
  },
  grabberRow: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.tertiaryLabel,
  },
  sheetChrome: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelText: {
    color: IOS_COLORS.systemBlue,
    fontSize: 16,
  },
  cancelPlaceholder: {
    color: 'transparent',
    fontSize: 16,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.1,
  },

  // Destination chip
  destChipRow: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  destChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,122,255,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  destChipText: {
    color: IOS_COLORS.systemBlue,
    fontSize: 12.5,
    letterSpacing: -0.05,
  },
  destChipStrong: {
    fontWeight: '700',
  },

  // Primary segmented
  priSeg: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 9,
    padding: 2,
    flexDirection: 'row',
    height: 34,
  },
  priSegBtn: {
    flex: 1,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  priSegBtnOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  priSegLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: -0.1,
  },
  priSegLabelOn: {
    fontWeight: '600',
    color: IOS_COLORS.label,
  },

  // Search
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
    padding: 0,
    letterSpacing: -0.2,
  },

  // Filter chips
  filterChipsRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: IOS_COLORS.systemGray5,
  },
  filterChipOn: {
    backgroundColor: IOS_COLORS.label,
  },
  filterChipLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  filterChipLabelOn: {
    color: '#FFFFFF',
  },

  // Body
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingBottom: 10,
  },
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  empty: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Pick group
  pickGroup: {
    marginBottom: 14,
  },
  pickGroupEyebrow: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 6,
    fontSize: 10.5,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pickList: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pickRow: {
    paddingVertical: 11,
    paddingLeft: 12,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.tertiaryLabel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderColor: IOS_COLORS.systemBlue,
  },
  srcGlyph: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  srcGlyphConcept: {
    borderRadius: 15,
  },
  pickBody: {
    flex: 1,
    minWidth: 0,
  },
  pickTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
    marginBottom: 3,
    lineHeight: 17,
  },
  pickMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  pickMetaFmt: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pickMetaText: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: -0.05,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_COLORS.tertiaryLabel,
  },
  inPlayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B6B',
  },
  mark: {
    backgroundColor: 'rgba(255, 220, 0, 0.42)',
    fontWeight: '700',
  },

  // Footer / CTA
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  cta: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaDisabled: {
    backgroundColor: IOS_COLORS.systemGray4,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  ctaLabelDisabled: {
    color: IOS_COLORS.tertiaryLabel,
  },

  // Capture-new — cap-mode segmented
  capSeg: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 9,
    padding: 2,
    flexDirection: 'row',
    height: 32,
  },
  capSegBtn: {
    flex: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capSegBtnOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  capSegLabel: {
    fontSize: 12.5,
    color: IOS_COLORS.label,
  },
  capSegLabelOn: {
    fontWeight: '600',
  },

  // URL input
  urlInput: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  urlInputText: {
    flex: 1,
    fontSize: 13.5,
    color: IOS_COLORS.label,
    padding: 0,
    letterSpacing: -0.1,
  },

  // Capture stub for Upload / Photo / Paste
  captureStub: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 6,
  },
  captureStubTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  captureStubBody: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },

  // Detected card
  detectCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 107, 107, 0.32)',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  detectEb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  detectEbText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E85A5A',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumb: {
    width: 96,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbVideo: {
    backgroundColor: '#3A2A55',
  },
  thumbLink: {
    backgroundColor: '#445566',
  },
  thumbPlay: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectBody: {
    flex: 1,
    minWidth: 0,
  },
  fmtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  fmtChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  fmtChipLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  detectSrc: {
    fontSize: 10.5,
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.4,
  },
  detectTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.15,
    lineHeight: 17,
  },

  // Save-to-Library toggle
  toggleRow: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  toggleCopy: {
    flex: 1,
    minWidth: 0,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: 11.5,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 16,
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemGray4,
    padding: 2,
  },
  toggleOn: {
    backgroundColor: IOS_COLORS.systemGreen,
  },
  toggleKnob: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleKnobOn: {
    transform: [{ translateX: 20 }],
  },
});

