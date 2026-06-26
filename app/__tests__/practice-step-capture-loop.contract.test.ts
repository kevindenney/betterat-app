import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('practice, step, and capture loop contracts', () => {
  it('keeps the Practice tab routed to the canonical timeline zoom surface', () => {
    const practiceTab = readSource('app/(tabs)/practice.tsx');
    const racesTab = readSource('app/(tabs)/races.tsx');
    const zoomScreen = readSource('components/ios-register/timeline-zoom/TimelineZoomPracticeScreen.tsx');

    expect(practiceTab).toContain("export { default } from './races';");
    expect(racesTab).toContain('FEATURE_FLAGS.TIMELINE_ZOOM_PRACTICE_CUTOVER');
    expect(racesTab).toContain('return <TimelineZoomPracticeScreen />;');
    expect(zoomScreen).toContain('const routeLevel = useMemo<ZoomLevel | null>');
    expect(zoomScreen).toContain('if (n === 2) return 1;');
    expect(zoomScreen).toContain('const resolvedSelectedStepId = useMemo');
    expect(zoomScreen).toContain('saveLastViewState({ interestSlug: slug, zoomLevel: level, selectedStepId: focusStepId });');
    expect(zoomScreen).toContain('router.push(`/step/${stepId}` as never);');
    expect(zoomScreen).toContain('router.push(`/step/${stepId}?tab=review` as never);');
  });

  it('keeps the universal plus create-step path optimistic, season-aware, and blueprint-aware', () => {
    const provider = readSource('components/capture/UniversalPlusProvider.tsx');
    const sheet = readSource('components/ios-register/timeline-zoom/StepAddSheet.tsx');
    const logic = readSource('components/ios-register/timeline-zoom/StepAddSheet.logic.ts');

    expect(provider).toContain('FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER');
    expect(provider).toContain('insertOptimisticNextUpStep');
    expect(provider).toContain('metadata: {');
    expect(provider).toContain("capture_source: 'universal_plus_sheet'");
    expect(provider).toContain('...(payload.viewedSeasonId ? { season_id: payload.viewedSeasonId } : {})');
    expect(provider).toContain('await createDraftStep({');
    expect(provider).toContain('seasonId: currentSeason?.id ?? null');
    expect(provider).toContain("router.navigate({\n          pathname: '/(tabs)/races'");
    expect(provider).toContain('<StepAddSheet');
    expect(provider).toContain('showRaceSelector={isSailRacing}');
    expect(provider).toContain('venueId={isSailRacing ? homeVenue?.id ?? null : null}');

    expect(sheet).toContain('From your blueprints');
    expect(sheet).toContain('useSuggestedNextSteps(currentInterest?.id)');
    expect(sheet).toContain('useAdoptBlueprintStep');
    expect(sheet).toContain('subscriptionId: s.subscription_id');
    expect(sheet).toContain('blueprintId: s.blueprint_id');
    expect(sheet).toContain('viewedSeasonId,');
    expect(sheet).toContain('The blueprint author can see your progress on these steps.');
    expect(sheet).toContain('From your other interests');
    expect(sheet).toContain('onStartFromLink');
    expect(logic).toContain('export function buildStepAddPayload');
    expect(logic).toContain('runthroughBeats: workedBeats.length > 0 ? workedBeats : undefined');
  });

  it('keeps Chrome web, Android, and iOS capture differences explicit', () => {
    const quickCapture = readSource('components/capture/QuickCaptureComposer.tsx');
    const universalSheet = readSource('components/capture/UniversalPlusSheet.tsx');
    const stepAddSheet = readSource('components/ios-register/timeline-zoom/StepAddSheet.tsx');

    expect(quickCapture).toContain("const VOICE_SUPPORTED = Platform.OS !== 'web';");
    expect(quickCapture).toContain("VOICE_SUPPORTED ? (\n        <Pressable");
    expect(quickCapture).toContain("accessibilityLabel={isRecording ? 'Stop recording' : 'Hold to record voice'}");
    expect(quickCapture).toContain('voiceNoteService.startRecording({ maxDuration: 60 })');
    expect(quickCapture).toContain('voiceNoteService.stopRecording()');
    expect(quickCapture).toContain("web: { outlineStyle: 'none', resize: 'none', overflow: 'hidden' } as any");

    expect(universalSheet).toContain("const VOICE_SUPPORTED = Platform.OS !== 'web';");
    expect(universalSheet).toContain("Tap to type. We'll name it for you.");
    expect(universalSheet).toContain('android: { elevation: 24 }');
    expect(universalSheet).toContain("web: {\n        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.18)'");

    expect(stepAddSheet).toContain("if (Platform.OS === 'web') {\n      showAlert('Photo', 'Adding a photo is available on iOS and Android.');");
    expect(stepAddSheet).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");
  });

  it('keeps step detail Plan, Do, Reflect, Discuss, and safe navigation behavior intact', () => {
    const route = readSource('app/step/[id].tsx');
    const detail = readSource('components/step/StepDetailContent.tsx');

    expect(route).toContain("const backLabel =\n    sourceOrigin === 'atlas' ? 'Atlas' : sourceOrigin === 'watch' ? 'Watch' : 'Practice';");
    expect(route).toContain('router.canGoBack()\n      ? router.back()\n      : router.replace(getEventTabRoute() as any);');
    expect(route).toContain("Platform.OS === 'web' ? (");
    expect(route).toContain("pathname: '/(tabs)/races'");
    expect(route).toContain("params: { level: String(next), selected: actualId }");

    expect(detail).toContain("type TabValue = 'plan' | 'act' | 'review' | 'discussion';");
    expect(detail).toContain("case 'in_progress': return 'act';");
    expect(detail).toContain("case 'completed': return 'review';");
    expect(detail).toContain("routeParams?.scope === 'cohort' || routeTab === 'discussion'");
    expect(detail).toContain("<PlanTab");
    expect(detail).toContain("<ActTab");
    expect(detail).toContain("<ReviewTab");
    expect(detail).toContain("<StepDiscussionInline");
    expect(detail).toContain("handleNextTab('act')");
    expect(detail).toContain("handleNextTab('review')");
    expect(detail).toContain("router.push(`/(tabs)/practice?selected=${created.id}` as any);");
  });

  it('keeps Android due-date editing available through the shared picker modal', () => {
    const detail = readSource('components/step/StepDetailContent.tsx');
    const duePicker = readSource('components/step/DueDatePickerModal.tsx');

    expect(detail).toContain("import { DueDatePickerModal } from './DueDatePickerModal';");
    expect(detail).toContain('const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false);');
    expect(detail).toContain('const handleSelectDueDate = useCallback((dueAt: string) => {');
    expect(detail).toContain('setDueDatePickerOpen(true);');
    expect(detail).toContain('<DueDatePickerModal');
    expect(detail).not.toContain('Android picker is coming soon.');

    expect(duePicker).toContain('Platform.OS === \'web\' ? (');
    expect(duePicker).toContain('keyboardType="numbers-and-punctuation"');
    expect(duePicker).toContain('TIME_PRESETS.map');
    expect(duePicker).toContain("title = 'Set Due Date'");
  });

  it('keeps reflection share messages BetterAt-branded', () => {
    const shareActivity = readSource('components/reflect/ShareActivityButton.tsx');
    const weeklySummary = readSource('components/reflect/WeeklySummaryCard.tsx');
    const seasonRecap = readSource('components/reflect/SeasonRecapCard.tsx');

    expect(shareActivity).toContain('#BetterAt #Sailing');
    expect(shareActivity).toContain('Check out my sailing progress on BetterAt! #BetterAt #Sailing');
    expect(shareActivity).not.toContain('#RegattaFlow #Sailing');
    expect(shareActivity).not.toContain('Check out my sailing progress on RegattaFlow');

    expect(weeklySummary).toContain('#BetterAt #Sailing');
    expect(weeklySummary).not.toContain('#RegattaFlow #Sailing');

    expect(seasonRecap).toContain('#BetterAt #Sailing #YearInReview');
    expect(seasonRecap).not.toContain('#RegattaFlow #Sailing #YearInReview');
  });
});
