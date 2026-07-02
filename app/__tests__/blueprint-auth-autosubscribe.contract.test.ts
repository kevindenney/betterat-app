import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('blueprint auth return and auto-subscribe user flows', () => {
  const blueprintPage = readSource('app/blueprint/[slug].tsx');
  const loginPage = readSource('app/(auth)/login.tsx');
  const signupPage = readSource('app/(auth)/signup.tsx');
  const callbackPage = readSource('app/(auth)/callback.tsx');
  const signupContext = readSource('services/onboarding/commitSignupContext.ts');

  it('waits for auth and bridge settling before blueprint auto-subscribe redirects or subscribes', () => {
    expect(blueprintPage).toContain("const { user, ready: authReady, loading: authLoading } = useAuth();");
    expect(blueprintPage).toContain("if (auto_subscribe !== '1') return;");
    expect(blueprintPage).toContain('if (!authReady || authLoading) return;');
    expect(blueprintPage).toContain("window.location.search.includes('rf_access_token=')");
    expect(blueprintPage).toContain("window.location.search.includes('rf_bridge_token=')");
    expect(blueprintPage).toContain('const t = setTimeout(() => setBridgePollTick((n) => n + 1), 400);');
    expect(blueprintPage).toContain("const returnTo = `/blueprint/${slug}?auto_subscribe=1`;");
    expect(blueprintPage).toContain("router.replace({ pathname: '/(auth)/login', params: { returnTo } } as any);");
  });

  it('auto-subscribes only free blueprints and then moves the subscriber into their timeline', () => {
    expect(blueprintPage).toContain("if (blueprint.access_level === 'paid') return;");
    expect(blueprintPage).toContain('if (subscription === undefined) return;');
    expect(blueprintPage).toContain("u.searchParams.delete('auto_subscribe');");
    expect(blueprintPage).toContain('subscribeMutation\n      .mutateAsync(blueprint.id)');
    expect(blueprintPage).toContain('NotificationService\n            .notifyBlueprintSubscribed');
    expect(blueprintPage).toContain('await addInterest(targetInterestSlug);');
    expect(blueprintPage).toContain('await switchInterest(targetInterestSlug);');
    expect(blueprintPage).toContain('`betterat_blueprint_welcome:${slug}`');
    expect(blueprintPage).toContain('router.replace(getEventTabRoute() as any);');
    expect(blueprintPage).toContain('finally(stripParam)');
  });

  it('preserves blueprint and returnTo context through login on web, Android, and iOS paths', () => {
    expect(loginPage).toContain('ONBOARDING_BLUEPRINT_KEY');
    expect(loginPage).toContain('AsyncStorage.setItem(ONBOARDING_BLUEPRINT_KEY, blueprintRef)');
    expect(loginPage).toContain('const pending = await AsyncStorage.getItem(ONBOARDING_BLUEPRINT_KEY);');
    expect(loginPage).toContain('await commitOnboardingBlueprint(user.id, pending);');
    expect(loginPage).toContain('await AsyncStorage.removeItem(ONBOARDING_BLUEPRINT_KEY);');
    expect(loginPage).toContain("if (returnTo && typeof returnTo === 'string' && returnTo.startsWith('/'))");
    expect(loginPage).toContain('router.replace(returnTo as any);');
    expect(loginPage).toContain("window.sessionStorage.setItem('oauth_return_to', oauthReturnTo);");
    expect(loginPage).toContain('await signInWithGoogle();');
    expect(loginPage).toContain('await signInWithApple();');
  });

  it('persists signup context for email and OAuth before committing after callback', () => {
    expect(signupPage).toContain('const returnTo = params.returnTo || undefined;');
    expect(signupPage).toContain('const blueprintRef = params.blueprint || codeGrant?.blueprintRef;');
    expect(signupPage).toContain('const cachedSlug = await AsyncStorage.getItem(PREFERRED_INTEREST_KEY);');
    expect(signupPage).toContain('const commit = await commitSignupContext({');
    expect(signupPage).toContain('userId: result?.user?.id ?? null');
    expect(signupPage).toContain('interestSlug: selectedInterest');
    expect(signupPage).toContain('returnTo: returnTo ?? null');
    expect(signupPage).toContain('blueprintRef: blueprintRef ?? null');
    expect(signupPage).toContain('await signInWithGoogle(persona);');
    expect(signupPage).toContain('await signInWithApple(persona);');

    expect(signupContext).toContain("export const POST_ONBOARDING_RETURN_TO_KEY = 'post_onboarding_return_to';");
    expect(signupContext).toContain("export const ONBOARDING_BLUEPRINT_KEY = 'onboarding_blueprint_ref';");
    expect(signupContext).toContain('await AsyncStorage.setItem(POST_ONBOARDING_RETURN_TO_KEY, returnTo);');
    expect(signupContext).toContain('await AsyncStorage.setItem(ONBOARDING_BLUEPRINT_KEY, blueprintRef);');
    expect(signupContext).toContain('const sub = await commitOnboardingBlueprint(input.userId, blueprintRef);');
    expect(signupContext).toContain('await subscribeToBlueprint(userId, blueprintId);');
  });

  it('callback drains pending blueprint context and prefers safe returnTo destinations', () => {
    expect(callbackPage).toContain('const pendingBlueprintRef = await AsyncStorage.getItem(\n              ONBOARDING_BLUEPRINT_KEY,');
    expect(callbackPage).toContain('const bpResult = await commitOnboardingBlueprint(\n                session.user.id,\n                pendingBlueprintRef,');
    expect(callbackPage).toContain('await AsyncStorage.removeItem(ONBOARDING_BLUEPRINT_KEY)');
    expect(callbackPage).toContain("const fromSession = window.sessionStorage.getItem('oauth_return_to')");
    expect(callbackPage).toContain('if (!returnTo && isSafeReturnPath(fromSession))');
    expect(callbackPage).toContain("window.sessionStorage.removeItem('oauth_return_to')");
    expect(callbackPage).toContain("returnTo = await AsyncStorage.getItem('post_onboarding_return_to')");
    expect(callbackPage).toContain("await AsyncStorage.removeItem('post_onboarding_return_to')");
    expect(callbackPage).toContain('router.replace(returnTo as any)');
  });
});
