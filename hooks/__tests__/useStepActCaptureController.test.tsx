import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { TimelineStepRecord } from '@/types/timeline-steps';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { All: 'All' },
}));

jest.mock('@/services/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: jest.fn(),
        remove: jest.fn(() => ({ catch: () => {} })),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  },
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const showConfirmMock = jest.fn();
const showAlertMock = jest.fn();
jest.mock('@/lib/utils/crossPlatformAlert', () => ({
  showAlert: (...args: unknown[]) => showAlertMock(...args),
  showConfirm: (...args: unknown[]) => showConfirmMock(...args),
}));

const updateMetadataMutate = jest.fn();
const updateStepMutate = jest.fn();
let currentStep: TimelineStepRecord | undefined;
const setCurrentStep = (s: TimelineStepRecord | undefined) => {
  currentStep = s;
};

jest.mock('@/hooks/useStepDetail', () => ({
  useStepDetail: () => ({ data: currentStep }),
  useUpdateStepMetadata: () => ({
    mutate: (partial: unknown) => updateMetadataMutate(partial),
  }),
}));

jest.mock('@/hooks/useTimelineSteps', () => ({
  useUpdateStep: () => ({
    mutate: (input: unknown) => updateStepMutate(input),
  }),
}));

// eslint-disable-next-line import/first
import { useStepActCaptureController } from '../useStepActCaptureController';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = Date.parse('2026-05-16T14:30:00Z');

function makeStep(overrides: Partial<TimelineStepRecord> = {}): TimelineStepRecord {
  return {
    id: 'step-1',
    user_id: 'user-1',
    title: 'Light-air starts in shifty breeze',
    description: null,
    status: 'in_progress',
    sort_order: 0,
    metadata: {},
    completed_at: null,
    target_date: null,
    interest_id: 'sail-racing',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-16T14:00:00Z',
    ...overrides,
  } as unknown as TimelineStepRecord;
}

beforeEach(() => {
  updateMetadataMutate.mockClear();
  updateStepMutate.mockClear();
  showConfirmMock.mockClear();
  showAlertMock.mockClear();
  setCurrentStep(undefined);
});

const renderController = (
  input: { readOnly?: boolean; onMoveToReflect?: () => void } = {},
) =>
  renderHook(() =>
    useStepActCaptureController({
      stepId: 'step-1',
      now: () => NOW,
      ...input,
    }),
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useStepActCaptureController — state derivation', () => {
  it('reports pre_activity when status is pending and act is empty', () => {
    setCurrentStep(makeStep({ status: 'pending', metadata: {} }));
    const { result } = renderController({ readOnly: true });
    expect(result.current.state).toBe('pre_activity');
    expect(result.current.captures).toEqual([]);
  });

  it('reports live when status is in_progress with captures + started_at', () => {
    setCurrentStep(
      makeStep({
        status: 'in_progress',
        metadata: {
          act: {
            started_at: '2026-05-16T14:10:00Z',
            observations: [
              { id: 'a', text: 'note', timestamp: '2026-05-16T14:20:00Z', source: 'note' },
            ],
          },
        },
      }),
    );
    const { result } = renderController({ readOnly: true });
    expect(result.current.state).toBe('live');
    expect(result.current.captures).toHaveLength(1);
  });

  it('computes elapsedMs as now - started_at when live', () => {
    setCurrentStep(
      makeStep({
        status: 'in_progress',
        metadata: { act: { started_at: '2026-05-16T14:15:30Z' } },
      }),
    );
    const { result } = renderController({ readOnly: true });
    expect(result.current.doTabInteriorProps.elapsedMs).toBe(14 * 60 * 1000 + 30 * 1000);
  });
});

describe('useStepActCaptureController — activity lifecycle', () => {
  it('transitions live → post_activity when onStopCapturing fires', () => {
    setCurrentStep(
      makeStep({
        status: 'in_progress',
        metadata: { act: { started_at: '2026-05-16T14:10:00Z' } },
      }),
    );
    const { result } = renderController();
    expect(result.current.state).toBe('live');
    act(() => {
      result.current.doTabInteriorProps.onStopCapturing?.();
    });
    expect(result.current.state).toBe('post_activity');
    expect(result.current.activityEndedAt).not.toBeNull();
  });

  it('returns to live when onAddAnotherCapture fires after a stop', () => {
    setCurrentStep(
      makeStep({
        status: 'in_progress',
        metadata: { act: { started_at: '2026-05-16T14:10:00Z' } },
      }),
    );
    const { result } = renderController();
    act(() => {
      result.current.doTabInteriorProps.onStopCapturing?.();
    });
    expect(result.current.state).toBe('post_activity');
    act(() => {
      result.current.doTabInteriorProps.onAddAnotherCapture?.();
    });
    expect(result.current.state).toBe('live');
    expect(result.current.activityEndedAt).toBeNull();
  });

  it('forwards onMoveToReflect to the supplied handler', () => {
    setCurrentStep(makeStep({ status: 'in_progress' }));
    const onMoveToReflect = jest.fn();
    const { result } = renderController({ onMoveToReflect });
    act(() => {
      result.current.doTabInteriorProps.onMoveToReflect?.();
    });
    expect(onMoveToReflect).toHaveBeenCalledTimes(1);
  });
});

describe('useStepActCaptureController — capture writes', () => {
  it('submitQuickNote writes a new observation into metadata.act.observations[]', () => {
    setCurrentStep(
      makeStep({
        status: 'in_progress',
        metadata: { act: { started_at: '2026-05-16T14:10:00Z', observations: [] } },
      }),
    );
    const { result } = renderController();
    act(() => {
      result.current.submitQuickNote('Trust the shift');
    });
    expect(updateMetadataMutate).toHaveBeenCalled();
    const partial = updateMetadataMutate.mock.calls[0][0] as {
      act?: { observations?: { text: string; source?: string }[]; notes?: string };
    };
    expect(partial.act?.observations?.[0]?.text).toBe('Trust the shift');
    expect(partial.act?.observations?.[0]?.source).toBe('note');
    expect(partial.act?.notes).toContain('Trust the shift');
    expect(result.current.quickNoteVisible).toBe(false);
  });

  it('onDeleteCapture removes the matching observation by prefixed id', () => {
    setCurrentStep(
      makeStep({
        status: 'in_progress',
        metadata: {
          act: {
            started_at: '2026-05-16T14:10:00Z',
            observations: [
              { id: 'obs-1', text: 'keep', timestamp: '2026-05-16T14:11:00Z', source: 'note' },
              { id: 'obs-2', text: 'drop', timestamp: '2026-05-16T14:12:00Z', source: 'note' },
            ],
          },
        },
      }),
    );
    const { result } = renderController();
    act(() => {
      result.current.doTabInteriorProps.onDeleteCapture?.('obs:obs-2');
    });
    const partial = updateMetadataMutate.mock.calls.at(-1)?.[0] as {
      act?: { observations?: { id: string }[] };
    };
    expect(partial.act?.observations?.map((o) => o.id)).toEqual(['obs-1']);
  });
});

describe('useStepActCaptureController — evidence + discard', () => {
  it('onMarkAsEvidence sets markingCaptureId and exposes the matching capture', () => {
    setCurrentStep(
      makeStep({
        status: 'in_progress',
        metadata: {
          act: {
            started_at: '2026-05-16T14:10:00Z',
            observations: [
              { id: 'obs-1', text: 'one', timestamp: '2026-05-16T14:11:00Z', source: 'note' },
            ],
          },
        },
      }),
    );
    const { result } = renderController();
    expect(result.current.markingCaptureId).toBeNull();
    act(() => {
      result.current.doTabInteriorProps.onMarkAsEvidence?.('obs:obs-1');
    });
    expect(result.current.markingCaptureId).toBe('obs:obs-1');
    expect(result.current.markingCapture?.body).toBe('one');
    act(() => {
      result.current.closeMarkAsEvidence();
    });
    expect(result.current.markingCaptureId).toBeNull();
    expect(result.current.markingCapture).toBeNull();
  });

  it('onDiscardActivity prompts via showConfirm and clears act on confirm', () => {
    setCurrentStep(
      makeStep({
        status: 'in_progress',
        metadata: {
          act: {
            started_at: '2026-05-16T14:10:00Z',
            observations: [
              { id: 'obs-1', text: 'x', timestamp: '2026-05-16T14:11:00Z', source: 'note' },
            ],
            notes: 'x',
          },
        },
      }),
    );
    const { result } = renderController();
    act(() => {
      result.current.doTabInteriorProps.onDiscardActivity?.();
    });
    expect(showConfirmMock).toHaveBeenCalled();
    const callArgs = showConfirmMock.mock.calls[0];
    expect(callArgs[0]).toBe('Discard activity?');
    expect(typeof callArgs[2]).toBe('function');
    const confirmCallback = callArgs[2] as () => void;
    act(() => {
      confirmCallback();
    });
    const lastPartial = updateMetadataMutate.mock.calls.at(-1)?.[0] as {
      act?: StepActDataLite;
    };
    expect(lastPartial.act?.observations).toEqual([]);
    expect(lastPartial.act?.media_uploads).toEqual([]);
    expect(lastPartial.act?.media_links).toEqual([]);
    expect(lastPartial.act?.notes).toBe('');
    expect(lastPartial.act?.started_at).toBeUndefined();
  });
});

describe('useStepActCaptureController — read-only gates', () => {
  it('readOnly suppresses every mutating callback', () => {
    setCurrentStep(
      makeStep({
        status: 'in_progress',
        metadata: { act: { started_at: '2026-05-16T14:10:00Z' } },
      }),
    );
    const onMoveToReflect = jest.fn();
    const { result } = renderController({ readOnly: true, onMoveToReflect });
    act(() => {
      result.current.doTabInteriorProps.onStopCapturing?.();
      result.current.doTabInteriorProps.onMoveToReflect?.();
      result.current.doTabInteriorProps.onDiscardActivity?.();
      result.current.doTabInteriorProps.onMarkAsEvidence?.('obs:obs-1');
      result.current.doTabInteriorProps.onAddAnotherCapture?.();
    });
    expect(result.current.state).toBe('live');
    expect(updateMetadataMutate).not.toHaveBeenCalled();
    expect(updateStepMutate).not.toHaveBeenCalled();
    expect(onMoveToReflect).not.toHaveBeenCalled();
    expect(showConfirmMock).not.toHaveBeenCalled();
    expect(result.current.markingCaptureId).toBeNull();
  });
});

describe('useStepActCaptureController — auto-start', () => {
  it('auto-stamps started_at and transitions pending → in_progress on first render (owner)', async () => {
    setCurrentStep(makeStep({ status: 'pending', metadata: {} }));
    renderController();
    await waitFor(() => expect(updateMetadataMutate).toHaveBeenCalled());
    const partial = updateMetadataMutate.mock.calls[0][0] as {
      act?: { started_at?: string };
    };
    expect(typeof partial.act?.started_at).toBe('string');
    expect(updateStepMutate).toHaveBeenCalledWith({
      stepId: 'step-1',
      input: { status: 'in_progress' },
    });
  });

  it('does NOT auto-start when readOnly is true', async () => {
    setCurrentStep(makeStep({ status: 'pending', metadata: {} }));
    renderController({ readOnly: true });
    // Allow effect to flush
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(updateMetadataMutate).not.toHaveBeenCalled();
    expect(updateStepMutate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Local lite alias so we can introspect the partial without pulling the full
// StepActData type into the test surface.
// ---------------------------------------------------------------------------

type StepActDataLite = {
  observations?: unknown[];
  media_uploads?: unknown[];
  media_links?: unknown[];
  notes?: string;
  started_at?: string;
};
