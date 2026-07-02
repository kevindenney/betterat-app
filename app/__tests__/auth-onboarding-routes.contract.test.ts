import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('auth onboarding route contracts', () => {
  it('keeps signup resumable across email, OAuth, interests, org intent, invite, and blueprint contexts', () => {
    const signup = readSource('app/(auth)/signup.tsx');
    const signupContext = readSource('services/onboarding/commitSignupContext.ts');
    const signupPersona = readSource('lib/auth/signupPersona.ts');

    expect(signup).toContain("const [step, setStep] = useState<SignupStep | 'loading'>");
    expect(signup).toContain('AsyncStorage.getItem(PREFERRED_INTEREST_KEY)');
    expect(signup).toContain('if (signedIn) {');
    expect(signup).toContain('const codeGrant = resolveSignupCode(codeInput);');
    expect(signup).toContain('const blueprintRef = params.blueprint || codeGrant?.blueprintRef;');
    expect(signup).toContain('const wantsCreateOrg = params.intent === \'create-org\';');
    expect(signup).toContain('const result = await signUp(trimmedEmail, trimmedUsername, password, persona);');
    expect(signup).toContain('const commit = await commitSignupContext({');
    expect(signup).toContain('userId: result?.user?.id ?? null');
    expect(signup).toContain('interestSlug: selectedInterest');
    expect(signup).toContain('orgSlug: params.org ?? null');
    expect(signup).toContain('returnTo: returnTo ?? null');
    expect(signup).toContain('blueprintRef: blueprintRef ?? null');
    expect(signup).toContain("router.replace(`/invite/${inviteToken}` as any);");
    expect(signup).toContain("await AsyncStorage.setItem(PENDING_CREATE_ORG_KEY, '1');");
    expect(signup).toContain("router.replace('/(tabs)/library?zone=orgs' as any);");
    expect(signup).toContain("router.replace('/onboarding/trial-activation');");
    expect(signup).toContain("router.replace(chatRoute as any);");
    expect(signup).toContain('await signInWithGoogle(persona);');
    expect(signup).toContain('await signInWithApple(persona);');
    expect(signup).toContain("const [appleSignInAvailable, setAppleSignInAvailable] = useState(Platform.OS === 'web');");
    expect(signup).toContain("if (Platform.OS === 'ios') {");
    expect(signup).toContain('AppleAuthentication.AppleAuthenticationButton');
    expect(signup).toContain("onPress={() => router.push('/terms')}");
    expect(signup).toContain("onPress={() => router.push('/privacy')}");
    expect(signup).toContain("onPress={() => router.push('/(auth)/login')}");

    expect(signupContext).toContain('await AsyncStorage.setItem(ONBOARDING_INTEREST_SLUG_KEY, slug);');
    expect(signupContext).toContain('await AsyncStorage.setItem(POST_ONBOARDING_RETURN_TO_KEY, returnTo);');
    expect(signupContext).toContain('await AsyncStorage.setItem(ONBOARDING_BLUEPRINT_KEY, blueprintRef);');
    expect(signupPersona).toContain("export const SIGNUP_PERSONAS: readonly PersonaRole[] = ['sailor', 'club'];");
    expect(signupPersona).toContain("coach: 'sailor'");
  });

  it('validates phone OTP input and uses safe return paths before auth side effects', () => {
    const phone = readSource('app/(auth)/phone.tsx');

    expect(phone).toContain("const isSafeReturnPath = (path: string | undefined): path is string =>");
    expect(phone).toContain("typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')");
    expect(phone).toContain('const isValidE164Phone = (value: string) => /^\\+[1-9]\\d{7,14}$/.test(value.trim());');
    expect(phone).toContain('const isValidOtpCode = (value: string) => /^\\d{4,8}$/.test(value.trim());');
    expect(phone).toContain("setError(t('phone.errors.phoneRequired'))");
    expect(phone).toContain("setError(t('phone.errors.phoneFormat'))");
    expect(phone).toContain('await sendPhoneOtp(trimmedPhone);');
    expect(phone).toContain("setError(t('phone.errors.codeFormat'))");
    expect(phone).toContain('const { isNewUser } = await verifyPhoneOtp(trimmedPhone, trimmedCode);');
    expect(phone).toContain('if (isSafeReturnPath(returnTo))');
    expect(phone).toContain("router.replace('/(auth)/sailor-onboarding-comprehensive' as any);");
    expect(phone).toContain("router.replace('/(tabs)/races');");
    expect(phone).toContain("keyboardType={Platform.OS === 'web' ? 'default' : 'phone-pad'}");
    expect(phone).toContain('textContentType="oneTimeCode"');
    expect(phone).toContain("onPress={() => (stage === 'code' ? setStage('phone') : router.back())}");
  });

  it('keeps club onboarding entry routes domain-aware and cancellable', () => {
    const chatRoute = readSource('app/(auth)/club-onboarding-chat.tsx');
    const enhancedRoute = readSource('app/(auth)/club-onboarding-enhanced.tsx');
    const websiteVerification = readSource('app/(auth)/club-onboarding-website-verification.tsx');
    const clubChat = readSource('components/onboarding/ClubOnboardingChat.tsx');
    const enhanced = readSource('components/onboarding/EnhancedClubOnboarding.tsx');

    expect(chatRoute).toContain('const { interest } = useLocalSearchParams<{ interest?: string }>();');
    expect(chatRoute).toContain('const ctx = getOnboardingContext(interest);');
    expect(chatRoute).toContain('const orgLabel = ctx.organizationLabel;');
    expect(chatRoute).toContain('AI-Powered {capitalizedOrg} Setup');
    expect(chatRoute).toContain('<ClubOnboardingChat interestSlug={interest} />');

    expect(enhancedRoute).toContain("pathname: '/club/event/create'");
    expect(enhancedRoute).toContain('params: { clubId }');
    expect(enhancedRoute).toContain('router.back();');
    expect(enhancedRoute).toContain('onComplete={handleComplete}');
    expect(enhancedRoute).toContain('onCancel={handleCancel}');

    expect(websiteVerification).toContain("if (!websiteUrl.includes('.') || !websiteUrl.startsWith('http'))");
    expect(websiteVerification).toContain('ClubVerificationService.generateVerificationToken(userId)');
    expect(websiteVerification).toContain('ClubVerificationService.verifyMetaTag(websiteUrl, userId)');
    expect(websiteVerification).toContain('ClubVerificationService.extractClubData(websiteUrl)');
    expect(websiteVerification).toContain('ClubVerificationService.findMatchingYachtClub(websiteUrl)');
    expect(websiteVerification).toContain(".from('club_profiles').upsert");
    expect(websiteVerification).toContain("router.push('/club-dashboard');");

    expect(clubChat).toContain("pathname: '/(auth)/org-welcome'");
    expect(clubChat).toContain('interestSlug');
    expect(enhanced).toContain('onComplete?.(clubId)');
  });
});
