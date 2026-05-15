import { supabase } from '../supabase';
import { extractInspiration } from '../InspirationService';

jest.mock('../supabase', () => ({
  supabase: {
    functions: {
      // Drives the test from inside: the test owns when (and how) the
      // pending promise resolves/rejects, plus captures the signal that
      // was forwarded into the invoke call.
      invoke: jest.fn(),
    },
  },
}));

const mockedInvoke = supabase.functions.invoke as jest.MockedFunction<
  typeof supabase.functions.invoke
>;

beforeEach(() => {
  mockedInvoke.mockReset();
});

describe('extractInspiration abort plumbing', () => {
  it('forwards the caller-supplied AbortSignal to supabase.functions.invoke', async () => {
    mockedInvoke.mockResolvedValueOnce({ data: { stub: true }, error: null } as any);

    const controller = new AbortController();
    await extractInspiration(
      {
        content_type: 'url',
        content: 'https://example.com/article',
        user_existing_interest_slugs: [],
      },
      { signal: controller.signal },
    );

    expect(mockedInvoke).toHaveBeenCalledTimes(1);
    const [, opts] = mockedInvoke.mock.calls[0];
    expect((opts as any).signal).toBe(controller.signal);
  });

  it('rejects with an AbortError when the caller aborts mid-request', async () => {
    // Simulate the SDK behavior: when the request's signal is aborted,
    // invoke rejects with an AbortError. This is what the configured
    // services/supabase.ts fetch wrapper produces when the caller signal
    // fires (see services/supabase.ts:162-170).
    mockedInvoke.mockImplementationOnce(
      (_name, opts: any) =>
        new Promise((_resolve, reject) => {
          const signal = opts?.signal as AbortSignal | undefined;
          if (!signal) {
            reject(new Error('expected signal forwarded'));
            return;
          }
          if (signal.aborted) {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }) as any,
    );

    const controller = new AbortController();
    const pending = extractInspiration(
      {
        content_type: 'url',
        content: 'https://example.com/article',
        user_existing_interest_slugs: [],
      },
      { signal: controller.signal },
    );

    // Abort mid-flight.
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('still works when no signal is provided (back-compat)', async () => {
    mockedInvoke.mockResolvedValueOnce({ data: { stub: true }, error: null } as any);

    const result = await extractInspiration({
      content_type: 'url',
      content: 'https://example.com/article',
      user_existing_interest_slugs: [],
    });

    expect(result).toEqual({ stub: true });
    const [, opts] = mockedInvoke.mock.calls[0];
    // `signal` is undefined when caller didn't pass one — SDK behavior is
    // unchanged from pre-Commit-3.
    expect((opts as any).signal).toBeUndefined();
  });
});
