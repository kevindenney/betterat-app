import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useInterest } from '@/providers/InterestProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { ContextSheet, type ContextSurface } from '@/components/navigation/ContextSheet';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';

function surfaceFromPath(pathname: string | null): ContextSurface {
  const path = pathname || '';
  if (path.startsWith('/studio')) return 'studio';
  if (path.startsWith('/admin')) return 'admin';
  return 'practice';
}

function initialsFor(name?: string | null): string {
  const tokens = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '·';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}

function orgIdFromPath(pathname: string | null): string | null {
  const path = pathname || '';
  const match = path.match(/^\/admin\/([^/]+)/);
  return match?.[1] ?? null;
}

export function ContextSwitcher() {
  const pathname = usePathname();
  const surface = surfaceFromPath(pathname);
  const { currentInterest, loading } = useInterest();
  const { activeOrganization } = useOrganization();
  const menu = useProfileMenuData();
  const [open, setOpen] = useState(false);
  const routeOrgId = orgIdFromPath(pathname);
  const routeOrg = routeOrgId
    ? menu.memberships.find((membership) => membership.org_id === routeOrgId)
    : null;
  const workspaceName = activeOrganization?.name || routeOrg?.org_name || null;
  const workspaceMono = routeOrg?.org_short_name || initialsFor(workspaceName);

  const chip = useMemo(() => {
    if (surface === 'practice') {
      return {
        label: currentInterest?.name ?? 'Practice',
        dotColor: currentInterest?.accent_color ?? '#2563EB',
        monogram: null as string | null,
        tone: 'practice' as const,
      };
    }

    if (surface === 'admin') {
      return {
        label: 'Admin',
        dotColor: '#475569',
        monogram: workspaceName ? workspaceMono : null,
        tone: 'admin' as const,
      };
    }

    return {
      label: 'Studio',
      dotColor: activeOrganization ? '#28406B' : '#6D5BD0',
      monogram: workspaceName ? workspaceMono : null,
      tone: 'studio' as const,
    };
  }, [activeOrganization, currentInterest, surface, workspaceMono, workspaceName]);

  if (surface === 'practice' && loading && !currentInterest) return null;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.pill,
          chip.tone === 'studio' && styles.pillStudio,
          chip.tone === 'admin' && styles.pillAdmin,
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Current context: ${chip.monogram ? `${chip.monogram} ` : ''}${chip.label}. Tap to switch.`}
      >
        {chip.monogram ? (
          <View style={[styles.mono, { backgroundColor: chip.dotColor }]}>
            <Text style={styles.monoText}>{chip.monogram}</Text>
          </View>
        ) : (
          <View style={styles.dotWrap}>
            <View style={[styles.dotRing, { backgroundColor: chip.dotColor }]} />
            <View style={[styles.dot, { backgroundColor: chip.dotColor }]} />
          </View>
        )}
        <Text style={styles.pillText} numberOfLines={1}>
          {chip.label}
        </Text>
        <Ionicons name="chevron-down" size={13} color="rgba(60, 60, 67, 0.32)" />
      </TouchableOpacity>

      <ContextSheet
        visible={open}
        surface={surface}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.14)',
  },
  pillStudio: {
    borderColor: 'rgba(109, 91, 208, 0.22)',
    backgroundColor: 'rgba(246, 244, 255, 0.92)',
  },
  pillAdmin: {
    borderColor: 'rgba(71, 85, 105, 0.22)',
    backgroundColor: 'rgba(248, 250, 252, 0.94)',
  },
  dotWrap: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
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
  mono: {
    width: 19,
    height: 19,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pillText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1F2937',
    maxWidth: 150,
    letterSpacing: 0,
  },
});
