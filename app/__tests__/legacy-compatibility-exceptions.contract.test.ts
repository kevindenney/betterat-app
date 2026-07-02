import fs from 'fs';
import path from 'path';

const SCAN_ROOTS = ['app', 'components', 'services', 'lib', 'hooks', 'api', 'supabase/functions'];
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.md']);
const LEGACY_PATTERN = /RegattaFlow|regattaflow\.(app|com|io|local)|@regattaflow|regattaflow:\/\/|io\.regattaflow\.app/;

const STORAGE_KEY_FILES = new Set([
  'app/(tabs)/clubs.tsx',
  'components/cards/constants.ts',
  'components/learn/CoachesContent.tsx',
  'components/races/AddRaceDialog/IOSAddRaceForm.tsx',
  'components/races/AddRaceDialog/TufteAddRaceForm.tsx',
  'components/races/plan/CollapsibleSection.tsx',
  'hooks/useCoachRecruitment.ts',
  'hooks/useCoachingInsightDismissals.ts',
  'lib/races/constants.ts',
  'services/GuestStorageService.ts',
  'services/ai/SkillManagementService.ts',
  'services/offlineService.ts',
]);

const INTERNAL_SYMBOL_FILES = new Set([
  'components/race-detail/PostRaceAnalysisCard.tsx',
  'components/races/RegattaFlowPlaybookCoaching.tsx',
  'components/races/index.ts',
  'services/PostRaceLearningService.ts',
  'services/sailwave/SailwaveService.ts',
]);

type LegacyMatch = {
  path: string;
  line: number;
  text: string;
};

function walkFiles(root: string): string[] {
  const absoluteRoot = path.resolve(process.cwd(), root);
  if (!fs.existsSync(absoluteRoot)) return [];

  const entries = fs.readdirSync(absoluteRoot, {withFileTypes: true});
  return entries.flatMap((entry) => {
    const absolutePath = path.join(absoluteRoot, entry.name);
    const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') return [];
      return walkFiles(relativePath);
    }

    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    return [relativePath];
  });
}

function collectLegacyMatches(): LegacyMatch[] {
  return SCAN_ROOTS.flatMap(walkFiles).flatMap((relativePath) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
    return source.split('\n').flatMap((line, index) => (
      LEGACY_PATTERN.test(line)
        ? [{path: relativePath,line: index + 1,text: line.trim()}]
        : []
    ));
  });
}

function isAllowedLegacyMatch(match: LegacyMatch): boolean {
  if (STORAGE_KEY_FILES.has(match.path) && match.text.includes('@regattaflow')) return true;

  if (match.path === 'app/join-race/[code].tsx') {
    return match.text.includes('legacy regattaflow://join-race');
  }

  if (match.path === 'app/scan-qr.tsx') {
    return (
      match.text.includes('Legacy RegattaFlow profile URLs and deep links') ||
      match.text.includes("data.startsWith('regattaflow://')") ||
      match.text.includes("data.replace('regattaflow://', 'https://regattaflow.app/')")
    );
  }

  if (match.path === 'services/sailwave/SailwaveService.ts') {
    return /map(RegattaFlow|RaceStatusToRegattaFlow|ScoringConfigToRegattaFlow)/.test(match.text);
  }

  if (INTERNAL_SYMBOL_FILES.has(match.path)) {
    return /RegattaFlowPlaybook(Coaching|Framework)/.test(match.text);
  }

  return false;
}

describe('legacy compatibility exceptions', () => {
  it('keeps remaining RegattaFlow identifiers limited to compatibility and internal names', () => {
    const unexpected = collectLegacyMatches().filter((match) => !isAllowedLegacyMatch(match));

    expect(unexpected).toEqual([]);
  });
});
