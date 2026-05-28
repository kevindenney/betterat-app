/**
 * ScopeRow — the second row of the unified top-bar contract.
 *
 * Where the global chrome row (interest pill + `+` + inbox + avatar) answers
 * "who am I and what can I do globally", ScopeRow answers "what slice am I
 * looking at right now". Used by Practice L1–L4 and (eventually) Library
 * zone pages.
 *
 * Composition (top → bottom):
 *
 *   1. Scope line — breadcrumb of zoom-out crumbs + bold focus title (with
 *      optional chevron). The crumbs are tap-targets; tapping one zooms
 *      out to that level. The title is the persona-native instance name
 *      (e.g. "Winter 2025–26", "wk 1", "Figure out Bram's mast step").
 *
 *   2. Zoom rail — four dots labelled ALL / ARC / WK / STEP, with one
 *      filled to indicate the current level. Trailing edge of the scope
 *      line so it never competes with the title for the leading edge.
 *
 *   3. Vitals chips — usually three status counts (done · in play ·
 *      queued) plus optional muted meta (date range, week-of-N).
 *
 *   4. Narration — optional italic Librarian / Coach line, demoted below
 *      vitals so the counts lead.
 *
 * The component is intentionally presentational. Wiring (which crumbs to
 * show, what counts mean, where the rail navigates) lives in each L*View
 * because the vocabulary and navigation differ per zoom level.
 *
 * See: docs/redesign/ios-register/topbar-unified-canonical.html
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

/**
 * Zoom levels in the Practice timeline.
 * `all` = L4 (multi-arc landscape), `arc` = L3 (a single arc),
 * `week` = L2 (a single week within an arc), `step` = L1 (one step).
 */
export type ScopeZoomLevel = 'all' | 'arc' | 'week' | 'step';

export interface ScopeCrumb {
  label: string;
  onPress?: () => void;
}

export type ScopeChipTone = 'good' | 'warn' | 'queued' | 'meta' | 'status';

export interface ScopeVitalChip {
  label: string;
  tone?: ScopeChipTone;
  onPress?: () => void;
}

interface Props {
  /**
   * Trail of zoom-out crumbs ending one level above the focus title.
   * Each crumb is rendered with a trailing ▸ separator. Pass `onPress`
   * to make a crumb tappable (zoom up to that level); omit to render
   * as plain text.
   */
  breadcrumb?: ScopeCrumb[];

  /** Bold focus title (the rightmost / current scope). */
  title: string;
  /** When set, the title gains a chevron and becomes a tap target — used for switching scope (arc picker, week picker, etc.). */
  onTitlePress?: () => void;

  /**
   * Current zoom dot to fill. Pass `undefined` to hide the rail (use for
   * non-timeline surfaces like Library zones).
   */
  zoomLevel?: ScopeZoomLevel;
  /** Tap handler for the four rail dots; receives the requested level. */
  onZoomChange?: (level: ScopeZoomLevel) => void;

  /**
   * Status/meta chips. Convention is the first three are the live status
   * counts (good / warn / queued); any after that are muted meta (date
   * range, week-of-N, "Also relevant for X"). The L1 step view typically
   * leads with a `status`-toned chip representing Planned / In play / Done.
   */
  vitals?: ScopeVitalChip[];

  /**
   * Optional Librarian / Coach italic line. Rendered below vitals so
   * counts lead. Pass a React node so consumers can style emphasis spans.
   */
  narration?: React.ReactNode;
}

const ZOOM_ORDER: readonly ScopeZoomLevel[] = ['all', 'arc', 'week', 'step'] as const;
const ZOOM_LABEL: Record<ScopeZoomLevel, string> = {
  all: 'ALL',
  arc: 'ARC',
  week: 'WK',
  step: 'STEP',
};

export function ScopeRow({
  breadcrumb,
  title,
  onTitlePress,
  zoomLevel,
  onZoomChange,
  vitals,
  narration,
}: Props) {
  const hasCrumbs = breadcrumb && breadcrumb.length > 0;
  const hasRail = zoomLevel !== undefined;
  const hasVitals = vitals && vitals.length > 0;

  const titleNode = (
    <View style={styles.titleRow}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {onTitlePress ? (
        <Ionicons
          name="chevron-down"
          size={20}
          color={IOS_REGISTER.labelSecondary}
          style={styles.titleCaret}
        />
      ) : null}
    </View>
  );

  return (
    <View style={styles.block}>
      <View style={styles.scopeLine}>
        <View style={styles.scopeLeft}>
          {hasCrumbs ? (
            <View style={styles.crumbRow}>
              {breadcrumb!.map((crumb, idx) => (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  {crumb.onPress ? (
                    <Pressable
                      onPress={crumb.onPress}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Zoom out to ${crumb.label}`}
                    >
                      <Text style={styles.crumbLink} numberOfLines={1}>
                        {crumb.label}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.crumbText} numberOfLines={1}>
                      {crumb.label}
                    </Text>
                  )}
                  <Text style={styles.crumbSeparator}>▸</Text>
                </React.Fragment>
              ))}
            </View>
          ) : null}

          {onTitlePress ? (
            <Pressable
              onPress={onTitlePress}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${title}. Tap to switch.`}
            >
              {titleNode}
            </Pressable>
          ) : (
            titleNode
          )}
        </View>

        {hasRail ? (
          <ZoomRail
            activeLevel={zoomLevel!}
            onZoomChange={onZoomChange}
          />
        ) : null}
      </View>

      {hasVitals ? (
        <View style={styles.vitalsRow}>
          {vitals!.map((chip, idx) => (
            <VitalChip key={`${chip.label}-${idx}`} chip={chip} />
          ))}
        </View>
      ) : null}

      {narration ? (
        <View style={styles.narrationRow}>
          {typeof narration === 'string' ? (
            <Text style={styles.narrationText}>{narration}</Text>
          ) : (
            narration
          )}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function ZoomRail({
  activeLevel,
  onZoomChange,
}: {
  activeLevel: ScopeZoomLevel;
  onZoomChange?: (level: ScopeZoomLevel) => void;
}) {
  return (
    <View style={styles.rail}>
      <Text style={styles.railLabel}>{ZOOM_LABEL[activeLevel]}</Text>
      {ZOOM_ORDER.map((level) => {
        const isActive = level === activeLevel;
        const interactive = !!onZoomChange && !isActive;
        return (
          <Pressable
            key={level}
            onPress={interactive ? () => onZoomChange!(level) : undefined}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Zoom to ${ZOOM_LABEL[level].toLowerCase()}`}
            accessibilityState={{ selected: isActive }}
            disabled={!interactive}
            style={styles.railDotHit}
          >
            <View style={[styles.railDot, isActive && styles.railDotActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function VitalChip({ chip }: { chip: ScopeVitalChip }) {
  const tone = chip.tone ?? 'meta';
  const showSwatch = tone === 'good' || tone === 'warn' || tone === 'queued' || tone === 'status';
  const swatchColor = SWATCH_COLOR[tone];

  const content = (
    <View style={[styles.chip, tone === 'meta' && styles.chipMeta]}>
      {showSwatch ? (
        <View style={[styles.chipSwatch, { backgroundColor: swatchColor }]} />
      ) : null}
      <Text
        style={[
          styles.chipLabel,
          tone === 'meta' && styles.chipLabelMeta,
        ]}
        numberOfLines={1}
      >
        {chip.label}
      </Text>
    </View>
  );

  if (chip.onPress) {
    return (
      <Pressable onPress={chip.onPress} hitSlop={6} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }
  return content;
}

const SWATCH_COLOR: Record<ScopeChipTone, string> = {
  good: IOS_COLORS.systemGreen,
  warn: IOS_COLORS.systemOrange,
  queued: IOS_COLORS.systemGray3,
  meta: 'transparent',
  // L1 status (Planned / In play / Done) — neutral until completed; consumer
  // can override the swatch via tone choice if a specific state colour is
  // wanted at the call site.
  status: IOS_COLORS.systemGray3,
};

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 6,
  },
  scopeLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  scopeLeft: {
    flex: 1,
    minWidth: 0,
  },
  crumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 2,
  },
  crumbLink: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  crumbText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  crumbSeparator: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    marginHorizontal: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
  },
  titleCaret: {
    marginTop: 4,
  },

  // Vitals chips
  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  chipMeta: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  chipSwatch: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  chipLabelMeta: {
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },

  // Narration (Librarian italic line)
  narrationRow: {
    paddingTop: 2,
  },
  narrationText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },

  // Zoom rail
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  railLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginRight: 2,
  },
  railDotHit: {
    padding: 3,
  },
  railDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  railDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOS_REGISTER.label,
  },
});

export default ScopeRow;
