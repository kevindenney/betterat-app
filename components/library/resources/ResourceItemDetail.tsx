import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { FORMAT_ICON, FORMAT_TINT } from './formatStyles';
import type { BackRefRow, MarkedExcerpt, ResourceItemFull } from './types';

// Most interactions on the resource detail screen don't have destinations
// yet (no reader, no concept-from-mark wizard, no demo concept/step rows).
// Stub them with a contextual coming-soon so the buttons feel alive and
// the user knows what they would do.
const comingSoon = (action: string) =>
  showAlert(`${action}`, 'This action is on the roadmap — not wired up yet.');

interface Props {
  item: ResourceItemFull;
}

export function ResourceItemDetail({ item }: Props) {
  const insets = useSafeAreaInsets();
  const tint = FORMAT_TINT[item.format];

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
            onPress={() => comingSoon('Share')}
            hitSlop={8}
            activeOpacity={0.6}
          >
            <Ionicons name="share-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => comingSoon('More')}
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

        <View style={styles.preview}>
          <View style={[styles.previewSpine, { backgroundColor: tint }]} />
          <Text style={styles.previewStamp}>PRACTICE ALERT</Text>
          <Text style={styles.previewPage}>P 1 / 8</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.7}
            onPress={() => comingSoon('Read')}
          >
            <Ionicons name="book-outline" size={16} color={IOS_COLORS.label} />
            <Text style={styles.actionText}>Read</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.7}
            onPress={() => comingSoon('Listen')}
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

        <Text style={styles.sectionEyebrow}>Where this appears in your practice</Text>
        <View style={styles.usesList}>
          {item.backRefs.map((ref) => (
            <BackRefRowView
              key={ref.id}
              ref_={ref}
              onPress={() =>
                comingSoon(
                  ref.role === 'in_step' ? 'Open step' : 'Open concept',
                )
              }
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
          onPress={() => comingSoon('Cite as origin')}
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
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  metaText: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.4,
    lineHeight: 27,
  },
  sourceLine: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  preview: {
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.md,
    height: 160,
    backgroundColor: '#FAFAF7',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
    padding: 18,
    overflow: 'hidden',
  },
  previewSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  previewStamp: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: IOS_COLORS.tertiaryLabel,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
