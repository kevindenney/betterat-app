import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('AI extraction edge function contracts', () => {
  it('rejects unsafe PDF extraction URLs before fetching remote content', () => {
    const source = readSource('supabase/functions/extract-pdf-text/index.ts');

    expect(source).toContain('function isPrivateUrl(urlString: string): boolean');
    expect(source).toContain("hostname === 'localhost'");
    expect(source).toContain('parsedUrl.protocol !== \'https:\'');
    expect(source).toContain("JSON.stringify({ success: false, error: 'Invalid URL' })");
    expect(source).toContain("JSON.stringify({ success: false, error: 'Only https:// URLs are allowed' })");
    expect(source).toContain("JSON.stringify({ success: false, error: 'URL is disallowed' })");
    expect(source.indexOf('if (isPrivateUrl(url))')).toBeLessThan(source.indexOf('const fetchResult = await fetchPdfWithRetry(url);'));
  });

  it('keeps race-detail extraction defensive against fenced or truncated model JSON', () => {
    const source = readSource('supabase/functions/extract-race-details/index.ts');

    expect(source).toContain("content.startsWith('```json')");
    expect(source).toContain('const jsonMatch = content.match(/\\{[\\s\\S]*\\}/);');
    expect(source).toContain('Recovered truncated JSON');
    expect(source).toContain('JSON truncated:');
    expect(source).toContain("error: 'Failed to parse AI response'");
  });

  it('keeps SSI extraction parsing fenced JSON before failing the request', () => {
    const source = readSource('supabase/functions/extract-ssi-details/index.ts');

    expect(source).toContain('JSON.parse(content)');
    expect(source).toContain('content.match(/\\{[\\s\\S]*\\}/)');
    expect(source).toContain("extraction_status: 'failed'");
    expect(source).toContain("extraction_error: error.message");
  });
});
