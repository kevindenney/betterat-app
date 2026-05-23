/**
 * iOS Detail Chrome — shared primitives for the Discover detail trio.
 *
 * Implements the canonical visual register documented in
 * `docs/redesign/ios-register/discover-detail-trio-canonical.html`.
 *
 * The same nav bar, hero scaffolding, section header, xrow, drow, signal-row,
 * trajectory row, in-common row, concept-card, external-link, and skeleton
 * are used on all three detail surfaces (Org, Person, Topic). The only thing
 * that varies between surfaces is which sections are composed and what data
 * the rows carry.
 *
 * Five structural rules hold across the three:
 *   1. Nav bar — back chevron + originating segment + tiny centred context
 *      label + optional docked relationship action in trailing slot.
 *   2. Hero scaffolding — 64px mark + name + descriptor + meta + relationship.
 *   3. Section headers — 11px small caps + optional "See all →".
 *   4. Xrow — one component for all cross-references.
 *   5. Per-section loading — hero solid first, sections fill progressively.
 */

import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
// Import the canonical palette pickers so the list cell and the detail
// hero produce the same mark colour for the same org (or person). Earlier the
// detail had a local Record-based palette whose Object.keys order diverged
// from the canonical array, breaking the visual hinge between cell ↔ detail.
// IMPORTANT: must `import` (not just re-export) so the names are in this
// file's own scope — the XRow + Hero JSX below references them directly.
import {
  pickSquareMarkColor,
  pickAvatarMarkColor,
} from '@/components/discover/canonical';

export { pickSquareMarkColor, pickAvatarMarkColor };

// =============================================================================
// TOKENS
// =============================================================================

const SEP = IOS_REGISTER.separator;
const LABEL = IOS_REGISTER.label;
const LABEL_2 = IOS_REGISTER.labelSecondary;
const LABEL_3 = IOS_REGISTER.labelTertiary;
const BLUE = IOS_COLORS.systemBlue;
const GROUPED_BG = '#FFFFFF';
const GROUND_BG = '#F2F2F7';
const PILL_FILL = 'rgba(60, 60, 67, 0.08)';
const ACCENT_DISCOVER = '#D97757';
const ACCENT_TINT = 'rgba(217, 119, 87, 0.13)';
const ACCENT_BORDER = 'rgba(217, 119, 87, 0.20)';
const CHECK_GREEN = '#3F8758';

// =============================================================================
// NAV BAR
// =============================================================================

export interface IOSDetailNavBarProps {
  /** Segment label shown next to back chevron (e.g. "Orgs", "People", "Forums") */
  backLabel: string;
  /** Tiny centred context label (e.g. "Org", "Person", "Topic") */
  contextLabel: string;
  /** Optional unit name shown beneath context when scrolled past hero */
  dockedName?: string;
  /** Whether the trailing relationship action is docked */
  docked?: boolean;
  /** Trailing nav action (only present when relationship not yet mine and scrolled past hero) */
  trailingAction?: {
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  onBack: () => void;
}

export function IOSDetailNavBar({
  backLabel,
  contextLabel,
  dockedName,
  docked,
  trailingAction,
  onBack,
}: IOSDetailNavBarProps) {
  return (
    <View style={[navStyles.bar, docked && navStyles.barDocked]}>
      <Pressable
        onPress={onBack}
        style={navStyles.back}
        accessibilityRole="button"
        accessibilityLabel={`Back to ${backLabel}`}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={22} color={BLUE} style={navStyles.backIcon} />
        <Text style={navStyles.backLabel}>{backLabel}</Text>
      </Pressable>

      <View style={navStyles.title}>
        <Text style={navStyles.titleText}>{contextLabel}</Text>
        {docked && dockedName ? (
          <Text style={navStyles.dockedName} numberOfLines={1}>
            {dockedName}
          </Text>
        ) : null}
      </View>

      {trailingAction ? (
        <Pressable
          onPress={trailingAction.onPress}
          style={navStyles.action}
          accessibilityRole="button"
          accessibilityLabel={trailingAction.label}
        >
          {trailingAction.icon ? (
            <Ionicons
              name={trailingAction.icon}
              size={13}
              color="#FFFFFF"
              style={navStyles.actionIcon}
            />
          ) : null}
          <Text style={navStyles.actionLabel}>{trailingAction.label}</Text>
        </Pressable>
      ) : (
        <View style={navStyles.actionSpacer} />
      )}
    </View>
  );
}

// =============================================================================
// HERO
// =============================================================================

export type HeroMarkShape = 'square' | 'circle' | 'topic';

export interface IOSDetailHeroProps {
  markShape: HeroMarkShape;
  markText?: string;
  markIcon?: keyof typeof Ionicons.glyphMap;
  markColor?: string;
  name: string;
  descriptor?: string;
  meta?: { icon?: keyof typeof Ionicons.glyphMap; text: string }[];
  children?: React.ReactNode;
}

export function IOSDetailHero({
  markShape,
  markText,
  markIcon,
  markColor,
  name,
  descriptor,
  meta,
  children,
}: IOSDetailHeroProps) {
  const isTopic = markShape === 'topic';
  const isCircle = markShape === 'circle';

  const markStyle = [
    heroStyles.mark,
    isCircle && heroStyles.markCircle,
    isTopic
      ? heroStyles.markTopic
      : { backgroundColor: markColor ?? pickSquareMarkColor(name) },
  ];

  return (
    <View style={heroStyles.hero}>
      <View style={heroStyles.row}>
        <View style={markStyle}>
          {isTopic && markIcon ? (
            <Ionicons name={markIcon} size={32} color={LABEL} />
          ) : (
            <Text
              style={[
                heroStyles.markText,
                isTopic && heroStyles.markTextTopic,
              ]}
            >
              {markText}
            </Text>
          )}
        </View>
        <View style={heroStyles.body}>
          <Text style={heroStyles.name}>{name}</Text>
          {descriptor ? (
            <Text style={heroStyles.descriptor}>{descriptor}</Text>
          ) : null}
        </View>
      </View>

      {meta && meta.length > 0 ? (
        <View style={heroStyles.meta}>
          {meta.map((m, i) => (
            <View key={i} style={heroStyles.metaItem}>
              {m.icon ? (
                <Ionicons name={m.icon} size={13} color={LABEL_3} />
              ) : null}
              <Text style={heroStyles.metaText}>{m.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {children ? <View style={heroStyles.rel}>{children}</View> : null}
    </View>
  );
}

// =============================================================================
// RELATIONSHIP — primary filled blue button OR informational gray pill
// =============================================================================

export interface RelationshipButtonProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
  secondary?: boolean;
  fullWidth?: boolean;
}

export function RelationshipButton({
  label,
  icon,
  onPress,
  loading,
  secondary,
  fullWidth = true,
}: RelationshipButtonProps) {
  // The blue fill is on a static-style View so it always renders. The
  // Pressable wraps it and only varies opacity on press. Earlier function-form
  // Pressable styles produced a washed-out fill on the iOS 26 simulator.
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        fullWidth ? relStyles.btnWrapFull : relStyles.btnWrap,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          relStyles.btn,
          secondary ? relStyles.btnSecondary : relStyles.btnPrimary,
          fullWidth && relStyles.btnFull,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={secondary ? BLUE : '#FFFFFF'} />
        ) : (
          <>
            {icon ? (
              <Ionicons
                name={icon}
                size={16}
                color={secondary ? BLUE : '#FFFFFF'}
                style={relStyles.btnIcon}
              />
            ) : null}
            <Text
              style={[
                relStyles.btnLabel,
                secondary && relStyles.btnLabelSecondary,
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

export function RelationshipMinePill({
  label,
  onPress,
}: {
  label: string;
  /**
   * Optional handler. Canonical position: the pill is "informational" — but
   * users expect tap-to-undo on Following / Subscribed pills (Instagram /
   * Twitter convention). When `onPress` is set, the pill becomes a tap
   * target without changing its visual chrome.
   */
  onPress?: () => void;
}) {
  const body = (
    <View style={relStyles.pill}>
      <Ionicons name="checkmark" size={14} color={CHECK_GREEN} />
      <Text style={relStyles.pillLabel}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

// =============================================================================
// SECTION HEADER + BODY
// =============================================================================

export interface IOSDetailSectionProps {
  header: string;
  seeAll?: { label: string; onPress: () => void };
  loadingLine?: string;
  flush?: boolean;
  /**
   * Drop the white card body chrome — header sits above raw children.
   * Used for sections whose child renders its OWN card (e.g. ConceptCard's
   * coral working-on-now card). Without this the coral sits inset inside a
   * white card with visible white padding around it.
   */
  bare?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function IOSDetailSection({
  header,
  seeAll,
  loadingLine,
  flush,
  bare,
  style,
  children,
}: IOSDetailSectionProps) {
  return (
    <View style={[sectionStyles.section, style]}>
      <View style={sectionStyles.head}>
        <Text style={sectionStyles.headText}>{header}</Text>
        {seeAll ? (
          <Pressable onPress={seeAll.onPress} hitSlop={6}>
            <Text style={sectionStyles.seeAll}>{seeAll.label} →</Text>
          </Pressable>
        ) : null}
      </View>
      {loadingLine ? (
        <View style={sectionStyles.loadLine}>
          <ActivityIndicator size="small" color={LABEL_3} />
          <Text style={sectionStyles.loadLineText}>{loadingLine}</Text>
        </View>
      ) : null}
      {bare ? (
        <>{children}</>
      ) : (
        <View style={[sectionStyles.body, flush && sectionStyles.bodyFlush]}>
          {children}
        </View>
      )}
    </View>
  );
}

// =============================================================================
// SIGNAL ROW — three-pellet activity signal (Org "up next", Topic stats inline)
// =============================================================================

export interface SignalCellData {
  num: string;
  small?: string;
  label: string;
}

export function SignalRow({ cells }: { cells: SignalCellData[] }) {
  return (
    <View style={signalStyles.row}>
      {cells.map((c, i) => (
        <View
          key={i}
          style={[
            signalStyles.cell,
            i < cells.length - 1 && signalStyles.cellDivider,
          ]}
        >
          <Text style={signalStyles.num}>
            {c.num}
            {c.small ? <Text style={signalStyles.numSmall}> {c.small}</Text> : null}
          </Text>
          <Text style={signalStyles.label}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// DROW — generic detail row (events, threads, posts)
// =============================================================================

export interface DRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  pinned?: boolean;
  title: string;
  sub?: string;
  meta?: string;
  metaWhen?: string;
  onPress?: () => void;
  isFirst?: boolean;
}

export function DRow({
  icon,
  iconColor,
  pinned,
  title,
  sub,
  meta,
  metaWhen,
  onPress,
  isFirst,
}: DRowProps) {
  // Pressable wraps for touch only — the View inside owns the row layout.
  // Earlier we set flex styles in Pressable's function-form style array, and
  // they were being silently dropped on iOS, causing the row to render as
  // a column-stacked layout instead of a horizontal row.
  return (
    <Pressable onPress={onPress}>
      <View style={[rowStyles.drow, !isFirst && rowStyles.drowBorder]}>
        {icon ? (
          <View style={rowStyles.drowLead}>
            <Ionicons
              name={icon}
              size={18}
              color={iconColor ?? (pinned ? ACCENT_DISCOVER : LABEL_2)}
            />
          </View>
        ) : null}
        <View style={rowStyles.drowBody}>
          <Text style={rowStyles.drowTitle} numberOfLines={1}>
            {pinned ? <Text style={rowStyles.pinnedTag}>Pinned  </Text> : null}
            {title}
          </Text>
          {sub ? (
            <Text style={rowStyles.drowSub} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
        {meta || metaWhen ? (
          <View style={rowStyles.drowMeta}>
            {meta ? <Text style={rowStyles.drowMetaText}>{meta}</Text> : null}
            {metaWhen ? (
              <Text style={rowStyles.drowMetaWhen}>{metaWhen}</Text>
            ) : null}
          </View>
        ) : null}
        <View style={rowStyles.chevWrap}>
          <Ionicons name="chevron-forward" size={14} color={LABEL_3} />
        </View>
      </View>
    </Pressable>
  );
}

// =============================================================================
// XROW — cross-reference row used on every detail surface
// =============================================================================

export type XMarkVariant = 'square' | 'circle' | 'topic';

export interface XRowProps {
  markText?: string;
  markIcon?: keyof typeof Ionicons.glyphMap;
  markColor?: string;
  markVariant?: XMarkVariant;
  name: string;
  sub?: string;
  tail?: string;
  onPress?: () => void;
  isFirst?: boolean;
}

export function XRow({
  markText,
  markIcon,
  markColor,
  markVariant = 'square',
  name,
  sub,
  tail,
  onPress,
  isFirst,
}: XRowProps) {
  const isTopic = markVariant === 'topic';
  const isCircle = markVariant === 'circle';

  return (
    <Pressable onPress={onPress}>
      <View style={[rowStyles.xrow, !isFirst && rowStyles.xrowBorder]}>
        <View
          style={[
            rowStyles.xmark,
            isCircle && rowStyles.xmarkCircle,
            isTopic
              ? rowStyles.xmarkTopic
              : { backgroundColor: markColor ?? pickSquareMarkColor(name) },
          ]}
        >
          {isTopic && markIcon ? (
            <Ionicons name={markIcon} size={18} color={LABEL_2} />
          ) : (
            <Text
              style={[
                rowStyles.xmarkText,
                isTopic && rowStyles.xmarkTextTopic,
              ]}
            >
              {markText}
            </Text>
          )}
        </View>
        <View style={rowStyles.xbody}>
          <Text style={rowStyles.xname} numberOfLines={1}>
            {name}
          </Text>
          {sub ? (
            <Text style={rowStyles.xsub} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
        {tail ? <Text style={rowStyles.xtail}>{tail}</Text> : null}
        <View style={rowStyles.chevWrap}>
          <Ionicons name="chevron-forward" size={14} color={LABEL_3} />
        </View>
      </View>
    </Pressable>
  );
}

// =============================================================================
// TROPHY ROW — restrained trajectory list (Person surface only)
// =============================================================================

export interface TrophyRowProps {
  title: React.ReactNode;
  sub?: string;
  when?: string;
  onPress?: () => void;
  isFirst?: boolean;
}

export function TrophyRow({ title, sub, when, onPress, isFirst }: TrophyRowProps) {
  // When there's no onPress, render as a plain View so the row doesn't show
  // a phantom press feedback. Canonical position: Trophy rows on the Person
  // detail are informational; tap-to-open is reserved for the Trophy detail
  // surface which lives outside this trio.
  const body = (
    <View style={[rowStyles.tro, !isFirst && rowStyles.troBorder]}>
      <View style={rowStyles.troLead}>
        <Ionicons name="ribbon-outline" size={16} color={LABEL_2} />
      </View>
      <View style={rowStyles.troBody}>
        <Text style={rowStyles.troTitle} numberOfLines={2}>
          {title}
        </Text>
        {sub ? <Text style={rowStyles.troSub}>{sub}</Text> : null}
      </View>
      {when ? <Text style={rowStyles.troWhen}>{when}</Text> : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

// =============================================================================
// IN-COMMON ROW — Person surface only; prose with italic anchor
// =============================================================================

export interface InCommonRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  when?: string;
  /** Tap target — opens the primary anchor in the row (org, topic, race…). */
  onPress?: () => void;
  isFirst?: boolean;
}

export function InCommonRow({ icon, children, when, onPress, isFirst }: InCommonRowProps) {
  const body = (
    <View
      style={[rowStyles.incommon, !isFirst && rowStyles.incommonBorder]}
    >
      {icon ? (
        <View style={rowStyles.incommonLead}>
          <Ionicons name={icon} size={16} color={LABEL_2} />
        </View>
      ) : null}
      <View style={rowStyles.incommonBody}>
        <Text style={rowStyles.incommonText}>{children}</Text>
        {when ? <Text style={rowStyles.incommonWhen}>{when}</Text> : null}
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={14} color={LABEL_3} />
      ) : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

// =============================================================================
// CONCEPT CARD — Person surface "Working on now" card
// =============================================================================

export interface ConceptCardProps {
  label?: string;
  /** Tail rendered after the label as ` · TAIL`, uppercase. E.g. "WEEK 3". */
  tail?: string;
  text: string;
  /**
   * Provenance line directly under the quote — e.g.
   * "captured at last debrief, three weeks ago".
   * Pass 11 Component-2 grammar (italic-serif-with-provenance). Italic, small,
   * tertiary color. Sits between the quote and any stats/history rows.
   */
  provenance?: string;
  /**
   * Optional stats line below the quote — e.g.
   * "In play across 3 races · 2 reflections this week".
   * Rendered with a small flame icon prefix.
   */
  stats?: string;
  /**
   * Optional concept-history affordance row below a hairline — "Followed: X · Y →".
   * Carries the chronology of past concepts the practitioner has worked through.
   */
  history?: {
    primary: string;
    secondary?: string;
    onPress: () => void;
  };
  /** Legacy footer link — "View public face →" on Discover Person detail. */
  link?: { label: string; onPress: () => void };
}

export function ConceptCard({
  label = 'Current concept',
  tail,
  text,
  provenance,
  stats,
  history,
  link,
}: ConceptCardProps) {
  // Frame the practice signal in curly quotes so it reads as something the
  // person SAID about their practice, not as a tagline or bio. Editorial
  // italic-serif typeface (Iowan / Source Serif) mirrors the canonical voice.
  return (
    <View style={conceptStyles.card}>
      <Text style={conceptStyles.label}>
        {label}
        {tail ? <Text style={conceptStyles.labelTail}>{` · ${tail}`}</Text> : null}
      </Text>
      <Text style={conceptStyles.text}>{`“${text}”`}</Text>
      {provenance ? (
        <Text style={conceptStyles.provenance}>{provenance}</Text>
      ) : null}
      {stats ? (
        <View style={conceptStyles.statsRow}>
          <Ionicons name="flame" size={13} color={ACCENT_DISCOVER} />
          <Text style={conceptStyles.statsText}>{stats}</Text>
        </View>
      ) : null}
      {history ? (
        <>
          <View style={conceptStyles.divider} />
          <Pressable onPress={history.onPress} style={conceptStyles.historyRow} hitSlop={6}>
            <Text style={conceptStyles.historyText} numberOfLines={1}>
              <Text style={conceptStyles.historyKey}>Followed: </Text>
              {history.primary}
              {history.secondary ? (
                <Text style={conceptStyles.historySecondary}>{` · ${history.secondary}`}</Text>
              ) : null}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={LABEL_3} />
          </Pressable>
        </>
      ) : null}
      {link ? (
        <Pressable onPress={link.onPress} style={conceptStyles.linkRow} hitSlop={6}>
          <Text style={conceptStyles.linkText}>{link.label}</Text>
          <Ionicons name="chevron-forward" size={14} color={BLUE} />
        </Pressable>
      ) : null}
    </View>
  );
}

// =============================================================================
// EXTERNAL LINK FOOTER — Org surface only
// =============================================================================

export function ExternalLinkRow({
  url,
  onPress,
}: {
  url: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View style={extStyles.row}>
        <Ionicons name="link-outline" size={15} color={LABEL_3} />
        <Text style={extStyles.url} numberOfLines={1}>
          {url}
        </Text>
        <Ionicons name="arrow-up" size={13} color={LABEL_3} style={extStyles.outIcon} />
      </View>
    </Pressable>
  );
}

// =============================================================================
// SECTION SKELETON — loading state for a section
// =============================================================================

export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={[
            skelStyles.row,
            i > 0 && skelStyles.rowBorder,
          ]}
        >
          <View style={skelStyles.circle} />
          <View style={skelStyles.col}>
            <View style={[skelStyles.block, { width: '70%' }]} />
            <View style={[skelStyles.block, { width: '40%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// GROUND — page background wrapper
// =============================================================================

export const IOS_DETAIL_GROUND_BG = GROUND_BG;

// =============================================================================
// STYLES
// =============================================================================

const navStyles = StyleSheet.create({
  bar: {
    minHeight: 44,
    paddingHorizontal: 8,
    paddingLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 242, 247, 0.92)',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  barDocked: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 64,
  },
  backIcon: { marginRight: -2 },
  backLabel: {
    color: BLUE,
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  title: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: LABEL_2,
    lineHeight: 14,
  },
  dockedName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.25,
    color: LABEL,
    marginTop: 1,
  },
  action: {
    minWidth: 64,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: { marginRight: 2 },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  actionSpacer: { minWidth: 64 },
});

const heroStyles = StyleSheet.create({
  hero: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: GROUND_BG,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  markCircle: { borderRadius: 32 },
  markTopic: { backgroundColor: '#E5E5EA' },
  markText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  markTextTopic: { color: LABEL_2 },
  body: { flex: 1, minWidth: 0, paddingTop: 2 },
  name: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.45,
    lineHeight: 26,
    color: LABEL,
  },
  descriptor: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.08,
    color: LABEL_2,
  },
  meta: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12.5,
    letterSpacing: -0.05,
    color: LABEL_2,
  },
  rel: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});

const relStyles = StyleSheet.create({
  btnWrap: {},
  btnWrapFull: { flex: 1, alignSelf: 'stretch' },
  btn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: { width: '100%' },
  btnPrimary: { backgroundColor: BLUE },
  btnSecondary: { backgroundColor: 'rgba(120, 120, 128, 0.12)' },
  btnIcon: { marginRight: 6 },
  btnLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  btnLabelSecondary: { color: BLUE },
  pill: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 7,
    backgroundColor: PILL_FILL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillLabel: {
    color: LABEL_2,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.08,
  },
});

const sectionStyles = StyleSheet.create({
  section: { marginTop: 22 },
  head: {
    paddingHorizontal: 22,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  headText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: LABEL_2,
  },
  seeAll: {
    fontSize: 13,
    color: BLUE,
    letterSpacing: -0.08,
  },
  loadLine: {
    paddingHorizontal: 22,
    paddingTop: 0,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadLineText: {
    fontSize: 12,
    letterSpacing: -0.05,
    color: LABEL_3,
  },
  body: {
    marginHorizontal: 16,
    backgroundColor: GROUPED_BG,
    borderRadius: 13,
    overflow: 'hidden',
  },
  bodyFlush: { marginHorizontal: 0, borderRadius: 0 },
});

const signalStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cell: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  cellDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: SEP,
  },
  num: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: LABEL,
    lineHeight: 21,
  },
  numSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: LABEL_2,
    letterSpacing: -0.05,
  },
  label: {
    marginTop: 5,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '500',
    color: LABEL_2,
  },
});

const rowStyles = StyleSheet.create({
  pressed: { backgroundColor: 'rgba(60, 60, 67, 0.04)' },

  drow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 50,
    gap: 10,
  },
  drowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  drowLead: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drowBody: { flex: 1, minWidth: 0 },
  drowTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    color: LABEL,
    lineHeight: 19,
  },
  pinnedTag: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: ACCENT_DISCOVER,
  },
  drowSub: {
    marginTop: 2,
    fontSize: 12.5,
    letterSpacing: -0.05,
    color: LABEL_2,
    lineHeight: 16,
  },
  drowMeta: { alignItems: 'flex-end' },
  drowMetaText: {
    fontSize: 12.5,
    letterSpacing: -0.05,
    color: LABEL_2,
  },
  drowMetaWhen: {
    marginTop: 2,
    fontSize: 11.5,
    color: LABEL_3,
  },
  chev: { marginLeft: 2 },
  chevWrap: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // XROW
  xrow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
    minHeight: 54,
  },
  xrowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  xmark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  xmarkCircle: { borderRadius: 18 },
  xmarkTopic: { backgroundColor: '#E5E5EA' },
  xmarkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  xmarkTextTopic: { color: LABEL },
  xbody: { flex: 1, minWidth: 0 },
  xname: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    color: LABEL,
    lineHeight: 19,
  },
  xsub: {
    marginTop: 2,
    fontSize: 12.5,
    letterSpacing: -0.05,
    color: LABEL_2,
    lineHeight: 16,
  },
  xtail: {
    maxWidth: 110,
    fontSize: 11.5,
    color: LABEL_3,
    letterSpacing: -0.05,
    textAlign: 'right',
  },

  // TROPHY
  tro: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  troBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  troLead: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(60, 60, 67, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  troBody: { flex: 1, minWidth: 0 },
  troTitle: {
    fontSize: 14.5,
    fontWeight: '500',
    letterSpacing: -0.15,
    color: LABEL,
    lineHeight: 18,
  },
  troSub: {
    marginTop: 2,
    fontSize: 12,
    letterSpacing: -0.05,
    color: LABEL_2,
  },
  troWhen: {
    fontSize: 12,
    color: LABEL_3,
    letterSpacing: -0.05,
  },

  // IN COMMON
  incommon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  incommonBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  incommonLead: { marginTop: 1 },
  incommonBody: { flex: 1 },
  incommonText: {
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: -0.15,
    color: LABEL,
  },
  incommonWhen: {
    marginTop: 3,
    fontSize: 12,
    color: LABEL_2,
    letterSpacing: -0.05,
  },
});

const conceptStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 14,
    backgroundColor: ACCENT_TINT,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT_BORDER,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: ACCENT_DISCOVER,
    marginBottom: 6,
  },
  labelTail: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: ACCENT_DISCOVER,
    opacity: 0.75,
  },
  text: {
    fontFamily: Platform.select({
      ios: 'Iowan Old Style',
      android: 'serif',
      default: 'Georgia',
    }),
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.1,
    fontStyle: 'italic',
    fontWeight: '500',
    color: '#2A2824',
  },
  provenance: {
    marginTop: 6,
    fontSize: 12.5,
    letterSpacing: -0.05,
    color: LABEL_3,
    fontStyle: 'italic',
  },
  statsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsText: {
    fontSize: 12.5,
    letterSpacing: -0.05,
    color: ACCENT_DISCOVER,
    fontWeight: '500',
  },
  divider: {
    marginTop: 12,
    marginBottom: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: ACCENT_BORDER,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyText: {
    flex: 1,
    fontSize: 13,
    letterSpacing: -0.08,
    color: '#2A2824',
  },
  historyKey: { color: LABEL_3 },
  historySecondary: { color: LABEL_2 },
  linkRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkText: {
    fontSize: 13,
    color: BLUE,
    letterSpacing: -0.08,
  },
});

const extStyles = StyleSheet.create({
  row: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: GROUPED_BG,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  url: {
    flex: 1,
    fontSize: 13,
    color: BLUE,
    letterSpacing: -0.08,
  },
  outIcon: { transform: [{ rotate: '45deg' }] },
});

const skelStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(60, 60, 67, 0.06)',
  },
  col: { flex: 1, gap: 6 },
  block: {
    height: 11,
    borderRadius: 4,
    backgroundColor: 'rgba(60, 60, 67, 0.06)',
  },
});
