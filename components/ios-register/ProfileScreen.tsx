/**
 * ProfileScreen — practitioner Profile iOS surface. Third sub-tab under
 * Reflect (Progress / Race Log / Profile).
 *
 * Identity, interests, settings. This is the surface where the iOS register
 * most closely resembles default iOS Settings — and that's the right call.
 * Profile is utility chrome, not poetry; the register doesn't have to fight
 * the platform on every screen.
 *
 * Practitioner-side of architecture decision #2 — standard iOS settings
 * density. No faculty calibration applies; this is Felix's own profile,
 * not a faculty/preceptor surface.
 *
 * No earned-register exception (declared explicitly by the design brief).
 *
 * Where the register defers to platform:
 *   - Grouped inset white cards with 0.5px hairline separators
 *   - 29×29 rounded-square colored icon tiles (iOS Settings vocabulary)
 *   - Standard 16pt label / 16pt right-aligned value cell grammar
 *   - Pencil glyph (not chevron) on inline-editable Identity cells
 *   - iOS Settings color semantics: blue drill-in, red destructive
 *
 * Where the register asserts itself:
 *   - Centered 96pt slate-gradient avatar hero (not a cell)
 *   - Interests as chips (single white card), not list rows. The "active
 *     pursuit" chip uses coral — same coral semantic as the live-dot
 *     elsewhere on the iOS register
 *   - Inline iOS segmented controls for the two units a sailor has
 *     opinions about (wind speed + distance), instead of drill-in
 *   - 28pt section gaps (tighter than iOS Settings default 32+)
 *
 * Visual source: Claude Design "Profile · Felix sailing · iOS register"
 * handoff.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProfileInterestKind = 'primary' | 'standard';

export interface ProfileInterest {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  kind?: ProfileInterestKind;
}

export interface ProfileIdentityFields {
  name: string;
  handle: string;
  email: string;
  bio?: string;
}

export interface ProfilePreferencesFields {
  /** Right-aligned value shown on the Notifications drill-in. */
  notificationsValue: string;
  windUnit: 'knots' | 'm/s' | 'mph';
  distanceUnit: 'nautical' | 'metric';
  appearanceValue: string;
  languageValue: string;
}

export interface ProfileReflectFields {
  captureStyleValue: string;
  weeklyDigestOn: boolean;
  resurfaceOldCapturesOn: boolean;
  privateModeOn: boolean;
}

export interface ProfilePlan {
  /** "BetterAt Plus", "Free", etc. */
  name: string;
  /** "Yearly · renews Oct 5, 2026". */
  sub: string;
  /** "+" badge text. */
  badge?: string;
}

export interface ProfileHero {
  /** Initials displayed inside the slate-gradient avatar circle. */
  initials: string;
  name: string;
  handle: string;
  /** ["Member since October 2024", "Hong Kong"]. */
  metaSpans: string[];
}

interface Props {
  hero: ProfileHero;
  interests: ProfileInterest[];
  identity: ProfileIdentityFields;
  preferences: ProfilePreferencesFields;
  reflect: ProfileReflectFields;
  plan?: ProfilePlan;
  // ---- handlers — all optional; caller wires the real flows -----
  onEditAvatarPress?: () => void;
  onAddInterestPress?: () => void;
  onInterestPress?: (interest: ProfileInterest) => void;
  onIdentityFieldPress?: (field: keyof ProfileIdentityFields) => void;
  onNotificationsPress?: () => void;
  onAppearancePress?: () => void;
  onLanguagePress?: () => void;
  onWindUnitChange?: (unit: 'knots' | 'm/s' | 'mph') => void;
  onDistanceUnitChange?: (unit: 'nautical' | 'metric') => void;
  onCaptureStylePress?: () => void;
  onWeeklyDigestChange?: (on: boolean) => void;
  onResurfaceOldCapturesChange?: (on: boolean) => void;
  onPrivateModeChange?: (on: boolean) => void;
  onManagePlanPress?: () => void;
  onExportDataPress?: () => void;
  onPrivacyPress?: () => void;
  onHelpPress?: () => void;
  onSignOutPress?: () => void;
  onDeleteAccountPress?: () => void;
  bottomPad?: number;
  /**
   * Top inset for the inner ScrollView's contentContainerStyle. When
   * embedded inside a tab that overlays a translucent toolbar, the caller
   * passes the measured toolbar height so the hero sits below the toolbar
   * rather than starting hidden under it. Defaults to 0.
   */
  topInset?: number;
  /** Forwarded to the inner ScrollView (e.g. for scroll-driven toolbar hide). */
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll'];
}

// ---------------------------------------------------------------------------

export function ProfileScreen({
  hero,
  interests,
  identity,
  preferences,
  reflect,
  plan,
  onEditAvatarPress,
  onAddInterestPress,
  onInterestPress,
  onIdentityFieldPress,
  onNotificationsPress,
  onAppearancePress,
  onLanguagePress,
  onWindUnitChange,
  onDistanceUnitChange,
  onCaptureStylePress,
  onWeeklyDigestChange,
  onResurfaceOldCapturesChange,
  onPrivateModeChange,
  onManagePlanPress,
  onExportDataPress,
  onPrivacyPress,
  onHelpPress,
  onSignOutPress,
  onDeleteAccountPress,
  bottomPad = 130,
  topInset = 0,
  onScroll,
}: Props) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? 16 : undefined}
    >
      {/* Hero — centered avatar + name + handle + meta */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitials}>{hero.initials}</Text>
          <Pressable
            style={styles.editPip}
            hitSlop={8}
            onPress={onEditAvatarPress}
            accessibilityRole="button"
            accessibilityLabel="Change photo"
          >
            <Ionicons
              name="camera"
              size={14}
              color={IOS_REGISTER.accentUserAction}
            />
          </Pressable>
        </View>
        <Text style={styles.heroName}>{hero.name}</Text>
        <Text style={styles.heroHandle}>{hero.handle}</Text>
        {hero.metaSpans.length > 0 && (
          <View style={styles.heroMeta}>
            {hero.metaSpans.map((span, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={styles.heroMetaDot} />}
                <Text style={styles.heroMetaText}>{span}</Text>
              </React.Fragment>
            ))}
          </View>
        )}
      </View>

      {/* Interests — chips, single white card */}
      <SectionHead label="Interests" />
      <View style={styles.interestsCard}>
        <View style={styles.chipRow}>
          {interests.map((it) => (
            <InterestChip
              key={it.id}
              interest={it}
              onPress={() => onInterestPress?.(it)}
            />
          ))}
          <Pressable
            onPress={onAddInterestPress}
            accessibilityRole="button"
            accessibilityLabel="Add interest"
            style={[styles.chip, styles.chipAdd]}
          >
            <Ionicons
              name="add"
              size={13}
              color={IOS_REGISTER.accentUserAction}
            />
            <Text style={[styles.chipText, { color: IOS_REGISTER.accentUserAction }]}>
              Add interest
            </Text>
          </Pressable>
        </View>
      </View>
      {interests.some((i) => i.kind === 'primary') ? (
        <SectionFoot>
          {interests.find((i) => i.kind === 'primary')?.label} is your active
          pursuit — the one Reflect, Race Prep and Discover are tuned for.
        </SectionFoot>
      ) : null}

      {/* Identity — inline-editable cells */}
      <SectionHead label="Identity" />
      <View style={styles.group}>
        <IdentityCell
          label="Name"
          value={identity.name}
          onPress={() => onIdentityFieldPress?.('name')}
        />
        <Hairline />
        <IdentityCell
          label="Handle"
          value={identity.handle}
          onPress={() => onIdentityFieldPress?.('handle')}
        />
        <Hairline />
        <IdentityCell
          label="Email"
          value={identity.email}
          onPress={() => onIdentityFieldPress?.('email')}
        />
        <Hairline />
        <BioCell
          bio={identity.bio}
          onPress={() => onIdentityFieldPress?.('bio')}
        />
      </View>
      <SectionFoot>
        Tap any field to edit in place. No modals; no save button — changes
        commit when you tap away.
      </SectionFoot>

      {/* Preferences */}
      <SectionHead label="Preferences" />
      <View style={styles.group}>
        <DrillCell
          icon="notifications"
          tone="blue"
          label="Notifications"
          value={preferences.notificationsValue}
          onPress={onNotificationsPress}
        />
        <Hairline insetIcon />
        <SegmentCell
          icon="speedometer"
          tone="gray"
          label="Wind speed"
          options={[
            { value: 'knots', label: 'Knots' },
            { value: 'm/s', label: 'm/s' },
            { value: 'mph', label: 'mph' },
          ]}
          selected={preferences.windUnit}
          onChange={(v) => onWindUnitChange?.(v as 'knots' | 'm/s' | 'mph')}
        />
        <Hairline insetIcon />
        <SegmentCell
          icon="resize"
          tone="gray"
          label="Distance"
          options={[
            { value: 'nautical', label: 'Nautical' },
            { value: 'metric', label: 'Metric' },
          ]}
          selected={preferences.distanceUnit}
          onChange={(v) => onDistanceUnitChange?.(v as 'nautical' | 'metric')}
        />
        <Hairline insetIcon />
        <DrillCell
          icon="moon"
          tone="purple"
          label="Appearance"
          value={preferences.appearanceValue}
          onPress={onAppearancePress}
        />
        <Hairline insetIcon />
        <DrillCell
          icon="language"
          tone="gray"
          label="Language"
          value={preferences.languageValue}
          onPress={onLanguagePress}
        />
      </View>

      {/* Reflect */}
      <SectionHead label="Reflect" />
      <View style={styles.group}>
        <DrillCell
          icon="chatbubble"
          tone="coral"
          label="Capture style"
          value={reflect.captureStyleValue}
          onPress={onCaptureStylePress}
        />
        <Hairline insetIcon />
        <ToggleCell
          icon="mail"
          tone="green"
          label="Weekly digest"
          on={reflect.weeklyDigestOn}
          onChange={onWeeklyDigestChange}
        />
        <Hairline insetIcon />
        <ToggleCell
          icon="time"
          tone="amber"
          label="Resurface old captures"
          on={reflect.resurfaceOldCapturesOn}
          onChange={onResurfaceOldCapturesChange}
        />
        <Hairline insetIcon />
        <ToggleCell
          icon="eye-off"
          tone="gray"
          label="Private mode"
          on={reflect.privateModeOn}
          onChange={onPrivateModeChange}
        />
      </View>
      <SectionFoot>
        Private mode hides Reflect home cards from the iOS share preview when
        you AirPlay or screen-mirror.
      </SectionFoot>

      {/* Plan */}
      {plan ? (
        <>
          <SectionHead label="Plan" />
          <View style={styles.planCard}>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{plan.badge ?? '+'}</Text>
            </View>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planSub}>{plan.sub}</Text>
            </View>
            <Pressable
              onPress={onManagePlanPress}
              accessibilityRole="button"
              accessibilityLabel="Manage plan"
              hitSlop={6}
            >
              <Text style={styles.planManage}>Manage</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {/* Account */}
      <SectionHead label="Account" />
      <View style={styles.group}>
        <DrillCell
          icon="download"
          tone="gray"
          label="Export my data"
          onPress={onExportDataPress}
        />
        <Hairline insetIcon />
        <DrillCell
          icon="shield-half"
          tone="gray"
          label="Privacy & data"
          onPress={onPrivacyPress}
        />
        <Hairline insetIcon />
        <DrillCell
          icon="help-circle"
          tone="gray"
          label="Help & feedback"
          onPress={onHelpPress}
        />
      </View>

      {/* Sign out + Delete — separate single-cell groups, no section head */}
      <View style={styles.spacer} />
      <View style={styles.group}>
        <Pressable
          onPress={onSignOutPress}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={[styles.cell, styles.cellAction]}
        >
          <Text style={styles.actionLabel}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.spacer} />
      <View style={styles.group}>
        <Pressable
          onPress={onDeleteAccountPress}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          style={[styles.cell, styles.cellDestructive]}
        >
          <Text style={styles.destructiveLabel}>Delete account</Text>
        </Pressable>
      </View>
      <SectionFoot>
        Deleting your account removes captures, race logs, and concept history.
        This cannot be undone.
      </SectionFoot>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Internal components
// ---------------------------------------------------------------------------

function SectionHead({ label }: { label: string }) {
  return <Text style={styles.sectHead}>{label.toUpperCase()}</Text>;
}

function SectionFoot({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectFoot}>{children}</Text>;
}

function Hairline({ insetIcon }: { insetIcon?: boolean }) {
  return (
    <View
      style={[
        styles.hairline,
        insetIcon && { marginLeft: 56 },
      ]}
    />
  );
}

function InterestChip({
  interest,
  onPress,
}: {
  interest: ProfileInterest;
  onPress: () => void;
}) {
  const isPrimary = interest.kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={interest.label}
      style={[styles.chip, isPrimary && styles.chipPrimary]}
    >
      {interest.icon && (
        <Ionicons
          name={interest.icon}
          size={13}
          color={isPrimary ? '#B33B3B' : IOS_REGISTER.label}
        />
      )}
      <Text
        style={[
          styles.chipText,
          isPrimary && styles.chipTextPrimary,
        ]}
      >
        {interest.label}
      </Text>
    </Pressable>
  );
}

function IdentityCell({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${label.toLowerCase()}`}
    >
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue} numberOfLines={1}>
        {value}
      </Text>
      <Ionicons
        name="pencil"
        size={14}
        color={IOS_REGISTER.labelTertiary}
      />
    </Pressable>
  );
}

function BioCell({
  bio,
  onPress,
}: {
  bio?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.cellMulti}
      accessibilityRole="button"
      accessibilityLabel="Edit bio"
    >
      <View style={styles.cellMultiHead}>
        <Text style={styles.cellMultiKey}>Bio</Text>
        <Ionicons
          name="pencil"
          size={14}
          color={IOS_REGISTER.labelTertiary}
        />
      </View>
      <Text style={styles.cellMultiBody}>
        {bio ?? 'Tell people what you’re working on.'}
      </Text>
    </Pressable>
  );
}

type IconTone = 'blue' | 'purple' | 'coral' | 'green' | 'amber' | 'gray';

function iconBg(tone: IconTone): string {
  switch (tone) {
    case 'blue':
      return IOS_REGISTER.accentUserAction;
    case 'purple':
      return '#AF52DE';
    case 'coral':
      return IOS_REGISTER.accentMarkedContent;
    case 'green':
      return '#34C759';
    case 'amber':
      return '#FF9500';
    case 'gray':
      return '#8E8E93';
  }
}

function DrillCell({
  icon,
  tone,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: IconTone;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.cellIcon, { backgroundColor: iconBg(tone) }]}>
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <Text style={styles.cellLabel}>{label}</Text>
      {value ? <Text style={styles.cellValue}>{value}</Text> : null}
      <Ionicons
        name="chevron-forward"
        size={14}
        color={IOS_REGISTER.labelTertiary}
      />
    </Pressable>
  );
}

function ToggleCell({
  icon,
  tone,
  label,
  on,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: IconTone;
  label: string;
  on: boolean;
  onChange?: (on: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange?.(!on)}
      style={styles.cell}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
    >
      <View style={[styles.cellIcon, { backgroundColor: iconBg(tone) }]}>
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <Text style={styles.cellLabel}>{label}</Text>
      <View style={[styles.toggle, !on && styles.toggleOff]}>
        <View style={[styles.toggleKnob, !on && styles.toggleKnobOff]} />
      </View>
    </Pressable>
  );
}

function SegmentCell<T extends string>({
  icon,
  tone,
  label,
  options,
  selected,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: IconTone;
  label: string;
  options: { value: T; label: string }[];
  selected: T;
  onChange?: (value: T) => void;
}) {
  return (
    <View style={styles.cell}>
      <View style={[styles.cellIcon, { backgroundColor: iconBg(tone) }]}>
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <Text style={styles.cellLabel}>{label}</Text>
      <View style={styles.segMini}>
        {options.map((opt) => {
          const on = opt.value === selected;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange?.(opt.value)}
              style={[styles.segMiniOpt, on && styles.segMiniOptOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text
                style={[
                  styles.segMiniOptText,
                  on && styles.segMiniOptTextOn,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  // ----- hero -----
  hero: {
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 8,
    alignItems: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#5E7591',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(34, 50, 80, 0.45)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 4,
  },
  avatarInitials: {
    fontSize: 34,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  editPip: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  heroName: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: IOS_REGISTER.label,
  },
  heroHandle: {
    marginTop: 2,
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  heroMeta: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetaText: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
    marginHorizontal: 7,
  },
  // ----- section head / foot -----
  sectHead: {
    paddingTop: 28,
    paddingHorizontal: 32,
    paddingBottom: 7,
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectFoot: {
    paddingTop: 7,
    paddingHorizontal: 32,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 16,
    letterSpacing: -0.05,
  },
  // ----- grouped list -----
  group: {
    marginHorizontal: 16,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 10,
    overflow: 'hidden',
  },
  spacer: {
    height: 28,
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
  },
  cellIcon: {
    width: 29,
    height: 29,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cellLabel: {
    flex: 1,
    fontSize: 16,
    color: IOS_REGISTER.label,
    letterSpacing: -0.32,
  },
  cellValue: {
    fontSize: 16,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.32,
    textAlign: 'right',
    maxWidth: '56%',
  },
  cellMulti: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 13,
    gap: 4,
  },
  cellMultiHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cellMultiKey: {
    flex: 1,
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
  cellMultiBody: {
    fontSize: 15,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_REGISTER.separator,
  },
  // ----- destructive / action rows -----
  cellAction: {
    justifyContent: 'center',
  },
  cellDestructive: {
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 16,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.32,
  },
  destructiveLabel: {
    fontSize: 16,
    color: '#FF3B30',
    letterSpacing: -0.32,
  },
  // ----- interests -----
  interestsCard: {
    marginHorizontal: 16,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 10,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 9,
    paddingRight: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EFEFF4',
  },
  chipText: {
    fontSize: 13.5,
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  chipPrimary: {
    backgroundColor: IOS_REGISTER.accentMarkedContentTint,
  },
  chipTextPrimary: {
    color: '#B33B3B',
    fontWeight: '500',
  },
  chipAdd: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(60, 60, 67, 0.36)',
  },
  // ----- toggle (iOS switch) -----
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#34C759',
    justifyContent: 'center',
  },
  toggleOff: {
    backgroundColor: '#D1D1D6',
  },
  toggleKnob: {
    position: 'absolute',
    left: 22,
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleKnobOff: {
    left: 2,
  },
  // ----- segmented mini -----
  segMini: {
    flexDirection: 'row',
    height: 28,
    padding: 2,
    gap: 2,
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: 7,
  },
  segMiniOpt: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  segMiniOptOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 1,
  },
  segMiniOptText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.08,
    color: IOS_REGISTER.label,
  },
  segMiniOptTextOn: {
    fontWeight: '600',
  },
  // ----- plan card -----
  planCard: {
    marginHorizontal: 16,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 10,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planBadge: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#1B3855',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  planInfo: {
    flex: 1,
    minWidth: 0,
  },
  planName: {
    fontSize: 15.5,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  planSub: {
    marginTop: 2,
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
  planManage: {
    fontSize: 15,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
});
