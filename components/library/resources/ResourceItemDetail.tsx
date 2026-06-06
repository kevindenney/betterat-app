import React, { useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import {
  showAlertWithButtons,
  showConfirm,
  showPrompt,
} from '@/lib/utils/crossPlatformAlert';
import {
  useDeleteLibraryItem,
  useUpdateLibraryItem,
} from '@/hooks/useLibraryItemMutations';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { ConceptEditor } from '@/components/playbook/concepts/ConceptEditor';
import { useInterest } from '@/providers/InterestProvider';
import { usePlaybook } from '@/hooks/usePlaybook';
import { FORMAT_ICON, FORMAT_TINT } from './formatStyles';
import { DEMO_LIBRARY_ITEMS } from './demoItems';
import { InterestTagRow } from './InterestTagRow';
import type { BackRefRow, MarkedExcerpt, ResourceItemFull } from './types';

// Most interactions on the resource detail screen don't have destinations
// yet (no reader, no concept-from-mark wizard, no demo concept/step rows).
// Stub them with a contextual coming-soon so the buttons feel alive and
// the user knows what they would do.
const comingSoon = (action: string) =>
  showAlert(`${action}`, 'This action is on the roadmap — not wired up yet.');

// useLibraryItemDetail encodes back-ref targets as `${role}-${uuid}` in
// BackRefRow.id; demoItems.ts uses semantic slugs like `origin-lactate-
// perfusion` for the hardcoded MSN-Capstone cards. Real UUIDs we can
// route; slugs fall through to a coming-soon explaining the demo gap.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractTargetUuid(refId: string): string | null {
  // Strip the leading role prefix: origin-, cited-, step-, in_step-.
  const stripped = refId.replace(/^(origin|cited|step|in_step)-/, '');
  return UUID_RE.test(stripped) ? stripped : null;
}

function handleBackRefPress(ref: BackRefRow) {
  const uuid = extractTargetUuid(ref.id);
  if (uuid) {
    if (ref.role === 'in_step') {
      router.push(`/step/${uuid}` as never);
    } else {
      router.push(`/(tabs)/library/concept/${uuid}` as never);
    }
    return;
  }
  // Demo back-ref — no real route to take. Tell the user it's demo-only
  // so the dead-tap doesn't read like a bug.
  showAlert(
    ref.title,
    ref.role === 'in_step'
      ? 'This is a demo back-reference; opening real steps from a resource works once the item is attached to a step you own.'
      : 'This is a demo back-reference; concept detail will open once this concept exists in your library.',
  );
}

function truncateDraftTitle(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= 72) return compact;
  return `${compact.slice(0, 69).trimEnd()}...`;
}

function buildConceptDraft(item: ResourceItemFull) {
  const firstMark = item.marks[0];
  const title = firstMark?.quote
    ? truncateDraftTitle(firstMark.quote)
    : truncateDraftTitle(item.title);
  const lines = [
    firstMark?.quote ? `> ${firstMark.quote}` : null,
    '',
    '## Source',
    `- ${item.title}`,
    item.sourceLine ? `- ${item.sourceLine}` : null,
    item.url ? `- ${item.url}` : null,
    firstMark?.prov ? `- Mark: ${firstMark.prov}` : null,
    '',
    '## Working note',
    'What this changes in my practice:',
  ].filter((line): line is string => line !== null);

  return {
    title,
    bodyMd: lines.join('\n'),
  };
}

function getYouTubeVideoId(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    }
    if (host.endsWith('youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'v') {
        return parts[1] ?? null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  return (
    <View style={styles.youtubeEmbed}>
      {React.createElement('iframe' as any, {
        src,
        title,
        allow:
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowFullScreen: true,
        style: {
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
        },
      })}
    </View>
  );
}

interface Props {
  item: ResourceItemFull;
}

export function ResourceItemDetail({ item }: Props) {
  const insets = useSafeAreaInsets();
  const tint = FORMAT_TINT[item.format];
  const isDemoItem = item.id in DEMO_LIBRARY_ITEMS;
  const { currentInterest } = useInterest();
  const { data: playbook } = usePlaybook(currentInterest?.id);
  const updateItem = useUpdateLibraryItem(item.id);
  const deleteItem = useDeleteLibraryItem();
  const [conceptEditorOpen, setConceptEditorOpen] = useState(false);
  const conceptDraft = useMemo(() => buildConceptDraft(item), [item]);
  const youtubeVideoId = useMemo(() => getYouTubeVideoId(item.url), [item.url]);
  const showEmbeddedYouTube = Platform.OS === 'web' && item.format === 'video' && !!youtubeVideoId;

  const handleRead = async () => {
    if (!item.url) {
      showAlert(
        'Read',
        'This item has no URL to open. A built-in reader for notes and pasted text is on the roadmap.',
      );
      return;
    }
    try {
      // SFSafariViewController on iOS / Chrome Custom Tabs on Android — keeps
      // the user in BetterAt, returns to this screen on close. PDFs and
      // uploaded files (public URL from library-files bucket) render inline
      // via the system's built-in PDF viewer when the URL ends in .pdf.
      await WebBrowser.openBrowserAsync(item.url, {
        toolbarColor: '#FFFFFF',
        controlsColor: '#007AFF',
        enableBarCollapsing: true,
        readerMode: item.format === 'article' || item.format === 'link',
      });
    } catch (err) {
      // openBrowserAsync rejects when the URL is malformed or there's no
      // available handler. Fall back to system browser so the user still has
      // a way to read.
      const can = await Linking.canOpenURL(item.url);
      if (can) await Linking.openURL(item.url);
      else showAlert('Read', err instanceof Error ? err.message : String(err));
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: item.title,
        message: item.url ? `${item.title}\n${item.url}` : item.title,
        ...(item.url ? { url: item.url } : {}),
      });
    } catch (err) {
      showAlert('Share failed', err instanceof Error ? err.message : String(err));
    }
  };

  const handleListen = async () => {
    // Real audio playback needs an in-app player. For audio kinds with a
    // URL we hand off to the in-app browser (system audio player renders);
    // anything else surfaces the roadmap note explicitly instead of a
    // generic "coming soon."
    if (item.format === 'audio' && item.url) {
      try {
        await WebBrowser.openBrowserAsync(item.url);
      } catch (err) {
        showAlert('Listen', err instanceof Error ? err.message : String(err));
      }
      return;
    }
    if (item.format === 'audio') {
      showAlert('Listen', 'This audio item has no URL to play.');
      return;
    }
    comingSoon('Listen');
  };

  const handleEditTitle = async () => {
    const next = await showPrompt('Rename item', undefined, item.title);
    const trimmed = next?.trim();
    if (!trimmed || trimmed === item.title) return;
    updateItem.mutate(
      { title: trimmed },
      {
        onError: (err) =>
          showAlert('Rename failed', err instanceof Error ? err.message : String(err)),
      },
    );
  };

  const handleDelete = () => {
    showConfirm(
      'Delete from Library',
      `This removes "${item.title}" from your library. Steps that pinned it as before-shift reading will lose the pin. This can't be undone.`,
      () => {
        deleteItem.mutate(item.id, {
          onSuccess: () => {
            if (router.canGoBack()) router.back();
            else router.replace('/library?zone=resources');
          },
          onError: (err) =>
            showAlert(
              'Delete failed',
              err instanceof Error ? err.message : String(err),
            ),
        });
      },
      { destructive: true, confirmText: 'Delete' },
    );
  };

  const handleMore = () => {
    if (isDemoItem) {
      showAlert(
        'More actions',
        'Edit and delete are on real captures — this is a demo card.',
      );
      return;
    }
    showAlertWithButtons('More', undefined, [
      { text: 'Rename', onPress: handleEditTitle },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: handleDelete,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleCiteAsOrigin = () => {
    if (!currentInterest?.id || !playbook?.id) {
      showAlert(
        'Concept developer unavailable',
        'Your playbook is still loading. Try again in a moment.',
      );
      return;
    }
    setConceptEditorOpen(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/library?zone=resources'))}
          hitSlop={8}
          activeOpacity={0.6}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color="#007AFF" />
          <Text style={styles.backText}>Library</Text>
        </TouchableOpacity>
        <View style={styles.topbarRight}>
          <TouchableOpacity
            onPress={handleShare}
            hitSlop={8}
            activeOpacity={0.6}
          >
            <Ionicons name="share-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleMore}
            hitSlop={8}
            activeOpacity={0.6}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + 24 },
        ]}
      >
        <View style={styles.head}>
          <View style={styles.fmtRow}>
            <View style={[styles.fmtChip, { backgroundColor: `${tint}1F` }]}>
              <Ionicons name={FORMAT_ICON[item.format]} size={11} color={tint} />
              <Text style={[styles.fmtLabel, { color: tint }]}>{item.formatLabel}</Text>
            </View>
            <Text style={styles.metaText}>{item.meta}</Text>
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.sourceLine}>{item.sourceLine}</Text>
        </View>

        <View style={[styles.preview, showEmbeddedYouTube && styles.videoPreview]}>
          {showEmbeddedYouTube ? (
            <YouTubeEmbed videoId={youtubeVideoId!} title={item.title} />
          ) : item.thumbUrl ? (
            <Image
              source={{ uri: item.thumbUrl }}
              style={styles.previewImage}
              resizeMode={item.format === 'video' ? 'contain' : 'cover'}
            />
          ) : null}
          {!showEmbeddedYouTube ? (
            <>
              <View style={[styles.previewSpine, { backgroundColor: tint }]} />
              <View
                style={[
                  styles.previewStampPill,
                  item.thumbUrl ? styles.previewStampOverImage : null,
                ]}
              >
                <Text
                  style={[
                    styles.previewStamp,
                    item.thumbUrl ? styles.previewStampOnImage : null,
                  ]}
                >
                  {item.formatLabel.toUpperCase()}
                </Text>
              </View>
              {item.meta ? (
                <Text
                  style={[
                    styles.previewPage,
                    item.thumbUrl ? styles.previewPageOnImage : null,
                  ]}
                >
                  {item.meta}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.7}
            onPress={handleRead}
          >
            <Ionicons name="book-outline" size={16} color={IOS_COLORS.label} />
            <Text style={styles.actionText}>Read</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.7}
            onPress={handleListen}
          >
            <Ionicons name="headset-outline" size={16} color={IOS_COLORS.label} />
            <Text style={styles.actionText}>Listen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.7}
            onPress={() => comingSoon('Annotate')}
          >
            <Ionicons name="brush-outline" size={16} color={IOS_COLORS.label} />
            <Text style={styles.actionText}>Annotate</Text>
          </TouchableOpacity>
        </View>

        <InterestTagRow libraryItemId={item.id} isDemo={isDemoItem} />

        <Text style={styles.sectionEyebrow}>Where this appears in your practice</Text>
        <View style={styles.usesList}>
          {item.backRefs.map((ref) => (
            <BackRefRowView
              key={ref.id}
              ref_={ref}
              onPress={() => handleBackRefPress(ref)}
            />
          ))}
        </View>

        {item.marks.length > 0 ? (
          <>
            <Text style={styles.sectionEyebrow}>
              What you marked{' '}
              <Text style={styles.sectionEyebrowDim}>· {item.marks.length} excerpts</Text>
            </Text>
            <View style={styles.marksList}>
              {item.marks.map((m) => (
                <MarkView key={m.id} mark={m} />
              ))}
            </View>
          </>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.citeRow}
          onPress={handleCiteAsOrigin}
        >
          <View style={styles.citeIc}>
            <Ionicons name="sparkles" size={16} color="#5C2DAA" />
          </View>
          <View style={styles.citeCopy}>
            <Text style={styles.citeTitle}>Cite as origin of a new concept</Text>
            <Text style={styles.citeSub}>
              Open the marked phrase as a working concept in your playbook
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={IOS_COLORS.tertiaryLabel}
          />
        </TouchableOpacity>

      </ScrollView>
      {conceptEditorOpen && currentInterest?.id && playbook?.id ? (
        <ConceptEditor
          mode="create"
          playbookId={playbook.id}
          interestId={currentInterest.id}
          initialTitle={conceptDraft.title}
          initialBodyMd={conceptDraft.bodyMd}
          saveLabel="Create concept"
          onClose={() => setConceptEditorOpen(false)}
          onSaved={(concept) => {
            router.push(`/(tabs)/library/concept/${concept.id}` as never);
          }}
        />
      ) : null}
    </View>
  );
}

function BackRefRowView({
  ref_,
  onPress,
}: {
  ref_: BackRefRow;
  onPress: () => void;
}) {
  const roleLabel = ref_.role === 'origin' ? 'Origin' : ref_.role === 'cited' ? 'Cited' : 'In step';
  const roleStyles = {
    origin: { bg: 'rgba(175,82,222,0.14)', color: '#5C2DAA' },
    cited: { bg: 'rgba(0,122,255,0.14)', color: '#0046A8' },
    in_step: { bg: 'rgba(52,199,89,0.16)', color: '#1F8636' },
  }[ref_.role];
  return (
    <TouchableOpacity activeOpacity={0.6} style={styles.useRow} onPress={onPress}>
      <View
        style={[styles.roleChip, { backgroundColor: roleStyles.bg }]}
      >
        <Text style={[styles.roleLabel, { color: roleStyles.color }]}>
          {roleLabel}
        </Text>
      </View>
      <View style={styles.refBody}>
        <Text style={styles.itTitle} numberOfLines={2}>
          {ref_.title}
        </Text>
        <Text style={styles.itSub} numberOfLines={1}>
          {ref_.subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={IOS_COLORS.tertiaryLabel} />
    </TouchableOpacity>
  );
}

function MarkView({ mark }: { mark: MarkedExcerpt }) {
  return (
    <View style={styles.mark}>
      <Text style={styles.markQuote}>"{mark.quote}"</Text>
      <Text style={styles.markProv}>{mark.prov}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#007AFF',
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.md,
  },
  body: {
    // paddingBottom set inline so it can incorporate safe-area + tab bar
  },
  head: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemBackground,
    gap: 8,
  },
  fmtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fmtChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  fmtLabel: {
    fontSize: 9,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaText: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
    lineHeight: 27,
  },
  sourceLine: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  preview: {
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.md,
    aspectRatio: 16 / 9,
    backgroundColor: '#FAFAF7',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
    padding: 18,
    overflow: 'hidden',
  },
  videoPreview: {
    padding: 0,
    backgroundColor: '#000000',
  },
  youtubeEmbed: {
    flex: 1,
    backgroundColor: '#000000',
  },
  previewSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  previewImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  previewStampPill: {
    alignSelf: 'flex-start',
  },
  previewStampOverImage: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewStamp: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: IOS_COLORS.tertiaryLabel,
  },
  previewStampOnImage: {
    color: '#FFFFFF',
  },
  previewPageOnImage: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  previewPage: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: IOS_COLORS.tertiaryLabel,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.md,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.systemBackground,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.lg,
    paddingBottom: 6,
  },
  sectionEyebrowDim: {
    fontWeight: '500',
    textTransform: 'none',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: -0.05,
  },
  usesList: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  useRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    minWidth: 60,
    alignItems: 'center',
  },
  roleLabel: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  refBody: {
    flex: 1,
    minWidth: 0,
  },
  itTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 17,
  },
  itSub: {
    fontSize: 11.5,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 2,
  },
  marksList: {
    gap: 8,
    paddingHorizontal: IOS_SPACING.lg,
  },
  mark: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
    gap: 4,
  },
  markQuote: {
    fontSize: 14.5,
    lineHeight: 21,
    fontStyle: 'italic',
    color: IOS_COLORS.label,
    letterSpacing: -0.1,
  },
  markProv: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
  },
  citeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: IOS_SPACING.lg,
    padding: 12,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(175,82,222,0.35)',
  },
  citeIc: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(175,82,222,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  citeCopy: {
    flex: 1,
  },
  citeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  citeSub: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 1,
  },
});
