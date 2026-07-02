import { isDefaultStepTitle, stepTitleFromText } from '../stepTitle';

describe('isDefaultStepTitle', () => {
  it('matches the app furniture names', () => {
    expect(isDefaultStepTitle('Untitled step')).toBe(true);
    expect(isDefaultStepTitle('untitled step')).toBe(true);
    expect(isDefaultStepTitle('Step 3')).toBe(true);
    expect(isDefaultStepTitle('step 42')).toBe(true);
  });

  it('matches interest-name + number only for the exact interest name', () => {
    expect(isDefaultStepTitle('Golf 1', 'Golf')).toBe(true);
    expect(isDefaultStepTitle('golf 12', 'Golf')).toBe(true);
    expect(isDefaultStepTitle('Sail Racing 3', 'Sail Racing')).toBe(true);
    // Different interest → the words aren't furniture.
    expect(isDefaultStepTitle('Golf 1', 'Nursing')).toBe(false);
    // No interest given → words-plus-number is NOT assumed to be a default.
    expect(isDefaultStepTitle('Golf 1')).toBe(false);
  });

  it('never matches real user vocabulary', () => {
    expect(isDefaultStepTitle('Back 9', 'Golf')).toBe(false);
    expect(isDefaultStepTitle('Race 2 debrief', 'Sail Racing')).toBe(false);
    expect(isDefaultStepTitle('Practice putting', 'Golf')).toBe(false);
    expect(isDefaultStepTitle('Stepping stones', 'Golf')).toBe(false);
    // "Step 3" plus anything is a real title.
    expect(isDefaultStepTitle('Step 3 retro notes')).toBe(false);
  });

  it('escapes regex specials in the interest name', () => {
    expect(isDefaultStepTitle('C++ (Advanced) 2', 'C++ (Advanced)')).toBe(true);
    expect(isDefaultStepTitle('C++ Advanced 2', 'C++ (Advanced)')).toBe(false);
  });
});

describe('stepTitleFromText', () => {
  it('returns short text unchanged', () => {
    expect(stepTitleFromText('Sketch the 9th hole')).toBe('Sketch the 9th hole');
  });

  it('collapses internal whitespace and trims', () => {
    expect(stepTitleFromText('  Sketch   the\nhole  ')).toBe('Sketch the hole');
  });

  it('cuts at a word boundary with an ellipsis, never mid-word', () => {
    const text =
      'Sketch golf course layouts from aerial photos, practicing perspective to show elevation changes';
    const title = stepTitleFromText(text);
    expect(title.length).toBeLessThanOrEqual(81); // 80 + ellipsis char budget
    expect(title.endsWith('…')).toBe(true);
    // The word before the ellipsis is a whole word from the source.
    const lastWord = title.slice(0, -1).split(' ').pop()!;
    expect(text.split(/\s+/)).toContain(lastWord);
    // Specifically not the historical mid-word cut.
    expect(title).not.toMatch(/\sel…$/);
  });

  it('strips trailing punctuation before the ellipsis', () => {
    const text = `${'a'.repeat(40)} word,${' tail'.repeat(20)}`;
    const title = stepTitleFromText(text, 47);
    expect(title.endsWith(',…')).toBe(false);
    expect(title.endsWith('…')).toBe(true);
  });

  it('keeps the hard cut for one giant token instead of discarding most of the title', () => {
    const giant = 'x'.repeat(200);
    const title = stepTitleFromText(giant);
    expect(title).toBe(`${'x'.repeat(80)}…`);
  });
});
