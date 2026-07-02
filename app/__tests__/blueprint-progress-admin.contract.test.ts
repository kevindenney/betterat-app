import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('blueprint subscriber progress and admin oversight flows', () => {
  const progressStrip = readSource('components/blueprint/BlueprintProgressStrip.tsx');
  const studentProgress = readSource('components/blueprint/StudentProgressSection.tsx');
  const blueprintHooks = readSource('hooks/useBlueprint.ts');
  const blueprintService = readSource('services/BlueprintService.ts');
  const adminBlueprints = readSource('app/admin/[orgId]/blueprints.tsx');
  const adminBlueprintHooks = readSource('hooks/useAdminOrgBlueprints.ts');
  const cohortLinkSheet = readSource('components/admin/BlueprintCohortLinkSheet.tsx');

  it('renders subscribed blueprint sections with adopt, unsubscribe, mentor suggestions, and peer progress', () => {
    expect(progressStrip).toContain('useSubscribedBlueprints(interestId)');
    expect(progressStrip).toContain('useSuggestedNextSteps(interestId)');
    expect(progressStrip).toContain('usePeerTimelines(interestId)');
    expect(progressStrip).toContain('<SuggestedStepsBar interestId={interestId} />');
    expect(progressStrip).toContain('usePersistedSet(COLLAPSED_KEY)');
    expect(progressStrip).toContain('usePersistedSet(PINNED_PEERS_KEY)');
    expect(progressStrip).toContain('const { data: steps } = useBlueprintSteps(blueprint.blueprint_id);');
    expect(progressStrip).toContain('const isAdopted = adoptedSourceIds.has(step.id) || localAdoptedIds.has(step.id);');
    expect(progressStrip).toContain('await adoptMutation.mutateAsync({');
    expect(progressStrip).toContain('subscriptionId: blueprint.subscription_id');
    expect(progressStrip).toContain('blueprintId: blueprint.blueprint_id');
    expect(progressStrip).toContain('setLocalAdoptedIds((prev) => new Set(prev).add(stepId));');
    expect(progressStrip).toContain('unsubscribeMutation.mutateAsync(blueprint.blueprint_id)');
  });

  it('records adopt and dismiss actions against the exact subscription and refreshes next-step state', () => {
    expect(blueprintHooks).toContain("await markStepAction(subscriptionId, sourceStepId, 'adopted', adopted.id);");
    expect(blueprintHooks).toContain("await markStepAction(subscriptionId, sourceStepId, 'dismissed');");
    expect(blueprintHooks).toContain("queryClient.invalidateQueries({ queryKey: ['blueprint-new-steps'] });");
    expect(blueprintHooks).toContain("queryClient.invalidateQueries({ queryKey: ['blueprint-suggested-next'] });");
    expect(blueprintService).toContain(".from('blueprint_step_actions')");
    expect(blueprintService).toContain("{ onConflict: 'subscription_id,source_step_id' }");
    expect(blueprintService).toContain('adopted_step_id: adoptedStepId ?? null');
  });

  it('lets authors review subscriber adoption, completion, dismissal, ratings, and read-only adopted steps', () => {
    expect(studentProgress).toContain('useBlueprintSubscriberProgress(blueprintId)');
    expect(studentProgress).toContain('No subscribers yet');
    expect(studentProgress).toContain('progress.reduce((sum, p) => sum + p.completed_count, 0)');
    expect(studentProgress).toContain("router.push(`/step/${adoptedStepId}?readOnly=true` as any)");
    expect(studentProgress).toContain("queryKey: ['competency-progress', subscriber.subscriber_id, interestId]");
    expect(studentProgress).toContain('enabled: expanded && Boolean(interestId)');
    expect(studentProgress).toContain("sp.action === 'dismissed'");
    expect(studentProgress).toContain('sp?.overall_rating != null && sp.overall_rating > 0');
    expect(studentProgress).toContain('sp?.has_evidence');

    expect(blueprintHooks).toContain('queryFn: () => getBlueprintSubscriberProgress(blueprintId!)');
    expect(blueprintService).toContain(".rpc('get_blueprint_subscriber_progress'");
    expect(blueprintService).toContain("adopted_count: steps.filter((s: any) => s.action === 'adopted').length");
    expect(blueprintService).toContain("completed_count: steps.filter((s: any) => s.status === 'completed').length");
    expect(blueprintService).toContain("dismissed_count: steps.filter((s: any) => s.action === 'dismissed').length");
    expect(blueprintService).toContain(".eq('subscriber_id', subscriberId)");
    expect(blueprintService).toContain(".eq('action', 'adopted')");
    expect(blueprintService).toContain(".sort((a, b) => a.sort_order - b.sort_order)");
  });

  it('shows org admins a real blueprint oversight list and routes selected rows to Studio', () => {
    expect(adminBlueprints).toContain('useAdminOrgBlueprints(orgId as string)');
    expect(adminBlueprints).toContain("const live = blueprints.filter((b) => b.status === 'live').length;");
    expect(adminBlueprints).toContain("const draft = blueprints.filter((b) => b.status === 'draft').length;");
    expect(adminBlueprints).toContain("const review = blueprints.filter((b) => b.status === 'review').length;");
    expect(adminBlueprints).toContain('const subs = blueprints.reduce((sum, b) => sum + b.subscribers, 0);');
    expect(adminBlueprints).toContain('total subscriber-seats');
    expect(adminBlueprints).toContain('Not yet assigned to a cohort');
    expect(adminBlueprints).toContain('onPress={() => router.push(`/studio/blueprints/${b.id}` as any)}');

    expect(adminBlueprintHooks).toContain("queryKey: ['admin-org-blueprints', orgId]");
    expect(adminBlueprintHooks).toContain("enabled: !!orgId");
    expect(adminBlueprintHooks).toContain(".rpc('admin_org_blueprints', {");
    expect(adminBlueprintHooks).toContain('cohortLabels: r.cohort_labels ?? []');
    expect(adminBlueprintHooks).toContain('subscribers: r.subscribers');
  });

  it('links blueprints to cohorts idempotently and refreshes Studio/admin surfaces', () => {
    expect(cohortLinkSheet).toContain('const linked = useMemo(() => new Set(linkedCohortIds), [linkedCohortIds]);');
    expect(cohortLinkSheet).toContain('const pool = cohorts.filter((c) => !linked.has(c.id));');
    expect(cohortLinkSheet).toContain("c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)");
    expect(cohortLinkSheet).toContain("if (ids.length === 0) throw new Error('Select at least one cohort.');");
    expect(cohortLinkSheet).toContain(".from('blueprint_cohorts')");
    expect(cohortLinkSheet).toContain(".upsert(payload, { onConflict: 'blueprint_id,cohort_id', ignoreDuplicates: true })");
    expect(cohortLinkSheet).toContain("p_verb: 'blueprint_cohort_link'");
    expect(cohortLinkSheet).toContain("queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });");
    expect(cohortLinkSheet).toContain("queryClient.invalidateQueries({ queryKey: ['admin-cohorts', orgId] });");
    expect(cohortLinkSheet).toContain('onLinked?.(count);');
    expect(cohortLinkSheet).toContain('setSelected(new Set());');
    expect(cohortLinkSheet).toContain('setSearch(\'\');');
    expect(cohortLinkSheet).toContain('onClose();');
  });
});
