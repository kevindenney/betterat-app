import { normalizeDoCaptures, sortCapturesNewestFirst } from '../doCaptureModel';
import type { StepActData } from '@/types/step-detail';

describe('doCaptureModel', () => {
  describe('normalizeDoCaptures', () => {
    it('returns [] for empty/undefined act', () => {
      expect(normalizeDoCaptures(undefined)).toEqual([]);
      expect(normalizeDoCaptures(null)).toEqual([]);
      expect(normalizeDoCaptures({})).toEqual([]);
    });

    it('normalizes voice observations to voice kind', () => {
      const act: StepActData = {
        observations: [
          { id: 'a', text: 'spoken', timestamp: '2026-05-16T10:00:00Z', source: 'voice' },
        ],
      };
      const [item] = normalizeDoCaptures(act);
      expect(item.kind).toBe('voice');
      expect(item.source).toBe('act_observation');
      expect(item.body).toBe('spoken');
    });

    it('normalizes typed observations to note kind', () => {
      const act: StepActData = {
        observations: [
          { id: 'a', text: 'typed', timestamp: '2026-05-16T10:00:00Z', source: 'note' },
        ],
      };
      expect(normalizeDoCaptures(act)[0].kind).toBe('note');
    });

    it('normalizes media uploads with caption + uri', () => {
      const act: StepActData = {
        media_uploads: [
          {
            id: 'm',
            uri: 'storage://step-media/x.jpg',
            type: 'photo',
            caption: 'mark rounding',
            created_at: '2026-05-16T10:05:00Z',
          },
        ],
      };
      const [item] = normalizeDoCaptures(act);
      expect(item.kind).toBe('photo');
      expect(item.body).toBe('mark rounding');
      expect(item.mediaUri).toBe('storage://step-media/x.jpg');
      expect(item.source).toBe('media_upload');
    });

    it('normalizes media links with url as fallback body', () => {
      const act: StepActData = {
        media_links: [
          {
            id: 'l',
            url: 'https://youtu.be/abc',
            platform: 'youtube',
            added_at: '2026-05-16T10:10:00Z',
          },
        ],
      };
      const [item] = normalizeDoCaptures(act);
      expect(item.kind).toBe('media_link');
      expect(item.body).toBe('https://youtu.be/abc');
      expect(item.mediaUri).toBe('https://youtu.be/abc');
      expect(item.source).toBe('media_link');
    });

    it('skips entries missing id', () => {
      const act = {
        observations: [
          { id: '', text: 'no id', timestamp: '2026-05-16T10:00:00Z' },
          { id: 'a', text: 'has id', timestamp: '2026-05-16T10:01:00Z' },
        ],
      } as unknown as StepActData;
      const items = normalizeDoCaptures(act);
      expect(items).toHaveLength(1);
      expect(items[0].body).toBe('has id');
    });

    it('defaults capability + flag fields per spec contract', () => {
      const act: StepActData = {
        observations: [{ id: 'a', text: 'x', timestamp: '2026-05-16T10:00:00Z' }],
      };
      const [item] = normalizeDoCaptures(act);
      expect(item.capabilityIds).toEqual([]);
      expect(item.capabilityLabels).toEqual([]);
      expect(item.flaggedForDebrief).toBe(false);
    });
  });

  describe('sortCapturesNewestFirst', () => {
    it('orders entries reverse-chronologically', () => {
      const act: StepActData = {
        observations: [
          { id: 'a', text: 'first', timestamp: '2026-05-16T10:00:00Z' },
          { id: 'b', text: 'third', timestamp: '2026-05-16T10:20:00Z' },
          { id: 'c', text: 'second', timestamp: '2026-05-16T10:10:00Z' },
        ],
      };
      const ordered = sortCapturesNewestFirst(normalizeDoCaptures(act));
      expect(ordered.map((i) => i.body)).toEqual(['third', 'second', 'first']);
    });

    it('places null/invalid timestamps at the end', () => {
      const act: StepActData = {
        observations: [
          { id: 'a', text: 'has time', timestamp: '2026-05-16T10:00:00Z' },
          { id: 'b', text: 'no time', timestamp: '' },
        ],
      };
      const ordered = sortCapturesNewestFirst(normalizeDoCaptures(act));
      expect(ordered[0].body).toBe('has time');
      expect(ordered[1].body).toBe('no time');
    });
  });
});
