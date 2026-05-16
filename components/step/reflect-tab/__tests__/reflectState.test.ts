import { deriveReflectState, hasReflectAnswer, type ReflectPromptAnswer } from '../reflectState';

const worked: ReflectPromptAnswer = {
  id: 'worked',
  kind: 'what_worked',
  prompt: 'What worked?',
  answer: 'I kept the bow down.',
};

const improve: ReflectPromptAnswer = {
  id: 'improve',
  kind: 'what_to_improve',
  prompt: 'What should change?',
  answer: 'Call the shift earlier.',
};

describe('reflectState', () => {
  it('treats whitespace-only answers as empty', () => {
    expect(hasReflectAnswer({ answer: '   ' })).toBe(false);
    expect(hasReflectAnswer({ answer: 'real note' })).toBe(true);
  });

  it('keeps Reflect empty until Do has capture content', () => {
    expect(deriveReflectState({ hasDoCapture: false, answers: [worked, improve] })).toBe('empty');
  });

  it('requires one worked answer and one improve answer before completion is ready', () => {
    expect(deriveReflectState({ hasDoCapture: true, answers: [] })).toBe('needs_worked');
    expect(deriveReflectState({ hasDoCapture: true, answers: [worked] })).toBe('needs_improve');
    expect(deriveReflectState({ hasDoCapture: true, answers: [worked, improve] })).toBe('ready');
  });

  it('uses completedAt as the shipped state', () => {
    expect(
      deriveReflectState({
        hasDoCapture: true,
        answers: [],
        completedAt: '2026-05-16T12:00:00Z',
      }),
    ).toBe('complete');
  });
});
