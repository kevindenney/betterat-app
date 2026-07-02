import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('social, discovery, messaging, and community workflow contracts', () => {
  it('keeps legacy Discover links routed to canonical Library, Watch, and Atlas homes', () => {
    const source = read('app/(tabs)/discover.tsx');

    expect(source).toContain("raw === 'organizations' ? 'orgs'");
    expect(source).toContain("raw === 'blueprints' ? 'plans'");
    expect(source).toContain("href = '/(tabs)/watch'");
    expect(source).toContain("href = '/(tabs)/atlas'");
    expect(source).toContain("href = '/(tabs)/library?zone=follow'");
    expect(source).toContain("href = '/(tabs)/library?zone=orgs'");
    expect(source).toContain("href = '/(tabs)/library?zone=interests'");
    expect(source).toContain("href = '/(tabs)/library?zone=today'");
  });

  it('keeps the full-screen discovery feed follow, refresh, pagination, and platform template actions', () => {
    const source = read('components/discover/DiscoverScreen.tsx');

    expect(source).toContain('useDiscoveryFeed()');
    expect(source).toContain('transformToFullScreenData(feedItems)');
    expect(source).toContain('onToggleFollow={handleToggleFollow}');
    expect(source).toContain('onRefresh={handleRefresh}');
    expect(source).toContain('onLoadMore={handleLoadMore}');
    expect(source).toContain('hasMore && !isLoadingMore');
    expect(source).toContain("Platform.OS === 'ios'");
    expect(source).toContain('ActionSheetIOS.showActionSheetWithOptions');
    expect(source).toContain('showAlertWithButtons');
    expect(source).toContain("pathname: '/(tabs)/practice'");
  });

  it('keeps person detail follow, self-profile, public sections, and suggestion actions intact', () => {
    const source = read('app/discover/person/[userId].tsx');

    expect(source).toContain('usePersonPublicSections(userId)');
    expect(source).toContain(".from('profiles')");
    expect(source).toContain(".from('user_follows')");
    expect(source).toContain(".eq('follower_id', user.id)");
    expect(source).toContain(".eq('following_id', userId)");
    expect(source).toContain("label=\"This is you · Edit profile\"");
    expect(source).toContain("label=\"Following\"");
    expect(source).toContain('showConfirm(');
    expect(source).toContain('setComposerOpen(true)');
    expect(source).toContain("router.push('/settings/edit-profile'");
  });

  it('keeps people search segmented by suggestions, contacts, QR, and non-sailing demo peers', () => {
    const source = read('components/search/SailorSearchContent.tsx');

    expect(source).toContain("type SailorSubTab = 'suggested' | 'contacts' | 'qr'");
    expect(source).toContain('useInterestEventConfig()');
    expect(source).toContain("eventConfig.interestSlug === 'sail-racing'");
    expect(source).toContain('getConnectDemoData(eventConfig.interestSlug)');
    expect(source).toContain('searchQuery.trim().toLowerCase()');
    expect(source).toContain('<SuggestedSailorsSection searchQuery={searchQuery} />');
    expect(source).toContain('<InviteFriendsBanner />');
    expect(source).toContain('<ProfileQRCodeSection userId={user.id} />');
    expect(source).toContain('setDemoFollowedIds((prev) =>');
  });

  it('keeps messages hub filtering, search, thread creation, and valid crew/fleet shortcuts', () => {
    const messagesSource = read('app/messages.tsx');
    const listSource = read('components/crew/CrewThreadList.tsx');
    const newChatSource = read('components/crew/NewChatSheet.tsx');
    const crewFinderSource = read('components/crew/CrewMemberFinderModal.tsx');
    const hookSource = read('hooks/useCrewThreads.ts');

    expect(messagesSource).toContain("type FilterTab = 'all' | 'unread' | 'groups'");
    expect(messagesSource).toContain("threads.filter((t) => t.unreadCount > 0)");
    expect(messagesSource).toContain("threads.filter((t) => t.threadType !== 'direct')");
    expect(messagesSource).toContain('searchQuery={searchQuery}');
    expect(messagesSource).toContain('router.push(`/crew-thread/${threadId}`)');
    expect(messagesSource).toContain('<NewChatSheet');

    expect(listSource).toContain('searchQuery.trim()');
    expect(listSource).toContain('t.otherUser?.fullName?.toLowerCase()');
    expect(listSource).toContain('thread.unreadCount > 99 ?');
    expect(listSource).toContain("router.push(`/crew-thread/${thread.id}`)");

    expect(newChatSource).toContain("type SheetMode = 'menu' | 'direct' | 'group'");
    expect(newChatSource).toContain('<ContactPicker');
    expect(newChatSource).toContain('<GroupCreationFlow');
    expect(newChatSource).toContain("router.push('/(tabs)/fleet')");
    expect(newChatSource).toContain("router.push('/crew')");
    expect(newChatSource).not.toContain("router.push('/(tabs)/crew')");

    expect(crewFinderSource).toContain('BetterAt user');
    expect(crewFinderSource).toContain('Be the first to join BetterAt!');
    expect(crewFinderSource).toContain('placeholder="Search BetterAt users..."');
    expect(crewFinderSource).not.toContain('RegattaFlow user');
    expect(crewFinderSource).not.toContain('Be the first to join RegattaFlow!');
    expect(crewFinderSource).not.toContain('Search RegattaFlow users');

    expect(hookSource).toContain('CrewThreadService.getMyThreads()');
    expect(hookSource).toContain('refetchInterval: 60 * 1000');
  });

  it('keeps crew thread chat owner/admin actions, member modals, and platform rename behavior', () => {
    const source = read('app/crew-thread/[id].tsx');

    expect(source).toContain('useCrewThreadMessages({ threadId: id })');
    expect(source).toContain('CrewThreadService.getThread(id)');
    expect(source).toContain('const isOwner = thread?.ownerId === user?.id');
    expect(source).toContain("const isAdmin = thread?.role === 'admin'");
    expect(source).toContain('label: \'View Members\'');
    expect(source).toContain('label: \'Add Member\'');
    expect(source).toContain('label: \'Edit Thread\'');
    expect(source).toContain('label: \'Leave Thread\'');
    expect(source).toContain('label: \'Delete Thread\'');
    expect(source).toContain("Platform.OS === 'ios' && typeof Alert.prompt === 'function'");
    expect(source).toContain('showConfirm(');
    expect(source).toContain('<ThreadMembersModal');
    expect(source).toContain('<AddMemberModal');
  });

  it('keeps Activity notifications grouped/raw modes, message previews, follow suggestions, and destination routing', () => {
    const source = read('app/social-notifications.tsx');

    expect(source).toContain("useState<'grouped' | 'all'>('grouped')");
    expect(source).toContain("window.localStorage.getItem('betterat.notifications.viewMode')");
    expect(source).toContain('groupGroupedNotificationsByTime(groupedNotifications)');
    expect(source).toContain('groupRawNotificationsByTime(rawNotifications)');
    expect(source).toContain('markGroupAsRead(item.ids)');
    expect(source).toContain('markAsRead(latest.id)');
    expect(source).toContain('deleteNotification(latest.id)');
    expect(source).toContain('CrewFinderService.followUser(user.id, actorId)');
    expect(source).toContain('CrewFinderService.unfollowUser(user.id, actorId)');
    expect(source).toContain("router.push('/messages')");
    expect(source).toContain("router.push('/(tabs)/connect')");
    expect(source).toContain('routeCohortDiscussionNotification');
  });

  it('keeps crew finder fallback reasons BetterAt-branded', () => {
    const source = read('services/CrewFinderService.ts');

    expect(source).toContain("similarityReasons: ['On BetterAt']");
    expect(source).not.toContain("similarityReasons: ['On RegattaFlow']");
  });

  it('keeps Inbox as one attention surface for actions, messages, and activity', () => {
    const source = read('app/(tabs)/inbox.tsx');
    const countSource = read('hooks/useInboxCount.ts');

    expect(source).not.toContain("type Segment = 'act' | 'read' | 'done'");
    expect(source).toContain('<InboxSummaryPill label="Needs action"');
    expect(source).toContain('<InboxSummaryPill label="Unread"');
    expect(source).toContain('<ActPanel');
    expect(source).toContain('<ReadPanel');
    expect(source).toContain('useInboxItems()');
    expect(source).toContain('useFleetInvites()');
    expect(source).toContain('useCrewThreads()');
    expect(source).not.toContain('useInboxDoneItems()');
    expect(source).toContain('useInboxActions()');
    expect(source).toContain('unreadGroups');
    expect(source).toContain("group.latest.type !== 'new_message'");
    expect(source).toContain('<MessageThreadCard');
    expect(source).toContain('router.push(`/crew-thread/${thread.id}`');
    expect(source).toContain('markNotificationAsRead');
    expect(source).toContain('markAllNotificationsAsRead');
    expect(source).toContain('markNotificationGroupAsRead');
    expect(source).toContain('fleetService.acceptFleetInvite(id)');
    expect(source).toContain('fleetService.declineFleetInvite(id)');
    expect(source).toContain("router.push('/(tabs)/library?zone=groups')");
    expect(source).toContain('<SuggestStepComposer');
    expect(countSource).toContain('useCrewThreads()');
    expect(countSource).toContain("group.latest.type !== 'new_message'");
  });

  it('keeps community discovery, create, join/leave, post filters, and feed pagination intact', () => {
    const detailSource = read('app/community/[slug].tsx');
    const createSource = read('app/community/create.tsx');
    const feedSource = read('components/venue/feed/CommunityFeed.tsx');

    expect(detailSource).toContain('useCommunityBySlug(slug)');
    expect(detailSource).toContain('useJoinCommunity()');
    expect(detailSource).toContain('useLeaveCommunity()');
    expect(detailSource).toContain('router.replace(`/venue/post/${postIdParam}`');
    expect(detailSource).toContain("pathname: '/(auth)/login'");
    expect(detailSource).toContain('returnTo = `/community/${slug}`');
    expect(detailSource).toContain("Platform.OS === 'ios'");
    expect(detailSource).toContain('ActionSheetIOS.showActionSheetWithOptions');
    expect(detailSource).toContain('router.push(`/venue/post/${post.id}`)');
    expect(detailSource).toContain('router.push(`/venue/post/create?${params.toString()}`)');

    expect(createSource).toContain('useCreateCommunity()');
    expect(createSource).toContain('useCommunityCategories()');
    expect(createSource).toContain('name.trim().length < 3');
    expect(createSource).toContain('router.replace(`/community/${community.slug}`)');
    expect(createSource).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");
    expect(createSource).toContain('Discard Changes?');

    expect(feedSource).toContain('useCommunityFeed(venueId');
    expect(feedSource).toContain('useTopicTags()');
    expect(feedSource).toContain('hasNextPage && !isFetchingNextPage');
    expect(feedSource).toContain('fetchNextPage()');
    expect(feedSource).toContain('onRefresh={() => refetch()}');
    expect(feedSource).toContain('showConditionMatch={sort === \'conditions_match\'}');
  });

  it('keeps notification service read/delete/preferences/realtime ownership guards', () => {
    const source = read('services/NotificationService.ts');

    expect(source).toContain('export type SocialNotificationType =');
    expect(source).toContain('normalizeMembershipDecisionType(');
    expect(source).toContain('async markAsRead(userId: string, notificationId: string)');
    expect(source).toContain(".eq('id', notificationId)");
    expect(source).toContain(".eq('user_id', userId)");
    expect(source).toContain("throw new Error('Notification not found.')");
    expect(source).toContain('async markAllAsRead(userId: string)');
    expect(source).toContain('async deleteNotification(');
    expect(source).toContain('async updatePreferences(');
    expect(source).toContain('subscribeToNotifications(');
    expect(source).toContain('backfillNotificationsAfterReconnect');
    expect(source).toContain('this.realtimeUserId !== userId');
  });
});
