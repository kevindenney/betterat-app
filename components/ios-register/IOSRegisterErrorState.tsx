/**
 * IOSRegisterErrorState — canonical iOS-register error-state component.
 *
 * The visual implementation of cross-cutting **Principle #2** (the error-
 * state principle) documented in IOS_MIGRATION_PLAN.md. Once shipped, every
 * future iOS-register surface that needs an error state imports this
 * component instead of designing one from scratch.
 *
 * The principle in one line:
 *   *Plain language + a next action, no error codes, no dead-ends.*
 *
 * The chrome is canonical (same across all three variants the design lays
 * out); what varies is **headline / supportingText / actions / disclosure /
 * the optional surrounding context (reference card, info card)**. Those
 * variants are now caller responsibilities — the caller passes children
 * (for a `<ReferenceCard>` or `<InfoCard>`) between the hero and the
 * actions, or omits them entirely.
 *
 * The three reference variants the design pass established:
 *
 *   Variant 1 — Recoverable / network (transient): glyph + headline +
 *     supporting + reference card (the user's input preserved) + primary
 *     "Try again" + secondary fallback. No tertiary, no disclosure.
 *
 *   Variant 2 — Input / user-correctable: glyph + headline + supporting +
 *     reference card with a "Can't use" tag + an InfoCard explaining what
 *     works + primary "Try different X" + secondary structural workaround.
 *     Optional top-right "What works?" educational link.
 *
 *   Variant 3 — System / non-recoverable: glyph + headline + supporting +
 *     disclosure (request id behind "More info") + primary "Go back" (NOT
 *     retry, because retry would lie) + secondary "Tell us what you were
 *     trying to do" + optional tertiary "Try again later".
 *
 * Density: standard practitioner iOS register. No earned-register exception
 * per architecture decision #3 — errors are a state, not the surface's
 * primary purpose.
 *
 * Header rule: the header shows the **context** (e.g. "Get Inspired"),
 * not the word "Error". The error lives in the body.
 *
 * Visual source: Claude Design "Error state · canonical · iOS register"
 * handoff (2026-05-15). No feature flag — errors are cross-cutting
 * infrastructure, not a render-path replacement with a fallback.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IOSRegisterErrorAction {
  label: string;
  onPress: () => void;
  /** Optional leading icon for the primary CTA (e.g. "refresh", "arrow-back"). */
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface IOSRegisterErrorDisclosure {
  /** Label on the closed row. Defaults to "More info". */
  label?: string;
  /** Whether the disclosure is open by default. Defaults to false. */
  defaultOpen?: boolean;
  /**
   * Content rendered inside the expanded panel. Caller has full control —
   * typical contents are a request-id row with a Copy button + a small
   * supportive line below it. Pass a string for the simple case (rendered
   * as monospace) or a node for full control.
   */
  content: React.ReactNode;
}

interface Props {
  /** Plain-language message — required. Never an error code. */
  headline: string;
  /** Second paragraph explaining context. Optional. */
  supportingText?: string;
  /**
   * Header context title (e.g. "Get Inspired"). When omitted the header
   * shows only the back-chevron. Per the canonical rule: the header shows
   * **context**, not "Error". The error itself is the body.
   */
  headerTitle?: string;
  /** Back-chevron label (e.g. "Discover"). Defaults to "Back". */
  backLabel?: string;
  onBackPress?: () => void;
  /**
   * Optional top-right tertiary action in the nav-bar (subtle weight). The
   * design uses this for variant-2 "What works?" educational shortcut and
   * variant-3 "More info" jump-to-disclosure. Either explicit-action or
   * omit; not both.
   */
  navRightAction?: { label: string; onPress: () => void };
  /**
   * The 36×36 muted glyph above the headline. Defaults to a sensible
   * neutral (`information-circle-outline`). Variant 1 uses `wifi-off`;
   * variant 2 uses `link-outline` (broken-link variant); variant 3 uses
   * `construct-outline`.
   */
  glyph?: keyof typeof Ionicons.glyphMap;
  /** Required main next action. */
  primaryAction: IOSRegisterErrorAction;
  /** Optional alternative action below the primary. */
  secondaryAction?: IOSRegisterErrorAction;
  /** Optional tertiary action below the secondary (smaller, tertiary text). */
  tertiaryAction?: IOSRegisterErrorAction;
  /** Optional "More info" expandable disclosure (variant 3 pattern). */
  disclosure?: IOSRegisterErrorDisclosure;
  /**
   * Optional content rendered between the hero block and the actions stack.
   * Use this slot for the reference card (variant 1 + 2) or the educational
   * info card (variant 2). The component is intentionally agnostic about
   * what goes here; caller composes.
   */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------

export function IOSRegisterErrorState({
  headline,
  supportingText,
  headerTitle,
  backLabel = 'Back',
  onBackPress,
  navRightAction,
  glyph = 'information-circle-outline',
  primaryAction,
  secondaryAction,
  tertiaryAction,
  disclosure,
  children,
}: Props) {
  return (
    <View style={styles.screen}>
      <NavBar
        title={headerTitle}
        backLabel={backLabel}
        onBackPress={onBackPress}
        navRightAction={navRightAction}
      />

      <View style={styles.body}>
        <View style={styles.hero}>
          <View style={styles.glyph}>
            <Ionicons
              name={glyph}
              size={20}
              color={IOS_REGISTER.labelSecondary}
            />
          </View>
          <Text style={styles.headline}>{headline}</Text>
          {supportingText ? (
            <Text style={styles.supporting}>{supportingText}</Text>
          ) : null}
        </View>

        {children}

        {disclosure ? <Disclosure {...disclosure} /> : null}

        <View style={styles.actions}>
          <Pressable
            onPress={primaryAction.onPress}
            style={styles.ctaPrimary}
            accessibilityRole="button"
            accessibilityLabel={primaryAction.label}
          >
            {primaryAction.icon ? (
              <Ionicons name={primaryAction.icon} size={18} color="#FFFFFF" />
            ) : null}
            <Text style={styles.ctaPrimaryText}>{primaryAction.label}</Text>
          </Pressable>
          {secondaryAction ? (
            <Pressable
              onPress={secondaryAction.onPress}
              style={styles.ctaSecondary}
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.label}
            >
              <Text style={styles.ctaSecondaryText}>
                {secondaryAction.label}
              </Text>
            </Pressable>
          ) : null}
          {tertiaryAction ? (
            <Pressable
              onPress={tertiaryAction.onPress}
              style={styles.ctaTertiary}
              accessibilityRole="button"
              accessibilityLabel={tertiaryAction.label}
            >
              <Text style={styles.ctaTertiaryText}>{tertiaryAction.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function NavBar({
  title,
  backLabel,
  onBackPress,
  navRightAction,
}: {
  title?: string;
  backLabel: string;
  onBackPress?: () => void;
  navRightAction?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.navbar}>
      <Pressable
        onPress={onBackPress}
        style={styles.back}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
      >
        <Ionicons
          name="chevron-back"
          size={22}
          color={IOS_REGISTER.accentUserAction}
        />
        <Text style={styles.backLabel}>{backLabel}</Text>
      </Pressable>
      {title ? <Text style={styles.navTitle}>{title}</Text> : <View />}
      {navRightAction ? (
        <Pressable
          onPress={navRightAction.onPress}
          style={styles.navRight}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={navRightAction.label}
        >
          <Text style={styles.navRightSubtle}>{navRightAction.label}</Text>
        </Pressable>
      ) : (
        <View style={styles.navRightPlaceholder} />
      )}
    </View>
  );
}

function Disclosure({
  label = 'More info',
  defaultOpen = false,
  content,
}: IOSRegisterErrorDisclosure) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <View style={styles.disclosure}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.disclosureRow}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.disclosureLbl}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={IOS_REGISTER.labelSecondary}
          />
          <Text style={styles.disclosureLblText}>{label}</Text>
        </View>
        <View style={open ? styles.chevOpen : undefined}>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={IOS_REGISTER.labelTertiary}
          />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.disclosurePanel}>
          {typeof content === 'string' ? (
            <Text style={styles.disclosurePanelMono}>{content}</Text>
          ) : (
            content
          )}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  // ----- nav bar -----
  navbar: {
    height: 44,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60, 60, 67, 0.10)',
    backgroundColor: IOS_REGISTER.groundBg,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backLabel: {
    fontSize: 17,
    letterSpacing: -0.2,
    color: IOS_REGISTER.accentUserAction,
    marginLeft: -2,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: IOS_REGISTER.label,
  },
  navRight: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  navRightSubtle: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.1,
    color: IOS_REGISTER.labelSecondary,
  },
  navRightPlaceholder: {
    width: 44,
  },
  // ----- body -----
  body: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: 22,
    flexDirection: 'column',
  },
  // ----- hero -----
  hero: {
    paddingTop: 36,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  glyph: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(60, 60, 67, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  headline: {
    fontSize: 26,
    fontWeight: '500',
    lineHeight: 31,
    letterSpacing: -0.4,
    color: IOS_REGISTER.label,
    marginBottom: 12,
  },
  supporting: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: -0.3,
    color: IOS_REGISTER.labelSecondary,
  },
  // ----- disclosure -----
  disclosure: {
    marginTop: 22,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    overflow: 'hidden',
  },
  disclosureRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disclosureLbl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  disclosureLblText: {
    fontSize: 15,
    letterSpacing: -0.15,
    color: IOS_REGISTER.label,
  },
  chevOpen: {
    transform: [{ rotate: '90deg' }],
  },
  disclosurePanel: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  disclosurePanelMono: {
    marginTop: 12,
    fontFamily: 'SF Mono, Menlo, monospace' as never,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  // ----- actions -----
  actions: {
    marginTop: 'auto',
    paddingTop: 18,
    flexDirection: 'column',
    gap: 4,
  },
  ctaPrimary: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: IOS_REGISTER.accentUserAction,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaPrimaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  ctaSecondary: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondaryText: {
    color: IOS_REGISTER.accentUserAction,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  ctaTertiary: {
    width: '100%',
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTertiaryText: {
    color: IOS_REGISTER.labelTertiary,
    fontSize: 13,
    letterSpacing: -0.05,
  },
});
