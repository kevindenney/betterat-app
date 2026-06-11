import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { AdoptStepFooter } from '@/components/step/AdoptStepFooter';
import { AtlasPickerBus, type AtlasPickerResult } from '@/services/AtlasPickerBus';
import { PlanTabBody } from './PlanTabBody';
import type { BeforeShiftItem } from './plan/BeforeTheShiftCard';
import type { StepPhaseTab, StepV2 } from './types';

interface Props {
  step: StepV2;
  tab: StepPhaseTab;
  onTabChange: (tab: StepPhaseTab) => void;
  onToggleSubStep?: (subStepId: string) => void;
  backLabel?: string;
  /** Render AdoptStepFooter; pass provenance copy to caption it. */
  adopt?: {
    provenance?: string;
    onAddToTimeline: () => void;
    onSaveAsConceptSeed: () => void;
  };
  beforeShift?: {
    items: BeforeShiftItem[];
    totalEstimate?: string;
    onToggle?: (id: string) => void;
    onAddFromLibrary?: () => void;
  };
}

const TAB_KEYS: StepPhaseTab[] = ['plan', 'do', 'reflect', 'discuss'];

const TAB_LABELS: Record<StepPhaseTab, string> = {
  plan: 'Plan',
  do: 'Do',
  reflect: 'Reflect',
  discuss: 'Discuss',
};

const STATE_PILL_STYLE = {
  done: { bg: 'rgba(52,199,89,0.16)', color: '#1F8636' },
  current: { bg: 'rgba(0,122,255,0.14)', color: '#0046A8' },
  next: { bg: '#F2F2F7', color: IOS_COLORS.secondaryLabel },
} as const;

export function StepShell({
  step,
  tab,
  onTabChange,
  onToggleSubStep,
  backLabel = 'Practice',
  adopt,
  beforeShift,
}: Props) {
  const insets = useSafeAreaInsets();
  const [pickedLocation, setPickedLocation] = useState<AtlasPickerResult | null>(null);
  const unsubscribePickerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setPickedLocation(null);
  }, [step.id]);

  useEffect(() => {
    return () => {
      unsubscribePickerRef.current?.();
      unsubscribePickerRef.current = null;
    };
  }, []);

  const displayStep = useMemo<StepV2>(() => {
    if (!pickedLocation) return step;
    const name =
      pickedLocation.place ??
      `${pickedLocation.lat.toFixed(4)}, ${pickedLocation.lng.toFixed(4)}`;
    return {
      ...step,
      where: `${name} · ${pickedLocation.lat.toFixed(4)}, ${pickedLocation.lng.toFixed(4)}`,
    };
  }, [pickedLocation, step]);

  const handlePickWhere = useCallback(() => {
    unsubscribePickerRef.current?.();
    unsubscribePickerRef.current = AtlasPickerBus.awaitResult((result) => {
      unsubscribePickerRef.current = null;
      setPickedLocation(result);
    }, () => {
      unsubscribePickerRef.current = null;
    });
    // Root-level alias: pushing the tab route would POP this step screen
    // (killing the bus subscription above), so the pick was never applied.
    router.push({ pathname: '/atlas-picker', params: { fromPlan: '1' } });
  }, []);

  const showDiscuss = step.hasSharedAccess !== false; // default true if undefined
  const visibleTabs = showDiscuss
    ? TAB_KEYS
    : (TAB_KEYS.filter((k) => k !== 'discuss') as StepPhaseTab[]);
  const pillStyle = STATE_PILL_STYLE[step.state];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/practice'))}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color="#007AFF" />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
        <View style={styles.topbarRight}>
          <Ionicons name="share-outline" size={20} color="#007AFF" />
          <Ionicons name="ellipsis-horizontal" size={20} color="#007AFF" />
        </View>
      </View>

      <View style={styles.titlebar}>
        <View style={styles.titleTopRow}>
          <View style={[styles.pill, { backgroundColor: pillStyle.bg }]}>
            <View
              style={[styles.pillDot, { backgroundColor: pillStyle.color }]}
            />
            <Text style={[styles.pillText, { color: pillStyle.color }]}>
              {step.stateLabel}
            </Text>
          </View>
          <Text style={styles.stepNo}>
            <Text style={styles.stepNoEm}>Step {step.stepNumber}</Text>
            {step.contextLine ? ` · ${step.contextLine}` : ''}
          </Text>
        </View>
        <Text style={styles.title}>{step.title}</Text>
        {step.planChip ? (
          <View style={styles.fromPlan}>
            <View
              style={[
                styles.fromPlanChip,
                { backgroundColor: `${step.planChip.color}22` },
              ]}
            >
              <View
                style={[styles.fromPlanDot, { backgroundColor: step.planChip.color }]}
              />
              <Text style={styles.fromPlanLabel}>{step.planChip.label}</Text>
            </View>
            <Text style={styles.fromPlanSub}>{step.planChip.subtitle}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {visibleTabs.map((k) => {
          const isActive = k === tab;
          return (
            <Pressable
              key={k}
              onPress={() => onTabChange(k)}
              style={styles.tab}
            >
              <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
                {TAB_LABELS[k]}
                {k === 'discuss' && step.discussCount ? (
                  <Text style={styles.tabPip}>  {step.discussCount}</Text>
                ) : null}
              </Text>
              {isActive ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {tab === 'plan' ? (
          <PlanTabBody
            step={displayStep}
            onToggleSubStep={onToggleSubStep}
            onPickWhere={handlePickWhere}
            beforeShift={beforeShift}
          />
        ) : tab === 'do' ? (
          <PlaceholderTab
            title="Do"
            blurb="Live-capture surface for this step — keep the existing Do/Act body for now. Rebuild lands later."
          />
        ) : tab === 'reflect' ? (
          <PlaceholderTab
            title="Reflect"
            blurb="Post-step reflection — keep existing Reflect/Review body for now. Rebuild lands later."
          />
        ) : (
          <PlaceholderTab
            title="Discuss"
            blurb="Thread visible only when the step has shared access. Wave 2 deferred: real-time thread + composer lands in session 2."
          />
        )}
      </ScrollView>
      {adopt ? (
        <AdoptStepFooter
          provenance={adopt.provenance}
          onAddToTimeline={adopt.onAddToTimeline}
          onSaveAsConceptSeed={adopt.onSaveAsConceptSeed}
        />
      ) : null}
    </View>
  );
}

function PlaceholderTab({ title, blurb }: { title: string; blurb: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderBlurb}>{blurb}</Text>
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
  titlebar: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.md,
    gap: 8,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  titleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stepNo: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  stepNoEm: {
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.45,
    lineHeight: 28,
  },
  fromPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  fromPlanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  fromPlanDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  fromPlanLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: IOS_COLORS.label,
    textTransform: 'uppercase',
  },
  fromPlanSub: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.2)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  tabLabelActive: {
    color: IOS_COLORS.label,
  },
  tabPip: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF3B30',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -StyleSheet.hairlineWidth,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#007AFF',
    borderRadius: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 40,
  },
  placeholder: {
    margin: IOS_SPACING.lg,
    padding: IOS_SPACING.lg,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.systemBackground,
    gap: 8,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  placeholderBlurb: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 19,
  },
});
