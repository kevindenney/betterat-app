import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AtlasMapLibreCanvas,
  type AtlasPinSpec,
} from '@/components/ios-register/atlas/AtlasMapLibreCanvas';
import { InterestSwitcher, openInterestSwitcher } from '@/components/InterestSwitcher';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';
import { useInterest } from '@/providers/InterestProvider';
import { useUserAtlasSteps, type PickerStep } from '@/hooks/useUserAtlasSteps';
import { OpenStepPicker } from './OpenStepPicker';

type GolfSurface = 'venues' | 'course' | 'game' | 'nearby';
type GolfFilter = 'mine' | 'club' | 'coach' | 'group';

type GolfAtlasSurfaceProps = {
  embedded: boolean;
  subtitle?: string;
  bottomSheetOffset?: number;
  onPrimaryAction?: (pin?: {
    lat: number;
    lng: number;
    place?: string;
    suggestedTitle?: string;
    suggestedCategory?: string;
    suggestedInterestSlug?: string;
    metadata?: Record<string, unknown>;
  }) => void;
  onStepPress?: (stepId: string) => void;
};

const TURF = '#15663B';
const FLAG = '#C42E2E';
const WATER = '#2E73A8';
const LABEL = '#16261A';
const LABEL_2 = 'rgba(28,46,32,0.62)';
const SEP = 'rgba(30,70,40,0.12)';

const OAKRIDGE_CC = { lng: -122.1124, lat: 37.4178 };

const GOLF_VENUE_PINS: AtlasPinSpec[] = [
  {
    id: 'golf-venue-range',
    kind: 'poi-racing-area',
    lng: -122.1163,
    lat: 37.4165,
    label: 'Practice Range',
    subtitle: 'Grass tees · short-game area',
  },
  {
    id: 'golf-venue-home',
    kind: 'poi-club-anchor',
    lng: OAKRIDGE_CC.lng,
    lat: OAKRIDGE_CC.lat,
    label: 'Oakridge CC',
    subtitle: 'Home course',
  },
  {
    id: 'golf-venue-sim',
    kind: 'poi-sim-lab',
    lng: -122.1192,
    lat: 37.4211,
    label: 'GolfTec Sim',
    subtitle: 'Trackman · 4 mi',
  },
  {
    id: 'golf-venue-green',
    kind: 'poi-home-anchor',
    lng: -122.1101,
    lat: 37.4197,
    label: 'Putting Green',
    subtitle: 'Fast today',
  },
];

const GOLF_HOLE_PINS: AtlasPinSpec[] = [
  { id: 'golf-hole-1', kind: 'race-mark', lng: -122.1161, lat: 37.4196, label: '1', subtitle: 'Opening hole' },
  { id: 'golf-hole-3', kind: 'race-mark', lng: -122.1135, lat: 37.4210, label: '3', subtitle: 'Par 4 · steady' },
  { id: 'golf-hole-5', kind: 'race-mark', lng: -122.1112, lat: 37.4182, label: '5', subtitle: 'Par 5 · layup zone' },
  { id: 'golf-hole-7', kind: 'race-mark', lng: -122.1090, lat: 37.4212, label: '7', subtitle: 'Worst hole · avoid right' },
  { id: 'golf-hole-9', kind: 'race-mark', lng: -122.1074, lat: 37.4188, label: '9', subtitle: 'Turn · birdie look' },
];

const HEAT = [
  ['1', '#15803D'], ['2', '#0E7490'], ['3', '#0E7490'], ['4', '#D97706'],
  ['5', '#D97706'], ['6', '#0E7490'], ['7', FLAG], ['8', '#0E7490'],
  ['9', '#0E7490'], ['10', '#0E7490'], ['11', '#D97706'], ['12', '#15803D'],
  ['13', '#0E7490'], ['14', FLAG], ['15', '#0E7490'], ['16', '#0E7490'],
  ['17', '#D97706'], ['18', '#0E7490'],
] as const;

const STROKES_GAINED = [
  { id: 'tee', label: 'Off the tee', note: 'Distance fine · miss right', value: '+0.4', tone: '#2E73A8', good: true },
  { id: 'approach', label: 'Approach', note: 'Bleeds from 150-175y', value: '-2.1', tone: TURF },
  { id: 'short', label: 'Short game', note: 'Up-and-down 48% · solid', value: '+0.2', tone: '#B45309', good: true },
  { id: 'putting', label: 'Putting', note: 'Worst on fast greens · 3-putts', value: '-3.1', tone: '#6D28D9', bad: true },
  { id: 'mgmt', label: 'Course management', note: 'Big numbers on par 5s', value: '-1.0', tone: '#475569' },
];

export function GolfAtlasSurface({
  embedded,
  subtitle,
  bottomSheetOffset = 0,
  onPrimaryAction,
  onStepPress,
}: GolfAtlasSurfaceProps) {
  const insets = useSafeAreaInsets();
  const { currentInterest } = useInterest();
  const { pickerSteps } = useUserAtlasSteps({ interestSlug: 'golf' });
  const [surface, setSurface] = useState<GolfSurface>('venues');
  const [lastAtlasSurface, setLastAtlasSurface] = useState<Exclude<GolfSurface, 'nearby'>>('venues');
  const [activeFilter, setActiveFilter] = useState<GolfFilter>('mine');
  const [joinedTeeTime, setJoinedTeeTime] = useState<string | null>(null);
  const [savedFocus, setSavedFocus] = useState<string | null>(null);
  const [stepPickerVisible, setStepPickerVisible] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const topPad = embedded ? insets.top + 10 : 48;
  const bottomPad = bottomSheetOffset + 18;

  const title =
    surface === 'course'
      ? 'Oakridge CC'
      : surface === 'game'
        ? 'My Game'
        : surface === 'nearby'
          ? 'Nearby'
          : 'Your Golf';

  const planRound = () => {
    onPrimaryAction?.({
      lat: 37.4178,
      lng: -122.1124,
      place: 'Oakridge CC',
      suggestedTitle: 'Saturday game plan',
      suggestedCategory: 'golf-round',
      suggestedInterestSlug: 'golf',
      metadata: {
        atlas: {
          origin: 'atlas_golf_round',
          frame: 'f9',
          interest_slug: 'golf',
          golf: {
            venue: 'Oakridge CC',
            tee_time: 'Sat 8:10',
            handicap: 14.2,
            target: 'Break 80',
          },
        },
        plan: {
          what_will_you_do: 'Play Oakridge from the white tees with a putting-speed plan.',
          where_location: { name: 'Oakridge CC', lat: 37.4178, lng: -122.1124 },
        },
      },
    });
  };

  const planPractice = () => {
    onPrimaryAction?.({
      lat: 37.4211,
      lng: -122.1192,
      place: 'GolfTec Sim · Trackman',
      suggestedTitle: 'Putting speed session',
      suggestedCategory: 'golf-practice',
      suggestedInterestSlug: 'golf',
      metadata: {
        atlas: {
          origin: 'atlas_golf_gap_route',
          frame: 'f9',
          interest_slug: 'golf',
          golf: {
            leak: 'Putting costs 3.1 shots a round',
            route_to: 'GolfTec Sim · Trackman',
          },
        },
        plan: {
          what_will_you_do: 'Calibrate 20-45 foot speed on fast greens.',
          where_location: { name: 'GolfTec Sim · Trackman', lat: 37.4211, lng: -122.1192 },
        },
      },
    });
  };

  const showSurface = (next: Exclude<GolfSurface, 'nearby'>) => {
    setLastAtlasSurface(next);
    setSurface(next);
  };

  const openNearby = () => {
    if (surface !== 'nearby') {
      setLastAtlasSurface(surface);
    }
    setSurface('nearby');
  };

  const topStepPickerStepId = useMemo(() => {
    if (selectedStepId) return selectedStepId;
    return (
      pickerSteps.find((step) => step.status === 'planned-next')?.step_id ??
      pickerSteps[0]?.step_id ??
      null
    );
  }, [pickerSteps, selectedStepId]);
  const selectedPickerStep = useMemo(
    () => pickerSteps.find((step) => step.step_id === selectedStepId) ?? null,
    [pickerSteps, selectedStepId],
  );

  const stepSwitcherLabel = useMemo(() => {
    if (!topStepPickerStepId) return 'Pick step';
    const index = pickerSteps.findIndex((step) => step.step_id === topStepPickerStepId);
    if (index < 0) return 'Pick step';
    const step = pickerSteps[index];
    const ordinal = `Step ${index + 1} of ${pickerSteps.length}`;
    const title = step.title.trim();
    return title ? `${title} · ${ordinal}` : ordinal;
  }, [pickerSteps, topStepPickerStepId]);

  const handlePickStep = useCallback(
    (step: PickerStep) => {
      setSelectedStepId(step.step_id);
      setStepPickerVisible(false);
    },
    [],
  );

  return (
    <View style={styles.frame}>
      <GolfMapBackdrop
        surface={surface === 'nearby' ? lastAtlasSurface : surface}
        focusedStep={selectedPickerStep}
        onPinPress={(pin) => {
          if (pin.id === 'golf-venue-home') showSurface('course');
          if (pin.id === 'golf-venue-sim') showSurface('game');
        }}
      />
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.switcherRow}>
          {currentInterest ? (
            <Pressable
              style={[styles.switcherPill, styles.interestPill]}
              onPress={() => openInterestSwitcher()}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Current interest: ${currentInterest.name}. Tap to switch.`}
            >
              <View
                style={[
                  styles.interestDot,
                  { backgroundColor: currentInterest.accent_color },
                ]}
              />
              <Text style={styles.switcherText} numberOfLines={1}>
                {currentInterest.name}
              </Text>
              <Ionicons name="chevron-down" size={12} color={LABEL_2} />
            </Pressable>
          ) : null}
          {pickerSteps.length > 0 ? (
            <Pressable
              style={[styles.switcherPill, styles.stepPill]}
              onPress={() => setStepPickerVisible(true)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${stepSwitcherLabel}. Jump to another step`}
            >
              <View style={styles.stepDot} />
              <Text style={styles.switcherText} numberOfLines={1}>
                {stepSwitcherLabel}
              </Text>
              <Ionicons name="chevron-down" size={12} color={LABEL_2} />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.switcherPill, styles.stepPill, styles.stepPillEmpty]}
              onPress={() => setStepPickerVisible(true)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Jump to step"
            >
              <View style={styles.stepDotEmpty} />
              <Text style={styles.switcherText} numberOfLines={1}>Pick step</Text>
              <Ionicons name="chevron-down" size={12} color={LABEL_2} />
            </Pressable>
          )}
          <View style={styles.headerActions}>
            <IconButton icon="search" label="Search golf places" onPress={openNearby} compact />
            <IconButton icon="add" label="Plan golf step" onPress={planRound} compact />
            <ProfileDropdown size={30} variant="light" menuAlign="right" />
          </View>
        </View>
        <View style={styles.headerTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>ATLAS</Text>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle ?? 'courses, range & sim nearby'}
            </Text>
          </View>
        </View>
        <View style={styles.segment}>
          {[
            ['venues', 'Courses'],
            ['course', 'Map'],
            ['game', 'My Game'],
          ].map(([id, label]) => {
            const active = surface === id || (surface === 'nearby' && lastAtlasSurface === id);
            return (
              <Pressable
                key={id}
                style={[styles.segmentButton, active && styles.segmentButtonActive]}
                onPress={() => showSurface(id as Exclude<GolfSurface, 'nearby'>)}
                accessibilityRole="button"
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.chips}>
          {[
            ['mine', 'Mine'],
            ['club', 'Club'],
            ['coach', 'Coach'],
            ['group', 'Group'],
          ].map(([id, label]) => {
            const active = activeFilter === id;
            return (
              <Pressable
                key={id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveFilter(id as GolfFilter)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {surface === 'course' ? (
        <HoleMapOverlay />
      ) : null}

      {surface === 'nearby' ? (
        <NearbySheet
          bottomPad={bottomPad}
          joinedTeeTime={joinedTeeTime}
          onJoin={(id) => setJoinedTeeTime(id)}
          onClose={() => setSurface(lastAtlasSurface)}
        />
      ) : selectedPickerStep ? (
        <SelectedStepCard
          bottomPad={bottomPad}
          step={selectedPickerStep}
          index={pickerSteps.findIndex((step) => step.step_id === selectedPickerStep.step_id)}
          total={pickerSteps.length}
          onOpen={onStepPress ? () => onStepPress(selectedPickerStep.step_id) : undefined}
          onClose={() => setSelectedStepId(null)}
        />
      ) : surface === 'game' ? (
        <GameHealthPanel
          bottomPad={bottomPad}
          savedFocus={savedFocus}
          onSaveFocus={setSavedFocus}
          onPractice={planPractice}
        />
      ) : surface === 'course' ? (
        <RoundCockpit bottomPad={bottomPad} onPractice={planPractice} onPlan={planRound} />
      ) : (
        <NextRoundCard bottomPad={bottomPad} onPlan={planRound} onWork={() => setSurface('game')} />
      )}

      <OpenStepPicker
        visible={stepPickerVisible}
        steps={pickerSteps}
        selectedStepId={topStepPickerStepId}
        onDismiss={() => setStepPickerVisible(false)}
        onPickStep={handlePickStep}
      />
      <InterestSwitcher headless />
    </View>
  );
}

function GolfMapBackdrop({
  surface,
  focusedStep,
  onPinPress,
}: {
  surface: Exclude<GolfSurface, 'nearby'>;
  focusedStep: PickerStep | null;
  onPinPress: (pin: AtlasPinSpec) => void;
}) {
  const courseMode = surface === 'course';
  const focusedStepPin = useMemo<AtlasPinSpec | null>(() => {
    if (!focusedStep?.has_place || focusedStep.lat == null || focusedStep.lng == null) {
      return null;
    }
    return {
      id: `golf-step:${focusedStep.step_id}`,
      kind: focusedStep.status === 'planned-next' ? 'my-step-next' : 'my-step-planned',
      lng: focusedStep.lng,
      lat: focusedStep.lat,
      label: focusedStep.title,
      subtitle: focusedStep.location_name ?? undefined,
      stepId: focusedStep.step_id,
    };
  }, [focusedStep]);
  const pins = useMemo(() => {
    const base = courseMode ? GOLF_HOLE_PINS : GOLF_VENUE_PINS;
    return focusedStepPin ? [...base, focusedStepPin] : base;
  }, [courseMode, focusedStepPin]);
  return (
    <View style={styles.map}>
      <AtlasMapLibreCanvas
        frame="f9"
        pins={pins}
        basemap="satellite"
        focusLocation={
          focusedStepPin
            ? { lat: focusedStepPin.lat, lng: focusedStepPin.lng }
            : courseMode
              ? { ...OAKRIDGE_CC }
              : null
        }
        focusZoomLevel={focusedStepPin ? 15.6 : courseMode ? 15.7 : 14}
        focusPadding={{ top: 180, bottom: courseMode ? 420 : 300, left: 28, right: 28 }}
        onPinPress={onPinPress}
      />
      <View
        pointerEvents="none"
        style={[styles.mapTint, courseMode && styles.mapTintCourse]}
      />
    </View>
  );
}

function SelectedStepCard({
  bottomPad,
  step,
  index,
  total,
  onOpen,
  onClose,
}: {
  bottomPad: number;
  step: PickerStep;
  index: number;
  total: number;
  onOpen?: () => void;
  onClose: () => void;
}) {
  const ordinal = index >= 0 ? `Step ${index + 1} of ${total}` : 'Selected step';
  return (
    <View style={[styles.selectedStepCard, { bottom: bottomPad }]}>
      <View style={styles.selectedStepHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardKicker}>JUMPED TO STEP · ATLAS FOCUS</Text>
          <Text style={styles.selectedStepTitle} numberOfLines={2}>
            {step.title}
          </Text>
          <View style={styles.selectedStepMetaRow}>
            <MetaPill
              icon={step.has_place ? 'location' : 'location-outline'}
              label={step.location_name ?? (step.has_place ? 'On the map' : 'Needs a place')}
              tone={step.has_place ? WATER : LABEL_2}
            />
            <MetaPill icon="radio-button-on" label={ordinal} tone={FLAG} />
          </View>
        </View>
        <IconButton icon="close" label="Clear selected step" onPress={onClose} soft />
      </View>
      <View style={styles.cardActions}>
        <Pressable
          style={styles.secondaryButton}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>Clear focus</Text>
        </Pressable>
        {onOpen ? (
          <Pressable style={styles.primaryButton} onPress={onOpen} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Open step</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function HoleMapOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.heatStrip}>
        <View style={styles.heatHeader}>
          <Text style={styles.heatLabel}>WHERE YOU LOSE STROKES</Text>
          <Text style={styles.heatLabel}>AVG VS PAR</Text>
        </View>
        <View style={styles.heatRow}>
          {HEAT.map(([label, color]) => (
            <View key={label} style={[styles.heatCell, { backgroundColor: color }]}>
              <Text style={styles.heatCellText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function NextRoundCard({
  bottomPad,
  onPlan,
  onWork,
}: {
  bottomPad: number;
  onPlan: () => void;
  onWork: () => void;
}) {
  return (
    <View style={[styles.nextCard, { bottom: bottomPad }]}>
      <Text style={styles.cardKicker}>FLAG NEXT ROUND · YOUR "RACE"</Text>
      <Text style={styles.nextTitle}>Saturday Men's League <Text style={styles.nextSmall}>· Sat 8:10</Text></Text>
      <Text style={styles.muted}>Oakridge CC · White tees · with your foursome</Text>
      <View style={styles.metaRow}>
        <MetaPill icon="partly-sunny-outline" label="12 mph SW" />
        <MetaPill icon="ellipse" label="greens 11.5 (fast)" tone="#16A34A" />
        <MetaPill icon="flag-outline" label="pins back-right" tone={FLAG} />
      </View>
      <View style={styles.cardActions}>
        <Pressable style={styles.primaryButton} onPress={onPlan} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Game plan</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onWork} accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>What to work on</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RoundCockpit({
  bottomPad,
  onPractice,
  onPlan,
}: {
  bottomPad: number;
  onPractice: () => void;
  onPlan: () => void;
}) {
  return (
    <View style={[styles.cockpit, { bottom: bottomPad }]}>
      <View style={styles.handle} />
      <View style={styles.cockpitHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardKicker}>ROUND DAY · OAKRIDGE</Text>
          <Text style={styles.cockpitTitle}>Saturday game plan</Text>
          <Text style={styles.muted}>White tees · 6,210y · par 71</Text>
        </View>
        <View style={styles.whenPill}><Text style={styles.whenText}>in 2 days</Text></View>
      </View>
      <View style={styles.gauges}>
        <Gauge icon="partly-sunny-outline" label="Wind" value="12" suffix="mph" sub="SW, hurts 4 & 12" />
        <Gauge icon="ellipse" label="Greens" value="11.5" sub="fast & firm" tone="#16A34A" />
        <Gauge icon="flag-outline" label="Pins" value="Back" sub="right-side" tone={FLAG} />
      </View>
      <View style={styles.edgeCard}>
        <Text style={styles.edgeKicker}>TARGET YOUR EDGE TODAY</Text>
        <Text style={styles.edgeTitle}>Favor below the hole and club down into 7 & 12.</Text>
        <Text style={styles.edgeBody}>
          Your tee miss is right; aim left-center off every tee. #7 is your worst hole, so lay back to 120y instead of forcing driver.
        </Text>
        <View style={styles.planTags}>
          <Text style={styles.planTag}>Front{'\n'}steady</Text>
          <Text style={styles.planTag}>Turn{'\n'}hydrate</Text>
          <Text style={styles.planTag}>Back{'\n'}birdie looks</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <Pressable style={styles.secondaryButton} onPress={onPractice} accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>Route practice</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onPlan} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Save plan</Text>
        </Pressable>
      </View>
    </View>
  );
}

function GameHealthPanel({
  bottomPad,
  savedFocus,
  onSaveFocus,
  onPractice,
}: {
  bottomPad: number;
  savedFocus: string | null;
  onSaveFocus: (focus: string) => void;
  onPractice: () => void;
}) {
  return (
    <ScrollView
      style={styles.gamePanel}
      contentContainerStyle={{ paddingBottom: bottomPad + 18 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.handicapCard}>
        <ProgressRing value="14.2" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.handicapTitle}>5.2 to single digits</Text>
          <Text style={styles.handicapBody}>
            You're scoring like a ~83. The gap is putting and 150-175y approach.
          </Text>
          <Text style={styles.mathLink}>see the math</Text>
        </View>
      </View>
      <View style={styles.sgPanel}>
        <Text style={styles.sectionLabel}>STROKES GAINED · WHERE YOU WIN & LOSE SHOTS</Text>
        {STROKES_GAINED.map((row, index) => (
          <View
            key={row.id}
            style={[
              styles.sgRow,
              index === STROKES_GAINED.length - 1 && styles.sgRowLast,
            ]}
          >
            <View style={[styles.sgDot, { backgroundColor: row.tone }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sgTitle}>{row.label}</Text>
              <Text style={styles.sgNote} numberOfLines={1}>{row.note}</Text>
            </View>
            <Text style={[styles.sgValue, row.good && styles.sgGood, row.bad && styles.sgBad]}>
              {row.value}
              <Text style={styles.sgUnit}>{'\n'}per round</Text>
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.gapCard}>
        <Text style={styles.cardKicker}>BIGGEST LEAK · FASTEST STROKES BACK</Text>
        <Text style={styles.gapTitle}>Putting costs you 3.1 shots a round.</Text>
        <Text style={styles.gapBody}>
          Your home greens run 11.5 Stimp. Route this to the simulator for speed ladders, then verify at the club green.
        </Text>
        {savedFocus ? <Text style={styles.savedText}>Saved: {savedFocus}</Text> : null}
        <View style={styles.cardActions}>
          <Pressable style={styles.primaryButton} onPress={onPractice} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Book sim drill</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => onSaveFocus('Putting speed · fast greens')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Save focus</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function NearbySheet({
  bottomPad,
  joinedTeeTime,
  onJoin,
  onClose,
}: {
  bottomPad: number;
  joinedTeeTime: string | null;
  onJoin: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <View style={[styles.nearbySheet, { bottom: bottomPad }]}>
      <View style={styles.sheetHeader}>
        <View>
          <Text style={styles.sheetTitle}>Nearby · players & tee times</Text>
          <Text style={styles.muted}>your club & group · 25 mi</Text>
        </View>
        <IconButton icon="close" label="Close nearby" onPress={onClose} soft />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <NearbySection label="OPEN TEE TIMES · JOIN A GROUP" />
        <NearbyRow icon="flag" title="Sat 8:10 · Men's League" sub="Oakridge · needs a 4th · your foursome" action={joinedTeeTime === 'league' ? 'Joined' : 'Join'} onPress={() => onJoin('league')} hot />
        <NearbyRow icon="flag-outline" title="Sun 7:30 · casual 18" sub="Riverside GC · 2 spots · 9 mi" action={joinedTeeTime === 'casual' ? 'Joined' : 'Join'} onPress={() => onJoin('casual')} />
        <NearbySection label="PRACTICE VENUES · 3 NEARBY" />
        <NearbyRow icon="desktop-outline" title="GolfTec Sim · Trackman" sub="indoor · weather-proof · 4 mi" actionIcon="navigate-outline" blue />
        <NearbyRow icon="golf-outline" title="Practice Range · Oakridge" sub="grass tees · short-game area" actionIcon="navigate-outline" blue />
        <NearbySection label="YOUR GROUP · 6 PLAYING NEARBY" />
        <NearbyRow initials="TM" title="Tom Murphy" sub="played · 79 at Riverside · foursome" right="9 mi" />
        <NearbyRow initials="RK" title="Raj Kapoor" sub="won · Sat flight · hcp 11" right="at club" red />
        <NearbyRow initials="CD" title="Coach Diaz · PGA pro" sub="coaches · lessons Tue-Thu · sim & range" right="at club" purple />
      </ScrollView>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  soft,
  compact = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  soft?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      style={[styles.iconButton, compact && styles.iconButtonCompact, soft && styles.iconButtonSoft]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={compact ? 16 : 18} color={TURF} />
    </Pressable>
  );
}

function MetaPill({
  icon,
  label,
  tone = TURF,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: string;
}) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={12} color={tone} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

function Gauge({
  icon,
  label,
  value,
  suffix,
  sub,
  tone = WATER,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  suffix?: string;
  sub: string;
  tone?: string;
}) {
  return (
    <View style={styles.gauge}>
      <View style={styles.gaugeLabelRow}>
        <Ionicons name={icon} size={11} color={tone} />
        <Text style={[styles.gaugeLabel, { color: tone }]}>{label}</Text>
      </View>
      <Text style={styles.gaugeValue}>{value}<Text style={styles.gaugeSuffix}>{suffix}</Text></Text>
      <Text style={styles.gaugeSub}>{sub}</Text>
    </View>
  );
}

function ProgressRing({ value }: { value: string }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = 0.58;
  return (
    <View style={styles.ringWrap}>
      <Svg width={96} height={96} viewBox="0 0 96 96">
        <Circle cx="48" cy="48" r={radius} stroke="rgba(30,70,40,0.14)" strokeWidth="13" fill="none" />
        <Circle
          cx="48"
          cy="48"
          r={radius}
          stroke={TURF}
          strokeWidth="13"
          fill="none"
          strokeDasharray={`${circumference * progress} ${circumference}`}
          strokeLinecap="butt"
          rotation="-90"
          origin="48,48"
        />
      </Svg>
      <View style={styles.ringInner}>
        <Text style={styles.ringValue}>{value}</Text>
        <Text style={styles.ringSub}>to 9.0 goal</Text>
      </View>
    </View>
  );
}

function NearbySection({ label }: { label: string }) {
  return <Text style={styles.nearbySection}>{label}</Text>;
}

function NearbyRow({
  icon,
  initials,
  title,
  sub,
  action,
  actionIcon,
  right,
  hot,
  blue,
  red,
  purple,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  initials?: string;
  title: string;
  sub: string;
  action?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  right?: string;
  hot?: boolean;
  blue?: boolean;
  red?: boolean;
  purple?: boolean;
  onPress?: () => void;
}) {
  const tone = hot ? FLAG : blue ? WATER : red ? FLAG : purple ? '#6D28D9' : TURF;
  return (
    <View style={styles.nearbyRow}>
      <View style={[styles.nearbyAvatar, { backgroundColor: tone }]}>
        {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : <Text style={styles.avatarText}>{initials}</Text>}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.nearbyTitle} numberOfLines={1}>{title}</Text>
        <Text style={[styles.nearbySub, red && styles.redText, purple && styles.purpleText]} numberOfLines={1}>{sub}</Text>
      </View>
      {action ? (
        <Pressable style={styles.joinButton} onPress={onPress} accessibilityRole="button">
          <Text style={styles.joinText}>{action}</Text>
        </Pressable>
      ) : actionIcon ? (
        <View style={styles.routeButton}><Ionicons name={actionIcon} size={15} color={TURF} /></View>
      ) : right ? (
        <Text style={styles.rightText}>{right}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: '#EAF0E6',
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#B5D2AA',
  },
  mapTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(226, 241, 217, 0.24)',
  },
  mapTintCourse: {
    backgroundColor: 'rgba(20, 70, 35, 0.08)',
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: 'rgba(234,240,230,0.84)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEP,
  },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  switcherPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(30,70,40,0.14)',
    shadowColor: '#14321E',
    shadowOpacity: 0.09,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
  },
  interestPill: {
    maxWidth: '30%',
    flexShrink: 0,
  },
  stepPill: {
    flex: 1,
    minWidth: 0,
  },
  stepPillEmpty: {
    opacity: 0.82,
  },
  interestDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FLAG,
  },
  stepDotEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(28,46,32,0.30)',
  },
  switcherText: {
    flexShrink: 1,
    minWidth: 0,
    color: LABEL,
    fontSize: 13,
    fontWeight: '800',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    color: TURF,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 2,
    color: LABEL,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 1,
    color: LABEL_2,
    fontSize: 14,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#14321E',
    shadowOpacity: 0.14,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
  },
  iconButtonCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  iconButtonSoft: {
    backgroundColor: 'rgba(21,102,59,0.10)',
    shadowOpacity: 0,
  },
  segment: {
    flexDirection: 'row',
    marginTop: 14,
    padding: 3,
    borderRadius: 11,
    backgroundColor: 'rgba(21,102,59,0.12)',
  },
  segmentButton: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#14321E',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentText: {
    color: LABEL_2,
    fontSize: 14,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: LABEL,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 11,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: TURF,
  },
  chipText: {
    color: LABEL_2,
    fontSize: 13,
    fontWeight: '800',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  venuePin: {
    position: 'absolute',
    width: 112,
    alignItems: 'center',
    transform: [{ translateX: -56 }, { translateY: -40 }],
  },
  homePin: {
    transform: [{ translateX: -56 }, { translateY: -54 }],
  },
  venueMarker: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeMarker: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 3,
    shadowColor: '#14321E',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  pinName: {
    marginTop: 6,
    color: '#14341F',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowRadius: 2,
  },
  pinMeta: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    color: '#3C6347',
    fontSize: 10,
    fontWeight: '800',
  },
  nextCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 15,
    borderLeftWidth: 5,
    borderLeftColor: FLAG,
    shadowColor: '#14321E',
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 9 },
  },
  selectedStepCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 15,
    borderLeftWidth: 5,
    borderLeftColor: WATER,
    shadowColor: '#14321E',
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 9 },
  },
  selectedStepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  selectedStepTitle: {
    marginTop: 6,
    color: LABEL,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  selectedStepMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  cardKicker: {
    color: FLAG,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  nextTitle: {
    marginTop: 6,
    color: LABEL,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  nextSmall: {
    color: LABEL_2,
    fontSize: 14,
    fontWeight: '700',
  },
  muted: {
    color: LABEL_2,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#EAF0E6',
  },
  metaText: {
    color: '#3C6347',
    fontSize: 12,
    fontWeight: '800',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: TURF,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: 'rgba(21,102,59,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: TURF,
    fontSize: 15,
    fontWeight: '900',
  },
  flagPin: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -10 }, { translateY: -20 }],
  },
  holeNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  holeNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  heatStrip: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '32%',
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 8,
  },
  heatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  heatLabel: {
    color: 'rgba(28,46,32,0.38)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  heatRow: {
    flexDirection: 'row',
    gap: 2,
  },
  heatCell: {
    flex: 1,
    height: 16,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatCellText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  cockpit: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingBottom: 14,
    shadowColor: '#14321E',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(28,46,32,0.30)',
    alignSelf: 'center',
    marginTop: 10,
  },
  cockpitHead: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEP,
  },
  cockpitTitle: {
    marginTop: 5,
    color: LABEL,
    fontSize: 21,
    fontWeight: '900',
  },
  whenPill: {
    borderRadius: 10,
    backgroundColor: 'rgba(196,46,46,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  whenText: {
    color: FLAG,
    fontSize: 12,
    fontWeight: '900',
  },
  gauges: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  gauge: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEP,
    backgroundColor: 'rgba(21,102,59,0.04)',
  },
  gaugeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gaugeLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  gaugeValue: {
    marginTop: 6,
    color: LABEL,
    fontSize: 21,
    fontWeight: '900',
  },
  gaugeSuffix: {
    color: LABEL_2,
    fontSize: 11,
    fontWeight: '800',
  },
  gaugeSub: {
    marginTop: 4,
    color: LABEL_2,
    fontSize: 11,
  },
  edgeCard: {
    marginHorizontal: 14,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(21,102,59,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(21,102,59,0.30)',
  },
  edgeKicker: {
    color: '#0F5130',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  edgeTitle: {
    marginTop: 8,
    color: '#0F4A2B',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  edgeBody: {
    marginTop: 7,
    color: '#1C5A36',
    fontSize: 13,
    lineHeight: 19,
  },
  planTags: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 11,
  },
  planTag: {
    flex: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.68)',
    color: '#0F4A2B',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 8,
  },
  gamePanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 188,
    bottom: 0,
    paddingHorizontal: 16,
  },
  handicapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 10,
    shadowColor: '#14321E',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  ringWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringValue: {
    color: LABEL,
    fontSize: 22,
    fontWeight: '900',
  },
  ringSub: {
    color: LABEL_2,
    fontSize: 9,
    fontWeight: '800',
  },
  handicapTitle: {
    color: LABEL,
    fontSize: 17,
    fontWeight: '900',
  },
  handicapBody: {
    marginTop: 5,
    color: LABEL_2,
    fontSize: 13,
    lineHeight: 18,
  },
  mathLink: {
    marginTop: 8,
    color: TURF,
    fontSize: 12,
    fontWeight: '900',
  },
  sectionLabel: {
    marginBottom: 4,
    color: 'rgba(28,46,32,0.46)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sgPanel: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(30,70,40,0.14)',
    shadowColor: '#14321E',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  sgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEP,
  },
  sgRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  sgDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  sgTitle: {
    color: LABEL,
    fontSize: 15,
    fontWeight: '800',
  },
  sgNote: {
    color: LABEL_2,
    fontSize: 12,
  },
  sgValue: {
    width: 58,
    color: '#D97706',
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '900',
  },
  sgGood: {
    color: '#15803D',
  },
  sgBad: {
    color: FLAG,
  },
  sgUnit: {
    color: 'rgba(28,46,32,0.34)',
    fontSize: 8,
    fontWeight: '800',
  },
  gapCard: {
    marginTop: 16,
    padding: 15,
    borderRadius: 16,
    backgroundColor: '#FFF6F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,46,46,0.28)',
  },
  gapTitle: {
    marginTop: 8,
    color: '#7F1D1D',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 23,
  },
  gapBody: {
    marginTop: 6,
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 19,
  },
  savedText: {
    marginTop: 8,
    color: TURF,
    fontSize: 12,
    fontWeight: '900',
  },
  nearbySheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    maxHeight: '78%',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#14321E',
    shadowOpacity: 0.20,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEP,
  },
  sheetTitle: {
    color: LABEL,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  nearbySection: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: '#EAF0E6',
    color: 'rgba(28,46,32,0.38)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEP,
  },
  nearbyAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  nearbyTitle: {
    color: LABEL,
    fontSize: 15,
    fontWeight: '800',
  },
  nearbySub: {
    marginTop: 2,
    color: LABEL_2,
    fontSize: 12,
  },
  redText: {
    color: FLAG,
    fontWeight: '800',
  },
  purpleText: {
    color: '#6D28D9',
    fontWeight: '800',
  },
  joinButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: TURF,
  },
  joinText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  routeButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(21,102,59,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightText: {
    width: 48,
    color: LABEL_2,
    fontSize: 12,
    textAlign: 'right',
    fontWeight: '900',
  },
});
