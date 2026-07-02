import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('race and sailing workflow contracts', () => {
  it('keeps add-race flows platform-aware with AI, manual, and save failure paths', () => {
    const source = readSource('components/races/AddRaceDialog/index.tsx');

    expect(source).toContain('USE_IOS_ADD_RACE_FORM');
    expect(source).toContain("Platform.OS !== 'web'");
    expect(source).toContain('<IOSAddRaceForm visible={visible} onClose={onClose} onSave={onSave} />');
    expect(source).toContain('USE_TUFTE_ADD_RACE_FORM');
    expect(source).toContain('<TufteAddRaceForm visible={visible} onClose={onClose} onSave={onSave} />');
    expect(source).toContain("<RaceTypeStep");
    expect(source).toContain("<InputMethodStep");
    expect(source).toContain("<AIExtractionStep");
    expect(source).toContain("<RaceDetailsStep");
    expect(source).toContain("setStep('ai-extraction')");
    expect(source).toContain("setStep('details')");
    expect(source).toContain('await onSave(data)');
    expect(source).toContain("showAlert('Save failed'");
    expect(source).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");
  });

  it('keeps races tab behavior split across web, iOS, Android, and the timeline cutover', () => {
    const source = readSource('app/(tabs)/races.tsx');

    expect(source).toContain('TIMELINE_ZOOM_PRACTICE_CUTOVER');
    expect(source).toContain('return <TimelineZoomPracticeScreen />');
    expect(source).toContain("const isMobileNative = Platform.OS === 'ios' || Platform.OS === 'android'");
    expect(source).toContain('USE_IOS_RACES_SCREEN');
    expect(source).toContain("Platform.OS !== 'web'");
    expect(source).toContain('<IOSRacesScreen');
    expect(source).toContain('router.push(`/race/${race.id}`)');
    expect(source).toContain('router.push(`/race/${raceId}`)');
    expect(source).toContain('<RaceCardsScreen');
    expect(source).toContain('router.push(`/race/ios/${item.id}`)');
    expect(source).toContain("if (Platform.OS === 'ios')");
    expect(source).toContain("if (Platform.OS === 'android')");
    expect(source).toContain("if (Platform.OS === 'web')");
  });

  it('keeps race detail route reusable on web and resilient across regattas and race_events', () => {
    const routeSource = readSource('app/race/[id].tsx');
    const detailSource = readSource('components/races/RaceDetailContent.tsx');

    expect(routeSource).toContain('const actualId = Array.isArray(id) ? id[0] : id');
    expect(routeSource).toContain("<RaceDetailContent raceId={actualId || ''} />");

    expect(detailSource).toContain('Accepts a raceId prop instead of reading route params');
    expect(detailSource).toContain("if (!raceId || raceId === '[id]') return");
    expect(detailSource).toContain(".from('regattas')");
    expect(detailSource).toContain(".from('race_events')");
    expect(detailSource).toContain("logger.warn('[RaceDetailContent] Race not found:'");
    expect(detailSource).toContain("setSelectedPhase('prep')");
    expect(detailSource).toContain('useRaceCollaborators(raceId || null)');
    expect(detailSource).toContain('ENABLE_RACE_CREW_CHAT');
    expect(detailSource).toContain('ENABLE_RACE_PRESENCE');
  });

  it('keeps registration, payment, and offline entry states sequenced', () => {
    const source = readSource('components/registration/RaceRegistrationWithPayment.tsx');

    expect(source).toContain("type RegistrationStep = 'form' | 'payment' | 'confirmation'");
    expect(source).toContain('raceRegistrationService.getEntry(createdEntryId)');
    expect(source).toContain("throw new Error('Failed to load entry details')");
    expect(source).toContain('if (entry.entry_fee_amount === 0)');
    expect(source).toContain("raceRegistrationService.confirmPayment(createdEntryId, 'free_entry')");
    expect(source).toContain("setCurrentStep('confirmation')");
    expect(source).toContain("setCurrentStep('payment')");
    expect(source).toContain("<RaceRegistrationForm");
    expect(source).toContain('onQueued={handleFormQueued}');
    expect(source).toContain("<PaymentFlowComponent");
    expect(source).toContain("showAlert('Offline'");
    expect(source).toContain("showConfirm(\n      'Cancel Registration'");
  });

  it('keeps committee control, result entry, protest, crew, and export paths intact', () => {
    const controlSource = readSource('app/club/race/control/[id].tsx');
    const resultSource = readSource('app/club/results/[raceId].tsx');

    expect(controlSource).toContain("type RaceResultsIdColumn = 'regatta_id' | 'race_id'");
    expect(controlSource).toContain('withRaceResultsColumnFallback');
    expect(controlSource).toContain("table: 'race_results'");
    expect(controlSource).toContain('startCountdown');
    expect(controlSource).toContain('handleRaceStart');
    expect(controlSource).toContain(".from('race_start_sequences').upsert");
    expect(controlSource).toContain("useState<'timer' | 'finishes' | 'flags' | 'protests' | 'crew'>('timer')");
    expect(controlSource).toContain('<CrewManifestTab raceId={id!} />');
    expect(controlSource).toContain('<ProtestModal');
    expect(controlSource).toContain("if (Platform.OS === 'web')");
    expect(controlSource).toContain('document.createElement');

    expect(resultSource).toContain("keyboardType={Platform.select({");
    expect(resultSource).toContain("ios: 'numbers-and-punctuation'");
    expect(resultSource).toContain("android: 'numbers-and-punctuation'");
    expect(resultSource).toContain("ios: 'decimal-pad'");
    expect(resultSource).toContain("android: 'decimal-pad'");
    expect(resultSource).toContain("showAlert('Invalid Time'");
    expect(resultSource).toContain("showAlert('Success', 'Results saved successfully')");
    expect(resultSource).toContain(".update({ status: 'completed' })");
  });

  it('keeps club onboarding agent outputs actionable with current support paths', () => {
    const source = readSource('services/agents/ClubOnboardingAgent.ts');

    expect(source).toContain('class ClubOnboardingAgent extends BaseAgentService');
    expect(source).toContain("task: 'Complete payment setup'");
    expect(source).toContain("link: '/club/billing'");
    expect(source).toContain("task: 'Create your first event'");
    expect(source).toContain("link: '/club/events/new'");
    expect(source).toContain('celebrationMessage');
    expect(source).toContain('Generated by BetterAt');
    expect(source).toContain('is now live on BetterAt');
    expect(source).toContain('Help me set up my club on BetterAt');
    expect(source).toContain("dashboardUrl: '/club/dashboard'");
    expect(source).toContain("videoTutorial: 'https://better.at/tutorials/getting-started'");
    expect(source).toContain("documentation: 'https://better.at/docs'");
    expect(source).toContain("supportEmail: 'info@better.at'");
    expect(source).not.toContain('https://regattaflow.io/training');
    expect(source).not.toContain("videoTutorial: 'https://regattaflow.io/tutorials/getting-started'");
    expect(source).not.toContain("documentation: 'https://regattaflow.io/docs'");
    expect(source).not.toContain('Generated by RegattaFlow');
    expect(source).not.toContain('is now live on RegattaFlow');
    expect(source).not.toContain('Help me set up my club on RegattaFlow');
    expect(source).not.toContain("supportEmail: 'support@regattaflow.io'");
  });

  it('keeps race and club share copy BetterAt-branded across web, iOS, and Android surfaces', () => {
    const shareTab = readSource('components/crew/tabs/ShareTab.tsx');
    const clubActionRow = readSource('components/club/ClubActionRow.tsx');
    const raceSummaryCard = readSource('components/cards/content/RaceSummaryCard.tsx');
    const teamInviteModal = readSource('components/team/TeamInviteModal.tsx');
    const teamRaceEntryHook = readSource('hooks/useTeamRaceEntry.ts');

    expect(shareTab).toContain("if (Platform.OS === 'web' && typeof window !== 'undefined')");
    expect(shareTab).toContain('return `${window.location.origin}/join-race/${code}`;');
    expect(shareTab).toContain("return `https://better.at/join-race/${code}`;");
    expect(shareTab).toContain('Join my race${raceText} on BetterAt!');
    expect(shareTab).toContain("const emailSubject = raceName ? `Join my race: ${raceName}` : 'Join my race on BetterAt';");
    expect(shareTab).toContain('await Share.share({');
    expect(shareTab).toContain('await Linking.openURL(emailUrl);');
    expect(shareTab).not.toContain('Join my race${raceText} on RegattaFlow!');
    expect(shareTab).not.toContain('Join my race on RegattaFlow');
    expect(shareTab).not.toContain('regattaflow://join-race?code=${code}');

    expect(clubActionRow).toContain('const clubUrl = `https://better.at/club/${clubId}`;');
    expect(clubActionRow).toContain('const message = `Check out ${clubName} on BetterAt! ${clubUrl}`;');
    expect(clubActionRow).toContain('title: `${clubName} on BetterAt`,');
    expect(clubActionRow).not.toContain('https://regattaflow.app/club/${clubId}');
    expect(clubActionRow).not.toContain('on RegattaFlow');

    expect(raceSummaryCard).toContain("const sourceLabel = isSailing ? 'Shared from BetterAt' : 'Shared from BetterAt Clinical';");
    expect(raceSummaryCard).not.toContain("'Shared from RegattaFlow'");

    expect(teamInviteModal).toContain('betterat://join-team?code=${inviteCode}');
    expect(teamInviteModal).toContain('They enter the code in their BetterAt app');
    expect(teamInviteModal).not.toContain('regattaflow://join-team?code=${inviteCode}');
    expect(teamInviteModal).not.toContain('They enter the code in their RegattaFlow app');
    expect(teamRaceEntryHook).toContain('return `betterat://join-team?code=${inviteCode}`;');
    expect(teamRaceEntryHook).not.toContain('return `regattaflow://join-team?code=${inviteCode}`;');
  });

  it('keeps club discovery, claim, and member invite surfaces BetterAt-branded', () => {
    const membersTab = readSource('app/(tabs)/members.tsx');
    const clubsTab = readSource('app/(tabs)/clubs.tsx');
    const clubDirectoryDetail = readSource('app/club/directory/[id].tsx');
    const claimClubModal = readSource('components/club/ClaimClubModal.tsx');
    const widgetManager = readSource('components/club/WidgetManager.tsx');

    expect(membersTab).toContain('Join%20our%20club%20on%20BetterAt');
    expect(membersTab).toContain('club%20workspace%20on%20BetterAt');
    expect(membersTab).not.toContain('Join%20our%20club%20on%20RegattaFlow');
    expect(membersTab).not.toContain('club%20workspace%20on%20RegattaFlow');

    expect(clubsTab).toContain("'BetterAt club'");
    expect(clubsTab).toContain("'Connected via BetterAt'");
    expect(clubsTab).toContain("'Track clubs you sail with and invite them to BetterAt'");
    expect(clubsTab).toContain('Invite your club to BetterAt to unlock live race management');
    expect(clubsTab).toContain('is not on BetterAt yet.');
    expect(clubsTab).not.toContain("'RegattaFlow club'");
    expect(clubsTab).not.toContain("'Connected via RegattaFlow'");
    expect(clubsTab).not.toContain("'Track clubs you sail with and invite them to RegattaFlow'");
    expect(clubsTab).not.toContain('Invite your club to RegattaFlow to unlock live race management');
    expect(clubsTab).not.toContain('is not on RegattaFlow yet.');

    expect(clubDirectoryDetail).toContain('On BetterAt');
    expect(clubDirectoryDetail).toContain('Claim this club to manage it on BetterAt');
    expect(clubDirectoryDetail).not.toContain('On RegattaFlow');
    expect(clubDirectoryDetail).not.toContain('Claim this club to manage it on RegattaFlow');

    expect(claimClubModal).toContain('Claiming this club will allow you to manage it on BetterAt.');
    expect(claimClubModal).toContain("placeholder=\"Any additional context about your role or how you'd like to use BetterAt...\"");
    expect(claimClubModal).not.toContain('manage it on RegattaFlow');
    expect(claimClubModal).not.toContain("how you'd like to use RegattaFlow");

    expect(widgetManager).toContain('Show "Powered by BetterAt"');
    expect(widgetManager).not.toContain('Show "Powered by RegattaFlow"');
  });

  it('keeps practice invites and race strategy export artifacts BetterAt-branded', () => {
    const practiceSessionHook = readSource('hooks/usePracticeSession.ts');
    const strategySharingModal = readSource('components/coaching/StrategySharingModal.tsx');
    const sharingFormatters = readSource('components/sharing/formatters/index.ts');
    const raceBriefingService = readSource('services/RaceBriefingService.ts');

    expect(practiceSessionHook).toContain('betterat://join-practice?code=${inviteCode}');
    expect(practiceSessionHook).not.toContain('regattaflow://join-practice?code=${inviteCode}');

    expect(strategySharingModal).toContain('Generated by BetterAt');
    expect(strategySharingModal).toContain('Share your strategy outside of BetterAt:');
    expect(strategySharingModal).toContain('Create a public link that anyone can view - no BetterAt account required.');
    expect(strategySharingModal).not.toContain('Generated by RegattaFlow');
    expect(strategySharingModal).not.toContain('Share your strategy outside of RegattaFlow:');
    expect(strategySharingModal).not.toContain('no RegattaFlow account required');

    expect(sharingFormatters).toContain('Generated by BetterAt');
    expect(sharingFormatters).not.toContain('Generated by RegattaFlow');

    expect(raceBriefingService).toContain('Generated by BetterAt');
    expect(raceBriefingService).not.toContain('Generated by RegattaFlow');
  });

  it('keeps race document provenance and course publishing labels BetterAt-branded', () => {
    const documentManagement = readSource('components/documents/management/DocumentManagementScreen.tsx');
    const coursePublishing = readSource('components/race/yacht-club/CoursePublishingPanel.tsx');

    expect(documentManagement).toContain('BetterAt tracks which document contributed each piece of race');
    expect(documentManagement).not.toContain('RegattaFlow tracks which document contributed each piece of race');

    expect(coursePublishing).toContain("name: 'Open Entry (BetterAt Network)'");
    expect(coursePublishing).not.toContain("name: 'Open Entry (RegattaFlow Network)'");
  });

  it('keeps visible playbook, coach, and race-doc learning labels BetterAt-branded', () => {
    const postRaceAnalysisCard = readSource('components/race-detail/PostRaceAnalysisCard.tsx');
    const playbookCoaching = readSource('components/races/RegattaFlowPlaybookCoaching.tsx');
    const tacticalChip = readSource('components/racing-console/AITacticalChips/TacticalChip.tsx');
    const postRaceAnalysisForm = readSource('components/races/PostRaceAnalysisForm.tsx');
    const raceDocumentsBasics = readSource('components/learn/interactives/data/raceDocumentsBasicsData.ts');

    expect(postRaceAnalysisCard).toContain('Open the BetterAt Playbook for the full framework library?');
    expect(postRaceAnalysisCard).toContain('Learn More at BetterAt Playbook');
    expect(postRaceAnalysisCard).toContain('badge="🏆 BetterAt Playbook"');
    expect(postRaceAnalysisCard).toContain('Get championship-level coaching from the BetterAt Playbook frameworks.');
    expect(postRaceAnalysisCard).not.toContain('Open the RegattaFlow Playbook for the full framework library?');
    expect(postRaceAnalysisCard).not.toContain('Learn More at RegattaFlow Playbook');
    expect(postRaceAnalysisCard).not.toContain('badge="🏆 RegattaFlow Playbook"');
    expect(postRaceAnalysisCard).not.toContain('RegattaFlow Playbook frameworks');

    expect(playbookCoaching).toContain('BetterAt Playbook Coaching');
    expect(playbookCoaching).toContain('BetterAt Playbook championship knowledge base');
    expect(playbookCoaching).not.toContain('RegattaFlow Playbook Coaching');
    expect(playbookCoaching).not.toContain('RegattaFlow Playbook championship knowledge base');

    expect(tacticalChip).toContain('BetterAt Coach Execution');
    expect(tacticalChip).not.toContain('RegattaFlow Coach Execution');

    expect(postRaceAnalysisForm).toContain('💡 BetterAt Playbook:');
    expect(postRaceAnalysisForm).not.toContain('💡 RegattaFlow Playbook:');

    expect(raceDocumentsBasics).toContain('BetterAt was designed to help you organize and review all your race documents');
    expect(raceDocumentsBasics).not.toContain('RegattaFlow was designed to help you organize and review all your race documents');
  });

  it('keeps native web-only sailing tool fallbacks BetterAt-branded', () => {
    const boat3DViewerNative = readSource('components/boats/Boat3DViewer.native.tsx');
    const routeBriefingWizard = readSource('components/checklist-tools/wizards/RouteBriefingWizard.tsx');

    expect(boat3DViewerNative).toContain('3D Viewer available on web');
    expect(boat3DViewerNative).toContain('Open BetterAt on a desktop browser to interact with the live 3D rig model.');
    expect(boat3DViewerNative).not.toContain('Open RegattaFlow on a desktop browser');

    expect(routeBriefingWizard).toContain("Platform.OS === 'web' ? (");
    expect(routeBriefingWizard).toContain('<DistanceRouteMap');
    expect(routeBriefingWizard).toContain('Map editing available on web');
    expect(routeBriefingWizard).toContain('Open BetterAt in a browser to edit waypoints');
    expect(routeBriefingWizard).not.toContain('Open RegattaFlow in a browser');
  });
});
