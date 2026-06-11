/**
 * SavedJumpSheet — the ★ Saved dropdown from Atlas mockup #39 (frame B).
 *
 * Consolidates three "where do I go" jobs into one favorites-style sheet so
 * the top bar can stay lean (context · 🔍 · ★ · avatar):
 *   1. JUMP TO A STEP IN VIEW — the step picker (was its own top-bar pill).
 *   2. YOUR RACING AREAS — the user's mapped/owned race waters.
 *   3. SAVED VENUES — favourited clubs/venues, nearest first.
 *
 * Distances are computed against the current map center so the list reads
 * "from where I'm looking", matching Apple/Google favourites behavior.
 */

import React, { useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { haversineDistance } from '@/lib/courseGeometry';
import type { PickerStep, UserStepStatus } from '@/hooks/useUserAtlasSteps';

export interface SavedPlaceItem {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** Trailing context shown after the distance (e.g. a class or fleet). */
  subtitle?: string | null;
  isHome?: boolean;
}

/**
 * Steps outside the near-now window, bucketed by arc (season). Rendered as
 * collapsed sections under MY STEPS so older work stays one tap away.
 */
export interface ArcStepGroup {
  id: string;
  label: string;
  steps: PickerStep[];
}

/** A step authored by someone you follow/know, grouped by relationship. */
export type PeerRelationship = 'crew' | 'fleet' | 'following' | 'nearby';

export interface RelationshipStepItem {
  id: string;
  title: string;
  relationship: PeerRelationship;
  lat: number;
  lng: number;
  /** Who set it / extra context, shown before the distance (e.g. "Alex"). */
  by?: string | null;
}

/**
 * Relationship → header label + dot color. Mirrors the lens chip strip so the
 * dropdown reads as the same WHOSE lens (crew red, fleet navy, following
 * violet, nearby teal).
 */
const RELATIONSHIP_ORDER: PeerRelationship[] = ['crew', 'fleet', 'following', 'nearby'];
const RELATIONSHIP_META: Record<PeerRelationship, { label: string; color: string }> = {
  crew: { label: 'CREW', color: '#E5484D' },
  fleet: { label: 'FLEET', color: '#14213D' },
  following: { label: 'FOLLOWING', color: '#6D28D9' },
  nearby: { label: 'NEARBY', color: '#0E7490' },
};

/** Show at most this many steps per relationship group to keep the list scannable. */
const MAX_PER_GROUP = 6;

/** Screen-space rect of the ★ trigger, so the menu can open as a dropdown under it. */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SavedJumpSheetProps {
  visible: boolean;
  steps: PickerStep[];
  selectedStepId?: string | null;
  /** When set, the menu opens as a dropdown anchored under this rect (mockup #39). */
  anchor?: AnchorRect | null;
  /** Older/further-out steps grouped by arc, newest arc first. */
  arcGroups?: ArcStepGroup[];
  /** Steps authored by crew/fleet/following/nearby, grouped by relationship. */
  relationshipSteps?: RelationshipStepItem[];
  /** Org-/group-originated mapped steps (RHKYC Dragon Class, cohorts…). */
  orgStepItems?: SavedPlaceItem[];
  racingAreas: SavedPlaceItem[];
  savedVenues: SavedPlaceItem[];
  /** Map center used to compute "X.X km" distances. */
  center: { lat: number; lng: number } | null;
  onDismiss: () => void;
  onPickStep: (step: PickerStep) => void;
  onPickPlace: (item: SavedPlaceItem) => void;
  /** Recenter the map on a peer/relationship step. */
  onPickPeerStep?: (item: RelationshipStepItem) => void;
  /** Footer action — save the place currently centered in the map view. */
  onAddPlaceInView?: () => void;
}

const STATUS_BADGE_LABEL: Partial<Record<UserStepStatus, string>> = {
  'planned-next': 'NEXT',
  'done-just-completed': 'DONE',
  'done-recent': 'DONE',
  'done-old': 'DONE',
};

const STATUS_BADGE_TONE: Partial<
  Record<UserStepStatus, { background: string; border: string; text: string }>
> = {
  'planned-next': {
    background: 'rgba(240, 169, 58, 0.18)',
    border: 'rgba(240, 169, 58, 0.7)',
    text: '#8A4B00',
  },
  'done-just-completed': {
    background: 'rgba(52, 199, 89, 0.18)',
    border: 'rgba(52, 199, 89, 0.7)',
    text: '#1F7A3A',
  },
  'done-recent': {
    background: 'rgba(52, 199, 89, 0.18)',
    border: 'rgba(52, 199, 89, 0.7)',
    text: '#1F7A3A',
  },
  'done-old': {
    background: 'rgba(52, 199, 89, 0.18)',
    border: 'rgba(52, 199, 89, 0.7)',
    text: '#1F7A3A',
  },
};

function statusDotColor(status: UserStepStatus, hasPlace: boolean): string {
  if (status === 'planned-next') return '#F0A93A';
  if (status.startsWith('done')) return '#34C759';
  if (hasPlace) return '#0A84FF';
  return 'rgba(120, 120, 130, 0.5)';
}

/**
 * Steps that were anchored from a raw dropped pin carry an unhelpful
 * "Dropped pin (lat, lng)" subtitle. Treat those as no-subtitle.
 */
function readableLocationName(name: string | null): string | null {
  if (!name) return null;
  if (/^Dropped pin/i.test(name.trim())) return null;
  return name;
}

function formatDistance(
  center: { lat: number; lng: number } | null,
  lat: number | null,
  lng: number | null,
): string | null {
  if (!center || lat == null || lng == null) return null;
  const meters = haversineDistance(center.lat, center.lng, lat, lng);
  const km = meters / 1000;
  if (km < 0.1) return 'here';
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

export function SavedJumpSheet({
  visible,
  steps,
  selectedStepId = null,
  anchor = null,
  arcGroups = [],
  relationshipSteps = [],
  orgStepItems = [],
  racingAreas,
  savedVenues,
  center,
  onDismiss,
  onPickStep,
  onPickPlace,
  onPickPeerStep,
  onAddPlaceInView,
}: SavedJumpSheetProps) {
  // Arc sections start collapsed — near-now steps stay the headline, older
  // arcs are one tap away. Persisting across opens within the session is fine.
  const [expandedArcs, setExpandedArcs] = useState<Set<string>>(() => new Set());
  const toggleArc = (id: string) =>
    setExpandedArcs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const hasAnything =
    steps.length > 0 ||
    arcGroups.length > 0 ||
    relationshipSteps.length > 0 ||
    orgStepItems.length > 0 ||
    racingAreas.length > 0 ||
    savedVenues.length > 0;

  // Dropdown mode (mockup #39): open as a card under the trigger pill instead
  // of a bottom sheet. The pill now lives on the LEFT of the top bar (right of
  // the interest dropdown), so align the card to whichever edge the anchor is
  // nearer — left-align when the anchor sits in the left half, else right-align.
  const isDropdown = anchor != null;
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const dropdownTop = anchor ? anchor.y + anchor.height + 8 : 0;
  const dropdownMaxHeight = anchor
    ? Math.min(560, Math.max(320, screenH - dropdownTop - 92))
    : undefined;
  const dropdownScrollMaxHeight = dropdownMaxHeight
    ? Math.max(220, dropdownMaxHeight - 106)
    : undefined;
  const dropdownWidth = Math.min(390, screenW - 32);
  const anchorOnLeftHalf = anchor ? anchor.x + anchor.width / 2 < screenW / 2 : false;
  const dropdownStyle = anchor
    ? {
        position: 'absolute' as const,
        top: dropdownTop,
        ...(anchorOnLeftHalf
          ? { left: Math.max(16, Math.min(anchor.x, screenW - dropdownWidth - 16)) }
          : { right: Math.max(16, screenW - (anchor.x + anchor.width)) }),
        width: dropdownWidth,
        maxHeight: dropdownMaxHeight,
        borderRadius: 16,
      }
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDropdown ? 'fade' : 'slide'}
      onRequestClose={onDismiss}
    >
      <Pressable
        style={[styles.backdrop, isDropdown && styles.backdropDropdown]}
        onPress={onDismiss}
      >
        <Pressable
          style={[styles.sheet, isDropdown && styles.sheetDropdown, dropdownStyle]}
          onPress={(e) => e.stopPropagation()}
        >
          {isDropdown ? null : (
            <View style={styles.handleRow}>
              <View style={styles.handle} />
              <Pressable
                onPress={onDismiss}
                hitSlop={12}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close saved"
              >
                <Ionicons name="close" size={22} color={IOS_COLORS.label} />
              </Pressable>
            </View>
          )}
          <View style={[styles.titleRow, isDropdown && styles.titleRowDropdown]}>
            <Ionicons name="star" size={16} color="#F0A93A" />
            <Text style={styles.title}>Saved &amp; jump to</Text>
          </View>

          {!hasAnything ? (
            <Text style={styles.empty}>
              Nothing saved yet. Map a step or save a venue to see it here.
            </Text>
          ) : (
            <ScrollView
              style={[
                styles.scroll,
                isDropdown && dropdownScrollMaxHeight
                  ? { maxHeight: dropdownScrollMaxHeight }
                  : null,
              ]}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {steps.length > 0 ? (
                <>
                  <SectionHeader label={`MY STEPS · ${steps.length}`} />
                  {steps.map((step, index) => {
                    const badgeLabel = STATUS_BADGE_LABEL[step.status];
                    const badgeTone = STATUS_BADGE_TONE[step.status];
                    const subtitle = readableLocationName(step.location_name);
                    const isSelected = step.step_id === selectedStepId;
                    return (
                      // TouchableOpacity + static style array — the function-form
                      // Pressable style silently strips flexDirection:'row' here.
                      <TouchableOpacity
                        key={step.step_id}
                        onPress={() => onPickStep(step)}
                        activeOpacity={0.55}
                        style={[styles.row, isSelected && styles.rowSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`Focus on ${step.title}`}
                      >
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: statusDotColor(step.status, step.has_place) },
                          ]}
                        />
                        <View style={styles.rowBody}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {index + 1}. {step.title}
                          </Text>
                          <View style={styles.rowMetaLine}>
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              {subtitle ??
                                (step.has_place ? 'On the map' : 'Tap to anchor on the map')}
                            </Text>
                            {badgeLabel && badgeTone ? (
                              <View
                                style={[
                                  styles.badge,
                                  {
                                    backgroundColor: badgeTone.background,
                                    borderColor: badgeTone.border,
                                  },
                                ]}
                              >
                                <Text style={[styles.badgeText, { color: badgeTone.text }]}>
                                  {badgeLabel}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : null}

              {arcGroups.map((group) => {
                if (group.steps.length === 0) return null;
                const expanded = expandedArcs.has(group.id);
                return (
                  <React.Fragment key={group.id}>
                    <TouchableOpacity
                      onPress={() => toggleArc(group.id)}
                      activeOpacity={0.55}
                      style={styles.arcHeader}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      accessibilityLabel={`${group.label}, ${group.steps.length} steps`}
                    >
                      <Text style={styles.sectionHeaderInline}>
                        {group.label} · {group.steps.length}
                      </Text>
                      <Ionicons
                        name={expanded ? 'chevron-down' : 'chevron-forward'}
                        size={13}
                        color={IOS_COLORS.secondaryLabel}
                      />
                    </TouchableOpacity>
                    {expanded
                      ? group.steps.map((step) => {
                          const badgeLabel = STATUS_BADGE_LABEL[step.status];
                          const badgeTone = STATUS_BADGE_TONE[step.status];
                          const subtitle = readableLocationName(step.location_name);
                          return (
                            <TouchableOpacity
                              key={step.step_id}
                              onPress={() => onPickStep(step)}
                              activeOpacity={0.55}
                              style={styles.row}
                              accessibilityRole="button"
                              accessibilityLabel={`Focus on ${step.title}`}
                            >
                              <View
                                style={[
                                  styles.dot,
                                  {
                                    backgroundColor: statusDotColor(step.status, step.has_place),
                                  },
                                ]}
                              />
                              <View style={styles.rowBody}>
                                <Text style={styles.rowTitle} numberOfLines={1}>
                                  {step.title}
                                </Text>
                                <View style={styles.rowMetaLine}>
                                  <Text style={styles.rowMeta} numberOfLines={1}>
                                    {subtitle ?? (step.has_place ? 'On the map' : 'No place yet')}
                                  </Text>
                                  {badgeLabel && badgeTone ? (
                                    <View
                                      style={[
                                        styles.badge,
                                        {
                                          backgroundColor: badgeTone.background,
                                          borderColor: badgeTone.border,
                                        },
                                      ]}
                                    >
                                      <Text style={[styles.badgeText, { color: badgeTone.text }]}>
                                        {badgeLabel}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      : null}
                  </React.Fragment>
                );
              })}

              {RELATIONSHIP_ORDER.map((rel) => {
                const group = relationshipSteps.filter((s) => s.relationship === rel);
                if (group.length === 0) return null;
                const meta = RELATIONSHIP_META[rel];
                const shown = group.slice(0, MAX_PER_GROUP);
                const overflow = group.length - shown.length;
                return (
                  <React.Fragment key={rel}>
                    <SectionHeader label={`${meta.label} · ${group.length}`} />
                    {shown.map((item) => {
                      const dist = formatDistance(center, item.lat, item.lng);
                      const rowMeta = [item.by, dist].filter(Boolean).join(' · ');
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => onPickPeerStep?.(item)}
                          activeOpacity={0.55}
                          style={styles.row}
                          accessibilityRole="button"
                          accessibilityLabel={`Focus on ${item.title}`}
                        >
                          <View style={[styles.dot, { backgroundColor: meta.color }]} />
                          <View style={styles.rowBody}>
                            <Text style={styles.rowTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                          {rowMeta ? (
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              {rowMeta}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                    {overflow > 0 ? (
                      <Text style={styles.overflowNote}>+{overflow} more</Text>
                    ) : null}
                  </React.Fragment>
                );
              })}

              {orgStepItems.length > 0 ? (
                <>
                  <SectionHeader label={`GROUPS · ${orgStepItems.length}`} />
                  {orgStepItems.map((item) => {
                    const dist = formatDistance(center, item.lat, item.lng);
                    const meta = [dist, item.subtitle].filter(Boolean).join(' · ');
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => onPickPlace(item)}
                        activeOpacity={0.55}
                        style={styles.row}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to ${item.name}`}
                      >
                        <Ionicons
                          name="flag"
                          size={16}
                          color="#14213D"
                          style={styles.placeIcon}
                        />
                        <View style={styles.rowBody}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {meta ? (
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              {meta}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : null}

              {racingAreas.length > 0 ? (
                <>
                  <SectionHeader label="YOUR RACING AREAS" />
                  {racingAreas.map((area) => {
                    const dist = formatDistance(center, area.lat, area.lng);
                    const meta = [dist, area.subtitle].filter(Boolean).join(' · ');
                    return (
                      <TouchableOpacity
                        key={area.id}
                        onPress={() => onPickPlace(area)}
                        activeOpacity={0.55}
                        style={styles.row}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to ${area.name}`}
                      >
                        <Ionicons
                          name="ellipse-outline"
                          size={18}
                          color={IOS_COLORS.systemBlue}
                          style={styles.placeIcon}
                        />
                        <View style={styles.rowBody}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {area.name}
                          </Text>
                          {meta ? (
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              {meta}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : null}

              {savedVenues.length > 0 ? (
                <>
                  <SectionHeader label="SAVED VENUES" />
                  {savedVenues.map((venue) => {
                    const dist = formatDistance(center, venue.lat, venue.lng);
                    const meta = dist
                      ? dist === 'here'
                        ? 'here'
                        : `${dist} away`
                      : null;
                    return (
                      <TouchableOpacity
                        key={venue.id}
                        onPress={() => onPickPlace(venue)}
                        activeOpacity={0.55}
                        style={styles.row}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to ${venue.name}`}
                      >
                        <Ionicons
                          name={venue.isHome ? 'home' : 'boat'}
                          size={16}
                          color={IOS_COLORS.secondaryLabel}
                          style={styles.placeIcon}
                        />
                        <View style={styles.rowBody}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {venue.name}
                          </Text>
                          {meta ? (
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              {meta}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : null}
            </ScrollView>
          )}

          {onAddPlaceInView ? (
            <TouchableOpacity
              onPress={onAddPlaceInView}
              activeOpacity={0.55}
              style={styles.footer}
              accessibilityRole="button"
              accessibilityLabel="Add the place in view to saved"
            >
              <Ionicons name="add" size={16} color={IOS_COLORS.systemBlue} />
              <Text style={styles.footerText}>Add the place in view to Saved</Text>
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  backdropDropdown: {
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingBottom: 28,
    maxHeight: '80%',
  },
  sheetDropdown: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  titleRowDropdown: {
    paddingTop: 10,
    paddingRight: 6,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    flex: 1,
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60, 60, 67, 0.28)',
  },
  closeBtn: {
    position: 'absolute',
    right: 10,
    top: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(60, 60, 67, 0.22)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 4,
  },
  title: {
    fontFamily: fontFamily.serif,
    fontSize: 19,
    color: IOS_COLORS.label,
  },
  sectionHeader: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 5,
  },
  arcHeader: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 5,
    borderRadius: 8,
  },
  sectionHeaderInline: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
  },
  scroll: {
    maxHeight: 460,
    flexShrink: 1,
  },
  scrollContent: {
    alignItems: 'stretch',
    paddingBottom: 2,
  },
  empty: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  row: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  rowSelected: {
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginLeft: 2,
    marginRight: 1,
    marginTop: 5,
  },
  placeIcon: {
    width: 20,
    textAlign: 'center',
    marginTop: 1,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  rowMetaLine: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowMeta: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 15,
    color: IOS_COLORS.secondaryLabel,
  },
  trailingSlot: {
    width: 52,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  overflowNote: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 4,
  },
  badge: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  footer: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60, 60, 67, 0.18)',
  },
  footerText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
});
