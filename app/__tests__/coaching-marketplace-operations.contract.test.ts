import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('coaching marketplace and operations workflow contracts', () => {
  it('keeps coach discovery and profile booking handoff intact', () => {
    const discovery = readSource('app/coach/discover.tsx');
    const profile = readSource('app/coach/[id].tsx');
    const hub = readSource('app/(tabs)/coaching.tsx');

    expect(discovery).toContain('type CoachingStatus =');
    expect(discovery).toContain("type SortKey = 'rating' | 'sessions' | 'price' | 'name'");
    expect(discovery).toContain('scoreCoach(');
    expect(discovery).toContain('SKILL_CHIPS');
    expect(discovery).toContain('runAIMatching');
    expect(discovery).toContain('TufteFiltersBar');
    expect(discovery).toContain('TufteCoachRow');

    expect(profile).toContain('getCoachPublicProfile(id)');
    expect(profile).toContain('getAvailabilitySlots(');
    expect(profile).toContain('getBlockedDates(id)');
    expect(profile).toContain('isDateBlocked(day.dateString)');
    expect(profile).toContain("pathname: '/coach/book'");
    expect(profile).toContain('hourlyRate: coach.hourly_rate_usd?.toString() || \'0\'');

    expect(hub).toContain('CoachDashboard');
    expect(hub).toContain('useUpcomingCoachSessions');
    expect(hub).toContain('useCoachMetrics');
    expect(hub).toContain('useCoachResources');
  });

  it('keeps coach recruitment and public coach landing copy branded for BetterAt', () => {
    const hub = readSource('app/(tabs)/coaching.tsx');
    const sailorDiscovery = readSource('components/learn/coaches/SailorDiscoveryView.tsx');
    const recruitment = readSource('hooks/useCoachRecruitment.ts');
    const landing = readSource('app/coaches.tsx');
    const recruitmentUserFacingCopy = recruitment.replace(
      "const DISMISSAL_STORAGE_KEY = '@regattaflow/coach-recruitment-dismissals';",
      '',
    );

    expect(hub).toContain('build your reputation on BetterAt.');
    expect(hub).toContain('coaching sailors worldwide on BetterAt.');
    expect(hub).not.toContain('on RegattaFlow.');

    expect(sailorDiscovery).toContain('become a BetterAt coach.');
    expect(sailorDiscovery).toContain('build your reputation on BetterAt.');
    expect(sailorDiscovery).not.toContain('become a RegattaFlow coach');

    expect(recruitmentUserFacingCopy).toContain('become a BetterAt coach');
    expect(recruitmentUserFacingCopy).not.toContain('RegattaFlow coach');

    expect(landing).toContain('<Text style={styles.logoText}>BetterAt</Text>');
  });

  it('keeps sailor booking requests priced with add-ons and delayed payment messaging', () => {
    const booking = readSource('app/coach/book.tsx');
    const service = readSource('services/CoachingService.ts');
    const myBookings = readSource('app/coach/my-bookings.tsx');

    expect(booking).toContain('const calculateSessionCost = () =>');
    expect(booking).toContain('selectedChargeIds.forEach(chargeId =>');
    expect(booking).toContain('const selectedCharges = selectedChargeIds');
    expect(booking).toContain('coachingService.createBookingRequest(');
    expect(booking).toContain('totalAmountCents: totalCostCents');
    expect(booking).toContain('customCharges: selectedCharges');
    expect(booking).toContain('Payment will be processed after the coach accepts your request.');
    expect(booking).toContain("router.push('/coach/my-bookings')");

    expect(service).toContain('async createBookingRequest(');
    expect(service).toContain('customCharges?: CustomCharge[];');
    expect(service).toContain(".from('session_bookings')");
    expect(service).toContain("status: 'pending'");
    expect(service).toContain('sendCoachNotification');
    expect(service).toContain('New Session Request');

    expect(myBookings).toContain('getSailorBookingRequests(statusFilter)');
    expect(myBookings).toContain('getSailorSessions()');
    expect(myBookings).toContain("coachingService.cancelBookingRequest(bookingId, 'Cancelled by sailor')");
    expect(myBookings).toContain("router.push('/coach/discover')");
  });

  it('keeps coach availability and pricing management guarded against accidental loss', () => {
    const availability = readSource('app/coach/availability.tsx');
    const pricing = readSource('app/coach/pricing.tsx');
    const service = readSource('services/CoachingService.ts');

    expect(availability).toContain('useCoachWorkspace');
    expect(availability).toContain('getCoachWeeklyAvailability(coachId)');
    expect(availability).toContain('getBlockedDates(coachId)');
    expect(availability).toContain('toggleAcceptingClients');
    expect(availability).toContain('updateAcceptingClients(coachId, newValue)');
    expect(availability).toContain('toggleTimeBlock');
    expect(availability).toContain('addBlockedDate(coachId, {');
    expect(availability).toContain('deleteBlockedDate(blocked.id)');
    expect(availability).toContain("'Unsaved Changes'");
    expect(availability).toContain("paddingTop: Platform.OS === 'ios' ? 60 : 20");

    expect(pricing).toContain('const PLATFORM_FEE = 0.15;');
    expect(pricing).toContain('const getNetRate = (rate: string) =>');
    expect(pricing).toContain('coachingService.getCoachPricing(coachId)');
    expect(pricing).toContain('coachingService.updateCoachPricing(coachId, updates)');
    expect(pricing).toContain('custom_charges: customCharges');
    expect(pricing).toContain('id: crypto.randomUUID()');
    expect(pricing).toContain("'Delete Charge'");
    expect(pricing).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");

    expect(service).toContain('async updateCoachPricing(');
    expect(service).toContain('async addBlockedDate(');
    expect(service).toContain('async deleteBlockedDate(');
  });

  it('keeps coach session cancellation, completion, summary, and messaging flows intact', () => {
    const cancelSession = readSource('app/coach/cancel-session.tsx');
    const completeSession = readSource('app/coach/complete-session.tsx');
    const messages = readSource('app/coach/messages.tsx');
    const conversation = readSource('app/coach/conversation/[id].tsx');
    const service = readSource('services/CoachingService.ts');
    const messaging = readSource('services/MessagingService.ts');
    const hooks = readSource('hooks/useMessaging.ts');

    expect(cancelSession).toContain('coachingService.getSessionDetails(params.sessionId)');
    expect(cancelSession).toContain('coachingService.calculateRefundAmount(');
    expect(cancelSession).toContain("coachingService.cancelSession(params.sessionId, 'coach', reasonText)");
    expect(cancelSession).toContain("'Missing Reason'");
    expect(cancelSession).toContain("'Cancel Session?'");

    expect(completeSession).toContain('coachingService.getSessionDetails(params.sessionId)');
    expect(completeSession).toContain("'Missing Notes'");
    expect(completeSession).toContain('coachingService.completeSessionWithNotes(params.sessionId, {');
    expect(completeSession).toContain("'Session Completed'");
    expect(completeSession).toContain('coachingService.sendSessionSummaryToSailor(params.sessionId)');
    expect(completeSession).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");

    expect(messages).toContain('useConversations(user?.id)');
    expect(messages).toContain('router.push(`/coach/conversation/${conversationId}`)');
    expect(conversation).toContain('useMessages(conversationId)');
    expect(conversation).toContain('messagingService.markConversationRead(conversationId, user.id)');
    expect(conversation).toContain("messagingService.sendMessage(conversationId, user.id, text, 'text')");
    expect(conversation).toContain("item.message_type === 'session_note' || item.message_type === 'debrief_share'");
    expect(conversation).toContain('Load earlier messages');
    expect(conversation).toContain("behavior={Platform.OS === 'ios' ? 'padding' : undefined}");

    expect(service).toContain('async completeSessionWithNotes(');
    expect(service).toContain('summary_sent_to_sailor: true');
    expect(service).toContain("'session_note'");
    expect(service).toContain('calculateRefundAmount(');
    expect(service).toContain('async getSessionDetails(');
    expect(messaging).toContain("export type MessageType = 'text' | 'session_note' | 'debrief_share' | 'schedule_request' | 'system'");
    expect(messaging).toContain("supabase.rpc('increment_unread_count'");
    expect(hooks).toContain("createChannelName('user-conversations', userId)");
    expect(hooks).toContain("createChannelName('conversation-messages', conversationId)");
  });

  it('keeps coach earnings and Stripe Connect payout flows platform-aware', () => {
    const earnings = readSource('app/(tabs)/earnings.tsx');
    const stripe = readSource('services/StripeConnectService.ts');
    const coachPaymentSetup = readSource('app/(auth)/coach-onboarding-payment-setup.tsx');

    expect(earnings).toContain('useCoachWorkspace');
    expect(earnings).toContain('useCoachEarningsSummary');
    expect(earnings).toContain('StripeConnectService.getConnectStatus(coachId)');
    expect(earnings).toContain('StripeConnectService.getPayoutHistory(coachId)');
    expect(earnings).toContain('StripeConnectService.getAvailableBalance(coachId)');
    expect(earnings).toContain('StripeConnectService.requestPayout(coachId)');
    expect(earnings).toContain('StripeConnectService.startOnboarding(coachId)');
    expect(earnings).toContain('StripeConnectService.getDashboardLink(coachId)');
    expect(earnings).toContain("if (Platform.OS === 'web')");
    expect(earnings).toContain("if (Platform.OS === 'ios')");
    expect(earnings).toContain("if (Platform.OS === 'android' && androidElevation)");
    expect(earnings).toContain("{ confirmText: 'Confirm Payout' }");
    expect(earnings).toContain("router.push('/coach/pricing')");

    expect(stripe).toContain("Authorization': `Bearer ${session.access_token}`");
    expect(stripe).toContain("getSupabaseFunctionUrl('create-stripe-connect-account')");
    expect(stripe).toContain("getSupabaseFunctionUrl('stripe-connect-dashboard')");
    expect(stripe).toContain("getSupabaseFunctionUrl('stripe-create-payout')");
    expect(stripe).toContain("return { success: false, error: 'User not authenticated' };");

    expect(coachPaymentSetup).toContain('const getPublicAppUrl = () =>');
    expect(coachPaymentSetup).toContain('StripeConnectService.startOnboarding(');
    expect(coachPaymentSetup).toContain('`${appUrl}/coach-onboarding-stripe-callback?fromPaymentSetup=true`');
    expect(coachPaymentSetup).toContain('`${appUrl}/coach-onboarding-payment-setup`');
    expect(coachPaymentSetup).not.toContain('/(auth)/coach-onboarding-stripe-callback?fromPaymentSetup=true');
    expect(coachPaymentSetup).toContain("window.location.href = result.url;");
    expect(coachPaymentSetup).toContain('await Linking.openURL(result.url);');
    expect(coachPaymentSetup).not.toContain("window.location.origin : 'https://regattaflow.com'");
  });
});
