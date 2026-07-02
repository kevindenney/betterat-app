import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('blueprint subscription and mentoring user flows', () => {
  const blueprintPage = readSource('app/blueprint/[slug].tsx');
  const blueprintHooks = readSource('hooks/useBlueprint.ts');
  const blueprintService = readSource('services/BlueprintService.ts');
  const mentoringPanel = readSource('components/creator/CreatorMentoringPanel.tsx');
  const notificationService = readSource('services/NotificationService.ts');
  const reflectShell = readSource('components/step/reflect-tab/ReflectTabIOSRegisterShell.tsx');

  it('keeps the public blueprint page wired for subscribe, unsubscribe, and first-step adoption', () => {
    expect(blueprintPage).toContain('useBlueprintSubscription(blueprint?.id)');
    expect(blueprintPage).toContain('const subscribeMutation = useSubscribe();');
    expect(blueprintPage).toContain('const unsubscribeMutation = useUnsubscribe();');
    expect(blueprintPage).toContain('const adoptStepMutation = useAdoptBlueprintStep();');
    expect(blueprintPage).toContain("testID=\"blueprint-subscribe\"");
    expect(blueprintPage).toContain("testID=\"blueprint-add-first-step\"");

    expect(blueprintPage).toContain("pathname: '/(auth)/signup'");
    expect(blueprintPage).toContain('returnTo: `/blueprint/${slug}`');
    expect(blueprintPage).toContain('const sub = await subscribeMutation.mutateAsync(blueprint.id);');
    expect(blueprintPage).toContain('setRecentSubscriptionId(sub.id);');
    expect(blueprintPage).toContain('NotificationService');
    expect(blueprintPage).toContain('notifyBlueprintSubscribed');

    expect(blueprintPage).toContain('showConfirm(');
    expect(blueprintPage).toContain('Steps already added to your timeline stay put.');
    expect(blueprintPage).toContain('await unsubscribeMutation.mutateAsync(blueprint.id);');
    expect(blueprintPage).toContain('setRecentSubscriptionId(null);');
    expect(blueprintPage).toContain('setAdoptedFirstStepId(null);');
  });

  it('requires a real subscription id before copying a blueprint step to the subscriber timeline', () => {
    expect(blueprintPage).toContain('const effectiveSubscriptionId = subscription?.id ?? recentSubscriptionId;');
    expect(blueprintPage).toContain("if (!blueprint?.interest_id || !blueprint?.id || !effectiveSubscriptionId || !steps?.[0]) return;");
    expect(blueprintPage).toContain('sourceStepId: steps[0].id');
    expect(blueprintPage).toContain('subscriptionId: effectiveSubscriptionId');
    expect(blueprintPage).toContain('blueprintId: blueprint.id');
    expect(blueprintPage).toContain('setAdoptedFirstStepId(firstAdopted.id);');
    expect(blueprintPage).toContain("params: { selected: firstAdopted.id, level: '1' }");
  });

  it('invalidates subscriber-facing caches after subscribe and unsubscribe mutations', () => {
    expect(blueprintHooks).toContain("queryClient.invalidateQueries({ queryKey: ['blueprint-subscriptions'], refetchType: 'all' });");
    expect(blueprintHooks).toContain("queryClient.invalidateQueries({ queryKey: ['blueprint-subscribed'], refetchType: 'all' });");
    expect(blueprintHooks).toContain("queryClient.invalidateQueries({ queryKey: ['blueprint-new-steps'], refetchType: 'all' });");
    expect(blueprintHooks).toContain("queryClient.invalidateQueries({ queryKey: ['blueprint-suggested-next'], refetchType: 'all' });");
    expect(blueprintHooks).toContain("queryClient.invalidateQueries({ queryKey: ['timeline-steps'], refetchType: 'all' });");
    expect(blueprintHooks).toContain("queryClient.invalidateQueries({ queryKey: ['library-plans'], refetchType: 'all' });");
    expect(blueprintHooks).toContain("queryClient.invalidateQueries({ queryKey: ['library-counts'], refetchType: 'all' });");
    expect(blueprintHooks).toContain("queryClient.invalidateQueries({ queryKey: ['library-zones-data'], refetchType: 'all' });");
    expect(blueprintHooks).toContain('invalidateFollowQueries(queryClient, user?.id);');
  });

  it('checks access before subscribing, auto-follows the author, and deletes exact subscriptions on unsubscribe', () => {
    const accessIndex = blueprintService.indexOf('const access = await checkBlueprintAccess(subscriberId, blueprint);');
    const upsertIndex = blueprintService.indexOf(".from('blueprint_subscriptions')\n      .upsert");
    const followIndex = blueprintService.indexOf(".from('user_follows')");

    expect(accessIndex).toBeGreaterThan(-1);
    expect(upsertIndex).toBeGreaterThan(accessIndex);
    expect(followIndex).toBeGreaterThan(upsertIndex);
    expect(blueprintService).toContain("if (!access.allowed) {\n      throw new Error(access.reason ?? 'Access denied');\n    }");
    expect(blueprintService).toContain("if (blueprint.user_id !== subscriberId)");
    expect(blueprintService).toContain("{ onConflict: 'follower_id,following_id' }");

    expect(blueprintService).toContain(".delete()\n      .eq('blueprint_id', blueprintId)\n      .eq('subscriber_id', subscriberId)");
    expect(blueprintService).toContain("throw new Error('Blueprint subscription not found.');");
  });

  it('lets mentors save review decisions and suggested next work without writing to the wrong learner', () => {
    expect(mentoringPanel).toContain('instructor_review_status: selectedStatus');
    expect(mentoringPanel).toContain('instructor_review_note: reviewNote.trim() || undefined');
    expect(mentoringPanel).toContain('instructor_review_at: new Date().toISOString()');
    expect(mentoringPanel).toContain('instructor_suggested_next: suggestedNext.trim() || undefined');
    expect(mentoringPanel).toContain('NotificationService.notifyStepReviewed');
    expect(mentoringPanel).toContain('targetUserId: step.user_id');
    expect(mentoringPanel).toContain('actorId: user.id');
    expect(mentoringPanel).toContain('stepId,');
    expect(mentoringPanel).toContain('reviewStatus: selectedStatus');
    expect(mentoringPanel).toContain('reviewNote: reviewNote.trim() || undefined');
    expect(mentoringPanel).toContain('suggestedNext: suggestedNext.trim() || undefined');
    expect(mentoringPanel).toContain('if (step?.user_id && user?.id && step.user_id !== user.id)');
    expect(notificationService).toContain('review_note: input.reviewNote?.trim() || null');
    expect(notificationService).toContain('suggested_next: input.suggestedNext?.trim() || null');
  });

  it('shows author feedback in the active learner reflect shell', () => {
    expect(reflectShell).toContain('const authorReviewNote = review?.instructor_review_note?.trim();');
    expect(reflectShell).toContain('const authorSuggestedNext = review?.instructor_suggested_next?.trim();');
    expect(reflectShell).toContain('Reviewed by author');
    expect(reflectShell).toContain('Retry requested by author');
    expect(reflectShell).toContain('Do this next time');
  });
});
