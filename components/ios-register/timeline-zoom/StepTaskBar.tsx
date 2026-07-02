/**
 * StepTaskBar — the floating task bar for the merged Step zoom level
 * (mockup #38 `.nav`). Replaces the generic AppChromeRow on the Step level
 * with a two-line identity lane:
 *
 *   SAIL RACING ▾          ← interest eyebrow = interest switcher (sheet UP)
 *   Race 2  ⌄              ← step name = step chooser (dropdown DOWN)
 *
 * plus the prominent filled-accent ＋, inbox bell, and avatar on the right.
 *
 * The two affordances differ by weight on purpose (Kevin's call): switching
 * interest is a heavy context change, so its sheet rises from the bottom
 * (reusing the global InterestSwitcher via `openInterestSwitcher()`); jumping
 * to a sibling step is a lightweight in-context move, so its menu drops down
 * from the word.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { openInterestSwitcher } from '@/components/InterestSwitcher';
import { ContextSwitcher } from '@/components/navigation/ContextSwitcher';
import { NotificationBell } from '@/components/social/NotificationBell';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';
import { useUniversalPlus } from '@/components/capture';
import { useInterest } from '@/providers/InterestProvider';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { SIDEBAR_PIN_BREAKPOINT, useWebDrawer } from '@/providers/WebDrawerProvider';
import { StepAddSheet } from './StepAddSheet';
import type { TimelineStep } from './types';

const DONE_COLOR = '#16A34A';
const NOW_COLOR = '#FF6B5A';
const STEP_MENU_WIDTH = 304;
const STEP_MENU_EDGE_MARGIN = 12;

interface StepTaskBarProps {
  interestLabel: string;
  /** Currently-viewed step (drives the lane's step-name line). */
  focusedStep?: TimelineStep | null;
  /** Ordered sibling steps — the jump menu + done/now/queued markers. */
  allSteps: TimelineStep[];
  /** Canonical "now" step id — anchors the done/now/queued split. Null
   *  means nothing is active (NOW sits past the end): every row reads done,
   *  no row wears the now dot. */
  nowStepId: string | null;
  onJumpToStep: (stepId: string) => void;
  /** Arc the user is viewing — threaded to StepAddSheet's creation stamp. */
  viewedSeasonId?: string | null;
}

export function StepTaskBar({
  interestLabel,
  focusedStep,
  allSteps,
  nowStepId,
  onJumpToStep,
  viewedSeasonId = null,
}: StepTaskBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const stepselRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const universalPlus = useUniversalPlus();
  const { currentInterest } = useInterest();
  const accentColor = currentInterest?.accent_color ?? IOS_REGISTER.accentUserAction;
  const isSailRacing = (currentInterest?.slug ?? '').toLowerCase() === 'sail-racing';

  // Web sidebar reveal. This bar replaces AppChromeRow on the Step level, so
  // without this the collapsed sidebar has no reopen affordance here — the
  // user is stranded on the Practice canvas until a hard refresh. Gated like
  // AppChromeRow: only where a sidebar can actually render.
  const { isDrawerOpen, openDrawer } = useWebDrawer();
  const { width: windowWidth } = useWindowDimensions();
  const showWebSidebarToggle =
    Platform.OS === 'web' &&
    FEATURE_FLAGS.USE_WEB_SIDEBAR_LAYOUT &&
    windowWidth >= SIDEBAR_PIN_BREAKPOINT &&
    !isDrawerOpen;

  const nowOrdinal = useMemo(
    () => allSteps.findIndex((s) => s.id === nowStepId),
    [allSteps, nowStepId],
  );
  const focusedOrdinal = useMemo(
    () => allSteps.findIndex((s) => s.id === focusedStep?.id),
    [allSteps, focusedStep?.id],
  );
  const stepselLabel = focusedOrdinal >= 0 ? `Step ${focusedOrdinal + 1}` : '—';
  const canChoose = allSteps.length > 1;

  // The inline menu would be trapped in the chrome row's stacking context
  // (a 48px-tall, transformed parent), so on native it both paints under the
  // card and falls outside the parent's hit-test bounds. Measure the trigger
  // and render the menu in a Modal so it escapes — mirrors ProfileDropdown.
  const openMenu = () => {
    if (!canChoose) return;
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const node = stepselRef.current;
    if (!node || Platform.OS === 'web') {
      setMenuOpen(true);
      return;
    }
    node.measureInWindow((x, y, _w, h) => {
      // Right-align the menu to the trigger, then clamp into the viewport so
      // the fixed-width card can't bleed off either edge (it was anchored to
      // the right-of-center step selector, pushing 304px past the screen).
      const screenW = Dimensions.get('window').width;
      const maxLeft = screenW - STEP_MENU_WIDTH - STEP_MENU_EDGE_MARGIN;
      const left = Math.max(STEP_MENU_EDGE_MARGIN, Math.min(x, maxLeft));
      setAnchor({ top: y + h + 6, left });
      setMenuOpen(true);
    });
  };

  const rows = allSteps.map((s, i) => {
    // nowStepId === null → the arc is fully settled, every row is done.
    // nowOrdinal < 0 with a non-null id → now lives in another arc; these
    // rows are neither behind nor on it, so they stay queued.
    const rel: 'done' | 'now' | 'queued' =
      nowStepId === null
        ? 'done'
        : nowOrdinal < 0
          ? 'queued'
          : i < nowOrdinal
            ? 'done'
            : i === nowOrdinal
              ? 'now'
              : 'queued';
    const dotColor =
      rel === 'done' ? DONE_COLOR : rel === 'now' ? NOW_COLOR : IOS_REGISTER.labelTertiary;
    const isLast = i === allSteps.length - 1;
    return (
      <Pressable
        key={s.id}
        style={({ pressed }) => (pressed ? styles.smrowPressed : undefined)}
        onPress={() => {
          setMenuOpen(false);
          if (s.id !== focusedStep?.id) onJumpToStep(s.id);
        }}
      >
        <View style={[styles.smrow, isLast && styles.smrowLast]} pointerEvents="none">
          <View style={[styles.smDot, { backgroundColor: dotColor }]} />
          <Text style={[styles.smLabel, rel === 'now' && { color: accentColor }]} numberOfLines={1}>
            {s.title}
          </Text>
          <Text
            style={[
              styles.smRt,
              rel === 'now' && { color: NOW_COLOR },
              rel === 'done' && { color: DONE_COLOR },
            ]}
          >
            {rel}
          </Text>
        </View>
      </Pressable>
    );
  });

  const menuBody = (
    <View style={styles.stepmenuCard}>
      <Text style={styles.smh}>JUMP TO STEP</Text>
      {allSteps.length > 8 ? (
        <ScrollView style={styles.smScroll} showsVerticalScrollIndicator={false}>
          {rows}
        </ScrollView>
      ) : (
        rows
      )}
    </View>
  );

  return (
    <View style={styles.nav}>
      {showWebSidebarToggle ? (
        <Pressable
          onPress={openDrawer}
          style={({ pressed, hovered }) => [
            styles.sidebarToggle,
            (hovered as boolean) && styles.sidebarToggleHover,
            pressed && styles.sidebarTogglePressed,
          ]}
          accessibilityLabel="Show sidebar"
          accessibilityRole="button"
        >
          <View style={styles.sidebarIcon}>
            <View style={styles.sidebarIconLeft} />
            <View style={styles.sidebarIconRight} />
          </View>
        </Pressable>
      ) : null}

      {FEATURE_FLAGS.CONTEXT_SWITCHER_V1 ? (
        <View style={styles.contextCluster}>
          <ContextSwitcher />
          <Pressable
            ref={stepselRef}
            onPress={openMenu}
            disabled={!canChoose}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            style={styles.stepOnlyPill}
            accessibilityRole="button"
            accessibilityLabel={
              focusedStep ? `${stepselLabel}. Tap to jump to another step.` : undefined
            }
          >
            <Text style={styles.segStepText} numberOfLines={1}>
              {stepselLabel}
            </Text>
            {canChoose ? (
              <Ionicons
                name={menuOpen ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={IOS_REGISTER.labelTertiary}
              />
            ) : null}
          </Pressable>
        </View>
      ) : (
        <View style={styles.intpill}>
          <Pressable
            testID="step-taskbar-interest-switcher"
            onPress={openInterestSwitcher}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            style={styles.segInt}
            accessibilityRole="button"
            accessibilityLabel={`Interest: ${interestLabel}. Tap to switch.`}
          >
            <View style={styles.dotWrap}>
              <View style={[styles.dotRing, { backgroundColor: accentColor }]} />
              <View style={[styles.dot, { backgroundColor: accentColor }]} />
            </View>
            <Text style={styles.segIntText} numberOfLines={1}>
              {interestLabel}
            </Text>
          </Pressable>

          <View style={styles.crumb} pointerEvents="none">
            <Ionicons name="chevron-forward" size={12} color={IOS_REGISTER.labelTertiary} />
          </View>

          <Pressable
            ref={stepselRef}
            onPress={openMenu}
            disabled={!canChoose}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            style={styles.segStep}
            accessibilityRole="button"
            accessibilityLabel={
              focusedStep ? `${stepselLabel}. Tap to jump to another step.` : undefined
            }
          >
            <Text style={styles.segStepText} numberOfLines={1}>
              {stepselLabel}
            </Text>
            {canChoose ? (
              <Ionicons
                name={menuOpen ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={IOS_REGISTER.labelTertiary}
              />
            ) : null}
          </Pressable>
        </View>
      )}

      <View style={styles.icons}>
        <Pressable
          testID="step-taskbar-add-step"
          style={[styles.plusbtn, { backgroundColor: accentColor }]}
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add step"
          hitSlop={6}
        >
          <Ionicons name="add" size={19} color="#FFFFFF" />
        </Pressable>
        {FEATURE_FLAGS.CONTEXT_SWITCHER_V1 ? (
          <View style={styles.bellWrap}>
            <NotificationBell size={18} color={IOS_REGISTER.label} />
          </View>
        ) : null}
        <ProfileDropdown size={28} />
      </View>

      {menuOpen && Platform.OS === 'web' ? (
        <>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="Dismiss step menu"
          />
          <View style={styles.stepmenuWeb}>{menuBody}</View>
        </>
      ) : null}

      {menuOpen && Platform.OS !== 'web' ? (
        <Modal
          transparent
          visible
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="Dismiss step menu"
          >
            <Pressable
              style={[
                styles.stepmenuModal,
                { top: anchor?.top ?? 56, left: anchor?.left ?? 14 },
              ]}
              onPress={(e) => e.stopPropagation?.()}
            >
              {menuBody}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      <StepAddSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={universalPlus.submit}
        onStepAdded={(id) => onJumpToStep(id)}
        showRaceSelector={isSailRacing}
        viewedSeasonId={viewedSeasonId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 8,
    minHeight: 48,
    zIndex: 1000,
  },
  // Apple-style sidebar reveal — mirrors AppChromeRow's collapsed-sidebar toggle.
  sidebarToggle: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.systemBackground,
    marginRight: 10,
  },
  sidebarToggleHover: {
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderColor: IOS_COLORS.opaqueSeparator,
  },
  sidebarTogglePressed: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  sidebarIcon: {
    width: 16,
    height: 12,
    flexDirection: 'row',
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.secondaryLabel,
    overflow: 'hidden',
  },
  sidebarIconLeft: {
    width: 5,
    height: '100%',
    backgroundColor: IOS_COLORS.secondaryLabel,
  },
  sidebarIconRight: {
    flex: 1,
  },
  // Breadcrumb interest pill — persistent chrome, never a plain label.
  contextCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  stepOnlyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingLeft: 11,
    paddingRight: 12,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separatorStrong,
    backgroundColor: IOS_REGISTER.cardBg,
    flexShrink: 0,
  },
  intpill: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'center',
    height: 38,
    maxWidth: 248,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separatorStrong,
    backgroundColor: IOS_REGISTER.cardBg,
    overflow: 'hidden',
    flexShrink: 1,
    minWidth: 0,
  },
  segInt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 13,
    paddingRight: 11,
    flexShrink: 1,
    minWidth: 0,
  },
  segIntText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: IOS_REGISTER.label,
    flexShrink: 1,
  },
  dotWrap: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotRing: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 7.5,
    opacity: 0.2,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  crumb: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
    flexShrink: 0,
  },
  segStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 9,
    paddingRight: 13,
    flexShrink: 0,
  },
  segStepText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: IOS_REGISTER.labelSecondary,
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginLeft: 'auto',
    paddingLeft: 8,
  },
  bellWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusbtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOpacity: 0.36,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  menuBackdrop: {
    position: 'absolute',
    top: -200,
    left: -400,
    right: -400,
    height: 2000,
    zIndex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,12,20,0.28)',
  },
  stepmenuWeb: {
    position: 'absolute',
    top: 50,
    left: 0,
    zIndex: 2,
  },
  stepmenuModal: {
    position: 'absolute',
  },
  stepmenuCard: {
    width: STEP_MENU_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.24)',
    overflow: 'hidden',
    shadowColor: '#0B1220',
    shadowOpacity: 0.34,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  smScroll: {
    maxHeight: 360,
  },
  smh: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: IOS_REGISTER.label,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  smrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  smrowLast: {
    borderBottomWidth: 0,
  },
  smrowPressed: {
    backgroundColor: IOS_REGISTER.fillPill,
  },
  smDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },
  smLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: IOS_REGISTER.label,
  },
  smRt: {
    marginLeft: 'auto',
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelTertiary,
  },
});

export default StepTaskBar;
