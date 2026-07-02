import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('generated agent and integration branding contracts', () => {
  it('keeps AI agent prompts and generated club resources BetterAt-branded', () => {
    const clubOnboarding = readSource('services/agents/ClubOnboardingAgent.ts');
    const coachMatching = readSource('services/agents/CoachMatchingAgent.ts');
    const raceExtraction = readSource('services/agents/RaceExtractionAgent.ts');
    const documentProcessing = readSource('services/agents/DocumentProcessingAgent.ts');
    const onboarding = readSource('services/agents/OnboardingAgent.ts');
    const venueIntelligence = readSource('services/agents/VenueIntelligenceAgent.ts');
    const baseAgent = readSource('services/agents/BaseAgentService.ts');
    const postRaceLearning = readSource('services/PostRaceLearningService.ts');
    const generateRaceCoaching = readSource('supabase/functions/generate-race-coaching/index.ts');

    expect(clubOnboarding).toContain('set up their operations on BetterAt');
    expect(clubOnboarding).toContain("'https://better.at/training/race-officer-basics'");
    expect(clubOnboarding).toContain("'https://better.at/training/multi-venue-management'");
    expect(clubOnboarding).toContain("videoTutorial: 'https://better.at/tutorials/getting-started'");
    expect(clubOnboarding).toContain("documentation: 'https://better.at/docs'");
    expect(clubOnboarding).not.toContain('set up their operations on RegattaFlow');
    expect(clubOnboarding).not.toContain('https://regattaflow.io/training');
    expect(clubOnboarding).not.toContain('https://regattaflow.io/tutorials');
    expect(clubOnboarding).not.toContain('https://regattaflow.io/docs');

    expect(coachMatching).toContain("BetterAt's marketplace");
    expect(coachMatching).not.toContain("RegattaFlow's marketplace");

    expect(raceExtraction).toContain('document parser for BetterAt');
    expect(raceExtraction).not.toContain('document parser for RegattaFlow');

    expect(documentProcessing).toContain('document processing specialist for BetterAt');
    expect(documentProcessing).toContain('Save processed document data to BetterAt knowledge base');
    expect(documentProcessing).not.toContain('document processing specialist for RegattaFlow');
    expect(documentProcessing).not.toContain('Save processed document data to RegattaFlow knowledge base');

    expect(onboarding).toContain('onboarding assistant for BetterAt');
    expect(onboarding).not.toContain('onboarding assistant for RegattaFlow');

    expect(venueIntelligence).toContain('venue intelligence specialist for BetterAt');
    expect(venueIntelligence).toContain('Makes BetterAt feel native to sailors everywhere.');
    expect(venueIntelligence).not.toContain('venue intelligence specialist for RegattaFlow');
    expect(venueIntelligence).not.toContain('Makes RegattaFlow feel native');

    expect(baseAgent).toContain('helpful AI assistant for BetterAt');
    expect(baseAgent).not.toContain('helpful AI assistant for RegattaFlow');

    expect(postRaceLearning).toContain("You are BetterAt's race learning analyst");
    expect(postRaceLearning).toContain('Blend BetterAt Playbook theory');
    expect(postRaceLearning).not.toContain("You are RegattaFlow's race learning analyst");
    expect(postRaceLearning).not.toContain('Blend RegattaFlow Playbook theory');

    expect(generateRaceCoaching).toContain('BetterAt Playbook frameworks');
    expect(generateRaceCoaching).not.toContain('RegattaFlow Playbook frameworks');
  });

  it('keeps scraping, extraction, geocoding, and verification user agents BetterAt-branded', () => {
    const clubScrape = readSource('supabase/functions/club-scrape/index.ts');
    const extractRaceDetails = readSource('supabase/functions/extract-race-details/index.ts');
    const extractCourseFromUrl = readSource('supabase/functions/extract-course-from-url/index.ts');
    const extractCourseFromDocument = readSource('supabase/functions/extract-course-from-document/index.ts');
    const bathymetryProxy = readSource('supabase/functions/bathymetry-proxy/index.ts');
    const nominatim = readSource('services/location/NominatimService.ts');
    const clubVerification = readSource('services/ClubVerificationService.ts');
    const geocoding = readSource('services/GeocodingService.ts');

    expect(clubScrape).toContain('You are onboarding a sailing club to BetterAt.');
    expect(clubScrape).toContain('"BetterAtBot/1.0 (+https://better.at)"');
    expect(clubScrape).not.toContain('You are onboarding a sailing club to RegattaFlow.');
    expect(clubScrape).not.toContain('RegattaFlowBot/1.0');

    expect(extractRaceDetails).toContain("'User-Agent': 'BetterAt/1.0 (Document Extraction)'");
    expect(extractCourseFromUrl).toContain("'User-Agent': 'Mozilla/5.0 (compatible; BetterAt/1.0; Sailing Race Course Extractor)'");
    expect(extractCourseFromDocument).toContain("'User-Agent': 'BetterAt/1.0 (Sailing Race Management App)'");
    expect(bathymetryProxy).toContain("'User-Agent': 'BetterAt/1.0 (sailing-app)'");
    expect(nominatim).toContain("private userAgent = 'BetterAt/1.0 (Sailing Race Management App)'");
    expect(clubVerification).toContain("'User-Agent': 'BetterAt-Verifier/1.0'");
    expect(geocoding).toContain("'User-Agent': 'BetterAt/1.0'");

    for (const source of [
      extractRaceDetails,
      extractCourseFromUrl,
      extractCourseFromDocument,
      bathymetryProxy,
      nominatim,
      clubVerification,
      geocoding,
    ]) {
      expect(source).not.toContain('RegattaFlow/1.0');
      expect(source).not.toContain('RegattaFlow-Verifier/1.0');
    }
  });

  it('keeps race strategy, tuning, and skill-generated copy BetterAt-branded', () => {
    const raceStrategyEngine = readSource('services/ai/RaceStrategyEngine.ts');
    const skillManagement = readSource('services/ai/SkillManagementService.ts');
    const raceTuning = readSource('services/ai/RaceTuningEngine.ts');
    const enhancedAiIntegration = readSource('services/ai/EnhancedAIIntegrationService.ts');
    const postRaceAnalysisForm = readSource('components/races/PostRaceAnalysisForm.tsx');

    expect(raceStrategyEngine).toContain('BetterAt Playbook + BetterAt Coach integration');
    expect(raceStrategyEngine).toContain('BetterAt Playbook, Racing to Win');
    expect(raceStrategyEngine).toContain('BetterAt Coach framework');
    expect(raceStrategyEngine).toContain('Classic BetterAt Playbook technique');
    expect(raceStrategyEngine).not.toContain('RegattaFlow Playbook + RegattaFlow Coach integration');
    expect(raceStrategyEngine).not.toContain('RegattaFlow Playbook, Racing to Win');
    expect(raceStrategyEngine).not.toContain('RegattaFlow Coach framework');
    expect(raceStrategyEngine).not.toContain('Classic RegattaFlow Playbook technique');

    expect(skillManagement).toContain('BetterAt Playbook and BetterAt Coach frameworks');
    expect(skillManagement).toContain('BetterAt tuning guides');
    expect(skillManagement).toContain('BetterAt Coach doctrine');
    expect(skillManagement).toContain("BetterAt Coach's *The Yachtsman's Guide to Racing Tactics*");
    expect(skillManagement).not.toContain('RegattaFlow Playbook and RegattaFlow Coach frameworks');
    expect(skillManagement).not.toContain('RegattaFlow tuning guides');
    expect(skillManagement).not.toContain('RegattaFlow Coach doctrine');
    expect(skillManagement).not.toContain("RegattaFlow Coach's *The Yachtsman's Guide to Racing Tactics*");

    expect(raceTuning).toContain("'BetterAt AI Rig Tuning Analyst'");
    expect(raceTuning).not.toContain("'RegattaFlow AI Rig Tuning Analyst'");

    expect(enhancedAiIntegration).toContain("BetterAt's AI systems");
    expect(enhancedAiIntegration).not.toContain("RegattaFlow's AI systems");

    expect(postRaceAnalysisForm).toContain('BetterAt Playbook framework integration');
    expect(postRaceAnalysisForm).not.toContain('RegattaFlow Playbook framework integration');
  });

  it('keeps demo personas and AI fallback labels BetterAt-branded', () => {
    const demoWorkspace = readSource('services/demo/demoWorkspace.ts');
    const mintDemoSession = readSource('supabase/functions/mint-demo-session/index.ts');
    const aiFallback = readSource('lib/utils/aiFallback.ts');

    expect(demoWorkspace).toContain("email: 'demo-coach@betterat.app'");
    expect(demoWorkspace).toContain("email: 'demo-club@betterat.app'");
    expect(demoWorkspace).not.toContain('@regattaflow.app');
    expect(demoWorkspace).not.toContain('@demo.regattaflow.io');

    expect(mintDemoSession).toContain("email: 'demo-markus@betterat.app'");
    expect(mintDemoSession).toContain("email: 'demo-yvonne@betterat.app'");
    expect(mintDemoSession).toContain("email: 'nursing-peer-1@demo.betterat.app'");
    expect(mintDemoSession).not.toContain('@regattaflow.app');
    expect(mintDemoSession).not.toContain('@demo.regattaflow.io');

    expect(aiFallback).toContain("guideSource: 'BetterAt Fallback (AI unavailable)'");
    expect(aiFallback).not.toContain("guideSource: 'RegattaFlow Fallback (AI unavailable)'");
  });
});
