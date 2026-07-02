import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('blueprint authoring and curation user flows', () => {
  const publishSheet = readSource('components/blueprint/PublishBlueprintSheet.tsx');
  const blueprintService = readSource('services/BlueprintService.ts');
  const blueprintHooks = readSource('hooks/useBlueprint.ts');
  const studioPage = readSource('app/studio/blueprints/[id].tsx');
  const editorHooks = readSource('hooks/useBlueprintEditor.ts');
  const studioHooks = readSource('hooks/useStudioBlueprint.ts');
  const pricingTab = readSource('components/studio/BlueprintEditorTabBodies.tsx');
  const coAuthorSheet = readSource('components/studio/BlueprintCoAuthorSheet.tsx');

  it('publishes a timeline blueprint with access, pricing, and post-publish curation handoff', () => {
    expect(publishSheet).toContain('const createBlueprint = useCreateBlueprint();');
    expect(publishSheet).toContain('const updateBlueprint = useUpdateBlueprint();');
    expect(publishSheet).toContain('if (!user?.id || !title.trim()) return;');
    expect(publishSheet).toContain("const priceCents = accessLevel === 'paid' && priceDollars");
    expect(publishSheet).toContain('Math.round(parseFloat(priceDollars) * 100)');
    expect(publishSheet).toContain('is_published: true');
    expect(publishSheet).toContain('organization_id: selectedOrgId || null');
    expect(publishSheet).toContain('program_id: selectedProgramId || null');
    expect(publishSheet).toContain('access_level: accessLevel');
    expect(publishSheet).toContain('price_cents: priceCents');
    expect(publishSheet).toContain("pricing_type: accessLevel === 'paid' ? pricingType : 'one_time'");
    expect(publishSheet).toContain('auto_curate: autoCurate');
    expect(publishSheet).toContain('await backfillAutoCurateSteps(publishedId, user.id, interestId);');
    expect(publishSheet).toContain('setCuratingBlueprintId(publishedId);');
    expect(publishSheet).toContain('setJustPublished(true);');
  });

  it('persists pricing type on new timeline blueprint creation for paid checkout correctness', () => {
    expect(blueprintService).toContain(".from('timeline_blueprints')\n      .insert({");
    expect(blueprintService).toContain('access_level: input.access_level ?? \'public\'');
    expect(blueprintService).toContain('price_cents: input.price_cents ?? null');
    expect(blueprintService).toContain("currency: input.currency ?? 'usd'");
    expect(blueprintService).toContain("pricing_type: input.pricing_type ?? (input.access_level === 'paid' ? 'recurring' : 'one_time')");
  });

  it('curates only eligible timeline steps and saves deterministic blueprint step order', () => {
    expect(publishSheet).toContain("mySteps.filter((s) => s.visibility !== 'private' && !(s as any)._pinned)");
    expect(publishSheet).toContain('setSelectedStepIds(new Set(curatedSteps.map((s) => s.id)))');
    expect(publishSheet).toContain('await setBlueprintSteps.mutateAsync({\n        blueprintId: curatingBlueprintId,\n        stepIds: Array.from(selectedStepIds),\n      });');
    expect(blueprintService).toContain(".from('blueprint_steps')\n      .delete()\n      .eq('blueprint_id', blueprintId)");
    expect(blueprintService).toContain('const rows = stepIds.map((stepId, index) => ({\n      blueprint_id: blueprintId,\n      step_id: stepId,\n      sort_order: index,');
    expect(blueprintService).toContain("const { error: insErr } = await supabase\n      .from('blueprint_steps')\n      .insert(rows);");
    expect(blueprintHooks).toContain('useSetBlueprintSteps');
    expect(blueprintHooks).toContain('queryClient.invalidateQueries({ queryKey: keys.steps(blueprintId) });');
  });

  it('blocks unsafe interest migration and preserves subscriber timeline copies when moving curated blueprints', () => {
    expect(publishSheet).toContain('const migrateBlueprintMutation = useMigrateBlueprint();');
    expect(publishSheet).toContain('Your ${activeBlueprint?.subscriber_count ?? 0} subscriber(s) will keep their adopted steps.');
    expect(publishSheet).toContain('await migrateBlueprintMutation.mutateAsync({\n                                    blueprintId: activeBlueprint!.id,\n                                    newInterestId: interest.id,\n                                  });');
    expect(blueprintService).toContain(".from('blueprint_steps')\n    .select('step_id')\n    .eq('blueprint_id', blueprintId)\n    .limit(1)");
    expect(blueprintService).toContain('Blueprint must have curated steps before moving to a different interest.');
    expect(blueprintService).toContain('migrated_from_interest_id: current.interest_id');
    expect(blueprintService).toContain('interest_id: newInterestId');
  });

  it('creates and edits Studio blueprints with guarded independent pricing and Stripe listing', () => {
    expect(studioPage).toContain('const createBlueprint = useCreateBlueprint();');
    expect(studioPage).toContain('const updateMeta = useUpdateBlueprintMeta(blueprintId);');
    expect(studioPage).toContain('const trimmed = priceText.trim();');
    expect(studioPage).toContain('const parsed = parseFloat(trimmed);');
    expect(studioPage).toContain("if (trimmed === '') return 0;");
    expect(studioPage).toContain('if (!isFinite(parsed) || parsed < 0) return null;');
    expect(studioPage).toContain('const { currentInterest, userInterests, allInterests } = useInterest();');
    expect(studioPage).toContain('const [interestId, setInterestId] = useState<string | null>');
    expect(studioPage).toContain('interests={interestOptions}');
    expect(studioPage).toContain('selectedInterestId={interestId}');
    expect(studioPage).toContain('pricePerSeatCents: accessMode === \'independent\' ? parsePriceCents() : null');
    expect(studioPage).toContain('interestId,');
    expect(studioPage).toContain('router.replace(`/studio/blueprints/${newId}`);');
    expect(studioPage).toContain('if (accessMode === \'independent\') {');
    expect(studioPage).toContain("showAlert('Enter a valid price', 'Use 0 for a free blueprint, or enter a paid price.');");
    expect(studioPage).toContain('if (accessMode === \'independent\' && priceCents != null && priceCents > 0) {');
    expect(studioPage).toContain('Saved as a free blueprint. It will now appear in the marketplace catalog.');
    expect(studioPage).toContain('await syncStripe.mutateAsync();');
    expect(studioPage).toContain('Saved and listed on Stripe. It will now appear in the marketplace catalog.');

    expect(editorHooks).toContain(".from('blueprints')\n        .insert(payload)");
    expect(editorHooks).toContain('interest_id: input.interestId ?? null');
    expect(editorHooks).toContain("org_id: input.accessMode === 'independent' ? null : input.orgId ?? null");
    expect(editorHooks).toContain('if (patch.interestId !== undefined) payload.interest_id = patch.interestId;');
    expect(editorHooks).toContain('payload.price_per_seat_cents = input.pricePerSeatCents;');
    expect(editorHooks).toContain(".from('blueprints')\n        .update(payload)\n        .eq('id', blueprintId)\n        .select('id')");
    expect(editorHooks).toContain("throw new Error('You do not have permission to edit this blueprint.');");

    expect(studioHooks).toContain("if (isNew) {");
    expect(studioHooks).toContain("id: 'new'");
    expect(studioHooks).toContain('interestId: bp?.interest_id ?? null');
    expect(studioHooks).toContain("accessMode: activeOrg ? 'institutional' : 'independent'");
    expect(pricingTab).toContain('List on Stripe');
    expect(pricingTab).toContain('const isFree = pricing.pricePerSeatCents != null && pricing.pricePerSeatCents <= 0;');
    expect(pricingTab).toContain('Free independent blueprints publish directly to the marketplace.');
    expect(pricingTab).toContain("window.open(url, '_blank', 'noopener,noreferrer');");
    expect(studioPage).toContain("accessMode={accessMode}");
    expect(studioPage).toContain("const isInstitutional = accessMode === 'institutional';");
    expect(studioPage).toContain('Personal blueprints are shared with individual subscribers.');
    expect(pricingTab).toContain('Personal blueprints do not use cohorts');
  });

  it('lets Studio authors tag step capabilities from the institution taxonomy, not free text', () => {
    const stepHooks = readSource('hooks/useBlueprintSteps.ts');
    const cohortService = readSource('services/CohortBlueprintService.ts');
    const evidenceService = readSource('services/CapabilityEvidenceService.ts');
    const migration = readSource(
      'supabase/migrations/20260701073000_blueprint_step_template_competency_ids.sql',
    );

    expect(pricingTab).toContain('useBlueprintCapabilities(');
    expect(pricingTab).toContain('capabilityGroups={capabilityGroups}');
    expect(pricingTab).toContain('function StepCapabilityPicker');
    expect(pricingTab).toContain('Add from institution taxonomy');
    expect(pricingTab).toContain('capability.fullLabel');
    expect(pricingTab).toContain('capabilityCompetencyIds');
    expect(pricingTab).toContain('capability.competencyId');
    expect(stepHooks).toContain('capabilityCompetencyIds: string[];');
    expect(stepHooks).toContain('capability_competency_ids');
    expect(cohortService).toContain('competency_ids: t.capability_competency_ids ?? []');
    expect(evidenceService).toContain('if (byId.has(row.capabilityId)) return row.capabilityId;');
    expect(evidenceService).toContain('orgCompetencyNameById?.get(id)');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS capability_competency_ids uuid[]');
    expect(migration).toContain('capability_competency_ids = matched.competency_ids');
    expect(pricingTab).not.toContain('placeholder="Comma-separated capabilities"');
  });

  it('lets Studio authors add existing org members as blueprint co-author credits', () => {
    const migration = readSource(
      'supabase/migrations/20260701084500_blueprint_co_author_credits.sql',
    );

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.blueprint_authors');
    expect(migration).toContain('PRIMARY KEY (blueprint_id, user_id)');
    expect(migration).toContain('user_id uuid NOT NULL REFERENCES public.users(id)');
    expect(migration).toContain('blueprint_authors_insert_v1');
    expect(migration).toContain('blueprint_authors.user_id IS DISTINCT FROM b.author_user_id');
    expect(studioHooks).toContain(".from('blueprint_authors')");
    expect(studioHooks).toContain('coAuthorUsers.map((coAuthor)');
    expect(editorHooks).toContain('useAddBlueprintCoAuthor');
    expect(editorHooks).toContain(".from('blueprint_authors')");
    expect(editorHooks).toContain('useRemoveBlueprintCoAuthor');
    expect(studioPage).toContain('<BlueprintCoAuthorSheet');
    expect(studioPage).toContain(
      'authorCreditOrgId={blueprint.orgId ?? activeOrg?.org_id ?? menu.memberships[0]?.org_id ?? null}',
    );
    expect(studioPage).toContain("orgId={accessMode === 'institutional' ? authorCreditOrgId : null}");
    expect(studioPage).toContain('onPress={handleAddCoAuthor}');
    expect(studioPage).toContain('handleRemoveCoAuthor');
    expect(coAuthorSheet).toContain('Modal');
    expect(coAuthorSheet).toContain('useAdminPeople(orgId ??');
    expect(coAuthorSheet).toContain("queryKey: ['blueprint-co-author-user-search', trimmedSearch]");
    expect(coAuthorSheet).toContain(".from('users')");
    expect(coAuthorSheet).toContain('Credit an existing BetterAt user');
    expect(coAuthorSheet).toContain('coAuthorErrorMessage');
    expect(coAuthorSheet).toContain('row.status === \'active\'');
    expect(coAuthorSheet).toContain('Credit an existing workspace member');
  });
});
