/**
 * OpenStepPicker — modal popup of the nursing Atlas steps. Reachable from
 * the step-selector pill in the F4 top chrome. Tapping any row closes the
 * picker and centers the map on that step.
 *
 * Three jobs, mirroring the sail-racing SavedJumpSheet in nursing vernacular:
 *   1. JUMP TO A STEP — current-rotation steps (flat, or bucketed by rotation
 *      arc when `arcGroups` is supplied).
 *   2. ROTATIONS — older work grouped by clinical rotation (an "arc"); the
 *      current rotation renders first and expanded, past ones one tap away.
 *   3. YOUR CLINICAL SITES — the sites the student has logged shifts at; tap
 *      to fly the map there (the nursing analog of "your racing areas").
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { PickerStep, UserStepStatus } from '@/hooks/useUserAtlasSteps';
import type { ArcStepGroup } from '@/components/ios-register/atlas/SavedJumpSheet';

/** A clinical site the student has logged at — the "racing areas" analog. */
export interface ClinicalSiteItem {
  /** atlas_poi id, used as the key + map focus target. */
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** Trailing context, e.g. "6 shifts · 18 evidenced". */
  subtitle?: string | null;
}

interface OpenStepPickerProps {
  visible: boolean;
  steps: PickerStep[];
  selectedStepId?: string | null;
  /** Older steps bucketed by rotation arc, current rotation first. */
  arcGroups?: ArcStepGroup[];
  /** Sites the student has logged shifts at — collapsible jump list. */
  clinicalSites?: ClinicalSiteItem[];
  onDismiss: () => void;
  onPickStep: (step: PickerStep) => void;
  /** Recenter the map on a logged clinical site. */
  onPickSite?: (site: ClinicalSiteItem) => void;
}

const STATUS_BADGE_LABEL: Partial<Record<UserStepStatus, string>> = {
  'planned-next': 'NEXT',
  'done-just-completed': 'JUST DONE',
  'done-recent': 'DONE',
  'done-old': 'DONE',
};

const STATUS_BADGE_TONE: Partial<
  Record<
    UserStepStatus,
    { background: string; border: string; text: string }
  >
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

function accentForStatus(status: UserStepStatus, hasPlace: boolean): string {
  if (status === 'planned-next') return '#F0A93A';
  if (status === 'done-just-completed' || status.startsWith('done')) return '#34C759';
  if (hasPlace) return '#0A84FF';
  return 'rgba(120, 120, 130, 0.5)';
}

/**
 * Some steps carry an unhelpful auto-generated subtitle like
 * "Dropped pin (22.366, 114.270)" because the user dropped a raw pin
 * without naming the place. Treat those as no-subtitle so the row
 * stays clean.
 */
function readableLocationName(name: string | null): string | null {
  if (!name) return null;
  if (/^Dropped pin/i.test(name.trim())) return null;
  return name;
}

function StepRow({
  step,
  index,
  selectedStepId,
  onPickStep,
}: {
  step: PickerStep;
  /** When set, the row is numbered (flat list); omit inside arc groups. */
  index?: number;
  selectedStepId: string | null;
  onPickStep: (step: PickerStep) => void;
}) {
  const badgeLabel = STATUS_BADGE_LABEL[step.status];
  const badgeTone = STATUS_BADGE_TONE[step.status];
  const subtitle = readableLocationName(step.location_name);
  const isHeroStep = step.status === 'planned-next';
  const isSelected = step.step_id === selectedStepId;
  const accentColor = accentForStatus(step.status, step.has_place);
  return (
    // Outer View carries the static row layout so the Pressable's
    // function-form style can't strip it (see
    // feedback_pressable_margin_row_stripping). Inner Pressable handles
    // taps + pressed-state tint only.
    <View
      style={[
        styles.row,
        isHeroStep && styles.rowHero,
        isSelected && styles.rowSelected,
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <Pressable
        onPress={() => onPickStep(step)}
        style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`Focus on ${step.title}`}
      >
        <View style={styles.rowBody}>
          <View style={styles.rowTitleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {index != null ? `${index + 1}. ` : ''}
              {step.title}
            </Text>
            {badgeLabel && badgeTone ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: badgeTone.background, borderColor: badgeTone.border },
                ]}
              >
                <Text style={[styles.badgeText, { color: badgeTone.text }]}>{badgeLabel}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.rowMetaRow}>
            <Ionicons
              name={step.has_place ? 'location' : 'location-outline'}
              size={12}
              color={step.has_place ? IOS_COLORS.systemBlue : IOS_COLORS.tertiaryLabel}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {subtitle ?? (step.has_place ? 'On the map' : 'Tap to anchor on the map')}
            </Text>
          </View>
        </View>
        <Ionicons
          name={isSelected ? 'checkmark' : 'chevron-forward'}
          size={isSelected ? 18 : 16}
          color={isSelected ? IOS_COLORS.systemBlue : IOS_COLORS.tertiaryLabel}
        />
      </Pressable>
    </View>
  );
}

function SectionHeader({
  label,
  collapsible,
  expanded,
  onToggle,
}: {
  label: string;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  if (!collapsible) {
    return <Text style={styles.sectionHeader}>{label}</Text>;
  }
  return (
    <Pressable
      onPress={onToggle}
      style={styles.sectionHeaderRow}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={label}
    >
      <Text style={styles.sectionHeaderInline}>{label}</Text>
      <Ionicons
        name={expanded ? 'chevron-down' : 'chevron-forward'}
        size={13}
        color={IOS_COLORS.secondaryLabel}
      />
    </Pressable>
  );
}

export function OpenStepPicker({
  visible,
  steps,
  selectedStepId = null,
  arcGroups = [],
  clinicalSites = [],
  onDismiss,
  onPickStep,
  onPickSite,
}: OpenStepPickerProps) {
  // Collapsible sections: the current rotation starts expanded (it's the
  // headline); other rotations + the sites section start collapsed. User
  // taps override either default for the session.
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, boolean>>({});
  const isExpanded = (key: string, defaultExpanded: boolean) =>
    sectionOverrides[key] ?? defaultExpanded;
  const toggle = (key: string, defaultExpanded: boolean) =>
    setSectionOverrides((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultExpanded) }));

  const usesArcs = arcGroups.length > 0;
  const hasAnything = steps.length > 0 || usesArcs || clinicalSites.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          // Pressable inside a Pressable backdrop — stop propagation so
          // taps on the sheet body don't dismiss.
        >
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <Pressable
              onPress={onDismiss}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close step picker"
            >
              <Ionicons name="close" size={22} color={IOS_COLORS.label} />
            </Pressable>
          </View>
          <Text style={styles.heading}>Jump to step</Text>
          {!hasAnything ? (
            <Text style={styles.empty}>No steps in this interest yet.</Text>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Current working set: flat list, or the rotation arcs. */}
              {!usesArcs
                ? steps.map((step, index) => (
                    <StepRow
                      key={step.step_id}
                      step={step}
                      index={index}
                      selectedStepId={selectedStepId}
                      onPickStep={onPickStep}
                    />
                  ))
                : arcGroups.map((group) => {
                    if (group.steps.length === 0) return null;
                    const expanded = isExpanded(group.id, !!group.isCurrent);
                    return (
                      <React.Fragment key={group.id}>
                        <SectionHeader
                          label={`${group.label} · ${group.steps.length}`}
                          collapsible
                          expanded={expanded}
                          onToggle={() => toggle(group.id, !!group.isCurrent)}
                        />
                        {expanded
                          ? group.steps.map((step) => (
                              <StepRow
                                key={step.step_id}
                                step={step}
                                selectedStepId={selectedStepId}
                                onPickStep={onPickStep}
                              />
                            ))
                          : null}
                      </React.Fragment>
                    );
                  })}

              {/* YOUR CLINICAL SITES — jump the map to a logged site. */}
              {clinicalSites.length > 0 ? (
                <>
                  <SectionHeader
                    label={`YOUR CLINICAL SITES · ${clinicalSites.length}`}
                    collapsible
                    expanded={isExpanded('clinical-sites', false)}
                    onToggle={() => toggle('clinical-sites', false)}
                  />
                  {isExpanded('clinical-sites', false)
                    ? clinicalSites.map((site) => (
                        <View key={site.id} style={styles.row}>
                          <View style={[styles.accentBar, { backgroundColor: '#0A84FF' }]} />
                          <Pressable
                            onPress={() => onPickSite?.(site)}
                            style={({ pressed }) => [
                              styles.rowPressable,
                              pressed && styles.rowPressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Go to ${site.name}`}
                          >
                            <Ionicons
                              name="medkit-outline"
                              size={18}
                              color={IOS_COLORS.systemBlue}
                              style={styles.siteIcon}
                            />
                            <View style={styles.rowBody}>
                              <Text style={styles.title} numberOfLines={1}>
                                {site.name}
                              </Text>
                              {site.subtitle ? (
                                <Text style={styles.metaText} numberOfLines={1}>
                                  {site.subtitle}
                                </Text>
                              ) : null}
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color={IOS_COLORS.tertiaryLabel}
                            />
                          </Pressable>
                        </View>
                      ))
                    : null}
                </>
              ) : null}
            </ScrollView>
          )}
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
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingBottom: 28,
    maxHeight: '75%',
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
  heading: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  scroll: {
    maxHeight: 440,
  },
  scrollContent: {
    paddingVertical: 4,
    gap: 6,
  },
  empty: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  sectionHeader: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sectionHeaderInline: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    backgroundColor: 'rgba(120, 120, 130, 0.06)',
    overflow: 'hidden',
  },
  rowHero: {
    backgroundColor: 'rgba(240, 169, 58, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(240, 169, 58, 0.42)',
  },
  rowSelected: {
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.42)',
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
  },
  rowPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowPressed: {
    backgroundColor: 'rgba(120, 120, 130, 0.16)',
  },
  accentBar: {
    width: 4,
  },
  siteIcon: {
    width: 20,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 4,
    paddingLeft: 8,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    flexShrink: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 1,
  },
  badgeText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
    lineHeight: 19,
  },
});
