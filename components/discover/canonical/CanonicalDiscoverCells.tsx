/**
 * Canonical Discover trio cell primitives
 *
 * Shared cell + chrome kit for the Discover trio (Orgs · People · Forums).
 * Implements the canonical visual register documented in
 * `docs/redesign/ios-register/discover-trio-canonical.html`:
 *
 *   - 44px leading mark (square for institution / topic, full-round for person)
 *   - 16px semibold name, 13px secondary descriptor
 *   - Optional third row: "Working on …" concept (People) or activity (Forums)
 *   - Right-edge tag column with three grammars:
 *       mine   — gray label, "Joined" / "Following" / "Mutual" / "Raced N×"
 *       weak   — outlined hairline, "Suggested" / "Met at …" / "Shared club"
 *       fit    — coral tint, system-attention only ("Matches your concept",
 *                "From your club")
 *   - 8px coral unread dot with halo (Forums, joined topics only)
 *
 * Coral semantic is reserved: system attention only. Never on relationship
 * tags (Joined / Following / Mutual stay gray). One coral, three jobs.
 *
 * Heights size to content; rhythm comes from the fixed 12px inner padding,
 * 44px mark column, 16px name size, and hairline separator. The eye reads
 * the column structure as repeating even when row heights differ.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

// =============================================================================
// COLORS — coral accent + letter-mark palette
// =============================================================================

export const CANONICAL_ACCENT_DISCOVER = '#D97757';
export const CANONICAL_ACCENT_TINT = 'rgba(217, 119, 87, 0.13)';

// Letter-mark palette — drawn from the Paths-for-you avatar palette so the
// surfaces look like family. Square for institutions, full-round for people.
const MARK_PALETTE_SQUARE = [
  '#4F6B7E', // slate
  '#6B6558', // stone
  '#5E7363', // sage
  '#2A2824', // ink
  '#3F5B6F', // deep
  '#B8A984', // sand
] as const;

const MARK_PALETTE_AVATAR = [
  '#8B9DA8', // av slate
  '#C2A285', // av putty
  '#98A38C', // av sage
  '#4F6B7E', // av deep
  '#C68B79', // av rose
  '#8E847A', // av stone
] as const;

function hashToIndex(seed: string, modulo: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % modulo;
}

export function pickSquareMarkColor(seed: string): string {
  return MARK_PALETTE_SQUARE[hashToIndex(seed, MARK_PALETTE_SQUARE.length)];
}

export function pickAvatarMarkColor(seed: string): string {
  return MARK_PALETTE_AVATAR[hashToIndex(seed, MARK_PALETTE_AVATAR.length)];
}

/** Two-letter initials for a name. Skips short connectors and respects multi-word names. */
export function initialsForName(name: string): string {
  const cleaned = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(the|of|and|de|le|la|von)$/i.test(w));
  if (cleaned.length === 0) return name.slice(0, 2).toUpperCase();
  if (cleaned.length === 1) return cleaned[0].slice(0, 2).toUpperCase();
  return (cleaned[0][0] + cleaned[1][0]).toUpperCase();
}

// =============================================================================
// LIST + CHROME
// =============================================================================

export function CanonicalList({ children }: { children: React.ReactNode }) {
  return <View style={styles.list}>{children}</View>;
}

export function CanonicalListEyebrow({
  plain,
  em,
  tail,
}: {
  plain: string;
  em?: string;
  tail?: string;
}) {
  return (
    <Text style={styles.listEyebrow}>
      {plain}
      {em ? <Text style={styles.listEyebrowEm}>{em}</Text> : null}
      {tail ?? ''}
    </Text>
  );
}

// =============================================================================
// MARKS — 44px leading column
// =============================================================================

export function SquareMark({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.markSquare, { backgroundColor: color }]}>
      <Text style={styles.markText}>{label}</Text>
    </View>
  );
}

export function RoundAvatarMark({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.markRound, { backgroundColor: color }]}>
      <Text style={styles.markInitials}>{label}</Text>
    </View>
  );
}

export function TopicGlyphMark({ glyph }: { glyph: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.markTopic}>
      <Ionicons name={glyph} size={22} color={IOS_REGISTER.labelSecondary} />
    </View>
  );
}

// =============================================================================
// TAGS — three grammars
// =============================================================================

export function MineTag({
  label,
  icon,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.tag, styles.tagMine]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={11}
          color={IOS_REGISTER.labelSecondary}
          style={styles.tagIcon}
        />
      ) : null}
      <Text style={[styles.tagText, styles.tagMineText]}>{label}</Text>
    </View>
  );
}

export function WeakTag({ label }: { label: string }) {
  return (
    <View style={[styles.tag, styles.tagWeak]}>
      <Text style={[styles.tagText, styles.tagWeakText]}>{label}</Text>
    </View>
  );
}

export function FitTag({ label }: { label: string }) {
  return (
    <View style={[styles.tag, styles.tagFit]}>
      <Text style={[styles.tagText, styles.tagFitText]}>{label}</Text>
    </View>
  );
}

/** 8px coral dot with halo — joined-topic unread mark. Coral semantic = system attention. */
export function UnreadDot() {
  return <View style={styles.unreadDot} accessibilityLabel="New activity" />;
}

// =============================================================================
// CELL ROWS — the three shapes
// =============================================================================

interface BaseCellProps {
  first?: boolean;
  onPress?: () => void;
  testID?: string;
}

export interface CanonicalOrgRowProps extends BaseCellProps {
  initials: string;
  markColor: string;
  name: string;
  descriptor: string;
  joinedLabel?: string; // e.g., "Joined" — gray mine tag; omit to render no tag
}

export function CanonicalOrgRow({
  initials,
  markColor,
  name,
  descriptor,
  joinedLabel,
  first,
  onPress,
  testID,
}: CanonicalOrgRowProps) {
  return (
    <Pressable
      style={[styles.cell, !first && styles.cellBordered]}
      onPress={onPress}
      testID={testID}
    >
      <SquareMark color={markColor} label={initials} />
      <View style={styles.cbody}>
        <Text style={styles.cname} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.cdesc} numberOfLines={2}>
          {descriptor}
        </Text>
      </View>
      {joinedLabel ? (
        <View style={styles.ctail}>
          <MineTag label={joinedLabel} icon="checkmark" />
        </View>
      ) : null}
      <Ionicons
        name="chevron-forward"
        size={14}
        color={IOS_REGISTER.labelTertiary}
        style={styles.chev}
      />
    </Pressable>
  );
}

export type PersonTag =
  | { kind: 'mine'; label: string; icon?: keyof typeof Ionicons.glyphMap }
  | { kind: 'weak'; label: string };

export interface CanonicalPersonRowProps extends BaseCellProps {
  initials: string;
  markColor: string;
  name: string;
  descriptor: string;
  /** "Working on …" current concept. Omitted when the user has none set. */
  concept?: string;
  tag?: PersonTag;
}

export function CanonicalPersonRow({
  initials,
  markColor,
  name,
  descriptor,
  concept,
  tag,
  first,
  onPress,
  testID,
}: CanonicalPersonRowProps) {
  return (
    <Pressable
      style={[styles.cell, !first && styles.cellBordered]}
      onPress={onPress}
      testID={testID}
    >
      <RoundAvatarMark color={markColor} label={initials} />
      <View style={styles.cbody}>
        <Text style={styles.cname} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.cdesc} numberOfLines={2}>
          {descriptor}
        </Text>
        {concept ? (
          <View style={styles.cevidence}>
            <Ionicons
              name="bulb-outline"
              size={13}
              color={IOS_REGISTER.labelTertiary}
              style={styles.evidenceIcon}
            />
            <Text style={styles.evidenceText} numberOfLines={2}>
              <Text style={styles.evidenceLabel}>Working on </Text>
              {concept}
            </Text>
          </View>
        ) : null}
      </View>
      {tag ? (
        <View style={styles.ctail}>
          {tag.kind === 'mine' ? (
            <MineTag label={tag.label} icon={tag.icon} />
          ) : (
            <WeakTag label={tag.label} />
          )}
        </View>
      ) : null}
      <Ionicons
        name="chevron-forward"
        size={14}
        color={IOS_REGISTER.labelTertiary}
        style={styles.chev}
      />
    </Pressable>
  );
}

export type ForumTag =
  | { kind: 'mine'; label: string; icon?: keyof typeof Ionicons.glyphMap }
  | { kind: 'fit'; label: string };

export interface CanonicalForumRowProps extends BaseCellProps {
  glyph: keyof typeof Ionicons.glyphMap;
  name: string;
  descriptor: string;
  activity?: { threads: string; lastActivity?: string };
  tag?: ForumTag;
  /** Coral unread dot — joined topics only. */
  unread?: boolean;
}

export function CanonicalForumRow({
  glyph,
  name,
  descriptor,
  activity,
  tag,
  unread,
  first,
  onPress,
  testID,
}: CanonicalForumRowProps) {
  return (
    <Pressable
      style={[styles.cell, !first && styles.cellBordered]}
      onPress={onPress}
      testID={testID}
    >
      <TopicGlyphMark glyph={glyph} />
      <View style={styles.cbody}>
        <Text style={styles.cname} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.cdesc} numberOfLines={1}>
          {descriptor}
        </Text>
        {activity ? (
          <View style={styles.cactivity}>
            <View style={styles.activityItem}>
              <Ionicons
                name="chatbubbles-outline"
                size={12}
                color={IOS_REGISTER.labelTertiary}
              />
              <Text style={styles.activityText}>{activity.threads}</Text>
            </View>
            {activity.lastActivity ? (
              <View style={styles.activityItem}>
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={IOS_REGISTER.labelTertiary}
                />
                <Text style={styles.activityText}>{activity.lastActivity}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {tag || unread ? (
        <View style={styles.ctail}>
          {tag &&
            (tag.kind === 'mine' ? (
              <MineTag label={tag.label} icon={tag.icon} />
            ) : (
              <FitTag label={tag.label} />
            ))}
          {unread ? <UnreadDot /> : null}
        </View>
      ) : null}
      <Ionicons
        name="chevron-forward"
        size={14}
        color={IOS_REGISTER.labelTertiary}
        style={styles.chev}
      />
    </Pressable>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // List container — inset grouped
  list: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    overflow: 'hidden',
  },

  // Eyebrow above a list block
  listEyebrow: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 6,
    fontSize: 13,
    letterSpacing: -0.08,
    color: IOS_REGISTER.labelSecondary,
  },
  listEyebrowEm: {
    color: IOS_REGISTER.label,
    fontWeight: '600',
  },

  // Cell — base
  cell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  cellBordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },

  // 44px marks
  markSquare: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  markRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  markTopic: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemGray5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  markText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  markInitials: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },

  // Cell body
  cbody: { flex: 1, minWidth: 0 },
  cname: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.32,
    color: IOS_REGISTER.label,
    lineHeight: 20,
  },
  cdesc: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.08,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },

  // Evidence row (People) — "Working on …"
  cevidence: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
  },
  evidenceIcon: { marginTop: 2 },
  evidenceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.08,
    color: IOS_REGISTER.label,
  },
  evidenceLabel: { color: IOS_REGISTER.labelSecondary },

  // Activity row (Forums) — threads + last activity
  cactivity: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityText: {
    fontSize: 12.5,
    letterSpacing: -0.05,
    color: IOS_REGISTER.labelSecondary,
  },

  // Trailing column + chevron
  ctail: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 1,
  },
  chev: { alignSelf: 'center', marginLeft: 4 },

  // Tags — three grammars
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 5,
  },
  tagIcon: { marginLeft: -1 },
  tagText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  tagMine: { backgroundColor: 'rgba(60, 60, 67, 0.08)' },
  tagMineText: { color: IOS_REGISTER.labelSecondary },
  tagWeak: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  tagWeakText: { color: IOS_REGISTER.labelTertiary },
  tagFit: { backgroundColor: CANONICAL_ACCENT_TINT },
  tagFitText: { color: CANONICAL_ACCENT_DISCOVER },

  // Unread coral dot
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CANONICAL_ACCENT_DISCOVER,
    ...Platform.select({
      web: {
        boxShadow: `0 0 0 4px ${CANONICAL_ACCENT_TINT}`,
      } as any,
      default: {
        shadowColor: CANONICAL_ACCENT_DISCOVER,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
    }),
  },
});
