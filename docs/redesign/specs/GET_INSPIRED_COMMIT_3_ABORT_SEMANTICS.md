# Get Inspired Commit 3 Spec: Abort Semantics

## Discrepancies

No repo contradiction found. The Supabase client already forwards caller `options.signal` to `fetch` in `services/supabase.ts`; `services/InspirationService.ts` does not currently accept or pass an `AbortSignal`.

## Decision

Stop cancels the active extraction request. Abort is cancellation, not an error.

## AbortController Instantiation

File: `components/inspiration/InspirationCaptureStep.tsx`

Use a ref because the controller is a mutable handle tied to the active request, not render state:

```tsx
const abortControllerRef = useRef<AbortController | null>(null);
const [errorState, setErrorState] = useState<GetInspiredErrorState | null>(null);
```

Lifecycle:

```tsx
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  };
}, []);
```

At the start of `handleAnalyze`:

```tsx
abortControllerRef.current?.abort();
const controller = new AbortController();
abortControllerRef.current = controller;
setErrorState(null);
setLoading(true);
```

In `finally`:

```tsx
if (abortControllerRef.current === controller) {
  abortControllerRef.current = null;
}
setLoading(false);
```

## Signal Threading

File: `services/InspirationService.ts`

Change signature:

```ts
export async function extractInspiration(
  input: InspirationInput,
  options: { signal?: AbortSignal } = {},
): Promise<InspirationExtraction>
```

Thread the signal into the Supabase function call:

```ts
const { data, error } = await supabase.functions.invoke('inspiration-extract', {
  body: {
    content_type: input.content_type,
    content: input.content,
    user_existing_interest_slugs: input.user_existing_interest_slugs,
  },
  signal: options.signal,
} as any);
```

The `as any` is acceptable here if Supabase's function invocation types do not expose `signal`; the configured Supabase client already passes `options.signal` to `fetch`.

Call site:

```tsx
const extraction = await extractInspiration(
  {
    content_type: mode,
    content: inputValue.trim(),
    user_existing_interest_slugs: userInterestSlugs,
  },
  { signal: controller.signal },
);
```

## Abort Trigger

Gestures that abort:

- Running-state Stop footer: calls `onCancelExtraction`.
- Modal Cancel/back while extraction is running: parent `InspirationWizard` asks the active capture step to cancel before closing.
- Swipe-down dismiss / Android back through `Modal.onRequestClose`: same parent close path.
- Component unmount: cleanup aborts the active controller.

Recommended parent-child contract:

```tsx
type InspirationCaptureStepProps = {
  ...
  onRunningChange?: (running: boolean) => void;
  registerAbortHandler?: (handler: (() => void) | null) => void;
};
```

`InspirationWizard` stores the registered abort handler in a ref. Its `handleClose` calls the handler before resetting wizard state when running.

## Abort vs Error Distinction

Use existing helper:

```tsx
import { isAbortError } from '@/lib/utils/fetchWithTimeout';
```

Catch block:

```tsx
} catch (error) {
  if (isAbortError(error) || controller.signal.aborted) {
    setLoading(false);
    setLoadingMessage('');
    return;
  }

  setErrorState(mapGetInspiredError(error, inputValue.trim(), mode));
}
```

Abort behavior:

- Preserve `inputValue`.
- Preserve selected mode.
- Return to filled capture state.
- Do not show an alert.
- Do not render `IOSRegisterErrorState`.
- Do not persist a result.

## Error Variant Selection

Use `<IOSRegisterErrorState />` for non-abort extraction failures.

Map errors:

```ts
type GetInspiredErrorKind = 'network' | 'input' | 'system';

function classifyGetInspiredError(error: unknown): GetInspiredErrorKind {
  const message = String((error as any)?.message || error || '').toLowerCase();
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'network';
  }
  if (
    message.includes('invalid') ||
    message.includes('unsupported') ||
    message.includes('empty') ||
    message.includes('link') ||
    message.includes('url')
  ) {
    return 'input';
  }
  return 'system';
}
```

Variant mapping:

- Network: glyph `cloud-offline-outline`; headline `We couldn't reach the server.`; primary `Try again`; secondary `Use a different link`.
- Input validation: glyph `link-outline`; headline `This source doesn't have enough practice material.`; primary `Try a different link`; secondary `Paste the text instead`.
- Downstream service/system: glyph `construct-outline`; headline `We hit an issue building your plan.`; primary `Try again`; secondary `Go back`; disclosure includes request ID if the thrown error exposes one.

The submitted source should appear in a reference card below the supporting text, matching the preview patterns in `app/error-state-ios.tsx`.

## Idempotency

Abort clears request-local state only. If the user immediately retries:

- Create a fresh `AbortController`.
- Clear `errorState`.
- Reuse the preserved `inputValue`.
- Do not attempt to reuse partial extraction output; the edge function returns only final output.

## Verification

- Stop during a slow extraction cancels the request and returns to filled capture state.
- Closing the modal while running aborts the request and does not later advance to review-interest.
- Retrying after abort starts a fresh request and can complete successfully.
- Non-abort network/input/system failures render `IOSRegisterErrorState`.
- `npm run typecheck` passes after threading the optional signal through `extractInspiration`.

## Commit Message

```text
feat(redesign): cancel Get Inspired extraction on user abort

Add AbortSignal plumbing for the Get Inspired extraction pipeline.

- InspirationCaptureStep owns an AbortController for the active extraction
- Stop, modal close, and component unmount abort the in-flight request
- extractInspiration accepts an optional AbortSignal and passes it to the
  Supabase edge-function invocation
- user abort is treated as cancellation, not an error
- non-abort extraction failures render the canonical IOSRegisterErrorState
  variants for network, input, and system failures

The result path stays in-memory and unchanged when extraction completes.
```
