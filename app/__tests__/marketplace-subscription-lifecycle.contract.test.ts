import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('marketplace subscription lifecycle user flows', () => {
  const marketplacePage = readSource('app/marketplace/[id].tsx');
  const marketplaceHooks = readSource('hooks/useMarketplaceBlueprints.ts');
  const detailHook = readSource('hooks/useMarketplaceBlueprint.ts');
  const subscriptionsHook = readSource('hooks/useMySubscriptions.ts');
  const subscriptionsPage = readSource('app/account/subscriptions.tsx');
  const checkoutFunction = readSource('supabase/functions/marketplace-blueprint-checkout/index.ts');
  const cancelFunction = readSource('supabase/functions/marketplace-cancel-subscription/index.ts');
  const globalSearchService = readSource('services/search/GlobalSearchService.ts');
  const cohortBlueprintService = readSource('services/CohortBlueprintService.ts');
  const freeMarketplaceMigration = readSource(
    'supabase/migrations/20260701123000_free_marketplace_blueprints.sql',
  );
  const freeSubscribePolicyMigration = readSource(
    'supabase/migrations/20260701161500_marketplace_free_subscribe_policy.sql',
  );
  const coAuthorAccessMigration = readSource(
    'supabase/migrations/20260701164000_marketplace_co_author_access.sql',
  );
  const freeReviewMigration = readSource(
    'supabase/migrations/20260701190000_marketplace_free_review_rpc.sql',
  );
  const marketplaceStepCopyRpcMigration = readSource(
    'supabase/migrations/20260701203500_marketplace_step_copy_rpc.sql',
  );
  const studioSubscribersHook = readSource('hooks/useStudioSubscribers.ts');
  const studioSubscribersPage = readSource('app/studio/subscribers.tsx');
  const mentoringPanel = readSource('components/creator/CreatorMentoringPanel.tsx');
  const studioMentoringMigration = readSource(
    'supabase/migrations/20260701214500_studio_marketplace_subscriber_mentoring.sql',
  );

  it('keeps marketplace detail wired for signed-out login, signed-in checkout, and platform browser handling', () => {
    expect(marketplacePage).toContain('const { user, isGuest } = useAuth();');
    expect(marketplacePage).toContain('const signedIn = !!user && !isGuest;');
    expect(marketplacePage).toContain('const { result, loading, upsertReview, deleteReview } = useMarketplaceBlueprint(id);');
    expect(marketplacePage).toContain('const checkout = useMarketplaceCheckout();');
    expect(marketplacePage).toContain('const freeSubscribe = useBlueprintSubscribe();');
    expect(marketplacePage).toContain('addInstitutionalStepById');
    expect(marketplacePage).toContain('addRemainingInstitutionalSteps');
    expect(marketplacePage).toContain('const returnTo = `/marketplace/${blueprint.id}`;');
    expect(marketplacePage).toContain("router.replace(`/(auth)/login?returnTo=${encodeURIComponent(returnTo)}` as any);");
    expect(marketplacePage).toContain('setPending(true);');
    expect(marketplacePage).toContain('setError(null);');
    expect(marketplacePage).toContain('if (isFree) {');
    expect(marketplacePage).toContain("blueprintSystem: 'marketplace'");
    expect(marketplacePage).toContain("entryGranularity: 'first'");
    expect(marketplacePage).toContain('checkout.mutate(blueprint.id');
    expect(marketplacePage).toContain("if (Platform.OS === 'web') {\n          window.open(url, '_blank', 'noopener,noreferrer');");
    expect(marketplacePage).toContain('WebBrowser.openBrowserAsync(url);');
    expect(marketplacePage).toContain("setError(err instanceof Error ? err.message : 'Checkout failed');");
    expect(marketplacePage).toContain("'Opening Stripe");
    expect(marketplacePage).toContain("'Subscribe free'");
    expect(marketplacePage).toContain("signedIn ? subscribeLabel : 'Sign in to subscribe'");
  });

  it('lets subscribed marketplace viewers inspect steps and copy more into their timeline', () => {
    expect(marketplacePage).toContain('const remainingStepCount = subscription');
    expect(marketplacePage).toContain('const [optimisticCopiedStepIds, setOptimisticCopiedStepIds]');
    expect(marketplacePage).toContain('const copiedTemplateIds = new Set(optimisticCopiedStepIds);');
    expect(marketplacePage).toContain('setOptimisticCopiedStepIds((prev) => {');
    expect(marketplacePage).toContain('const [optimisticStepIdsByTemplateId, setOptimisticStepIdsByTemplateId]');
    expect(marketplacePage).toContain('const stepIdsByTemplateId: Record<string, string>');
    expect(marketplacePage).toContain('const handleAddStep = async (templateId: string, title: string, openAfterAdd = false) => {');
    expect(marketplacePage).toContain('const result = await addInstitutionalStepById(user.id, blueprint.id, templateId, null);');
    expect(marketplacePage).toContain('const stepId = result.stepIdsByTemplateId[templateId] ?? result.firstStepId;');
    expect(marketplacePage).toContain('const goToPracticeStep = (stepId: string) => {');
    expect(marketplacePage).toContain('router.push(`/practice?selected=${encodeURIComponent(stepId)}&level=1` as any);');
    expect(marketplacePage).toContain('goToPracticeStep(stepId);');
    expect(marketplacePage).toContain('<View key={step.id} style={s.stepRow}>');
    expect(marketplacePage).toContain('style={({ pressed }) => [s.stepRowMain, pressed && { opacity: 0.82 }]}');
    expect(marketplacePage).toContain('const result = await addRemainingInstitutionalSteps(user.id, blueprint.id, null);');
    expect(marketplacePage).toContain('...result.stepIdsByTemplateId,');
    expect(marketplacePage).toContain('if (result.firstStepId) {');
    expect(marketplacePage).toContain("void queryClient.invalidateQueries({ queryKey: ['marketplace-blueprint', blueprint.id] });");
    expect(marketplacePage).toContain('const canAddStep = hasAccess && !!subscription && !isStepCopied;');
    expect(marketplacePage).toContain('const canInspectStep = hasAccess && !!subscription;');
    expect(marketplacePage).toContain('accessibilityLabel={canOpenStep ? `Open ${step.title}` : `Add and open ${step.title}`}');
    expect(cohortBlueprintService).toContain('stepIdsByTemplateId: Record<string, string>');
    expect(marketplacePage).toContain('Add any step below');
    expect(marketplacePage).toContain('Add steps to timeline');
    expect(marketplacePage).toContain('Add remaining');
    expect(marketplacePage).toContain('Add</Text>');
    expect(cohortBlueprintService).toContain('fetchTemplatesForMaterialization');
    expect(cohortBlueprintService).toContain('TEMPLATE_SELECT_WITH_COMPETENCY_IDS');
    expect(cohortBlueprintService).toContain('isMissingCapabilityCompetencyColumn');
    expect(cohortBlueprintService).toContain('capability_competency_ids: null');
    expect(cohortBlueprintService).toContain('materializeIndependentMarketplaceBlueprint');
    expect(cohortBlueprintService).toContain("supabase.rpc('materialize_marketplace_blueprint_steps'");
    expect(marketplaceStepCopyRpcMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.materialize_marketplace_blueprint_steps',
    );
    expect(marketplaceStepCopyRpcMigration).toContain('FROM public.blueprint_step_templates t');
    expect(marketplaceStepCopyRpcMigration).toContain("bs.blueprint_system = 'marketplace'");
    expect(marketplaceStepCopyRpcMigration).toContain("source_type = 'marketplace_copy'");
    expect(marketplaceStepCopyRpcMigration).toContain("'step_ids_by_template_id', v_step_map");
    expect(marketplaceStepCopyRpcMigration).toContain(
      'GRANT EXECUTE ON FUNCTION public.materialize_marketplace_blueprint_steps',
    );
  });

  it('shows subscription state and keeps reviews gated to active marketplace subscribers', () => {
    expect(marketplacePage).toContain('const { blueprint, hasAccess, viewerRole, subscription, steps, reviews, myReview } = result;');
    expect(marketplacePage).toContain('hasAccess && subscription ? (');
    expect(marketplacePage).toContain('subscription.cancelAtPeriodEnd');
    expect(marketplacePage).toContain('`Access through ${formatDate(subscription.currentPeriodEnd)}`');
    expect(marketplacePage).toContain("subscription.status === 'trialing'");
    expect(marketplacePage).toContain("'On trial'");
    expect(marketplacePage).toContain("'Subscribed'");
    expect(marketplacePage).toContain('canWrite={!!subscription}');
    expect(marketplacePage).toContain("canWrite\n            ? 'Share what you thought after working through the steps.'\n            : 'Subscribe to write a review.'");
    expect(marketplacePage).toContain('upsertReview.mutate(');
    expect(marketplacePage).toContain('deleteReview.mutate(myReview.id);');

    expect(detailHook).toContain("supabase.rpc('upsert_marketplace_blueprint_review'");
    expect(freeReviewMigration).toContain('CREATE OR REPLACE FUNCTION public.can_review_marketplace_blueprint');
    expect(freeReviewMigration).toContain('FROM public.marketplace_subscriptions ms');
    expect(freeReviewMigration).toContain('FROM public.blueprint_subscriptions bs');
    expect(freeReviewMigration).toContain("bs.blueprint_system = 'marketplace'");
    expect(freeReviewMigration).toContain('CREATE OR REPLACE FUNCTION public.upsert_marketplace_blueprint_review');
    expect(detailHook).toContain(".from('marketplace_blueprint_reviews')\n        .delete()");
    expect(detailHook).toContain("queryClient.invalidateQueries({ queryKey });");
    expect(detailHook).toContain("queryClient.invalidateQueries({ queryKey: ['marketplace-blueprints'] });");
  });

  it('treats marketplace co-authors as author-side viewers, not buyers', () => {
    expect(detailHook).toContain("export type MarketplaceViewerRole = 'primary_author' | 'co_author' | 'org_admin' | 'subscriber' | null;");
    expect(detailHook).toContain('viewerRole: p.viewer_role ?? null');
    expect(marketplacePage).toContain("const isCoAuthor = viewerRole === 'co_author';");
    expect(marketplacePage).toContain("'Co-author access'");
    expect(marketplacePage).toContain("You're credited on this blueprint. Buyers subscribe; co-authors do not.");
    expect(coAuthorAccessMigration).toContain('FROM public.blueprint_authors ba');
    expect(coAuthorAccessMigration).toContain("v_viewer_role := 'co_author';");
    expect(coAuthorAccessMigration).toContain("'viewer_role', v_viewer_role");
  });

  it('lets marketplace authors mentor subscribed copied steps from Studio subscribers', () => {
    expect(studioSubscribersHook).toContain('export interface StudioSubscriberStep');
    expect(studioSubscribersHook).toContain("supabase.rpc('studio_author_subscriber_steps'");
    expect(studioSubscribersPage).toContain('useStudioSubscriberSteps(plan.blueprintId, subscriber.userId)');
    expect(studioSubscribersPage).toContain('useFocusEffect(');
    expect(studioSubscribersPage).toContain('void refetchSteps();');
    expect(studioSubscribersPage).toContain('<SubscriberStepReviewRow');
    expect(studioSubscribersPage).toContain('Open reviewed step');
    expect(studioSubscribersPage).toContain('/creator/subscriber-step/${stepId}');
    expect(studioSubscribersPage).toContain('<SuggestStepSheet');
    expect(studioSubscribersPage).toContain('Suggest next');
    expect(studioSubscribersPage).toContain('Retry requested');
    expect(studioMentoringMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.studio_author_subscriber_steps',
    );
    expect(studioMentoringMigration).toContain('CREATE OR REPLACE FUNCTION public.get_studio_author_marketplace_step_ids');
    expect(studioMentoringMigration).toContain('public.is_blueprint_author_or_coauthor');
    expect(studioMentoringMigration).toContain('blueprint_authors ba');
    expect(studioMentoringMigration).toContain('source_type = \'marketplace_copy\'');
    expect(studioMentoringMigration).toContain('DROP POLICY IF EXISTS "Blueprint authors can view adopted step copies"');
    expect(studioMentoringMigration).toContain('DROP POLICY IF EXISTS "Blueprint authors can update adopted step metadata"');
    expect(mentoringPanel).toContain("queryClient.invalidateQueries({ queryKey: ['studio-author-subscriber-steps'] });");
  });

  it('creates checkout sessions with buyer auth, return URLs, and Stripe marketplace metadata', () => {
    expect(marketplaceHooks).toContain('const { data: { session } } = await supabase.auth.getSession();');
    expect(marketplaceHooks).toContain("if (!session) throw new Error('Sign in to subscribe');");
    expect(marketplaceHooks).toContain('Authorization: `Bearer ${session.access_token}`');
    expect(marketplaceHooks).toContain('blueprint_id: blueprintId');
    expect(marketplaceHooks).toContain('success_url: `${origin}/marketplace?stripe=success&bp=${blueprintId}`');
    expect(marketplaceHooks).toContain('cancel_url: `${origin}/marketplace?stripe=cancelled&bp=${blueprintId}`');
    expect(marketplaceHooks).toContain("throw new Error(payload?.error ?? 'Checkout session failed');");
    expect(marketplaceHooks).toContain('return { url: payload.url, sessionId: payload.session_id };');

    expect(checkoutFunction).toContain("metadata: {\n        blueprint_id: blueprint.id,\n        buyer_user_id: user.id");
    expect(checkoutFunction).toContain('client_reference_id: `${blueprint.id}:${user.id}`');
    expect(checkoutFunction).toContain("blueprint.access_mode !== 'independent'");
    expect(checkoutFunction).toContain('!blueprint.stripe_price_id');
    expect(checkoutFunction).toContain('stripe.checkout.sessions.create(sessionParams)');
  });

  it('allows free live marketplace blueprints to list without Stripe and subscribe through blueprint relationships', () => {
    expect(marketplacePage).toContain("if (cents <= 0) return 'Free';");
    expect(freeMarketplaceMigration).toContain('OR COALESCE(price_per_seat_cents, 0) = 0');
    expect(freeMarketplaceMigration).toContain("AND b.status = 'live'");
    expect(freeMarketplaceMigration).toContain('EXISTS (\n        SELECT 1 FROM public.blueprint_step_templates t');
    expect(freeMarketplaceMigration).toContain("bs.blueprint_system = 'marketplace'");
    expect(freeMarketplaceMigration).toContain("v_bp.status <> 'live'");
    expect(freeMarketplaceMigration).toContain("stripe_price_id', v_bp.stripe_price_id");
    expect(freeSubscribePolicyMigration).toContain('can_subscribe_to_marketplace_blueprint');
    expect(freeSubscribePolicyMigration).toContain("WHEN blueprint_system = 'marketplace'");
    expect(freeSubscribePolicyMigration).toContain('RETURN true;');
    expect(freeSubscribePolicyMigration).toContain("ms.status IN ('active', 'trialing')");
  });

  it('includes discoverable marketplace blueprints in global plan search', () => {
    expect(globalSearchService).toContain('searchMarketplaceBlueprints(trimmed)');
    expect(globalSearchService).toContain("supabase.rpc('list_marketplace_blueprints'");
    expect(globalSearchService).toContain("route: `/marketplace/${bp.id}`");
    expect(globalSearchService).toContain("Number(bp.price_per_seat_cents ?? 0) > 0");
  });

  it('lists buyer subscriptions and schedules cancellation without removing paid-period access', () => {
    expect(subscriptionsPage).toContain('const { subscriptions, loading, cancel } = useMySubscriptions();');
    expect(subscriptionsPage).toContain('access stays through the end of your current billing period.');
    expect(subscriptionsPage).toContain('const cancelable =\n              (sub.status === \'active\' || sub.status === \'trialing\') &&\n              !sub.cancelAtPeriodEnd;');
    expect(subscriptionsPage).toContain("` · access through ${periodEnd}`");
    expect(subscriptionsPage).toContain("Cancels {formatDate(sub.currentPeriodEnd) ?? 'end of period'}");
    expect(subscriptionsPage).toContain("onPress={() => handleCancel(sub.id)}");

    expect(subscriptionsHook).toContain(".from('marketplace_subscriptions')");
    expect(subscriptionsHook).toContain(".eq('buyer_user_id', user.id)");
    expect(subscriptionsHook).toContain('Authorization: `Bearer ${session.access_token}`');
    expect(subscriptionsHook).toContain('body: JSON.stringify({ subscription_id: subscriptionId })');
    expect(subscriptionsHook).toContain("queryClient.invalidateQueries({ queryKey });");

    expect(cancelFunction).toContain('row.buyer_user_id !== user.id');
    expect(cancelFunction).toContain('stripe.subscriptions.update(row.stripe_subscription_id, {\n          cancel_at_period_end: true,');
    expect(cancelFunction).toContain('cancel_at_period_end: true');
    expect(cancelFunction).toContain("status: 'canceled'");
    expect(cancelFunction).toContain('already_canceled: true');
    expect(cancelFunction).toContain('already_scheduled: true');
  });
});
