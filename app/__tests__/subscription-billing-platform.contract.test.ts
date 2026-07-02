import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('subscription billing and platform purchase user flows', () => {
  const subscriptionPage = readSource('app/subscription/index.tsx');
  const subscriptionSuccess = readSource('app/subscription/success.tsx');
  const accountSubscriptions = readSource('app/account/subscriptions.tsx');
const subscriptionManager = readSource('components/subscription/SubscriptionManager.tsx');
const paywallModal = readSource('components/subscriptions/PaywallModal.tsx');
const upgradePrompt = readSource('components/auth/UpgradePrompt.tsx');
const subscriptionContext = readSource('lib/contexts/SubscriptionContext.tsx');
const teamInviteSheet = readSource('components/subscription/TeamInviteSheet.tsx');
const sendTeamInviteFunction = readSource('supabase/functions/send-team-invite/index.ts');
const sendWelcomeEmailFunction = readSource('supabase/functions/send-welcome-email/index.ts');
const sendTrialReminderFunction = readSource('supabase/functions/send-trial-reminder/index.ts');
  const nativeService = readSource('lib/subscriptions/subscriptionService.ts');
  const webService = readSource('lib/subscriptions/subscriptionService.web.ts');
  const mySubscriptionsHook = readSource('hooks/useMySubscriptions.ts');
  const checkoutFunction = readSource('supabase/functions/create-checkout-session/index.ts');
  const cancelFunction = readSource('supabase/functions/marketplace-cancel-subscription/index.ts');

  it('starts app-level Stripe checkout and billing portal with platform-correct browser handling', () => {
    expect(subscriptionPage).toContain("type BillingPeriod = 'monthly' | 'yearly';");
    expect(subscriptionPage).toContain("const STRIPE_PRICE_IDS = {");
    expect(subscriptionPage).toContain("if (!user?.id) {\n      showAlert('Error', 'Please log in to subscribe.');");
    expect(subscriptionPage).toContain("supabase.functions.invoke('create-checkout-session'");
    expect(subscriptionPage).toContain('successUrl: `${origin}/subscription/success`');
    expect(subscriptionPage).toContain('cancelUrl: `${origin}/subscription`');
    expect(subscriptionPage).toContain("if (Platform.OS === 'web' && typeof window !== 'undefined') {");
    expect(subscriptionPage).toContain('window.location.href = data.url;');
    expect(subscriptionPage).toContain('await WebBrowser.openBrowserAsync(data.url);');
    expect(subscriptionPage).toContain("supabase.functions.invoke('create-portal-session'");
    expect(subscriptionPage).toContain('returnUrl: `${origin}/subscription`');
    expect(subscriptionPage).toContain('targetPriceId');
    expect(subscriptionPage).toContain('getCheckoutErrorMessage(error)');
  });

  it('makes current billing state explicit before changing cadence or canceling renewal', () => {
    expect(subscriptionPage).toContain(".from('subscriptions')");
    expect(subscriptionPage).toContain(".select('status, price_id, current_period_end, cancel_at_period_end')");
    expect(subscriptionPage).toContain("if (rawTier === 'plus' || rawTier === 'individual' || rawTier === 'basic')");
    expect(subscriptionPage).toContain('const activeBillingPeriod = activePaidPlan ? getCurrentBillingPeriodForPlan(activePaidPlan) : null;');
    expect(subscriptionPage).toContain('setBillingPeriod(activeBillingPeriod);');
    expect(subscriptionPage).toContain('Billing is managed in Stripe');
    expect(subscriptionPage).toContain('Subscription ends soon');
    expect(subscriptionPage).toContain('Your paid access stays on until');
    expect(subscriptionPage).toContain('Cancel, resume, switch billing period, update your card, and review invoices in Stripe Billing.');
    expect(subscriptionPage).toContain('Keep{\' \'}\n                  {billingPeriodLabel(billingPeriod)} selected');
    expect(subscriptionSuccess).toContain("router.replace('/(tabs)/races')");
  });

  it('lists marketplace buyer subscriptions and cancels only active or trialing rows', () => {
    expect(accountSubscriptions).toContain('const { subscriptions, loading, cancel } = useMySubscriptions();');
    expect(accountSubscriptions).toContain('const cancelable =\n              (sub.status === \'active\' || sub.status === \'trialing\') &&\n              !sub.cancelAtPeriodEnd;');
    expect(accountSubscriptions).toContain('Cancel any time —\n          access stays through the end of your current billing period.');
    expect(accountSubscriptions).toContain('Cancels {formatDate(sub.currentPeriodEnd) ?? \'end of period\'}');
    expect(accountSubscriptions).toContain("router.push('/marketplace' as any)");
    expect(accountSubscriptions).toContain('pendingId === sub.id ? \'Canceling…\' : \'Cancel\'');

    expect(mySubscriptionsHook).toContain(".from('marketplace_subscriptions')");
    expect(mySubscriptionsHook).toContain(".eq('buyer_user_id', user.id)");
    expect(mySubscriptionsHook).toContain(".from('blueprints')");
    expect(mySubscriptionsHook).toContain(".from('organizations')");
    expect(mySubscriptionsHook).toContain(".from('users')");
    expect(mySubscriptionsHook).toContain('const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/marketplace-cancel-subscription`;');
    expect(mySubscriptionsHook).toContain('Authorization: `Bearer ${session.access_token}`');
    expect(mySubscriptionsHook).toContain('body: JSON.stringify({ subscription_id: subscriptionId })');
    expect(mySubscriptionsHook).toContain("queryClient.invalidateQueries({ queryKey });");
  });

  it('keeps marketplace cancellation buyer-owned and access-preserving at the edge function', () => {
    expect(cancelFunction).toContain("if (!authHeader) {");
    expect(cancelFunction).toContain('await supabase.auth.getUser(authHeader.replace(\'Bearer \', \'\'))');
    expect(cancelFunction).toContain("body.subscription_id ?? body.subscriptionId");
    expect(cancelFunction).toContain(".from('marketplace_subscriptions')");
    expect(cancelFunction).toContain("if (!row || row.buyer_user_id !== user.id) {");
    expect(cancelFunction).toContain("if (row.status === 'canceled')");
    expect(cancelFunction).toContain('if (row.cancel_at_period_end)');
    expect(cancelFunction).toContain('stripe.subscriptions.update(row.stripe_subscription_id, {');
    expect(cancelFunction).toContain('cancel_at_period_end: true');
    expect(cancelFunction).toContain('current_period_end: periodEnd');
    expect(cancelFunction).toContain("status: 'canceled'");
  });

  it('allowlists app subscription prices and requires authenticated self-checkout', () => {
    expect(checkoutFunction).toContain('async function requireUserSelf(');
    expect(checkoutFunction).toContain("return jsonResponse({ error: 'Missing authorization header' }, 401);");
    expect(checkoutFunction).toContain("return jsonResponse({ error: 'Forbidden' }, 403);");
    expect(checkoutFunction).toContain('const PRICE_TIERS: Record<string, ConsumerTier> = {};');
    expect(checkoutFunction).toContain('Invalid price: ${requestedPriceId}. Not an allowed subscription price.');
    expect(checkoutFunction).toContain("error: 'Missing priceId or plan/billingPeriod.'");
    expect(checkoutFunction).toContain('billingPeriod === \'annual\' ? \'yearly\' : req.billingPeriod');
    expect(checkoutFunction).toContain("mode: 'subscription'");
    expect(checkoutFunction).toContain('billing_address_collection: \'required\'');
  });

  it('uses RevenueCat on native and Stripe on web with safe fallbacks', () => {
    expect(nativeService).toContain('Platform.select({');
    expect(nativeService).toContain('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');
    expect(nativeService).toContain('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY');
    expect(nativeService).toContain('IS_EXPO_GO');
    expect(nativeService).toContain('Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: user?.id ?? null });');
    expect(nativeService).toContain('Purchases.addCustomerInfoUpdateListener');
    expect(nativeService).toContain('Purchases.getOfferings()');
    expect(nativeService).toContain('isAndroidBillingUnavailable(error)');
    expect(nativeService).toContain('Purchases.purchasePackage(pkg)');
    expect(nativeService).toContain('Purchases.restorePurchases()');
    expect(nativeService).toContain("ios: 'To cancel your subscription, go to Settings > Apple ID > Subscriptions on your device.'");
    expect(nativeService).toContain("android: 'To cancel your subscription, open the Google Play Store app and go to Subscriptions.'");

    expect(webService).toContain("supabase.functions.invoke('create-checkout-session'");
    expect(webService).toContain('successUrl: `${window.location.origin}/subscription/success`');
    expect(webService).toContain('cancelUrl: `${window.location.origin}/subscription`');
    expect(webService).toContain("supabase.functions.invoke('create-portal-session'");
    expect(webService).toContain('window.location.href = data.url;');
    expect(webService).toContain(".from('users')");
    expect(webService).toContain(".select('subscription_status, subscription_tier')");
  });

  it('keeps paywall and legacy subscription manager actions non-crashing and user-routable', () => {
    const callbackIndex = subscriptionManager.indexOf('const loadSubscriptionStatus = useCallback');
    const effectIndex = subscriptionManager.indexOf('useEffect(() => {\n    loadSubscriptionStatus();');
    expect(callbackIndex).toBeGreaterThan(-1);
    expect(effectIndex).toBeGreaterThan(callbackIndex);
    expect(subscriptionManager).toContain("showAlert('Sign In Required', 'Please sign in to subscribe')");
    expect(subscriptionManager).toContain('void Linking.openURL(\n            `mailto:info@better.at?subject=Subscription%20Checkout%20Request');
    expect(subscriptionManager).toContain('`mailto:info@better.at?subject=Billing%20Portal%20Request');
    expect(subscriptionManager).not.toContain('mailto:support@regattaflow.com?subject=Subscription%20Checkout%20Request');
    expect(subscriptionManager).toContain('showConfirm(\n      \'Cancel Subscription\',');
    expect(subscriptionManager).toContain('await loadSubscriptionStatus();');

    expect(paywallModal).toContain("if (tierSource === 'organization') {");
    expect(paywallModal).toContain('Your premium access is provided by {orgName || \'your organization\'}. No additional payment needed.');
    expect(paywallModal).toContain("description: description || 'Unlock the full potential of BetterAt'");
    expect(paywallModal).toContain('This feature requires a BetterAt subscription to unlock premium');
    expect(paywallModal).toContain('Join people using BetterAt to improve what matters to them');
    expect(paywallModal).not.toContain('Unlock the full potential of RegattaFlow');
    expect(paywallModal).not.toContain('RegattaFlow Pro');

    expect(upgradePrompt).toContain('BetterAt Pro');
    expect(upgradePrompt).toContain('Join people using BetterAt to improve what matters to them');
    expect(upgradePrompt).not.toContain('RegattaFlow Pro');
    expect(subscriptionContext).toContain("'Welcome to BetterAt!'");
    expect(subscriptionContext).not.toContain('Welcome to RegattaFlow Pro!');

    expect(teamInviteSheet).toContain('Join my team on BetterAt! Use this link to join: ${link}');
    expect(teamInviteSheet).toContain("'https://better.at'");
    expect(teamInviteSheet).toContain('Platform.OS === \'ios\' ? link : undefined');
    expect(teamInviteSheet).not.toContain('Join my team on RegattaFlow');
    expect(teamInviteSheet).not.toContain("'https://regattaflow.com'");
    expect(sendTeamInviteFunction).toContain('const inviteLink = `https://better.at/team-invite/${team.invite_code}`;');
    expect(sendTeamInviteFunction).toContain("'A BetterAt user'");
    expect(sendTeamInviteFunction).toContain('Join <strong>${team.name}</strong> on BetterAt');
    expect(sendTeamInviteFunction).toContain('has invited you to join their team on BetterAt.');
    expect(sendTeamInviteFunction).toContain('This invitation was sent by BetterAt on behalf of ${ownerName}.');
    expect(sendTeamInviteFunction).toContain('subject: `${ownerName} invited you to join ${team.name} on BetterAt`,');
    expect(sendTeamInviteFunction).not.toContain('https://regattaflow.com/team-invite');
    expect(sendTeamInviteFunction).not.toContain('A RegattaFlow user');
    expect(sendTeamInviteFunction).not.toContain('on RegattaFlow');

    expect(paywallModal).toContain('const result = await purchaseProduct(popularProduct.id);');
    expect(paywallModal).toContain('if (result.success) {\n        onClose();');
    expect(paywallModal).toContain("router.push('/legacy');");
  });

  it('keeps club trial transactional emails BetterAt-branded', () => {
    expect(sendWelcomeEmailFunction).toContain("Deno.env.get('FROM_EMAIL') || 'BetterAt <hello@better.at>'");
    expect(sendWelcomeEmailFunction).toContain('<title>Welcome to BetterAt</title>');
    expect(sendWelcomeEmailFunction).toContain('🎉 Welcome to BetterAt!');
    expect(sendWelcomeEmailFunction).toContain('Congratulations on setting up <strong>${clubName}</strong> on BetterAt!');
    expect(sendWelcomeEmailFunction).toContain('href="https://better.at/events"');
    expect(sendWelcomeEmailFunction).toContain('href="https://better.at/docs"');
    expect(sendWelcomeEmailFunction).toContain('© ${new Date().getFullYear()} BetterAt. All rights reserved.');
    expect(sendWelcomeEmailFunction).toContain("subject: `🎉 Welcome to BetterAt, ${clubName}!`");
    expect(sendWelcomeEmailFunction).not.toContain('Welcome to RegattaFlow');
    expect(sendWelcomeEmailFunction).not.toContain('on RegattaFlow');
    expect(sendWelcomeEmailFunction).not.toContain('app.regattaflow.io');
    expect(sendWelcomeEmailFunction).not.toContain('regattaflow.io/docs');

    expect(sendTrialReminderFunction).toContain("Deno.env.get('FROM_EMAIL') || 'BetterAt <hello@better.at>'");
    expect(sendTrialReminderFunction).toContain('days left in your BetterAt trial');
    expect(sendTrialReminderFunction).toContain('Your BetterAt trial ends');
    expect(sendTrialReminderFunction).toContain('Keep the momentum going with BetterAt:');
    expect(sendTrialReminderFunction).toContain('href="https://better.at/subscription"');
    expect(sendTrialReminderFunction).toContain('© ${new Date().getFullYear()} BetterAt');
    expect(sendTrialReminderFunction).not.toContain('RegattaFlow trial');
    expect(sendTrialReminderFunction).not.toContain('RegattaFlow Pro');
    expect(sendTrialReminderFunction).not.toContain('app.regattaflow.io/subscription');
  });
});
