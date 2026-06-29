/**
 * /studio/earnings — retired. Earnings overlapped Payouts (both read
 * marketplace_subscriptions) and was unreachable from the phone bottom
 * nav. The money surface is now consolidated into /studio/payouts, which
 * carries the per-blueprint earnings breakdown, lifetime earnings, active
 * subscribers, and the author-payout-% note. This route redirects so old
 * links/bookmarks resolve.
 *
 * Declarative <Redirect> (not an imperative router.replace in an effect):
 * a hard-loaded deep route would otherwise throw "navigate before mounting
 * the Root Layout" — see project_expo_router_deeplink_redirect.
 */

import { Redirect } from 'expo-router';

export default function StudioEarningsRedirect() {
  return <Redirect href="/studio/payouts" />;
}
