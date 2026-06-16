/**
 * ForYouSection — Unified collapsible section that consolidates
 * peer suggestions, blueprint updates, org blueprints, and join-org prompts
 * into a single horizontal scrollable strip.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForYouItems, type ForYouItem, type ForYouItemType } from '@/hooks/useForYouItems';
import { ForYouPreviewModal } from './ForYouPreviewModal';

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'rgba(255,255,255,0.96)',
  cardBg: '#FFFFFF',
  cardBorder: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  // Type accent colors
  suggestion: '#007AFF',
  suggestionBg: 'rgba(37,99,235,0.08)',
  blueprint: '#00897B',
  blueprintBg: 'rgba(0,137,123,0.08)',
  orgBlueprint: '#007AFF',
  orgBlueprintBg: 'rgba(37,99,235,0.08)',
  joinOrg: '#D97706',
  joinOrgBg: 'rgba(217,119,6,0.08)',
  headerAccent: '#007AFF',
  badgeBg: '#DBEAFE',
  badgeText: '#007AFF',
} as const;

const TYPE_CONFIG: Record<ForYouItemType, { color: string; bg: string; icon: string; actionLabel: string }> = {
  peer_suggestion: { color: C.suggestion, bg: C.suggestionBg, icon: 'paper-plane', actionLabel: 'Adopt' },
  blueprint_update: { color: C.blueprint, bg: C.blueprintBg, icon: 'layers-outline', actionLabel: 'Adopt' },
  org_blueprint: { color: C.orgBlueprint, bg: C.orgBlueprintBg, icon: 'business-outline', actionLabel: 'Subscribe' },
  join_org: { color: C.joinOrg, bg: C.joinOrgBg, icon: 'enter-outline', actionLabel: 'Join' },
};

// =============================================================================
// PERSISTENCE
// =============================================================================

const COLLAPSED_KEY = 'foryou_collapsed';

function getPersistedCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function setPersistedCollapsed(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(COLLAPSED_KEY, String(value));
  } catch {
    // Ignore
  }
}

// =============================================================================
// PROPS
// =============================================================================

interface ForYouSectionProps {
  interestId?: string | null;
  interestSlug?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  hasOrg: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ForYouSection({
  interestId,
  interestSlug,
  orgId,
  orgName,
  hasOrg,
}: ForYouSectionProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(getPersistedCollapsed);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<ForYouItem | null>(null);

  const { items, actions } = useForYouItems({
    interestId,
    interestSlug,
    orgId,
    orgName,
    hasOrg,
  });

  const MAX_VISIBLE = 5;
  const allVisibleItems = items.filter((item) => !hiddenIds.has(item.id));
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? allVisibleItems : allVisibleItems.slice(0, MAX_VISIBLE);
  const hasMore = allVisibleItems.length > MAX_VISIBLE;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      setPersistedCollapsed(next);
      return next;
    });
  }, []);

  const hideLocally = useCallback((id: string) => {
    setHiddenIds((prev) => new Set(prev).add(id));
  }, []);

  const handleAction = useCallback(async (item: ForYouItem) => {
    setActionInProgress(item.id);
    try {
      switch (item.type) {
        case 'peer_suggestion':
          await actions.adoptSuggestion(item);
          break;
        case 'blueprint_update':
          actions.adoptBlueprintStep(item);
          break;
        case 'org_blueprint':
          await actions.subscribeBlueprint(item);
          break;
        case 'join_org':
          router.push(item.data.target as string);
          break;
      }
      // Close the preview modal once the action succeeds
      setPreviewItem((current) => (current?.id === item.id ? null : current));
    } finally {
      setActionInProgress(null);
    }
  }, [actions, router]);

  const handleDismiss = useCallback((item: ForYouItem) => {
    switch (item.type) {
      case 'peer_suggestion':
        actions.dismissSuggestion(item);
        break;
      case 'blueprint_update':
        actions.dismissBlueprintStep(item);
        break;
      case 'org_blueprint':
      case 'join_org':
        hideLocally(item.id);
        break;
    }
    setPreviewItem((current) => (current?.id === item.id ? null : current));
  }, [actions, hideLocally]);

  const handleCardPress = useCallback((item: ForYouItem) => {
    // For step-like items we open a preview modal so the user can read
    // the content before adopting. Org blueprints still navigate to the
    // blueprint page since that's a richer experience.
    if (item.type === 'org_blueprint') {
      router.push(`/blueprint/${item.data.blueprintSlug}` as any);
      return;
    }
    if (item.type === 'join_org') {
      router.push(item.data.target as string);
      return;
    }
    setPreviewItem(item);
  }, [router]);

  // Render nothing if no items
  if (visibleItems.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Pressable style={styles.headerRow} onPress={toggleCollapsed}>
        <Ionicons name="sparkles" size={12} color={C.headerAccent} />
        <Text style={styles.headerTitle}>For You</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{allVisibleItems.length}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Ionicons
          name={collapsed ? 'chevron-forward' : 'chevron-down'}
          size={14}
          color={C.labelLight}
        />
      </Pressable>

      {/* Collapsible body */}
      {!collapsed && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {visibleItems.map((item) => (
            <ForYouCard
              key={item.id}
              item={item}
              isLoading={actionInProgress === item.id}
              onAction={() => handleAction(item)}
              onDismiss={() => handleDismiss(item)}
              onNavigate={() => handleCardPress(item)}
            />
          ))}
          {hasMore && !showAll && (
            <Pressable style={styles.seeAllCard} onPress={() => setShowAll(true)}>
              <Text style={styles.seeAllCount}>+{allVisibleItems.length - MAX_VISIBLE}</Text>
              <Text style={styles.seeAllLabel}>See all</Text>
              <Ionicons name="chevron-forward" size={14} color={C.headerAccent} />
            </Pressable>
          )}
        </ScrollView>
      )}

      <ForYouPreviewModal
        visible={previewItem !== null}
        item={previewItem}
        isActionLoading={previewItem ? actionInProgress === previewItem.id : false}
        onAdopt={() => previewItem && handleAction(previewItem)}
        onDismiss={() => previewItem && handleDismiss(previewItem)}
        onClose={() => setPreviewItem(null)}
      />
    </View>
  );
}

// =============================================================================
// CARD
// =============================================================================

function ForYouCard({
  item,
  isLoading,
  onAction,
  onDismiss,
  onNavigate,
}: {
  item: ForYouItem;
  isLoading: boolean;
  onAction: () => void;
  onDismiss: () => void;
  onNavigate?: () => void;
}) {
  const config = TYPE_CONFIG[item.type];

  return (
    <View style={styles.card}>
      <Pressable style={styles.cardContent} onPress={onNavigate}>
        {/* Type indicator */}
        <View style={[styles.typeIndicator, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon as any} size={10} color={config.color} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </Pressable>
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionBtn}
          onPress={onAction}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size={10} color={config.color} />
          ) : (
            <>
              <Ionicons
                name={item.type === 'join_org' ? 'enter-outline' : 'add-circle-outline'}
                size={12}
                color={config.color}
              />
              <Text style={[styles.actionText, { color: config.color }]}>
                {config.actionLabel}
              </Text>
            </>
          )}
        </Pressable>
        <Pressable style={styles.dismissBtn} onPress={onDismiss}>
          <Ionicons name="close" size={12} color={C.labelLight} />
        </Pressable>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 8 : 4,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: C.headerAccent,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: C.badgeBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: C.badgeText,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  card: {
    width: 170,
    backgroundColor: C.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 3,
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: C.labelDark,
    lineHeight: 16,
  },
  cardSubtitle: {
    fontSize: 10,
    color: C.labelMid,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.cardBorder,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 5,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dismissBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: C.cardBorder,
  },
  seeAllCard: {
    width: 100,
    backgroundColor: C.badgeBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(109,40,217,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  seeAllCount: {
    fontSize: 18,
    fontWeight: '700',
    color: C.headerAccent,
  },
  seeAllLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.headerAccent,
  },
});
