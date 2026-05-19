import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { SubStepRow } from './SubStepRow';
import {
  BeforeTheShiftCard,
  type BeforeShiftItem,
} from './plan/BeforeTheShiftCard';
import type {
  CapabilityChip,
  NetworkSuggestion,
  StepV2,
  WithCollaborator,
} from './types';

interface Props {
  step: StepV2;
  onToggleSubStep?: (subStepId: string) => void;
  onAddSubStep?: () => void;
  onAddCollaborator?: () => void;
  onPickWhere?: () => void;
  onAddCapability?: () => void;
  onNext?: () => void;
  /** D37: "Before the shift" checklist of library items (Plan tab). */
  beforeShift?: {
    items: BeforeShiftItem[];
    totalEstimate?: string;
    onToggle?: (id: string) => void;
    onAddFromLibrary?: () => void;
  };
}

export function PlanTabBody({
  step,
  onToggleSubStep,
  onAddSubStep,
  onAddCollaborator,
  onPickWhere,
  onAddCapability,
  onNext,
  beforeShift,
}: Props) {
  const filled = [
    step.what,
    step.why,
    step.subSteps.length > 0 ? '1' : null,
    step.withCollaborators.length > 0 ? '1' : null,
    step.where,
  ].filter(Boolean).length;

  return (
    <View style={styles.body}>
      {beforeShift && beforeShift.items.length > 0 ? (
        <BeforeTheShiftCard
          items={beforeShift.items}
          totalEstimate={beforeShift.totalEstimate}
          onToggle={beforeShift.onToggle}
          onAddFromLibrary={beforeShift.onAddFromLibrary}
        />
      ) : null}
      {step.what ? (
        <Section icon="bulb-outline" label="What you'll do">
          <Text style={styles.val}>{step.what}</Text>
        </Section>
      ) : null}

      {step.why ? (
        <Section icon="chatbox-outline" label="Why">
          <Text style={[styles.val, styles.valQuote]}>"{step.why}"</Text>
        </Section>
      ) : null}

      <Section icon="checkmark-done-outline" label="How · sub-steps">
        <View style={styles.subList}>
          {step.subSteps.map((s) => (
            <SubStepRow
              key={s.id}
              step={s}
              onToggle={() => onToggleSubStep?.(s.id)}
            />
          ))}
          <Pressable
            onPress={onAddSubStep}
            style={({ pressed }) => [
              styles.subAdd,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons name="add" size={14} color="#007AFF" />
            <Text style={styles.subAddText}>
              Add sub-step · plain · from Resources · from Concepts
            </Text>
          </Pressable>
        </View>
      </Section>

      <Section icon="people-outline" label="With">
        <WithList
          collaborators={step.withCollaborators}
          onAdd={onAddCollaborator}
        />
      </Section>

      <Section icon="location-outline" label="Where">
        <Text style={styles.val}>{step.where ?? 'Not set yet.'}</Text>
        <Pressable
          onPress={onPickWhere}
          style={({ pressed }) => [
            styles.linkBtn,
            pressed ? styles.pressed : null,
          ]}
        >
          <Ionicons name="map-outline" size={14} color="#1F8636" />
          <Text style={styles.linkBtnText}>
            Pick on map · see what other sailors did here
          </Text>
        </Pressable>
      </Section>

      <Section
        icon="sparkles-outline"
        label="Capabilities this will develop"
        labelTint="#AF52DE"
        actionLabel="+ tag"
        onAction={onAddCapability}
      >
        <CapabilityChipSet chips={step.capabilities} />
      </Section>

      {step.suggestions.length > 0 ? (
        <View style={styles.suggestSection}>
          <View style={styles.suggestHead}>
            <View style={styles.suggestTitle}>
              <View style={styles.suggestDot} />
              <Text style={styles.suggestTitleText}>
                Suggestions from your network
              </Text>
            </View>
            <Text style={styles.suggestCount}>
              {step.suggestions.length} for this step
            </Text>
          </View>
          <View style={styles.suggestStack}>
            {step.suggestions.map((s) => (
              <NetworkSuggestionRow key={s.id} suggestion={s} />
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.moreOptions,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.moreOptionsText}>More options</Text>
        <Ionicons name="chevron-down" size={16} color={IOS_COLORS.tertiaryLabel} />
      </Pressable>

      <Pressable
        onPress={onNext}
        style={({ pressed }) => [
          styles.nextBtn,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.nextBtnText}>Next · Start Doing</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
      </Pressable>
      <Text style={styles.nextSub}>
        Plan looks ready · {filled} / 5 fundamentals filled
      </Text>
    </View>
  );
}

function Section({
  icon,
  label,
  labelTint,
  actionLabel,
  onAction,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  labelTint?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionEye}>
        <View style={styles.sectionLeft}>
          <Ionicons
            name={icon}
            size={14}
            color={labelTint ?? IOS_COLORS.secondaryLabel}
          />
          <Text
            style={[
              styles.sectionLabel,
              labelTint ? { color: labelTint } : null,
            ]}
          >
            {label}
          </Text>
        </View>
        {actionLabel ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={styles.sectionAction}>{actionLabel}</Text>
          </Pressable>
        ) : (
          <Ionicons
            name="sparkles-outline"
            size={14}
            color={IOS_COLORS.tertiaryLabel}
          />
        )}
      </View>
      {children}
    </View>
  );
}

function WithList({
  collaborators,
  onAdd,
}: {
  collaborators: WithCollaborator[];
  onAdd?: () => void;
}) {
  return (
    <View style={styles.withList}>
      {collaborators.map((c) => (
        <View key={c.id} style={styles.whoChip}>
          <View
            style={[
              styles.avMini,
              { backgroundColor: c.tint ?? '#1E63D6' },
            ]}
          >
            <Text style={styles.avMiniText}>{c.initials}</Text>
          </View>
          <Text style={styles.whoChipName}>{c.name}</Text>
          {c.role ? (
            <Text style={styles.whoChipRole}>{c.role}</Text>
          ) : null}
        </View>
      ))}
      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [styles.addWho, pressed ? styles.pressed : null]}
      >
        <Ionicons name="add" size={14} color="#007AFF" />
        <Text style={styles.addWhoText}>Add</Text>
      </Pressable>
    </View>
  );
}

function CapabilityChipSet({ chips }: { chips: CapabilityChip[] }) {
  if (!chips.length) {
    return (
      <Text style={styles.capEmpty}>No capability tags yet — tap "+ tag" to add.</Text>
    );
  }
  return (
    <View style={styles.capList}>
      {chips.map((c) => (
        <View key={c.id} style={styles.cap}>
          <Text style={styles.capText}>{c.label}</Text>
          <Ionicons name="close" size={10} color={IOS_COLORS.tertiaryLabel} />
        </View>
      ))}
    </View>
  );
}

function NetworkSuggestionRow({ suggestion }: { suggestion: NetworkSuggestion }) {
  const isMentor = suggestion.kind === 'mentor';
  return (
    <View style={styles.suggestRow}>
      <View style={styles.suggestSrc}>
        <View
          style={[
            styles.avXS,
            { backgroundColor: suggestion.fromTint ?? '#5AC8FA' },
          ]}
        >
          <Text style={styles.avXSText}>{suggestion.fromInitials}</Text>
        </View>
        <View
          style={[
            styles.chipSrc,
            isMentor ? styles.chipSrcMentor : styles.chipSrcFollowee,
          ]}
        >
          <View
            style={[
              styles.chipSrcDot,
              { backgroundColor: isMentor ? '#9A6800' : '#1F8636' },
            ]}
          />
          <Text
            style={[
              styles.chipSrcText,
              { color: isMentor ? '#9A6800' : '#1F8636' },
            ]}
          >
            {isMentor ? 'Mentor' : 'Suggestion'}
          </Text>
        </View>
        <Text style={styles.suggestContext} numberOfLines={1}>
          <Text style={styles.suggestContextName}>{suggestion.fromName}</Text>
          <Text style={styles.suggestContextRest}> · {suggestion.fromContext}</Text>
        </Text>
      </View>
      <Text style={styles.suggestTitleLine}>{suggestion.title}</Text>
      {suggestion.fromLine ? (
        <Text style={styles.suggestFromLine}>{suggestion.fromLine}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  section: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  sectionEye: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
  },
  sectionAction: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: -0.05,
  },
  val: {
    fontSize: 15,
    lineHeight: 21,
    color: IOS_COLORS.label,
  },
  valQuote: {
    fontStyle: 'italic',
    color: IOS_COLORS.secondaryLabel,
  },
  subList: {
    gap: 2,
  },
  subAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.08)',
    marginTop: 6,
  },
  subAddText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  pressed: {
    opacity: 0.6,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  linkBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1F8636',
    letterSpacing: -0.05,
  },
  withList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  whoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 3,
    paddingRight: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  avMini: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  whoChipName: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  whoChipRole: {
    fontSize: 10,
    color: IOS_COLORS.tertiaryLabel,
    marginLeft: 2,
  },
  addWho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,122,255,0.4)',
  },
  addWhoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },
  capList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(175,82,222,0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(175,82,222,0.35)',
  },
  capText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C2DAA',
  },
  capEmpty: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  suggestSection: {
    gap: 6,
  },
  suggestHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  suggestTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#AF52DE',
  },
  suggestTitleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
  },
  suggestCount: {
    fontSize: 10,
    color: IOS_COLORS.tertiaryLabel,
  },
  suggestStack: {
    gap: 6,
  },
  suggestRow: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    padding: 11,
    gap: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  suggestSrc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avXS: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avXSText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chipSrc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chipSrcFollowee: {
    backgroundColor: 'rgba(52,199,89,0.14)',
  },
  chipSrcMentor: {
    backgroundColor: 'rgba(255,149,0,0.16)',
  },
  chipSrcDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  chipSrcText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  suggestContext: {
    fontSize: 10.5,
    flex: 1,
  },
  suggestContextName: {
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  suggestContextRest: {
    color: IOS_COLORS.secondaryLabel,
  },
  suggestTitleLine: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 16,
  },
  suggestFromLine: {
    fontSize: 10,
    color: IOS_COLORS.tertiaryLabel,
  },
  moreOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  moreOptionsText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.1,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
    shadowColor: '#007AFF',
    shadowOpacity: 0.36,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.15,
  },
  nextSub: {
    textAlign: 'center',
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: -0.05,
    marginTop: 2,
  },
});
