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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type StudioAccent = 'purple' | 'navy' | 'drawing';
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

const ACCENT_COLORS: Record<StudioAccent, string> = {
  purple: '#6B5BBF',
  navy: '#28406B',
  drawing: '#B8855A',
};

const MONO_BG: Record<StudioShellProps['org']['monoColor'], string> = {
  navy: '#28406B',
  drawing: '#B8855A',
  solo: '#8E8E93',
};

export function StudioShell({
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
  return (
    <View style={s.shell}>
      <View style={s.sidebar}>
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
          <Ionicons name="chevron-down" size={16} color="rgba(60, 60, 67, 0.3)" />
        </View>

        {ctxLens ? (
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
                />
              ))}
              {section.footer ? <View style={s.navFooter}>{section.footer}</View> : null}
            </View>
          ))}
          <View style={{ height: 12 }} />
        </ScrollView>

        <Pressable style={s.userCard} onPress={onUserCardPress}>
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
      </View>

      <View style={s.main}>{children}</View>
    </View>
  );
}

function NavItem({
  item,
  accentColor,
}: {
  item: StudioNavItem;
  accentColor: string;
}) {
  const isActive = !!item.active;
  const isCta = !!item.cta;
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
      onPress={item.onPress}
      style={[
        s.navItem,
        isActive && { backgroundColor: accentColor },
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
  title: string;
  subtitleParts?: React.ReactNode[];  // tokens between dot separators
  pill?: { label: string; tone: 'purple' | 'navy' | 'amber' | 'green' };
  actions?: React.ReactNode;
}

export function StudioHeader({
  crumbs,
  title,
  subtitleParts,
  pill,
  actions,
}: StudioHeaderProps) {
  return (
    <View style={h.wrap}>
      <View style={h.crumbs}>
        {crumbs.map((c, i) => (
          <React.Fragment key={`${c}-${i}`}>
            <Text style={h.crumbText}>{c}</Text>
            {i < crumbs.length - 1 ? (
              <Ionicons name="chevron-forward" size={12} color="rgba(60, 60, 67, 0.4)" />
            ) : null}
          </React.Fragment>
        ))}
      </View>
      <View style={h.row}>
        <View style={h.titleCol}>
          <Text style={h.title}>{title}</Text>
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
        {actions ? <View style={h.actions}>{actions}</View> : null}
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
  onChange,
}: {
  tabs: StudioTab[];
  active: string;
  accent?: StudioAccent;
  onChange?: (key: string) => void;
}) {
  const underlineColor = ACCENT_COLORS[accent];
  return (
    <View style={t.bar}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable key={tab.key} onPress={() => onChange?.(tab.key)} style={t.tab}>
            <Text style={[t.label, isActive && t.labelOn]}>
              {tab.label}
              {tab.count ? (
                <Text style={t.count}>{` · ${tab.count}`}</Text>
              ) : null}
            </Text>
            {isActive ? (
              <View style={[t.underline, { backgroundColor: underlineColor }]} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
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
}: {
  variant?: 'primary' | 'ghost' | 'danger' | 'muted';
  accent?: StudioAccent;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  small?: boolean;
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
  orgMonoText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
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
    fontWeight: '700',
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

const h = StyleSheet.create({
  wrap: {},
  crumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  crumbText: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', letterSpacing: -0.05 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  titleCol: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    marginBottom: 6,
    lineHeight: 32,
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
  pillTextPurple: { color: '#6B5BBF' },
  pillTextNavy: { color: '#28406B' },
  pillTextAmber: { color: '#C99632' },
  pillTextGreen: { color: '#1E8F47' },
  actions: { flexDirection: 'row', gap: 8 },
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
