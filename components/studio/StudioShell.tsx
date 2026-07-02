/**
 * StudioShell — the iPad/desktop chrome shared by Creator Studio (Section B,
 * Frames 4-6), Org Admin (Section C, Frames 7-8), and any future writing-class
 * surface.
 *
 * Layout: 248px sidebar + flex-1 main area. The sidebar holds the org card,
 * the practice/studio/mentor context switcher, opinionated nav groups, and a
 * user card pinned to the bottom. The main area is a plain child slot.
 *
 * Reuse hints:
 *   - Pass `accent="purple"` for Creator Studio (institutional or independent),
 *     `accent="navy"` for Org Admin. The active nav item + page tabs + primary
 *     buttons pick up the accent.
 *   - Pages compose their own header (StudioHeader) and content inside the
 *     `children` slot. Two-column home/editor layouts live at the page level.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { ContextSwitcher } from '@/components/navigation/ContextSwitcher';
import { AppChromeRow } from '@/components/ui/AppChromeRow';
import {
  IOS_REGISTER,
  REGISTER_SECTION_ACCENT,
} from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

/**
 * Phone breakpoint. Below this the fixed 248px rail collapses into a top bar
 * + slide-over drawer and `main` goes full-width. 600 cleanly splits phones
 * (≤440pt portrait) from iPad portrait (≥744pt), so iPad keeps two-pane density.
 */
export const STUDIO_COMPACT_BREAKPOINT = 600;

export type StudioAccent = 'purple' | 'navy' | 'drawing' | 'blue';
export type StudioCtxLens = 'practice' | 'studio' | 'mentor';

export interface StudioNavItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count?: string | number;
  countTone?: 'neutral' | 'coral';
  active?: boolean;
  cta?: boolean;       // "+ Invite co-author" style — blue text
  onPress?: () => void;
}

export interface StudioNavSection {
  eyebrow: string;
  items: StudioNavItem[];
  footer?: React.ReactNode;
}

export interface StudioShellProps {
  accent?: StudioAccent;
  org: {
    name: string;          // "Johns Hopkins · MSN"
    role: string;          // "Studio · Dr. K. Murphy"
    mono: string;          // "JH"
    monoColor: 'navy' | 'drawing' | 'solo';
  };
  /** Hide the Practice/Studio/Mentor switcher when omitted — editor mode. */
  ctxLens?: StudioCtxLens;
  onCtxChange?: (next: StudioCtxLens) => void;
  /** Restrict context switcher options (e.g. independent author has no Mentor lens). */
  ctxLensOptions?: StudioCtxLens[];
  navSections: StudioNavSection[];
  /** Phone bottom nav. Defaults to the first five primary nav items. */
  compactBottomTabs?: StudioNavItem[];
  /**
   * Surface's primary create/save action, docked as a FAB pill above the bottom
   * tabs on phone. The page should drop the same button from its header on
   * compact so the action lives in exactly one place (thumb-reach).
   */
  compactPrimaryAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  };
  user: {
    name: string;
    email: string;
    initials: string;
    /** Replace email line with a status string (e.g. "Editing now"). */
    statusLine?: string;
  };
  onUserCardPress?: () => void;
  children: React.ReactNode;
}

// Section-identity hues (wayfinding) come from the named register token; `blue`
// is the additive action accent (#007AFF) for primary controls — see D1 decision.
const ACCENT_COLORS: Record<StudioAccent, string> = {
  purple: REGISTER_SECTION_ACCENT.purple,
  navy: REGISTER_SECTION_ACCENT.navy,
  drawing: REGISTER_SECTION_ACCENT.drawing,
  blue: IOS_REGISTER.accentUserAction,
};

const MONO_BG: Record<StudioShellProps['org']['monoColor'], string> = {
  navy: REGISTER_SECTION_ACCENT.navy,
  drawing: REGISTER_SECTION_ACCENT.drawing,
  solo: '#8E8E93',
};

export function StudioShell(props: StudioShellProps) {
  const { width } = useWindowDimensions();
  const compact =
    FEATURE_FLAGS.ADMIN_PHONE_PARITY && width < STUDIO_COMPACT_BREAKPOINT;
  if (compact) {
    return <StudioShellCompact {...props} />;
  }
  return <StudioShellRegular {...props} />;
}

/** ≥600pt — the original 248px rail + main, unchanged. */
function StudioShellRegular({
  accent = 'purple',
  org,
  ctxLens,
  onCtxChange,
  ctxLensOptions,
  navSections,
  user,
  onUserCardPress,
  children,
}: StudioShellProps) {
  const accentColor = ACCENT_COLORS[accent];
  // The route group hides the native Stack header, so the shell owns the
  // safe-area: without this the sidebar org card + page header collide with
  // the status bar / clock (notably on iPad) and the bottom user card with
  // the home indicator.
  const insets = useSafeAreaInsets();
  return (
    <View style={s.shell}>
      <View
        style={[
          s.sidebar,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 14 },
        ]}
      >
        <SidebarBody
          accentColor={accentColor}
          org={org}
          ctxLens={ctxLens}
          onCtxChange={onCtxChange}
          ctxLensOptions={ctxLensOptions}
          navSections={navSections}
          user={user}
          onUserCardPress={onUserCardPress}
        />
      </View>

      <View
        style={[
          s.main,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * <600pt — shared AppChromeRow shell (context chip left, account avatar right,
 * identical to Practice) + full-width main + bottom tabs. The page composes its
 * own StudioHeader (crumbs + title) inside `children`, so the chrome row carries
 * only identity + account — no redundant workspace/title row.
 *
 * We share the *shell* (chip + avatar) but NOT Practice's action cluster: the
 * universal `+` opens a personal-practice "new step" composer and the bell is a
 * personal capture inbox — both meaningless while authoring. So `showPlus` and
 * `showInboxBell` are off here; the surface's create-action lives in the page
 * header (New blueprint / Publish) and the author's "needs you" signal is the
 * Threads tab's coral badge. No hamburger drawer: bottom tabs are the single nav
 * spine and the context chip switches workspace.
 */
function StudioShellCompact({
  accent = 'purple',
  navSections,
  compactBottomTabs,
  compactPrimaryAction,
  children,
}: StudioShellProps) {
  const accentColor = ACCENT_COLORS[accent];
  const insets = useSafeAreaInsets();
  const bottomBar = Math.max(8, insets.bottom) + 52;
  return (
    <View style={c.shell}>
      <View style={[c.header, { paddingTop: insets.top + 6 }]}>
        <AppChromeRow showPlus={false} showInboxBell={false} />
      </View>

      <View style={c.contentWrap}>
        <View style={[c.main, { paddingBottom: insets.bottom + 76 }]}>{children}</View>
        {compactPrimaryAction ? (
          <Pressable
            style={[c.fab, { bottom: bottomBar + 14, backgroundColor: accentColor }]}
            onPress={compactPrimaryAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={compactPrimaryAction.label}
          >
            <Ionicons name={compactPrimaryAction.icon} size={18} color="#FFFFFF" />
            <Text style={c.fabText}>{compactPrimaryAction.label}</Text>
          </Pressable>
        ) : null}
        <CompactBottomTabs
          tabs={compactBottomTabs ?? navSections[0]?.items.slice(0, 5) ?? []}
          accentColor={accentColor}
          bottomInset={insets.bottom}
        />
      </View>
    </View>
  );
}

function CompactBottomTabs({
  tabs,
  accentColor,
  bottomInset,
}: {
  tabs: StudioNavItem[];
  accentColor: string;
  bottomInset: number;
}) {
  if (tabs.length === 0) return null;
  return (
    <View style={[c.bottomTabs, { paddingBottom: Math.max(8, bottomInset) }]}>
      {tabs.map((tab) => {
        const active = !!tab.active;
        const color = active ? accentColor : 'rgba(60, 60, 67, 0.62)';
        return (
          <Pressable
            key={tab.key}
            style={c.bottomTab}
            onPress={tab.onPress}
            disabled={!tab.onPress && !active}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
          >
            <Ionicons name={tab.icon} size={19} color={color} />
            <Text style={[c.bottomTabText, active && { color, fontWeight: '700' }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Shared rail content — rendered in the regular sidebar and the compact drawer. */
function SidebarBody({
  accentColor,
  org,
  ctxLens,
  onCtxChange,
  ctxLensOptions,
  navSections,
  user,
  onUserCardPress,
  onItemPress,
}: {
  accentColor: string;
  org: StudioShellProps['org'];
  ctxLens?: StudioCtxLens;
  onCtxChange?: (next: StudioCtxLens) => void;
  ctxLensOptions?: StudioCtxLens[];
  navSections: StudioNavSection[];
  user: StudioShellProps['user'];
  onUserCardPress?: () => void;
  onItemPress?: () => void;
}) {
  return (
    <>
      <View style={s.orgCard}>
        <View style={[s.orgMono, { backgroundColor: MONO_BG[org.monoColor] }]}>
          <Text style={s.orgMonoText}>{org.mono}</Text>
        </View>
        <View style={s.orgInfo}>
          <Text style={s.orgName} numberOfLines={1}>
            {org.name}
          </Text>
          <Text style={s.orgRole} numberOfLines={1}>
            {org.role}
          </Text>
        </View>
      </View>

      {FEATURE_FLAGS.CONTEXT_SWITCHER_V1 ? (
        <View style={s.contextSwitcherSlot}>
          <ContextSwitcher />
        </View>
      ) : ctxLens ? (
        <View style={s.ctxSwitch}>
          {(ctxLensOptions ?? (['practice', 'studio', 'mentor'] as StudioCtxLens[])).map((lens) => (
            <Pressable
              key={lens}
              onPress={() => onCtxChange?.(lens)}
              style={[s.ctxOpt, ctxLens === lens && s.ctxOptOn]}
            >
              <Text style={[s.ctxOptText, ctxLens === lens && s.ctxOptTextOn]}>
                {lens === 'practice' ? 'Practice' : lens === 'studio' ? 'Studio' : 'Mentor'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView style={s.navScroll} showsVerticalScrollIndicator={false}>
        {navSections.map((section, idx) => (
          <View key={`${section.eyebrow}-${idx}`}>
            <Text style={s.navEyebrow}>{section.eyebrow}</Text>
            {section.items.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                accentColor={accentColor}
                onItemPress={onItemPress}
              />
            ))}
            {section.footer ? <View style={s.navFooter}>{section.footer}</View> : null}
          </View>
        ))}
        <View style={{ height: 12 }} />
      </ScrollView>

      <Pressable
        style={s.userCard}
        onPress={() => {
          onUserCardPress?.();
          onItemPress?.();
        }}
      >
        <View style={[s.userAvi, { backgroundColor: accentColor }]}>
          <Text style={s.userAviText}>{user.initials}</Text>
        </View>
        <View style={s.userInfo}>
          <Text style={s.userName} numberOfLines={1}>
            {user.name}
          </Text>
          <Text style={s.userEmail} numberOfLines={1}>
            {user.statusLine ?? user.email}
          </Text>
        </View>
        <Ionicons
          name="ellipsis-horizontal"
          size={16}
          color="rgba(60, 60, 67, 0.3)"
        />
      </Pressable>
    </>
  );
}

function NavItem({
  item,
  accentColor,
  onItemPress,
}: {
  item: StudioNavItem;
  accentColor: string;
  onItemPress?: () => void;
}) {
  const isActive = !!item.active;
  const isCta = !!item.cta;
  const isActionable = !!item.onPress;
  const labelColor = isActive ? '#FFFFFF' : isCta ? '#007AFF' : 'rgba(60, 60, 67, 0.85)';
  const iconColor = isActive ? 'rgba(255,255,255,0.85)' : isCta ? '#007AFF' : 'rgba(60, 60, 67, 0.4)';
  const countColor = isActive
    ? 'rgba(255,255,255,0.85)'
    : item.countTone === 'coral'
    ? '#FF6B6B'
    : 'rgba(60, 60, 67, 0.4)';
  const countWeight = item.countTone === 'coral' ? '700' : '400';
  return (
    <Pressable
      disabled={!isActionable && !isActive}
      onPress={() => {
        item.onPress?.();
        onItemPress?.();
      }}
      style={[
        s.navItem,
        isActive && { backgroundColor: accentColor },
        !isActionable && !isActive && { opacity: 0.55 },
      ]}
    >
      <Ionicons name={item.icon} size={17} color={iconColor} style={s.navItemIcon} />
      <Text style={[s.navItemLabel, { color: labelColor }]} numberOfLines={1}>
        {item.label}
      </Text>
      {item.count !== undefined && item.count !== null && item.count !== '' ? (
        <Text
          style={[
            s.navItemCount,
            { color: countColor, fontWeight: countWeight as any },
          ]}
        >
          {String(item.count)}
        </Text>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// StudioHeader — crumbs + h1 + sub-h1 + actions row
// ---------------------------------------------------------------------------

export interface StudioHeaderProps {
  crumbs: string[];         // ["Creator Studio", "Home"]
  onCrumbPress?: (crumb: string, index: number) => void;
  title: string;
  subtitleParts?: React.ReactNode[];  // tokens between dot separators
  pill?: { label: string; tone: 'purple' | 'navy' | 'amber' | 'green' };
  actions?: React.ReactNode;
  /**
   * Phone reflow: drop the breadcrumb (the context chip + active tab already
   * say where you are), shrink the serif title, and stack the actions below
   * the title block so they don't fight it for width.
   */
  compact?: boolean;
}

export function StudioHeader({
  crumbs,
  onCrumbPress,
  title,
  subtitleParts,
  pill,
  actions,
  compact,
}: StudioHeaderProps) {
  return (
    <View style={h.wrap}>
      {compact ? null : (
        <View style={h.crumbs}>
          {crumbs.map((c, i) => {
            const canPress = !!onCrumbPress && i < crumbs.length - 1;
            return (
              <React.Fragment key={`${c}-${i}`}>
                <Pressable
                  disabled={!canPress}
                  onPress={() => onCrumbPress?.(c, i)}
                  hitSlop={6}
                >
                  <Text style={[h.crumbText, canPress && h.crumbLink]}>{c}</Text>
                </Pressable>
                {i < crumbs.length - 1 ? (
                  <Ionicons name="chevron-forward" size={12} color="rgba(60, 60, 67, 0.4)" />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
      )}
      <View style={[h.row, compact && h.rowCompact]}>
        <View style={[h.titleCol, compact && h.titleColCompact]}>
          <Text style={[h.title, compact && h.titleCompact]}>{title}</Text>
          {(subtitleParts && subtitleParts.length > 0) || pill ? (
            <View style={h.sub}>
              {subtitleParts?.map((part, i) => (
                <React.Fragment key={i}>
                  <View style={h.subToken}>{part}</View>
                  {i < (subtitleParts?.length ?? 0) - 1 ? <View style={h.dot} /> : null}
                </React.Fragment>
              ))}
              {pill ? (
                <View
                  style={[
                    h.pill,
                    pill.tone === 'purple' && h.pillPurple,
                    pill.tone === 'navy' && h.pillNavy,
                    pill.tone === 'amber' && h.pillAmber,
                    pill.tone === 'green' && h.pillGreen,
                  ]}
                >
                  <Text
                    style={[
                      h.pillText,
                      pill.tone === 'purple' && h.pillTextPurple,
                      pill.tone === 'navy' && h.pillTextNavy,
                      pill.tone === 'amber' && h.pillTextAmber,
                      pill.tone === 'green' && h.pillTextGreen,
                    ]}
                  >
                    {pill.label}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        {actions ? <View style={[h.actions, compact && h.actionsCompact]}>{actions}</View> : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// StudioTabs — the underlined section nav used by the editor (Overview · Steps · …)
// ---------------------------------------------------------------------------

export interface StudioTab {
  key: string;
  label: string;
  count?: string;
}

export function StudioTabs({
  tabs,
  active,
  accent = 'purple',
  scrollable = false,
  onChange,
}: {
  tabs: StudioTab[];
  active: string;
  accent?: StudioAccent;
  /** Phone: lay tabs in a horizontal scroll so 5+ sections don't clip. */
  scrollable?: boolean;
  onChange?: (key: string) => void;
}) {
  const underlineColor = ACCENT_COLORS[accent];
  const tabEls = tabs.map((tab) => {
    const isActive = tab.key === active;
    return (
      <Pressable key={tab.key} onPress={() => onChange?.(tab.key)} style={t.tab}>
        <Text style={[t.label, isActive && t.labelOn]} numberOfLines={1}>
          {tab.label}
          {tab.count ? <Text style={t.count}>{` · ${tab.count}`}</Text> : null}
        </Text>
        {isActive ? (
          <View style={[t.underline, { backgroundColor: underlineColor }]} />
        ) : null}
      </Pressable>
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={t.barScroll}
        contentContainerStyle={t.barScrollContent}
      >
        {tabEls}
      </ScrollView>
    );
  }

  return <View style={t.bar}>{tabEls}</View>;
}

// ---------------------------------------------------------------------------
// StudioPanel — the white card wrapper around blueprints/threads/etc lists
// ---------------------------------------------------------------------------

export interface StudioPanelProps {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  flex?: number;
  width?: number;
}

export function StudioPanel({ title, meta, children, flex, width }: StudioPanelProps) {
  return (
    <View
      style={[
        p.wrap,
        flex !== undefined && { flex },
        width !== undefined && { width },
      ]}
    >
      <View style={p.head}>
        <Text style={p.title}>{title}</Text>
        {meta ? <View>{meta}</View> : null}
      </View>
      <View style={p.body}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// StudioButton — toolbar buttons (.btn .primary .ghost from the design CSS)
// ---------------------------------------------------------------------------

export function StudioButton({
  variant = 'ghost',
  accent = 'purple',
  icon,
  label,
  onPress,
  small,
  testID,
}: {
  variant?: 'primary' | 'ghost' | 'danger' | 'muted';
  accent?: StudioAccent;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  small?: boolean;
  testID?: string;
}) {
  const bg =
    variant === 'primary'
      ? ACCENT_COLORS[accent]
      : variant === 'danger'
      ? 'rgba(255, 59, 48, 0.10)'
      : variant === 'muted'
      ? 'transparent'
      : 'rgba(0,0,0,0.05)';
  const color =
    variant === 'primary'
      ? '#FFFFFF'
      : variant === 'danger'
      ? '#FF3B30'
      : 'rgba(60, 60, 67, 0.85)';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        b.btn,
        { backgroundColor: bg },
        small && { paddingHorizontal: 11, paddingVertical: 6 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 14 : 15} color={color} /> : null}
      <Text style={[b.btnText, { color, fontSize: small ? 12 : 13 }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
  },
  sidebar: {
    width: 248,
    paddingHorizontal: 10,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(0,0,0,0.08)',
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginBottom: 12,
  },
  orgMono: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgMonoText: { color: '#FFFFFF', fontSize: 11, fontFamily: fontFamily.mono, fontWeight: '500', letterSpacing: 0.4 },
  orgInfo: { flex: 1, minWidth: 0 },
  orgName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  orgRole: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },

  ctxSwitch: {
    flexDirection: 'row',
    gap: 2,
    padding: 2,
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: 8,
    marginBottom: 14,
  },
  contextSwitcherSlot: {
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  ctxOpt: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  ctxOptOn: {
    backgroundColor: '#FFFFFF',
    ...({
      boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
    } as any),
  },
  ctxOptText: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '500' },
  ctxOptTextOn: { color: '#1C1C1E', fontWeight: '600' },

  navScroll: { flex: 1 },
  navEyebrow: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    marginTop: 14,
    marginBottom: 6,
    marginHorizontal: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 1,
  },
  navItemIcon: {},
  navItemLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.05,
  },
  navItemCount: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  navFooter: {
    marginHorizontal: 8,
    marginTop: 6,
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(40,64,107,0.07)',
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  userAvi: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAviText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 12.5, fontWeight: '600', color: '#1C1C1E' },
  userEmail: { fontSize: 10.5, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },

  main: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 18,
    overflow: 'hidden',
  },
});

// Compact (<600pt) chrome — iOS register top bar + slide-over drawer.
const c = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  contentWrap: {
    flex: 1,
  },
  header: {
    paddingBottom: 6,
    backgroundColor: IOS_REGISTER.cardBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bottomTabs: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 64,
    paddingTop: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  bottomTab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 46,
    paddingHorizontal: 2,
  },
  bottomTabText: {
    color: 'rgba(60, 60, 67, 0.62)',
    fontSize: 10.5,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

const h = StyleSheet.create({
  wrap: {},
  crumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  crumbText: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', letterSpacing: -0.05 },
  crumbLink: { color: '#6F56D9', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  titleCol: { flex: 1, minWidth: 200 },
  titleColCompact: { flex: 0, minWidth: 0 },
  title: {
    fontSize: 28,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: '#1C1C1E',
    letterSpacing: -0.4,
    marginBottom: 6,
    lineHeight: 32,
  },
  titleCompact: {
    fontSize: 22,
    lineHeight: 27,
    marginBottom: 4,
  },
  sub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  subToken: {},
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(60, 60, 67, 0.3)',
  },
  pill: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pillPurple: { backgroundColor: 'rgba(107, 91, 191, 0.14)' },
  pillNavy: { backgroundColor: 'rgba(40, 64, 107, 0.12)' },
  pillAmber: { backgroundColor: 'rgba(201, 150, 50, 0.14)' },
  pillGreen: { backgroundColor: 'rgba(52, 199, 89, 0.14)' },
  pillText: { fontSize: 11, fontWeight: '600', color: 'rgba(60, 60, 67, 0.85)', letterSpacing: -0.05 },
  pillTextPurple: { color: REGISTER_SECTION_ACCENT.purple },
  pillTextNavy: { color: REGISTER_SECTION_ACCENT.navy },
  pillTextAmber: { color: '#C99632' },
  pillTextGreen: { color: '#1E8F47' },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  actionsCompact: {
    justifyContent: 'flex-start',
  },
});

const p = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    ...({
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    } as any),
  },
  head: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  body: { flex: 1 },
});

const b = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
  },
  btnText: { fontWeight: '600', letterSpacing: -0.1 },
});

const t = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    marginBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  // Horizontal-scroll variant (phone): the bottom rule rides the scroll view so
  // it spans the full width, while the tabs themselves scroll inside it.
  barScroll: {
    width: '100%',
    marginTop: 4,
    marginBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.12)',
    flexGrow: 0,
  },
  barScrollContent: {
    flexDirection: 'row',
    gap: 4,
    paddingRight: 16,
  },
  tab: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    position: 'relative',
  },
  label: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: -0.1,
  },
  labelOn: { color: '#1C1C1E', fontWeight: '600' },
  count: { color: 'rgba(60, 60, 67, 0.6)', fontWeight: '400' },
  underline: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: -0.5,
    height: 2,
    borderRadius: 2,
  },
});
