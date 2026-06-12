/**
 * Public Face — iOS register primitives
 *
 * Implements the canonical defined in
 * `docs/redesign/ios-register/public-face-canonical.html` (BetterAt — Public
 * face · Person deep brief). The surface composes seven sections:
 *
 *   1. Hero — bigger mark (80px), bigger name (26px), descriptor + meta
 *   2. Framing line — italic-serif-with-provenance, written when joining
 *   3. Working on now — extended ConceptCard from chrome kit (stats + history)
 *   4. Practice timeline — TrophyRow with italic settled marker + open-trophy
 *   5. Capabilities — capability name + status pill + evidence quote
 *   6. Practice circle — single curated list (not Twitter follow-graph split)
 *   7. Published — newest-first reflections + threads (two row types)
 *   8. Where X practises — iOS form-row key/value pattern
 *   9. Events — date / name+venue / result (plain text, no medals)
 *
 * The vocabulary index re-uses the chrome kit aggressively: the italic-serif-
 * with-provenance component appears four times across the surface (framing,
 * concept body, capability evidence, published reflection). The status pill
 * gets its fourth state here (`settled`). The capability row is the only
 * net-new component.
 *
 * Section absent, never empty: if there's no current concept, the Working-on-
 * now slot doesn't render — not an "add concept" placeholder. Same rule the
 * Discover detail trio locked.
 */

import React from 'react';
import {
  Image,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { pickAvatarMarkColor } from '@/components/discover/canonical';

// =============================================================================
// TOKENS — duplicated from chrome kit's private set for self-contained import
// =============================================================================

const SEP = IOS_REGISTER.separator;
const LABEL = IOS_REGISTER.label;
const LABEL_2 = IOS_REGISTER.labelSecondary;
const LABEL_3 = IOS_REGISTER.labelTertiary;
const BLUE = IOS_COLORS.systemBlue;
const GROUND_BG = '#F2F2F7';
const ACCENT_DISCOVER = '#D97757';

const SERIF_FAMILY = fontFamily.serif;

// =============================================================================
// LARGE HERO — bigger mark + name for the public face
// Discover Person hero uses 64px / 22px; public face scales to 80px / 26px
// to mark this as a deeper surface. The framing line that follows lives in
// its own component (FramingLine) so the hero stays focused on identity.
// =============================================================================

export interface PublicFaceHeroProps {
  /** Mark text — practitioner initials. */
  markText: string;
  /** Mark background colour. Defaults to pickAvatarMarkColor(name). */
  markColor?: string;
  /** Avatar photo — when set, fills the mark instead of initials. */
  markImageUrl?: string;
  /** Practitioner display name. */
  name: string;
  /** "Dragon helm · Buenos Aires · also racing in Hong Kong" — primary descriptor. */
  descriptor?: string;
  /** Optional meta-pellet row — venue, seasons, programme year, etc. */
  meta?: { icon?: keyof typeof Ionicons.glyphMap; text: string }[];
  /** Relationship action — Follow / Following pill / Message. */
  children?: React.ReactNode;
}

export function PublicFaceHero({
  markText,
  markColor,
  markImageUrl,
  name,
  descriptor,
  meta,
  children,
}: PublicFaceHeroProps) {
  // avatar_url sometimes holds a device-local file:// ImagePicker path that
  // never got uploaded — unloadable anywhere else, so fall back to initials.
  const imageUrl =
    markImageUrl && /^https?:\/\//.test(markImageUrl) ? markImageUrl : undefined;
  return (
    <View style={heroStyles.hero}>
      <View style={heroStyles.row}>
        <View style={[heroStyles.mark, { backgroundColor: markColor ?? pickAvatarMarkColor(name) }]}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text style={heroStyles.markText}>{markText}</Text>
          )}
        </View>
        <View style={heroStyles.body}>
          <Text style={heroStyles.name}>{name}</Text>
          {descriptor ? <Text style={heroStyles.descriptor}>{descriptor}</Text> : null}
        </View>
      </View>
      {meta && meta.length > 0 ? (
        <View style={heroStyles.meta}>
          {meta.map((m, i) => (
            <View key={i} style={heroStyles.metaItem}>
              {m.icon ? <Ionicons name={m.icon} size={13} color={LABEL_3} /> : null}
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
// FRAMING LINE — the practitioner's own sentence at attribution
// Italic-serif-with-provenance, second deployment of the component (after
// Trophy titles). If a practitioner hasn't written a framing line, the
// section is absent — never a "tell us about yourself" prompt.
// =============================================================================

export interface FramingLineProps {
  /** The practitioner's first-person framing — 1-3 sentences. */
  text: string;
  /** Provenance line — "Written when joining BetterAt · Jan 2026". */
  provenance: string;
}

export function FramingLine({ text, provenance }: FramingLineProps) {
  return (
    <View style={framingStyles.box}>
      <Text style={framingStyles.text}>{`“${text}”`}</Text>
      <Text style={framingStyles.provenance}>{provenance}</Text>
    </View>
  );
}

// =============================================================================
// MESSAGE ICON BUTTON — secondary chrome-grey icon-only button
// Sits beside Follow in the hero. Position taken: not a primary action — it's
// a quiet affordance for opening a direct thread with the practitioner.
// Primary relationship action is Follow; messaging is what you do after.
// =============================================================================

export function MessageIconButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Message"
      style={msgStyles.btn}
      activeOpacity={0.85}
      hitSlop={6}
    >
      <Ionicons name="chatbubble-outline" size={18} color={LABEL_2} />
    </TouchableOpacity>
  );
}

// =============================================================================
// STATUS PILL — capability state
// Four locked states: learning / practicing / breakthrough / settled
// Rounded fill, sentence-case sans. Settled is the new state added on this
// surface (defensible because settled already exists in the trophy register).
// =============================================================================

export type CapabilityStatus = 'learning' | 'practicing' | 'breakthrough' | 'settled';

const STATUS_PALETTE: Record<CapabilityStatus, { fill: string; color: string }> = {
  learning: { fill: 'rgba(60, 60, 67, 0.10)', color: LABEL_2 },
  practicing: { fill: 'rgba(0, 122, 255, 0.12)', color: '#0A5BAA' },
  breakthrough: { fill: 'rgba(217, 119, 87, 0.16)', color: ACCENT_DISCOVER },
  settled: { fill: 'rgba(63, 135, 88, 0.14)', color: '#2F6D45' },
};

export function StatusPill({ status }: { status: CapabilityStatus }) {
  const palette = STATUS_PALETTE[status];
  const isSettled = status === 'settled';
  return (
    <View style={[pillStyles.pill, { backgroundColor: palette.fill }]}>
      {isSettled ? (
        <Ionicons name="checkmark" size={12} color={palette.color} style={pillStyles.icon} />
      ) : null}
      <Text style={[pillStyles.label, { color: palette.color }]}>{status}</Text>
    </View>
  );
}

// =============================================================================
// CAPABILITY ROW — the one net-new component on this surface
// Capability name + status pill + evidence quote (italic-serif-with-provenance,
// third deployment of the component) + provenance sub-line + chevron.
// Drops the "14 evidenced attempts" stat from the brief — that's prose-clothing
// for a stat, the vocabulary we're moving away from. What earns the space is
// the most-recent evidence quote itself.
// =============================================================================

export interface CapabilityRowProps {
  name: string;
  status: CapabilityStatus;
  /** Evidence quote — practitioner's own words from a reflection/debrief.
      Absent for rows built from evidence counts alone; the quote line drops. */
  evidence?: string;
  /** "from a reflection · Mar 2026" — provenance sub. */
  provenance: string;
  onPress?: () => void;
  isFirst?: boolean;
}

export function CapabilityRow({
  name,
  status,
  evidence,
  provenance,
  onPress,
  isFirst,
}: CapabilityRowProps) {
  const body = (
    <View style={[capStyles.row, !isFirst && capStyles.rowBorder]}>
      <View style={capStyles.head}>
        <Text style={capStyles.name} numberOfLines={2}>{name}</Text>
        <View style={capStyles.headRight}>
          <StatusPill status={status} />
          {onPress ? (
            <Ionicons name="chevron-forward" size={14} color={LABEL_3} />
          ) : null}
        </View>
      </View>
      {evidence ? <Text style={capStyles.evidence}>{`“${evidence}”`}</Text> : null}
      <Text style={capStyles.provenance}>{provenance}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

// =============================================================================
// PRACTICE CIRCLE ROW — single curated list, not a follow-graph split
// Avatar + name + role-in-this-practice sub ("Coach · four seasons",
// "Tactician · Phyloong"). Mutual tag at right edge when reciprocity exists.
// Renamed from "Working with" per the brief; the follow split was wrong
// vocabulary (Twitter's audience-size frame).
// =============================================================================

export interface PracticeCircleRowProps {
  name: string;
  /** Role-in-this-practice — "Coach · four seasons", "Faculty · settled X with Tomás" */
  role: string;
  /** Practitioner initials for the avatar mark. */
  initials: string;
  /** Optional explicit colour override for the avatar mark. */
  markColor?: string;
  /** Right-edge tag — "Mutual", "You follow". */
  tail?: string;
  onPress?: () => void;
  isFirst?: boolean;
}

export function PracticeCircleRow({
  name,
  role,
  initials,
  markColor,
  tail,
  onPress,
  isFirst,
}: PracticeCircleRowProps) {
  const body = (
    <View style={[circleStyles.row, !isFirst && circleStyles.rowBorder]}>
      <View style={[circleStyles.mark, { backgroundColor: markColor ?? pickAvatarMarkColor(name) }]}>
        <Text style={circleStyles.markText}>{initials}</Text>
      </View>
      <View style={circleStyles.body}>
        <Text style={circleStyles.name} numberOfLines={1}>{name}</Text>
        <Text style={circleStyles.role} numberOfLines={1}>{role}</Text>
      </View>
      {tail ? <Text style={circleStyles.tail}>{tail}</Text> : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={14} color={LABEL_3} />
      ) : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

// =============================================================================
// PUBLISHED ROWS — Reflections and Threads share one section
// Reflection: italic-serif-with-provenance body (fourth deployment of the
// component) + provenance line ("Reflection · 13 May 2026 · 3 returns from
// his circle"). Thread: drow-shaped with chatbubble glyph + "Thread in *Topic*
// · 23 replies" sub + date right.
// =============================================================================

export interface PublishedReflectionRowProps {
  text: string;
  provenance: string;
  onPress?: () => void;
  isFirst?: boolean;
}

export function PublishedReflectionRow({
  text,
  provenance,
  onPress,
  isFirst,
}: PublishedReflectionRowProps) {
  const body = (
    <View style={[pubStyles.refRow, !isFirst && pubStyles.rowBorder]}>
      <Text style={pubStyles.refText}>{`“${text}”`}</Text>
      <Text style={pubStyles.refProvenance}>{provenance}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export interface PublishedThreadRowProps {
  title: string;
  /** "Thread in *Dragon rigging & tuning* · 23 replies" — pass the italic topic separately. */
  topic: string;
  replies: number;
  when: string;
  onPress?: () => void;
  isFirst?: boolean;
}

export function PublishedThreadRow({
  title,
  topic,
  replies,
  when,
  onPress,
  isFirst,
}: PublishedThreadRowProps) {
  const body = (
    <View style={[pubStyles.threadRow, !isFirst && pubStyles.rowBorder]}>
      <View style={pubStyles.threadLead}>
        <Ionicons name="chatbubble-outline" size={16} color={LABEL_2} />
      </View>
      <View style={pubStyles.threadBody}>
        <Text style={pubStyles.threadTitle} numberOfLines={2}>{`“${title}”`}</Text>
        <Text style={pubStyles.threadSub} numberOfLines={1}>
          Thread in <Text style={pubStyles.threadTopic}>{topic}</Text>{' · '}{replies} replies
        </Text>
      </View>
      <Text style={pubStyles.threadWhen}>{when}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

// =============================================================================
// TROPHY ROW (public face variant) — italic settled marker + Open-the-trophy
// Different from Discover's TrophyRow in two ways:
//   - title carries " · settled" in italics when settled === true
//   - optional "Open the trophy" link sub-row beneath the sub
// =============================================================================

export interface TrophyRowPublicProps {
  title: string;
  settled?: boolean;
  /** Body sub — "The conditions where my technique lives. Closed with…" */
  sub: string;
  when: string;
  /** Optional supporting-artifact link — "Open the trophy". */
  openTrophy?: { onPress: () => void };
  onPress?: () => void;
  isFirst?: boolean;
}

export function TrophyRowPublic({
  title,
  settled,
  sub,
  when,
  openTrophy,
  onPress,
  isFirst,
}: TrophyRowPublicProps) {
  const body = (
    <View style={[troStyles.row, !isFirst && troStyles.rowBorder]}>
      <View style={troStyles.lead}>
        <Ionicons
          name={settled ? 'checkmark-circle' : 'ellipse-outline'}
          size={18}
          color={settled ? '#3F8758' : LABEL_3}
        />
      </View>
      <View style={troStyles.body}>
        <View style={troStyles.titleRow}>
          <Text style={troStyles.title} numberOfLines={2}>
            {title}
            {settled ? <Text style={troStyles.settled}> · settled</Text> : null}
          </Text>
          <Text style={troStyles.when}>{when}</Text>
        </View>
        <Text style={troStyles.sub}>{sub}</Text>
        {openTrophy ? (
          <Pressable onPress={openTrophy.onPress} style={troStyles.openLink} hitSlop={4}>
            <Ionicons name="ribbon-outline" size={13} color={BLUE} />
            <Text style={troStyles.openLinkText}>Open the trophy</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

// =============================================================================
// WHERE FORM ROW — iOS form-row pattern, key on left, value on right
// Generalises one-to-one across verticals: Discipline/Home club/Boat/Seasons
// active/Venue waters for sailing → Program/Institution/Year/Specialty/Sites
// for the JHU nursing vertical. Hairline separators inside the card.
// =============================================================================

export interface WhereFormRowProps {
  /** Key — "Discipline", "Home club". */
  k: string;
  /** Value — can be a string or a React node for inline italic emphasis. */
  v: React.ReactNode;
  isFirst?: boolean;
}

export function WhereFormRow({ k, v, isFirst }: WhereFormRowProps) {
  return (
    <View style={[formStyles.row, !isFirst && formStyles.rowBorder]}>
      <Text style={formStyles.key}>{k}</Text>
      <Text style={formStyles.value} numberOfLines={2}>{v}</Text>
    </View>
  );
}

// =============================================================================
// EVENT ROW — 3-column plain-text result
// date stack (small two-line) / name+venue / result+of-X. No medal glyphs,
// no podium icons, no "3rd 🥉". Generalises verbatim to the JHU vertical —
// rotation date / hospital / role.
// =============================================================================

export interface EventRowProps {
  /** Two-line date — "17 Apr" + "2026". */
  dateTop: string;
  dateBottom: string;
  /** Event name — "Spring Series · Race 5". */
  name: string;
  /** Venue sub-line — "RHKYC, Victoria Harbour · Dragon class". */
  venue: string;
  /** Result top — "7th" / "Settled". */
  resultTop: string;
  /** Optional result bottom — "of 22". */
  resultBottom?: string;
  onPress?: () => void;
  isFirst?: boolean;
}

export function EventRow({
  dateTop,
  dateBottom,
  name,
  venue,
  resultTop,
  resultBottom,
  onPress,
  isFirst,
}: EventRowProps) {
  const body = (
    <View style={[eventStyles.row, !isFirst && eventStyles.rowBorder]}>
      <View style={eventStyles.date}>
        <Text style={eventStyles.dateTop}>{dateTop}</Text>
        <Text style={eventStyles.dateBottom}>{dateBottom}</Text>
      </View>
      <View style={eventStyles.body}>
        <Text style={eventStyles.name} numberOfLines={1}>{name}</Text>
        <Text style={eventStyles.venue} numberOfLines={1}>{venue}</Text>
      </View>
      <View style={eventStyles.result}>
        <Text style={eventStyles.resultTop}>{resultTop}</Text>
        {resultBottom ? <Text style={eventStyles.resultBottom}>{resultBottom}</Text> : null}
      </View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

// =============================================================================
// GROUND
// =============================================================================

export const PUBLIC_FACE_GROUND_BG = GROUND_BG;

// =============================================================================
// STYLES
// =============================================================================

const heroStyles = StyleSheet.create({
  hero: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: GROUND_BG,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  mark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  markText: {
    fontSize: 27,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  body: { flex: 1, minWidth: 0, paddingTop: 6 },
  name: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 30,
    color: LABEL,
  },
  descriptor: {
    marginTop: 4,
    fontSize: 13.5,
    lineHeight: 19,
    letterSpacing: -0.08,
    color: LABEL_2,
  },
  meta: {
    marginTop: 10,
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
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});

const framingStyles = StyleSheet.create({
  box: {
    marginHorizontal: 22,
    marginTop: 4,
    paddingTop: 16,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  text: {
    fontFamily: SERIF_FAMILY,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.1,
    fontStyle: 'italic',
    fontWeight: '500',
    color: '#2A2824',
  },
  provenance: {
    marginTop: 8,
    fontSize: 12,
    color: LABEL_3,
    letterSpacing: -0.05,
  },
});

const msgStyles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const pillStyles = StyleSheet.create({
  pill: {
    height: 22,
    paddingHorizontal: 9,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  icon: { marginLeft: -2 },
  label: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: -0.05,
    textTransform: 'capitalize',
  },
});

const capStyles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 22,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    color: LABEL,
    lineHeight: 19,
  },
  headRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  evidence: {
    marginTop: 2,
    fontFamily: SERIF_FAMILY,
    fontSize: 14.5,
    lineHeight: 19,
    letterSpacing: -0.1,
    fontStyle: 'italic',
    fontWeight: '500',
    color: '#2A2824',
  },
  provenance: {
    marginTop: 2,
    fontSize: 12,
    color: LABEL_3,
    letterSpacing: -0.05,
  },
});

const circleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
    minHeight: 56,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  body: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    color: LABEL,
    lineHeight: 19,
  },
  role: {
    marginTop: 2,
    fontSize: 12.5,
    letterSpacing: -0.05,
    color: LABEL_2,
    lineHeight: 16,
  },
  tail: {
    maxWidth: 110,
    fontSize: 11.5,
    color: LABEL_3,
    letterSpacing: -0.05,
    textAlign: 'right',
  },
});

const pubStyles = StyleSheet.create({
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  refRow: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  refText: {
    fontFamily: SERIF_FAMILY,
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: -0.1,
    fontStyle: 'italic',
    fontWeight: '500',
    color: '#2A2824',
  },
  refProvenance: {
    marginTop: 6,
    fontSize: 12,
    color: LABEL_3,
    letterSpacing: -0.05,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  threadLead: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadBody: { flex: 1, minWidth: 0 },
  threadTitle: {
    fontSize: 14.5,
    fontWeight: '500',
    letterSpacing: -0.15,
    color: LABEL,
    lineHeight: 19,
  },
  threadSub: {
    marginTop: 2,
    fontSize: 12.5,
    letterSpacing: -0.05,
    color: LABEL_2,
  },
  threadTopic: {
    fontStyle: 'italic',
    color: LABEL_2,
  },
  threadWhen: {
    fontSize: 12,
    color: LABEL_3,
    letterSpacing: -0.05,
  },
});

const troStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  lead: {
    width: 24,
    alignItems: 'center',
    paddingTop: 1,
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.15,
    color: LABEL,
    lineHeight: 19,
  },
  settled: {
    fontStyle: 'italic',
    fontWeight: '500',
    color: LABEL_2,
  },
  when: {
    fontSize: 12,
    color: LABEL_3,
    letterSpacing: -0.05,
  },
  sub: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.05,
    color: LABEL_2,
  },
  openLink: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openLinkText: {
    fontSize: 13,
    color: BLUE,
    letterSpacing: -0.08,
  },
});

const formStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
    minHeight: 44,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  key: {
    width: 120,
    fontSize: 14,
    color: LABEL_2,
    letterSpacing: -0.1,
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: LABEL,
    letterSpacing: -0.1,
    lineHeight: 19,
  },
});

const eventStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
    minHeight: 56,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP,
  },
  date: {
    width: 56,
    alignItems: 'flex-start',
  },
  dateTop: {
    fontSize: 13,
    fontWeight: '500',
    color: LABEL,
    letterSpacing: -0.1,
  },
  dateBottom: {
    fontSize: 11.5,
    color: LABEL_3,
    letterSpacing: -0.05,
  },
  body: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 14.5,
    fontWeight: '500',
    letterSpacing: -0.15,
    color: LABEL,
    lineHeight: 18,
  },
  venue: {
    marginTop: 2,
    fontSize: 12.5,
    letterSpacing: -0.05,
    color: LABEL_2,
    lineHeight: 16,
  },
  result: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  resultTop: {
    fontSize: 14,
    fontWeight: '600',
    color: LABEL,
    letterSpacing: -0.1,
  },
  resultBottom: {
    marginTop: 1,
    fontSize: 11,
    color: LABEL_3,
    letterSpacing: -0.05,
  },
});
