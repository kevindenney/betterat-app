import {
  WAVEFORM_BAR_COUNT,
  WAVEFORM_MAX_HEIGHT,
  WAVEFORM_MIN_HEIGHT,
  buildWaveformHeights,
  formatClockTime,
  formatElapsedMmSs,
  formatRelativeAgo,
  formatVoiceDuration,
  normalizeDoCaptures,
  sortCapturesNewestFirst,
  summarizeCaptureBreakdown,
  type DoCaptureItem,
} from '../doCaptureModel';
import type { StepActData } from '@/types/step-detail';

const cap = (over: Partial<DoCaptureItem>): DoCaptureItem => ({
  id: over.id ?? 'cap',
  kind: over.kind ?? 'note',
  capturedAt: over.capturedAt ?? null,
  body: over.body ?? '',
  capabilityIds: [],
  capabilityLabels: [],
  flaggedForDebrief: false,
  source: 'act_observation',
  ...over,
});

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

  describe('formatClockTime', () => {
    it('returns HH:MM padded for valid iso input', () => {
      expect(formatClockTime('2026-05-16T14:23:11Z')).toMatch(/^\d{2}:\d{2}$/);
    });

    it('returns empty string for missing/invalid input', () => {
      expect(formatClockTime(undefined)).toBe('');
      expect(formatClockTime(null)).toBe('');
      expect(formatClockTime('')).toBe('');
      expect(formatClockTime('not a date')).toBe('');
    });
  });

  describe('formatRelativeAgo', () => {
    const now = Date.parse('2026-05-16T14:30:00Z');

    it('renders seconds bucket as "N s ago" for under 60 s', () => {
      expect(formatRelativeAgo('2026-05-16T14:29:48Z', now)).toBe('12 s ago');
    });

    it('renders minutes bucket as "Nm"', () => {
      expect(formatRelativeAgo('2026-05-16T14:27:00Z', now)).toBe('3m');
    });

    it('renders hours bucket as "Nh"', () => {
      expect(formatRelativeAgo('2026-05-16T12:30:00Z', now)).toBe('2h');
    });

    it('renders days bucket as "Nd" past 24h', () => {
      expect(formatRelativeAgo('2026-05-13T14:30:00Z', now)).toBe('3d');
    });

    it('returns empty for missing/invalid/future timestamps', () => {
      expect(formatRelativeAgo(undefined, now)).toBe('');
      expect(formatRelativeAgo('not a date', now)).toBe('');
      expect(formatRelativeAgo('2026-05-16T14:35:00Z', now)).toBe('');
    });
  });

  describe('formatElapsedMmSs', () => {
    it('formats sub-minute elapsed as 0:SS', () => {
      expect(formatElapsedMmSs(7_000)).toBe('0:07');
    });

    it('formats minutes:seconds with zero-padded seconds', () => {
      expect(formatElapsedMmSs(14 * 60 * 1000 + 52 * 1000)).toBe('14:52');
    });

    it('keeps m:ss past an hour per canonical spec', () => {
      const ms = (60 * 60 + 5 * 60 + 9) * 1000;
      expect(formatElapsedMmSs(ms)).toBe('65:09');
    });

    it('clamps negatives to 0:00', () => {
      expect(formatElapsedMmSs(-10_000)).toBe('0:00');
    });
  });

  describe('formatVoiceDuration', () => {
    it('renders seconds as m:ss', () => {
      expect(formatVoiceDuration(7)).toBe('0:07');
      expect(formatVoiceDuration(65)).toBe('1:05');
    });

    it('returns empty for missing/invalid duration', () => {
      expect(formatVoiceDuration(undefined)).toBe('');
      expect(formatVoiceDuration(0)).toBe('');
      expect(formatVoiceDuration(-5)).toBe('');
      expect(formatVoiceDuration(Number.NaN)).toBe('');
    });
  });

  describe('buildWaveformHeights', () => {
    it('always returns exactly WAVEFORM_BAR_COUNT entries', () => {
      expect(buildWaveformHeights(undefined)).toHaveLength(WAVEFORM_BAR_COUNT);
      expect(buildWaveformHeights([])).toHaveLength(WAVEFORM_BAR_COUNT);
      expect(buildWaveformHeights([0.5])).toHaveLength(WAVEFORM_BAR_COUNT);
      expect(buildWaveformHeights(new Array(40).fill(0.5))).toHaveLength(WAVEFORM_BAR_COUNT);
    });

    it('scales 0..1 normalised peaks up to the max height', () => {
      const out = buildWaveformHeights([1, 0.5, 0]);
      expect(out[0]).toBe(WAVEFORM_MAX_HEIGHT);
      expect(out[1]).toBeCloseTo(WAVEFORM_MAX_HEIGHT / 2, 5);
      expect(out[2]).toBe(WAVEFORM_MIN_HEIGHT);
    });

    it('treats >1 inputs as already-pixel and clamps to the bar height range', () => {
      const out = buildWaveformHeights([99, 8]);
      expect(out[0]).toBe(WAVEFORM_MAX_HEIGHT);
      expect(out[1]).toBe(8);
    });

    it('pads missing peaks to the bar floor so the grid stays stable', () => {
      const out = buildWaveformHeights([0.7]);
      expect(out[0]).toBeCloseTo(WAVEFORM_MAX_HEIGHT * 0.7, 5);
      for (let i = 1; i < WAVEFORM_BAR_COUNT; i += 1) {
        expect(out[i]).toBe(WAVEFORM_MIN_HEIGHT);
      }
    });
  });

  describe('summarizeCaptureBreakdown', () => {
    it('returns all zeros for an empty input', () => {
      expect(summarizeCaptureBreakdown([])).toEqual({ voice: 0, note: 0, photo: 0, marker: 0 });
    });

    it('counts each canonical display kind separately', () => {
      const items: DoCaptureItem[] = [
        cap({ id: 'v1', kind: 'voice' }),
        cap({ id: 'v2', kind: 'voice' }),
        cap({ id: 'n1', kind: 'note' }),
        cap({ id: 'p1', kind: 'photo', source: 'media_upload' }),
        cap({
          id: 'm1',
          kind: 'time_marker',
          body: 'a',
          markerLabel: 'a',
          source: 'time_marker',
        }),
        cap({
          id: 'm2',
          kind: 'time_marker',
          body: 'b',
          markerLabel: 'b',
          source: 'time_marker',
        }),
      ];
      expect(summarizeCaptureBreakdown(items)).toEqual({
        voice: 2,
        note: 1,
        photo: 1,
        marker: 2,
      });
    });

    it('folds video into photo and folds media_link / flag into note', () => {
      const items: DoCaptureItem[] = [
        cap({ id: 'vid', kind: 'video', source: 'media_upload' }),
        cap({ id: 'link', kind: 'media_link', source: 'media_link' }),
        cap({ id: 'flag', kind: 'flag' }),
      ];
      expect(summarizeCaptureBreakdown(items)).toEqual({
        voice: 0,
        note: 2,
        photo: 1,
        marker: 0,
      });
    });
  });
});
