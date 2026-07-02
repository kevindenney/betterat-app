import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('auth platform return and session handoff user flows', () => {
  const loginPage = readSource('app/(auth)/login.tsx');
  const callbackPage = readSource('app/(auth)/callback.tsx');
  const changePasswordPage = readSource('app/settings/change-password.tsx');
  const rootLayout = readSource('app/_layout.tsx');
  const landingPage = readSource('app/index.tsx');
  const authProvider = readSource('providers/AuthProvider.tsx');
  const signupContext = readSource('services/onboarding/commitSignupContext.ts');
  const oauthHook = readSource('lib/auth/useOAuth.tsx');

  it('keeps login usable across Chrome, Android, and iOS with safe return handling', () => {
    expect(loginPage).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");
    expect(loginPage).toContain("const [appleSignInAvailable, setAppleSignInAvailable] = useState(Platform.OS === 'web');");
    expect(loginPage).toContain("if (Platform.OS === 'ios') {");
    expect(loginPage).toContain('isAppleSignInAvailable().then(setAppleSignInAvailable);');
    expect(loginPage).toContain('{appleSignInAvailable && (');
    expect(loginPage).toContain("Platform.OS === 'ios' ? (");
    expect(loginPage).toContain('AppleAuthentication.AppleAuthenticationButton');
    expect(loginPage).toContain("testID=\"login-google-button\"");
    expect(loginPage).toContain("testID=\"login-submit-button\"");
    expect(loginPage).toContain("if (returnTo && typeof returnTo === 'string' && returnTo.startsWith('/'))");
    expect(loginPage).toContain('router.replace(returnTo as any);');
    expect(loginPage).toContain('router.replace(`/invite/${inviteToken}` as any);');
    expect(loginPage).toContain("window.sessionStorage.setItem('oauth_return_to', oauthReturnTo);");
    expect(oauthHook).toContain("scheme: 'betterat'");
    expect(oauthHook).toContain("clientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || 'com.betterat.app'");
    expect(oauthHook).not.toContain("scheme: 'regattaflow'");
    expect(oauthHook).not.toContain("clientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || 'io.regattaflow.app'");
  });

  it('uses platform-correct password reset behavior without breaking mobile alerts', () => {
    expect(loginPage).toContain("if (Platform.OS === 'web') {");
    expect(loginPage).toContain("window.prompt('Enter your email address to reset your password:')");
    expect(loginPage).toContain('window.confirm(`Send password reset link to ${emailToReset}?`)');
    expect(loginPage).toContain("const PASSWORD_RESET_RETURN_TO = '/settings/change-password?recovery=1';");
    expect(loginPage).toContain("const callbackUrl = new URL('/callback', origin);");
    expect(loginPage).toContain('redirectTo: getPasswordResetRedirectUrl(),');
    expect(loginPage).not.toContain('/(auth)/reset-password');
    expect(loginPage).toContain('window.alert(\'Password reset link sent! Check your email.\');');
    expect(loginPage).toContain("showConfirm(\n          'Reset Password',");
    expect(loginPage).toContain("showAlert('Success', 'Password reset link sent to your email');");
    expect(loginPage).toContain("showAlert('Reset Password', 'Enter your email address');");

    expect(callbackPage).toContain("const returnToParam = queryParams.get('returnTo')");
    expect(callbackPage).toContain('hasSafeReturnToParam: isSafeReturnPath(returnToParam)');
    expect(callbackPage).toContain('if (isSafeReturnPath(returnToParam))');

    expect(changePasswordPage).toContain('useLocalSearchParams');
    expect(changePasswordPage).toContain("const isRecovery = recovery === '1';");
    expect(changePasswordPage).toContain('if ((!isRecovery && !currentPassword) || !newPassword || !confirmPassword)');
    expect(changePasswordPage).toContain('if (!isRecovery) {');
    expect(changePasswordPage).toContain("{isRecovery ? 'Reset Password' : 'Change Password'}");
  });

  it('handles OAuth callbacks, slow session validation, onboarding context, and safe return destinations', () => {
    expect(callbackPage).toContain("const safetyTimeout = setTimeout(() => {");
    expect(callbackPage).toContain('}, 25000)');
    expect(callbackPage).toContain('const codeParam = queryParams.get(\'code\')');
    expect(callbackPage).toContain('supabase.auth.exchangeCodeForSession(codeParam)');
    expect(callbackPage).toContain('supabase.auth.setSession({');
    expect(callbackPage).toContain("window.sessionStorage.setItem('auth_settling_at', String(Date.now()))");
    expect(callbackPage).toContain("const setSessionTimeoutPromise = new Promise<{kind: 'timeout'}>(resolve =>");
    expect(callbackPage).toContain('setTimeout(() => resolve({ kind: \'timeout\' }), 5000)');
    expect(callbackPage).toContain("window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sessionData))");
    expect(callbackPage).toContain('window.location.replace(destination)');
    expect(callbackPage).toContain('await commitOnboardingInterest(');
    expect(callbackPage).toContain('await commitOnboardingBlueprint(');
    expect(callbackPage).toContain("const fromSession = window.sessionStorage.getItem('oauth_return_to')");
    expect(callbackPage).toContain('if (!returnTo && isSafeReturnPath(fromSession))');
    expect(callbackPage).toContain("returnTo = await AsyncStorage.getItem('post_onboarding_return_to')");
    expect(callbackPage).toContain('const demoLandingEarly = readDemoPersonaLanding(session.user.user_metadata)');
  });

  it('routes public landing and native cold-open states without protected-route loops', () => {
    expect(landingPage).toContain('function forwardImplicitTokenHash(): boolean');
    expect(landingPage).toContain("if (!hash.startsWith('#') || !hash.includes('access_token=')) return false;");
    expect(landingPage).toContain("const callbackUrl = new URL('/callback', window.location.origin);");
    expect(landingPage).toContain('window.location.replace(callbackUrl.toString());');
    expect(landingPage).toContain('const skeletonLockedOff = useRef(false);');
    expect(landingPage).toContain("AsyncStorage.getItem(PREFERRED_INTEREST_KEY)");
    expect(landingPage).toContain("router.replace(cachedSlug ? '/(auth)/login' : '/welcome')");
    expect(landingPage).toContain('router.replace(getLastTabRoute(userProfile?.user_type ?? null));');
    expect(landingPage).toContain('return <DashboardSkeleton />;');
    expect(landingPage).toContain('<NetflixLandingPage />');
  });

  it('preserves protected deep links through AuthGate while allowing public marketing routes', () => {
    expect(rootLayout).toContain("window.location.search.includes('rf_access_token=')");
    expect(rootLayout).toContain("window.location.search.includes('rf_bridge_token=')");
    expect(rootLayout).toContain("const settlingAt = window.sessionStorage.getItem('auth_settling_at');");
    expect(rootLayout).toContain("Date.now() - parseInt(settlingAt, 10) < 3000");
    expect(rootLayout).toContain("'blueprint'");
    expect(rootLayout).toContain("'community'");
    expect(rootLayout).toContain("'marketplace'");
    expect(rootLayout).toContain("'redeem'");
    expect(rootLayout).toContain('const isPublicVenuePost = firstSegment === \'venue\' && segments[1] === \'post\';');
    expect(rootLayout).toContain("returnTo = `${window.location.pathname}${window.location.search}`");
    expect(rootLayout).toContain("returnTo = routeSegments.length > 0 ? `/${routeSegments.join('/')}` : ''");
    expect(rootLayout).toContain("`/(auth)/login?returnTo=${encodeURIComponent(returnTo)}`");
    expect(rootLayout).toContain('router.replace(loginRoute as any)');
  });

  it('cleans Firebase bridge tokens and rebroadcasts cleaned URLs on success and failure', () => {
    expect(rootLayout).toContain('const tokens = extractSessionTokensFromUrl(currentUrl);');
    expect(rootLayout).toContain('const nextRedirect = extractNextRedirectFromUrl(currentUrl);');
    expect(rootLayout).toContain('const cleanUrl = cleanAuthTokensFromUrl(window.location.href);');
    expect(rootLayout).toContain("window.history.replaceState(null, '', cleanUrl);");
    expect(rootLayout).toContain('router.replace(path as any);');
    expect(rootLayout).toContain('success = await setSessionFromBridgeTokens(tokens.accessToken, tokens.refreshToken);');
    expect(rootLayout).toContain('success = await exchangeBridgeTokenForSession(tokens.bridgeToken);');
    expect(rootLayout).toContain("notifyAuthSuccess('session-established');");
    expect(rootLayout).toContain('router.replace(nextRedirect as any);');
    expect(rootLayout).toContain("notifyAuthFailure('Session exchange failed');");
    expect(rootLayout).toContain("notifyAuthFailure(error instanceof Error ? error.message : 'Unknown error');");
  });

  it('preserves OAuth returnTo and persona setup across web and native provider flows', () => {
    expect(authProvider).toContain("window.sessionStorage.setItem('oauth_return_to', returnTo)");
    expect(authProvider).toContain('const redirectTo = `${currentOrigin}/callback`');
    expect(authProvider).toContain("provider: 'google'");
    expect(authProvider).toContain("provider: 'apple'");
    expect(authProvider).toContain("await AsyncStorage.setItem('oauth_pending_persona', persona)");
    expect(authProvider).toContain('const result = await nativeGoogleSignIn()');
    expect(authProvider).toContain('await handleNativeOAuthProfile(result.user, persona)');
    expect(authProvider).toContain('.upsert(profilePayload, { onConflict: \'id\' })');
    expect(signupContext).toContain("export const POST_ONBOARDING_RETURN_TO_KEY = 'post_onboarding_return_to';");
    expect(signupContext).toContain('await AsyncStorage.setItem(POST_ONBOARDING_RETURN_TO_KEY, returnTo);');
  });
});
