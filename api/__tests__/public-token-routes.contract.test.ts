import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('public token route contracts', () => {
  const stepApi = readFile('api/public/steps/[token]/index.ts');
  const strategyApi = readFile('api/public/strategies/[token].ts');
  const publicStepPage = readFile('app/p/step/[token].tsx');
  const publicStrategyPage = readFile('app/p/strategy/[token].tsx');
  const sharePage = readFile('app/share/[token].tsx');
  const regattaApi = readFile('api/public/regattas/[regattaId].ts');
  const widgetApi = readFile('api/public/widgets/[token].ts');
  const publicRegattaPage = readFile('app/p/[regattaId].tsx');
  const publicResultsPage = readFile('app/p/results/[regattaId].tsx');
  const publicSchedulePage = readFile('app/p/schedule/[regattaId].tsx');
  const publicNoticesPage = readFile('app/p/notices/[regattaId].tsx');
  const embedResultsPage = readFile('app/embed/results.tsx');
  const embedSchedulePage = readFile('app/embed/schedule.tsx');

  it('keeps public step and strategy APIs signed-out by design', () => {
    for (const source of [stepApi, strategyApi]) {
      expect(source).not.toContain('withAuth(');
      expect(source).not.toMatch(/\bauthorization\b/i);
      expect(source).toContain("if (req.method !== 'GET')");
      expect(source).toContain("if (req.method === 'OPTIONS')");
    }
  });

  it('requires both share token and enabled sharing before returning public data', () => {
    expect(stepApi).toContain(".from('timeline_steps')");
    expect(stepApi).toContain(".eq('share_token', token)");
    expect(stepApi).toContain(".eq('share_enabled', true)");

    expect(publicStepPage).toContain(".from('timeline_steps')");
    expect(publicStepPage).toContain(".eq('share_token', shareToken)");
    expect(publicStepPage).toContain(".eq('share_enabled', true)");

    expect(strategyApi).toContain(".from('sailor_race_preparation')");
    expect(strategyApi).toContain(".eq('share_token', token)");
    expect(strategyApi).toContain(".eq('share_enabled', true)");
  });

  it('does not echo lookup tokens or internal step progress identifiers in public responses', () => {
    expect(stepApi).not.toContain('id: step.id');
    expect(stepApi).not.toContain('share_token: step.share_token');
    expect(stepApi).not.toContain('sub_step_progress');
    expect(publicStepPage).not.toContain('sub_step_progress');

    expect(strategyApi).not.toContain('id: preparation.id');
    expect(strategyApi).not.toContain('share_token: preparation.share_token');
    expect(publicStrategyPage).not.toContain('share_token: string');
  });

  it('preserves share-page signup return context without exposing the full private step', () => {
    expect(sharePage).toContain("params.set('returnTo', `/share/${token}`)");
    expect(sharePage).toContain("params.set('blueprint', blueprintRef)");
    expect(sharePage).toContain("params.set('blueprintName', blueprintTitle)");
    expect(sharePage).not.toContain('media_uploads');
    expect(sharePage).not.toContain('sub_step_progress');
  });

  it('keeps public regatta consumers on the consolidated include API shape', () => {
    expect(regattaApi).toContain('const includeParam = (req.query.include as string) ||');
    expect(regattaApi).toContain('fetchResults(regattaId, division, raceNumber)');
    expect(regattaApi).toContain('fetchSchedule(regattaId, dateFilter)');
    expect(regattaApi).toContain('fetchNotices(regattaId, priority)');

    expect(publicRegattaPage).toContain('setData(result.regatta)');
    for (const source of [publicResultsPage, embedResultsPage]) {
      expect(source).toContain('`' + '${API_BASE}/api/public/regattas/${regattaId}?include=results' + '`');
      expect(source).not.toContain('/api/public/regattas/${regattaId}/results');
    }
    for (const source of [publicSchedulePage, embedSchedulePage]) {
      expect(source).toContain('`' + '${API_BASE}/api/public/regattas/${regattaId}?include=schedule' + '`');
      expect(source).not.toContain('/api/public/regattas/${regattaId}/schedule');
    }
    expect(publicNoticesPage).toContain('`' + '${API_BASE}/api/public/regattas/${regattaId}?include=notices' + '`');
    expect(publicNoticesPage).not.toContain('/api/public/regattas/${regattaId}/notices');
  });

  it('keeps public widget config gated by active token and allowed domains', () => {
    expect(widgetApi).not.toContain('withAuth(');
    expect(widgetApi).toContain(".eq('embed_token', token)");
    expect(widgetApi).toContain('if (!widget.active)');
    expect(widgetApi).toContain('widget.allowed_domains');
    expect(widgetApi).toContain('Domain not allowed for this widget');
    expect(widgetApi).not.toContain('id: widget.id');
    expect(widgetApi).not.toContain('embed_token: widget.embed_token');
  });
});
