/**
 * /(tabs)/inbox — v3 Inbox tab (Screen 04 from the v3 screen designs).
 *
 * "Act / Read / Done. The Act headline is *suggestions waiting*; the Read
 * headline is *peer reflections*. Source is metadata."
 *
 * Verb-first triage with practice-grouping as the secondary cut. Suggestions
 * get a coral border-left (Discover-accent grammar); reflections get a lilac
 * border-left (AI/synthesis grammar). One-tap accept on every suggestion.
 *
 * v1 wiring reads from the existing inbox_items view via useInboxItems and
 * routes accept/decline through useInboxActions. Read and Done are skeletal
 * — peer_reflections schema lands in a follow-up.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { LayoutChangeEvent } from 'react-native';
import { useScrollToolbarHide } from '@/hooks/useScrollToolbarHide';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { useQueryClient } from '@tanstack/react-query';
import { useInboxItems } from '@/hooks/useInboxItems';
import { useFleetInvites, FLEET_INVITES_QUERY_KEY } from '@/hooks/useFleetInvites';
import { useNotifications } from '@/hooks/useNotifications';
import type { SocialNotification } from '@/services/NotificationService';
import type { NotificationGroup } from '@/lib/notifications/dedupe';
import { useAuth } from '@/providers/AuthProvider';
import { routeCohortDiscussionNotification } from '@/lib/notifications/routeDiscussionNotification';
import { fleetService, type FleetInvite } from '@/services/fleetService';
import { useInboxDoneItems } from '@/hooks/useInboxDoneItems';
import { useInboxActions } from '@/hooks/useInboxActions';
import type { InboxItem } from '@/components/practice/types';
import { SuggestStepComposer } from '@/components/sailor/SuggestStepComposer';
import { InterestSwitcher } from '@/components/InterestSwitcher';
import { useUniversalPlus } from '@/components/capture/UniversalPlusProvider';
import { LocationAnchor } from '@/components/ui/LocationAnchor';
import { HomeVenuePickerSheet } from '@/components/discover/HomeVenuePickerSheet';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';
import { useToast } from '@/components/ui/AppToast';
import { useUserHomeVenue, isSailingInterest } from '@/hooks/useUserHomeVenue';
import { useInterest } from '@/providers/InterestProvider';
import { Ionicons } from '@expo/vector-icons';

type Segment = 'act' | 'read' | 'done';

const CORAL = IOS_REGISTER.accentMarkedContent; // suggestion border-left
const LILAC = '#AF52DE'; // reflection / AI border-left

export default function InboxTabScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const [segment, setSegment] = useState<Segment>('act');

  // Deep-link tap on a cohort_discussion_post notification — resolve
  // the viewer's own forked timeline_step for the blueprint_step the
  // post lives on, then route to /step/[id]?scope=cohort so the
  // Discussion tab lands directly on the Cohort thread. Falls back to
  // a no-op when the viewer has no forked copy (Cohort tab wouldn't
  // render there anyway).
  const handleCohortNotificationTap = useCallback(
    (notification: SocialNotification) =>
      routeCohortDiscussionNotification(notification, user?.id),
    [user?.id],
  );
  const { data: fetched, isLoading } = useInboxItems();
  const { data: fleetInvitesFetched, isLoading: invitesLoading } = useFleetInvites();
  const inboxActions = useInboxActions();
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { data: doneFetched, isLoading: doneLoading } = useInboxDoneItems();

  // Option-4 Pass 2: the Inbox absorbs social notifications. They land
  // in the Read panel as an ACTIVITY group below peer reflections —
  // same surface, same archive grammar, one unified unread weight.
  //
  // We deliberately use RAW unread (every individual notification row)
  // rather than grouped unread (multi-notifications from one actor in
  // a 24h window collapsed to 1). The bell icon used the grouped count
  // for terseness, but inside the Inbox we render each row as its own
  // card — so the count must match what the user can actually see.
  const {
    unreadGroups,
    unreadGroupCount,
    isLoading: notifsLoading,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
    markGroupAsRead: markNotificationGroupAsRead,
  } = useNotifications();

  const items = useMemo(
    () => (fetched ?? []).filter((it) => !dismissedIds.has(it.id)),
    [fetched, dismissedIds],
  );
  const doneItems = useMemo(
    () => (doneFetched ?? []).filter((it) => !dismissedIds.has(it.id)),
    [doneFetched, dismissedIds],
  );

  // Split by kind: suggestions + on_deck → Act, reflections → Read.
  // Done is still a stub until per-user inbox state column lands.
  const actItems = useMemo(
    () => items.filter((it) => it.kind !== 'reflection'),
    [items],
  );
  const fleetInvites = useMemo(
    () => (fleetInvitesFetched ?? []).filter((iv) => !dismissedIds.has(iv.membershipId)),
    [fleetInvitesFetched, dismissedIds],
  );
  const readItems = useMemo(
    () => items.filter((it) => it.kind === 'reflection'),
    [items],
  );
  const actCount = actItems.length + fleetInvites.length;
  // Read segment count = active reflections + unread notification *groups*,
  // so the segment-pill total stays in sync with the bottom Inbox tab badge
  // (useInboxCount also counts groups) and with what the panel renders —
  // a burst of 15 blueprint-step notifications collapses to one digest row,
  // so it should add 1 to this count, not 15.
  const readCount = readItems.length + unreadGroupCount;

  // Practice grouping — design key is "the practice each item is about."
  // The closest analog in the current data model is the source step the
  // suggestion attaches to. Fold same-source items together. Items with
  // no step (free-form suggestions) group under their own title.
  const groups = useMemo(() => {
    const byKey = new Map<string, { title: string; items: InboxItem[] }>();
    actItems.forEach((it) => {
      const key = it.raw.sourceStepId || it.title;
      const existing = byKey.get(key);
      if (existing) {
        existing.items.push(it);
      } else {
        byKey.set(key, { title: it.title, items: [it] });
      }
    });
    return Array.from(byKey.values());
  }, [actItems]);

  const optimisticHide = (id: string) =>
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const handleAccept = (it: InboxItem) => {
    optimisticHide(it.id);
    inboxActions.accept(it).catch(() => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(it.id);
        return next;
      });
    });
  };
  const handleDecline = (it: InboxItem) => {
    optimisticHide(it.id);
    inboxActions.dismiss(it).catch(() => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(it.id);
        return next;
      });
    });
  };
  const handleArchive = (it: InboxItem) => {
    optimisticHide(it.id);
    inboxActions.archive(it).catch(() => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(it.id);
        return next;
      });
    });
  };

  const respondToInvite = (
    invite: FleetInvite,
    respond: (fleetId: string) => Promise<void>,
    onResolved?: () => void,
  ) => {
    optimisticHide(invite.membershipId);
    respond(invite.fleetId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: FLEET_INVITES_QUERY_KEY });
        onResolved?.();
      })
      .catch(() => {
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.delete(invite.membershipId);
          return next;
        });
      });
  };
  const handleAcceptInvite = (invite: FleetInvite) =>
    respondToInvite(invite, (id) => fleetService.acceptFleetInvite(id), () => {
      // Accepting silently empties the Act panel, which reads as "nothing
      // happened." Drop the user into Library › Groups — the joined group's
      // durable home — and back it with a success toast.
      toast.show(`You joined ${invite.fleetName}`, 'success');
      router.push('/(tabs)/library?zone=groups');
    });
  const handleDeclineInvite = (invite: FleetInvite) =>
    respondToInvite(invite, (id) => fleetService.declineFleetInvite(id));

  // Hide-on-scroll wiring for the in-screen header. The header is
  // overlaid (position:absolute) so when it translates up the body
  // content scrolls through the space behind it; scrolling back up
  // brings the header back into view.
  const { toolbarHidden, handleScroll } = useScrollToolbarHide();
  const [headerHeight, setHeaderHeight] = useState(170);
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - headerHeight) > 1) {
      setHeaderHeight(h);
    }
  }, [headerHeight]);
  const hideOffset = useSharedValue(0);
  useEffect(() => {
    // Translate by headerHeight + insets.top so the bottom edge of the
    // header (which sits at y = insets.top before the slide) clears
    // the safe-area band too. Without the +insets.top, the bottom of
    // the header (segment pills, etc.) stays visible behind the
    // dynamic island / clock when the user scrolls.
    hideOffset.value = withTiming(
      toolbarHidden ? -(headerHeight + insets.top) : 0,
      { duration: 200 },
    );
  }, [toolbarHidden, headerHeight, insets.top, hideOffset]);
  const headerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hideOffset.value }],
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Animated.View
          style={[
            styles.header,
            styles.headerOverlay,
            { top: insets.top },
            headerAnimStyle,
          ]}
          onLayout={onHeaderLayout}
        >
          {/* Top chrome row — interest pill on the left, action icons
              on the right. Matches CanvasTopBar's pattern so the same
              affordances (+, chat to /messages, avatar dropdown) are
              reachable from /inbox too. */}
          <InboxTopRow />
          <Text style={styles.title}>Inbox</Text>
          <View style={styles.segRow}>
            <SegmentPill
              label="Act"
              count={actCount}
              active={segment === 'act'}
              onPress={() => setSegment('act')}
            />
            <SegmentPill
              label="Read"
              count={readCount}
              active={segment === 'read'}
              onPress={() => setSegment('read')}
            />
            <SegmentPill
              label="Done"
              active={segment === 'done'}
              onPress={() => setSegment('done')}
            />
          </View>
        </Animated.View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={{
            paddingTop: headerHeight,
            paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + 32,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {segment === 'act' && (
            <ActPanel
              isLoading={isLoading || invitesLoading}
              suggestionCount={actItems.length}
              groups={groups}
              invites={fleetInvites}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onArchive={handleArchive}
              onAcceptInvite={handleAcceptInvite}
              onDeclineInvite={handleDeclineInvite}
            />
          )}
          {segment === 'read' && (
            <ReadPanel
              isLoading={isLoading}
              items={readItems}
              onArchive={handleArchive}
              notificationGroups={unreadGroups}
              notifsLoading={notifsLoading}
              notifUnreadCount={unreadGroupCount}
              onMarkNotificationRead={(id) => void markNotificationAsRead(id)}
              onMarkGroupRead={(ids) => void markNotificationGroupAsRead(ids)}
              onMarkAllNotificationsRead={() => void markAllNotificationsAsRead()}
              onCohortNotificationTap={handleCohortNotificationTap}
            />
          )}
          {segment === 'done' && (
            <DonePanel isLoading={doneLoading} items={doneItems} />
          )}
        </ScrollView>
      </View>
    </>
  );
}

/**
 * Inbox top-chrome row — interest pill on the left, action icons on
 * the right. Mirrors the CanvasTopBar pattern from /(tabs)/races. The
 * chat-bubble icon that used to live here was removed in v3 Pass 3:
 * messaging now flows through the Inbox itself (peer reflections +
 * activity), so a separate /messages entry-point on this surface
 * doubles up on grammar without adding a verb.
 */
function InboxTopRow() {
  const universalPlus = useUniversalPlus();
  const homeVenue = useUserHomeVenue();
  const { currentInterest } = useInterest();
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  // canGoBack() is true when the user arrived via router.push (e.g. tapped
  // the mail icon from Practice / Atlas). In that case, render a "Done"
  // affordance that returns them to the tab they came from. When they
  // arrived by tapping the bottom Inbox tab directly, history is empty
  // and we show the normal row.
  const canDismiss = router.canGoBack();
  return (
    <View style={styles.topRow}>
      <View style={styles.topRowLeft}>
        {canDismiss ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.topDoneBtn}
            accessibilityLabel="Close inbox and return"
          >
            <Text style={styles.topDoneBtnText}>Done</Text>
          </Pressable>
        ) : (
          <>
            <InterestSwitcher />
            {isSailingInterest(currentInterest?.slug) ? (
              <LocationAnchor
                region={homeVenue?.region}
                venue={homeVenue?.venue}
                onPress={() => setLocationPickerOpen(true)}
              />
            ) : null}
          </>
        )}
      </View>
      <View style={styles.topRowRight}>
        {universalPlus.isAvailable ? (
          <Pressable
            onPress={universalPlus.open}
            hitSlop={6}
            style={styles.topIconBtn}
            accessibilityLabel="Add"
          >
            <Ionicons name="add" size={22} color={IOS_REGISTER.label} />
          </Pressable>
        ) : null}
        <ProfileDropdown />
      </View>
      <HomeVenuePickerSheet
        visible={locationPickerOpen}
        onDismiss={() => setLocationPickerOpen(false)}
      />
    </View>
  );
}

function SegmentPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.seg, active && styles.segActive]}
    >
      <Text style={[styles.segLabel, active && styles.segLabelActive]}>
        {label}
        {count != null && count > 0 ? (
          <Text style={[styles.segCount, active && styles.segCountActive]}>
            {'  '}
            {count}
          </Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

function ActPanel({
  isLoading,
  suggestionCount,
  groups,
  invites,
  onAccept,
  onDecline,
  onArchive,
  onAcceptInvite,
  onDeclineInvite,
}: {
  isLoading: boolean;
  suggestionCount: number;
  groups: { title: string; items: InboxItem[] }[];
  invites: FleetInvite[];
  onAccept: (it: InboxItem) => void;
  onDecline: (it: InboxItem) => void;
  onArchive: (it: InboxItem) => void;
  onAcceptInvite: (iv: FleetInvite) => void;
  onDeclineInvite: (iv: FleetInvite) => void;
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
      </View>
    );
  }
  if (invites.length === 0 && groups.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Nothing waiting.</Text>
        <Text style={styles.emptyBody}>
          Suggestions from peers and AI surfacings land here.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {invites.length > 0 ? (
        <>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>FLEET INVITES</Text>
            <View style={styles.eyebrowPip}>
              <Text style={styles.eyebrowPipText}>{invites.length}</Text>
            </View>
          </View>
          {invites.map((iv) => (
            <FleetInviteCard
              key={iv.membershipId}
              invite={iv}
              onAccept={() => onAcceptInvite(iv)}
              onDecline={() => onDeclineInvite(iv)}
            />
          ))}
        </>
      ) : null}
      {groups.length > 0 ? (
        <>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>SUGGESTIONS WAITING</Text>
            <View style={styles.eyebrowPip}>
              <Text style={styles.eyebrowPipText}>{suggestionCount}</Text>
            </View>
          </View>
          {groups.map((g, idx) => (
            <View key={idx} style={styles.group}>
              <Text style={styles.groupHeader}>
                re: <Text style={styles.groupHeaderTitle}>{g.title}</Text>
                {g.items.length > 1 ? ` · ${g.items.length} suggestions` : ''}
              </Text>
              {g.items.map((it) => (
                <SuggestionCard
                  key={it.id}
                  item={it}
                  onAccept={() => onAccept(it)}
                  onDecline={() => onDecline(it)}
                  onArchive={() => onArchive(it)}
                />
              ))}
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function fleetInviteInitials(name: string | null): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '·';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '·';
}

function FleetInviteCard({
  invite,
  onAccept,
  onDecline,
}: {
  invite: FleetInvite;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const inviter = invite.inviterName?.trim() || 'A fleet captain';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: IOS_COLORS.systemGray3 }]}>
          <Text style={styles.avatarText}>{fleetInviteInitials(invite.inviterName)}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardFrom}>
            <Text style={styles.cardFromName}>{inviter}</Text>
            <Text style={styles.cardFromVerb}> invited you to a fleet</Text>
          </Text>
        </View>
        <Text style={styles.cardWhen}>{formatRelativeTime(invite.invitedAt)}</Text>
      </View>

      <Text style={styles.cardTitle}>{invite.fleetName}</Text>
      <Text style={styles.cardAttach}>
        join as <Text style={styles.cardAttachTitle}>{invite.role}</Text>
      </Text>

      <View style={styles.cardActions}>
        <Pressable onPress={onAccept} style={styles.actionPrimary}>
          <Text style={styles.actionPrimaryText}>Accept</Text>
        </Pressable>
        <Pressable onPress={onDecline} style={styles.actionSecondary}>
          <Text style={styles.actionSecondaryText}>Decline</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SuggestionCard({
  item,
  onAccept,
  onDecline,
  onArchive,
}: {
  item: InboxItem;
  onAccept: () => void;
  onDecline: () => void;
  onArchive: () => void;
}) {
  const sourceUserId = item.raw.sourceUserId;
  const sourceStepId = item.raw.sourceStepId;
  const goToSender = sourceUserId
    ? () => router.push(`/discover/person/${sourceUserId}` as never)
    : undefined;
  const openSourceStep = sourceStepId
    ? () => router.push(`/step/${sourceStepId}` as never)
    : undefined;
  // "Suggest back" — person-centric reciprocity. Pre-fills the
  // composer with the sender as recipient so the user can immediately
  // fire a suggestion back the other way. This is the canonical place
  // for the verb because the avatar is right there and the intent is
  // top-of-mind.
  const [composerOpen, setComposerOpen] = useState(false);
  const senderName =
    item.fromContext.split('·')[0]?.trim() || 'A teammate';

  return (
    <>
    <Swipeable
      friction={2}
      rightThreshold={48}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={onArchive} style={styles.swipeArchive}>
          <Text style={styles.swipeArchiveText}>Archive</Text>
        </Pressable>
      )}
    >
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Pressable
          onPress={goToSender}
          disabled={!goToSender}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={goToSender ? `Open ${item.fromContext}` : undefined}
          style={[styles.avatar, { backgroundColor: item.fromTint || IOS_COLORS.systemGray3 }]}
        >
          <Text style={styles.avatarText}>{item.fromInitials || '·'}</Text>
        </Pressable>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardFrom}>
            <Text style={styles.cardFromName}>
              {item.fromContext.split('·')[0]?.trim() || 'A teammate'}
            </Text>
            <Text style={styles.cardFromVerb}>
              {' '}
              {item.kind === 'on_deck' ? 'saved a step' : 'suggested a step'}
            </Text>
          </Text>
          {item.fromEmail ? (
            <Text style={styles.cardFromEmail} numberOfLines={1}>
              {item.fromEmail}
            </Text>
          ) : null}
        </View>
        <Text style={styles.cardWhen}>{item.when}</Text>
      </View>

      <Text style={styles.cardTitle}>{item.title}</Text>
      {item.blurb ? <Text style={styles.cardBody}>{item.blurb}</Text> : null}
      <Text style={styles.cardAttach}>
        would attach to <Text style={styles.cardAttachTitle}>{item.title}</Text>
      </Text>

      <View style={styles.cardActions}>
        <Pressable onPress={onAccept} style={styles.actionPrimary}>
          <Text style={styles.actionPrimaryText}>Accept</Text>
        </Pressable>
        <Pressable onPress={onDecline} style={styles.actionSecondary}>
          <Text style={styles.actionSecondaryText}>Decline</Text>
        </Pressable>
        {sourceUserId ? (
          <Pressable
            onPress={() => setComposerOpen(true)}
            style={styles.actionSecondary}
            accessibilityRole="button"
            accessibilityLabel={`Suggest a step back to ${senderName}`}
          >
            <Text style={styles.actionSecondaryText}>Suggest back</Text>
          </Pressable>
        ) : null}
        {openSourceStep ? (
          <Pressable onPress={openSourceStep} style={styles.actionLink} hitSlop={4}>
            <Text style={styles.actionLinkText}>Open</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
    </Swipeable>
    {sourceUserId ? (
      <SuggestStepComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        recipientId={sourceUserId}
        recipientName={senderName}
        recipientInitials={item.fromInitials}
        recipientTint={item.fromTint}
        reContext={item.title}
      />
    ) : null}
    </>
  );
}

function ReadPanel({
  isLoading,
  items,
  onArchive,
  notificationGroups,
  notifsLoading,
  notifUnreadCount,
  onMarkNotificationRead,
  onMarkGroupRead,
  onMarkAllNotificationsRead,
  onCohortNotificationTap,
}: {
  isLoading: boolean;
  items: InboxItem[];
  onArchive: (it: InboxItem) => void;
  notificationGroups: NotificationGroup[];
  notifsLoading: boolean;
  notifUnreadCount: number;
  onMarkNotificationRead: (id: string) => void;
  onMarkGroupRead: (ids: string[]) => void;
  onMarkAllNotificationsRead: () => void;
  onCohortNotificationTap: (notification: SocialNotification) => void | Promise<void>;
}) {
  if (isLoading && notifsLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
      </View>
    );
  }

  const hasReflections = items.length > 0;
  const hasNotifications = notificationGroups.length > 0;

  if (!hasReflections && !hasNotifications) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Nothing to read yet.</Text>
        <Text style={styles.emptyBody}>
          Peer reflections and system activity will land here when they
          come in.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {hasReflections ? (
        <>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>PEER REFLECTIONS</Text>
            <View style={[styles.eyebrowPip, { backgroundColor: LILAC }]}>
              <Text style={styles.eyebrowPipText}>{items.length}</Text>
            </View>
          </View>
          <View style={styles.group}>
            {items.map((it) => (
              <ReflectionCard
                key={it.id}
                item={it}
                onArchive={() => onArchive(it)}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasNotifications ? (
        <>
          <View style={[styles.eyebrowRow, hasReflections && styles.eyebrowRowSpace]}>
            <Text style={styles.eyebrow}>ACTIVITY</Text>
            {notifUnreadCount > 0 ? (
              <View style={[styles.eyebrowPip, { backgroundColor: IOS_REGISTER.accentUserAction }]}>
                <Text style={styles.eyebrowPipText}>{notifUnreadCount}</Text>
              </View>
            ) : null}
            {notifUnreadCount > 0 ? (
              <Pressable
                onPress={onMarkAllNotificationsRead}
                hitSlop={6}
                style={styles.markAllPill}
              >
                <Text style={styles.markAllPillText}>Mark all read</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.group}>
            {notificationGroups.map((group) =>
              group.count > 1 ? (
                <DigestCard
                  key={group.latest.id}
                  group={group}
                  onMarkGroupRead={() => onMarkGroupRead(group.ids)}
                  onOpenMember={(n) => {
                    if (!n.isRead) onMarkNotificationRead(n.id);
                    routeNotificationTap(n, onCohortNotificationTap);
                  }}
                />
              ) : (
                <ActivityCard
                  key={group.latest.id}
                  notification={group.latest}
                  onPress={() => {
                    if (!group.latest.isRead) onMarkNotificationRead(group.latest.id);
                    routeNotificationTap(group.latest, onCohortNotificationTap);
                  }}
                />
              ),
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

function ActivityCard({
  notification,
  onPress,
}: {
  notification: SocialNotification;
  onPress: () => void;
}) {
  const initials = (notification.actorName ?? '··')
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || '··';
  const tint = notification.actorAvatarColor ?? IOS_REGISTER.labelSecondary;
  const relativeTime = formatRelativeTime(notification.createdAt);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        styles.cardActivity,
        !notification.isRead && styles.cardActivityUnread,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.activityAvatar, { backgroundColor: tint }]}>
          <Text style={styles.activityAvatarText}>
            {notification.actorAvatarEmoji ?? initials}
          </Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.activityTitle} numberOfLines={2}>
            {notification.title}
          </Text>
          {notification.body ? (
            <Text style={styles.activityBody} numberOfLines={2}>
              {notification.body}
            </Text>
          ) : null}
        </View>
        <Text style={styles.activityWhen}>{relativeTime}</Text>
      </View>
    </Pressable>
  );
}

// Digest card — collapses an unread burst (e.g. one author publishing 15
// blueprint steps) into a single thread. Headline is the shared title +
// a count chip; each member's body becomes a glanceable preview line.
// First 3 show by default; the rest expand in place. The whole group
// marks read together.
const DIGEST_PREVIEW_LIMIT = 3;

function notificationInitials(name: string | null | undefined): string {
  return (name ?? '··')
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || '··';
}

function DigestCard({
  group,
  onMarkGroupRead,
  onOpenMember,
}: {
  group: NotificationGroup;
  onMarkGroupRead: () => void;
  onOpenMember: (n: SocialNotification) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const latest = group.latest;
  const tint = latest.actorAvatarColor ?? IOS_REGISTER.labelSecondary;
  const visible = expanded
    ? group.members
    : group.members.slice(0, DIGEST_PREVIEW_LIMIT);
  const remaining = group.count - DIGEST_PREVIEW_LIMIT;

  return (
    <View
      style={[
        styles.card,
        styles.cardActivity,
        group.hasUnread && styles.cardActivityUnread,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.activityAvatar, { backgroundColor: tint }]}>
          <Text style={styles.activityAvatarText}>
            {latest.actorAvatarEmoji ?? notificationInitials(latest.actorName)}
          </Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.activityTitle} numberOfLines={2}>
            {latest.title}
          </Text>
        </View>
        <View style={styles.digestCountChip}>
          <Text style={styles.digestCountChipText}>{group.count}</Text>
        </View>
      </View>

      <View style={styles.digestPreview}>
        {visible.map((member) => (
          <Pressable
            key={member.id}
            onPress={() => onOpenMember(member)}
            style={styles.digestLine}
          >
            <View style={styles.digestBullet} />
            <Text style={styles.digestLineText} numberOfLines={1}>
              {member.body || member.title}
            </Text>
            <Text style={styles.digestLineWhen}>
              {formatRelativeTime(member.createdAt)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.digestFoot}>
        {remaining > 0 ? (
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6}>
            <Text style={styles.digestFootLink}>
              {expanded ? 'Show less' : `+ ${remaining} more`}
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={onMarkGroupRead} hitSlop={6} style={styles.markAllPill}>
          <Text style={styles.markAllPillText}>Mark read</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Activity-row tap routing. Mirrors the canonical per-type mapping in
// app/social-notifications.tsx, plus the two discussion-post cases that
// only the Inbox surfaces. Types with no meaningful destination
// (step_suggested — acted on via the Act panel) intentionally no-op.
function routeNotificationTap(
  n: SocialNotification,
  onCohortNotificationTap: (notification: SocialNotification) => void | Promise<void>,
): void {
  const stepId = n.data?.step_id as string | undefined;
  switch (n.type) {
    case 'cohort_discussion_post':
      void onCohortNotificationTap(n);
      return;
    case 'step_discussion_post':
      // Personal-step posts live on the same timeline_step for owner +
      // collaborators. Route to the timeline card (the canonical step
      // surface) with the Discussion tab open, not the standalone screen.
      if (stepId)
        router.push({
          pathname: '/(tabs)/races',
          params: { selected: stepId, tab: 'discussion' },
        } as never);
      return;
    case 'followed_user_step_completed':
    case 'step_reviewed':
      if (stepId) router.push(`/step/${stepId}` as never);
      else router.push('/(tabs)/races' as never);
      return;
    case 'step_collaborator_added':
      if (stepId) router.push(`/step/${stepId}` as never);
      return;
    case 'new_follower':
      if (n.actorId) router.push(`/sailor/${n.actorId}` as never);
      return;
    case 'org_invite_received':
      if (n.data?.invite_token) router.push(`/invite/${n.data.invite_token}` as never);
      return;
    case 'org_membership_approved':
      router.push({
        pathname: '/onboarding/org-welcome',
        params: {
          orgId: n.data?.organization_id,
          orgName: n.data?.organization_name,
        },
      } as never);
      return;
    case 'org_invite_accepted':
      if (n.data?.organization_id) router.push('/organization/members' as never);
      return;
    default:
      if (n.regattaId) router.push(`/race/${n.regattaId}` as never);
  }
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

function ReflectionCard({
  item,
  onArchive,
}: {
  item: InboxItem;
  onArchive: () => void;
}) {
  const sourceUserId = item.raw.sourceUserId;
  const goToSender = sourceUserId
    ? () => router.push(`/discover/person/${sourceUserId}` as never)
    : undefined;
  return (
    <Swipeable
      friction={2}
      rightThreshold={48}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={onArchive} style={styles.swipeArchive}>
          <Text style={styles.swipeArchiveText}>Archive</Text>
        </Pressable>
      )}
    >
    <View style={[styles.card, styles.cardReflection]}>
      <View style={styles.cardHeader}>
        <Pressable
          onPress={goToSender}
          disabled={!goToSender}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={goToSender ? `Open ${item.fromContext}` : undefined}
          style={[styles.avatar, { backgroundColor: item.fromTint || LILAC }]}
        >
          <Text style={styles.avatarText}>{item.fromInitials || '·'}</Text>
        </Pressable>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardFrom}>
            <Text style={styles.cardFromName}>{item.fromContext}</Text>
            <Text style={styles.cardFromVerb}> reflected on </Text>
            <Text style={styles.cardFromName}>{item.title}</Text>
          </Text>
        </View>
        <Text style={styles.cardWhen}>{item.when}</Text>
      </View>

      {item.blurb ? (
        <Text style={styles.cardReflectionBody}>"{item.blurb}"</Text>
      ) : null}
    </View>
    </Swipeable>
  );
}

function DonePanel({
  isLoading,
  items,
}: {
  isLoading: boolean;
  items: InboxItem[];
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Nothing here.</Text>
        <Text style={styles.emptyBody}>
          Accepted and dismissed items archive here.
        </Text>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>DONE</Text>
      </View>
      <View style={styles.group}>
        {items.map((it) => (
          <DoneCard key={it.id} item={it} />
        ))}
      </View>
    </View>
  );
}

function DoneCard({ item }: { item: InboxItem }) {
  const isReflection = item.kind === 'reflection';
  return (
    <View
      style={[
        styles.card,
        styles.cardDone,
        isReflection && styles.cardReflection,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: item.fromTint || IOS_COLORS.systemGray3 }]}>
          <Text style={styles.avatarText}>{item.fromInitials || '·'}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardFrom}>
            <Text style={styles.cardFromName}>{item.fromContext}</Text>
            <Text style={styles.cardFromVerb}>
              {isReflection ? ' · archived reflection' : ` · ${item.chipLabel.toLowerCase()}`}
            </Text>
          </Text>
        </View>
        <Text style={styles.cardWhen}>{item.when}</Text>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      {item.blurb ? <Text style={styles.cardBody}>{item.blurb}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  header: {
    backgroundColor: IOS_REGISTER.cardBg,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  headerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
  },
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topDoneBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  topDoneBtnText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 32,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.4,
  },
  segRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  seg: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  segActive: {
    backgroundColor: IOS_REGISTER.label,
  },
  segLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  segLabelActive: {
    color: '#FFFFFF',
  },
  segCount: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  segCountActive: {
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 18,
    paddingBottom: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
  },
  eyebrowPip: {
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: CORAL,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowPipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  eyebrowRowSpace: {
    paddingTop: 28,
  },
  markAllPill: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  markAllPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
  cardActivity: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderLeftWidth: 3,
    borderLeftColor: IOS_REGISTER.separator,
  },
  cardActivityUnread: {
    borderLeftColor: IOS_REGISTER.accentUserAction,
  },
  activityAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  activityTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    lineHeight: 18,
  },
  activityBody: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  activityWhen: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_REGISTER.labelTertiary,
    marginLeft: 6,
    fontVariant: ['tabular-nums'],
  },
  digestCountChip: {
    minWidth: 22,
    height: 20,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  digestCountChipText: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    fontVariant: ['tabular-nums'],
  },
  digestPreview: {
    marginTop: 8,
    marginLeft: 40,
  },
  digestLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  digestBullet: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.labelTertiary,
    flexShrink: 0,
  },
  digestLineText: {
    flex: 1,
    fontSize: 13.5,
    color: IOS_REGISTER.label,
    fontWeight: '500',
  },
  digestLineWhen: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_REGISTER.labelTertiary,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  digestFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginLeft: 40,
  },
  digestFootLink: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
  group: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 6,
  },
  groupHeader: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  groupHeaderTitle: {
    fontStyle: 'italic',
    color: IOS_REGISTER.label,
  },
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: CORAL,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardReflection: {
    borderLeftColor: LILAC,
  },
  cardDone: {
    opacity: 0.7,
    borderLeftColor: IOS_REGISTER.separatorStrong,
  },
  swipeArchive: {
    backgroundColor: IOS_COLORS.systemRed,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
    borderRadius: 14,
  },
  swipeArchiveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cardReflectionBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    fontStyle: 'italic',
    color: IOS_REGISTER.label,
    fontFamily: fontFamily.serif,
    letterSpacing: -0.1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardFrom: {
    fontSize: 14,
    color: IOS_REGISTER.label,
  },
  cardFromName: {
    fontWeight: '600',
  },
  cardFromVerb: {
    color: IOS_REGISTER.labelSecondary,
  },
  cardFromEmail: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 1,
  },
  cardWhen: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_REGISTER.labelTertiary,
    fontVariant: ['tabular-nums'],
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginTop: 8,
    letterSpacing: -0.2,
  },
  cardBody: {
    fontSize: 14,
    color: IOS_REGISTER.label,
    marginTop: 4,
    lineHeight: 19,
  },
  cardAttach: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 8,
  },
  cardAttachTitle: {
    fontStyle: 'italic',
    color: IOS_REGISTER.label,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionPrimary: {
    backgroundColor: IOS_REGISTER.label,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionSecondary: {
    backgroundColor: IOS_REGISTER.fillPill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  actionSecondaryText: {
    color: IOS_REGISTER.label,
    fontSize: 13,
    fontWeight: '600',
  },
  actionLink: {
    paddingHorizontal: 6,
    paddingVertical: 7,
    marginLeft: 'auto',
  },
  actionLinkText: {
    color: IOS_COLORS.systemBlue,
    fontSize: 13,
    fontWeight: '500',
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingTop: 64,
    paddingHorizontal: IOS_SPACING.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 13.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
});
