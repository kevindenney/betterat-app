import {
  getReviewSections,
  getReviewSectionContent,
  REVIEW_PROMPT_LABELS,
} from '@/lib/step/getReviewSections';
import type { StepMetadata } from '@/types/step-detail';

describe('getReviewSections', () => {
  // -------------------------------------------------------------------------
  // Empty / missing
  // -------------------------------------------------------------------------

  describe('empty inputs', () => {
    it('returns empty for undefined metadata', () => {
      const result = getReviewSections(undefined);
      expect(result.version).toBe('1.0');
      expect(result.sections).toEqual([]);
      expect(result.composed_via).toBeNull();
    });

    it('returns empty for null metadata', () => {
      expect(getReviewSections(null).sections).toEqual([]);
    });

    it('returns empty for metadata without review', () => {
      const metadata: StepMetadata = { plan: {}, act: {} };
      expect(getReviewSections(metadata).sections).toEqual([]);
    });

    it('returns empty when review is an empty object', () => {
      const metadata: StepMetadata = { review: {} };
      expect(getReviewSections(metadata).sections).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // v1 (flat fields) synthesis
  // -------------------------------------------------------------------------

  describe('v1 (flat fields) synthesis', () => {
    it('synthesizes all three sections when all flat fields are set', () => {
      const metadata: StepMetadata = {
        review: {
          what_learned: 'I learned tacking timing matters.',
          deviation_reason: 'Wind shifted and I missed the layline.',
          next_step_notes: 'Practice port-tack approaches Wednesday.',
        },
      };
      const result = getReviewSections(metadata);
      expect(result.version).toBe('1.0');
      expect(result.composed_via).toBe('legacy');
      expect(result.sections).toHaveLength(3);

      const byPrompt = Object.fromEntries(result.sections.map((s) => [s.prompt, s]));
      expect(byPrompt.what_did_you_learn.content).toBe('I learned tacking timing matters.');
      expect(byPrompt.what_didnt.content).toBe('Wind shifted and I missed the layline.');
      expect(byPrompt.anything_else.content).toBe('Practice port-tack approaches Wednesday.');

      // All synthesized sections are source: 'legacy'
      for (const s of result.sections) {
        expect(s.source).toBe('legacy');
        expect(s.prompt_label).toBe(REVIEW_PROMPT_LABELS[s.prompt]);
      }
    });

    it('synthesizes only fields that are non-empty', () => {
      const metadata: StepMetadata = {
        review: {
          what_learned: 'Just one thing.',
          deviation_reason: '',
          next_step_notes: '   ',
        },
      };
      const result = getReviewSections(metadata);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].prompt).toBe('what_did_you_learn');
    });

    it('uses fallbackCapturedAt when provided', () => {
      const metadata: StepMetadata = { review: { what_learned: 'X' } };
      const result = getReviewSections(metadata, '2026-05-12T09:14:00Z');
      expect(result.composed_at).toBe('2026-05-12T09:14:00Z');
      expect(result.sections[0].captured_at).toBe('2026-05-12T09:14:00Z');
    });

    it('captured_at is null without fallback', () => {
      const metadata: StepMetadata = { review: { what_learned: 'X' } };
      expect(getReviewSections(metadata).sections[0].captured_at).toBeNull();
    });

    it('ignores non-prompt-related review fields', () => {
      // overall_rating, instructor_assessment, competency_assessment per D5 stay outside sections[].
      const metadata: StepMetadata = {
        review: {
          overall_rating: 4,
          worked_to_plan: true,
          capability_progress: { tacking: 3 },
          instructor_review_status: 'approved',
        },
      };
      expect(getReviewSections(metadata).sections).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // v2 (sections[]) passthrough
  // -------------------------------------------------------------------------

  describe('v2 (sections[]) passthrough', () => {
    it('returns v2 sections unchanged when well-formed', () => {
      const metadata: StepMetadata = {
        review: {
          sections: [
            {
              prompt: 'what_happened',
              prompt_label: 'What happened?',
              content: 'We had decent boatspeed off the line.',
              source: 'telegram',
              captured_at: '2026-05-12T09:14:23Z',
              duration_seconds: 47,
            },
            {
              prompt: 'what_worked',
              prompt_label: 'What worked?',
              content: 'Tactical call on the right side paid off.',
              source: 'voice_transcript',
              captured_at: '2026-05-12T09:15:10Z',
            },
          ],
          composed_via: 'telegram',
          composed_at: '2026-05-12T09:14:00Z',
        },
      };
      const result = getReviewSections(metadata);
      expect(result.version).toBe('2.0');
      expect(result.composed_via).toBe('telegram');
      expect(result.composed_at).toBe('2026-05-12T09:14:00Z');
      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].duration_seconds).toBe(47);
      expect(result.sections[1].source).toBe('voice_transcript');
    });

    it('uses canonical label when prompt_label missing', () => {
      const metadata = {
        review: {
          sections: [{ prompt: 'what_happened', content: 'X', source: 'telegram' }],
        },
      } as unknown as StepMetadata;
      const result = getReviewSections(metadata);
      expect(result.sections[0].prompt_label).toBe('What happened?');
    });

    it('falls back to legacy source for unknown source strings', () => {
      const metadata = {
        review: {
          sections: [{ prompt: 'what_worked', content: 'X', source: 'pigeon_carrier' }],
        },
      } as unknown as StepMetadata;
      expect(getReviewSections(metadata).sections[0].source).toBe('legacy');
    });

    it('prefers v2 when both v1 flat fields and v2 sections[] are present', () => {
      const metadata = {
        review: {
          what_learned: 'legacy text',
          sections: [
            {
              prompt: 'what_did_you_learn',
              content: 'v2 text',
              source: 'telegram',
              captured_at: '2026-05-12T09:14:00Z',
            },
          ],
        },
      } as unknown as StepMetadata;
      const result = getReviewSections(metadata);
      expect(result.version).toBe('2.0');
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].content).toBe('v2 text');
    });
  });

  // -------------------------------------------------------------------------
  // Malformed / partial v2
  // -------------------------------------------------------------------------

  describe('malformed inputs', () => {
    it('drops sections missing prompt', () => {
      const metadata = {
        review: {
          sections: [
            { content: 'no prompt', source: 'telegram' },
            { prompt: 'what_worked', content: 'kept', source: 'telegram' },
          ],
        },
      } as unknown as StepMetadata;
      const result = getReviewSections(metadata);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].content).toBe('kept');
    });

    it('drops sections with unknown prompt', () => {
      const metadata = {
        review: {
          sections: [
            { prompt: 'mystery_question', content: 'X', source: 'telegram' },
            { prompt: 'what_worked', content: 'kept', source: 'telegram' },
          ],
        },
      } as unknown as StepMetadata;
      const result = getReviewSections(metadata);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].prompt).toBe('what_worked');
    });

    it('drops sections with empty content', () => {
      const metadata = {
        review: {
          sections: [
            { prompt: 'what_worked', content: '', source: 'telegram' },
            { prompt: 'what_worked', content: '   ', source: 'telegram' },
            { prompt: 'what_didnt', content: 'kept', source: 'telegram' },
          ],
        },
      } as unknown as StepMetadata;
      const result = getReviewSections(metadata);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].prompt).toBe('what_didnt');
    });

    it('falls back to v1 synthesis when sections[] is present but entirely malformed', () => {
      const metadata = {
        review: {
          what_learned: 'I learned something.',
          sections: [{ garbage: true }, null, 'string-not-object'],
        },
      } as unknown as StepMetadata;
      const result = getReviewSections(metadata);
      expect(result.version).toBe('1.0');
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].prompt).toBe('what_did_you_learn');
    });

    it('returns empty when sections[] is non-array', () => {
      const metadata = {
        review: { sections: 'not-an-array' },
      } as unknown as StepMetadata;
      expect(getReviewSections(metadata).sections).toEqual([]);
    });

    it('ignores non-numeric duration_seconds', () => {
      const metadata = {
        review: {
          sections: [
            { prompt: 'what_worked', content: 'X', source: 'telegram', duration_seconds: 'forty' },
            { prompt: 'what_didnt', content: 'Y', source: 'telegram', duration_seconds: NaN },
            { prompt: 'what_happened', content: 'Z', source: 'telegram', duration_seconds: 12 },
          ],
        },
      } as unknown as StepMetadata;
      const result = getReviewSections(metadata);
      expect(result.sections[0].duration_seconds).toBeUndefined();
      expect(result.sections[1].duration_seconds).toBeUndefined();
      expect(result.sections[2].duration_seconds).toBe(12);
    });

    it('does not throw on garbage metadata', () => {
      // @ts-expect-error — testing malformed input
      expect(() => getReviewSections('not-an-object')).not.toThrow();
      // @ts-expect-error — testing malformed input
      expect(() => getReviewSections(42)).not.toThrow();
      // @ts-expect-error — testing malformed input
      expect(getReviewSections([1, 2, 3]).sections).toEqual([]);
    });
  });
});

describe('getReviewSectionContent', () => {
  it('returns content for the first matching prompt', () => {
    const sections = getReviewSections({
      review: {
        what_learned: 'A',
        deviation_reason: 'B',
        next_step_notes: 'C',
      },
    }).sections;

    expect(getReviewSectionContent(sections, 'what_did_you_learn')).toBe('A');
    expect(getReviewSectionContent(sections, 'what_didnt')).toBe('B');
    expect(getReviewSectionContent(sections, 'anything_else')).toBe('C');
    expect(getReviewSectionContent(sections, 'what_happened')).toBeNull();
  });
});
