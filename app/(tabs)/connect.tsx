/**
 * Connect Tab — legacy redirect.
 *
 * Kept for backwards compatibility with old deep links. Connect was
 * replaced by Discover, which has since been folded into Library/Watch
 * (5→4 tabs). People discovery now lives in Watch, so connect bounces
 * straight there.
 */

import { Redirect } from 'expo-router';

export default function ConnectRedirect() {
  return <Redirect href={'/(tabs)/watch' as never} />;
}
