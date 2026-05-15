# Get Inspired Commit 2 Spec: Running-State Render Switch

## Discrepancies

No repo contradiction found. The current loading state in `components/inspiration/InspirationCaptureStep.tsx` is a button-local spinner plus timed text; the iOS-register running-state preview exists at `app/get-inspired-ios-running.tsx` and is visual-only.

## Wiring Location

File: `components/inspiration/InspirationCaptureStep.tsx`

Existing owner of the long-running call:

```tsx
const handleAnalyze = async () => {
  setLoading(true);
  setLoadingMessage('Reading content...');
  ...
  const extraction = await extractInspiration(...);
  onComplete(extraction, inputValue.trim(), ...);
};
```

The render switch gates only the loading state. Result rendering and step advancement remain unchanged.

## Flag Check

Import:

```tsx
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import GetInspiredIosRunningPreview from '@/app/get-inspired-ios-running';
```

Use the same canonical pattern as the Reflect render switch shipped in `3d8b45dc`: `flag ON` renders the iOS-register surface; `flag OFF` keeps the existing render path unchanged.

## Diff

The implementation should add this early return before the normal capture form returns:

```diff
diff --git a/components/inspiration/InspirationCaptureStep.tsx b/components/inspiration/InspirationCaptureStep.tsx
@@
+  if (loading && FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER) {
+    return (
+      <GetInspiredIosRunningPreview
+        embedded
+        submittedUrl={inputValue.trim()}
+        onStop={onCancelExtraction}
+      />
+    );
+  }
+
   return (
     <View style={styles.container}>
@@
-          {loading ? (
-            <ActivityIndicator size="small" color="#fff" />
-          ) : (
-            <Ionicons name="sparkles" size={20} color="#fff" />
-          )}
-          <Text style={styles.analyzeButtonText}>
-            {loading ? loadingMessage : 'Build my plan'}
-          </Text>
+          {loading ? (
+            <ActivityIndicator size="small" color="#fff" />
+          ) : (
+            <Ionicons name="sparkles" size={20} color="#fff" />
+          )}
+          <Text style={styles.analyzeButtonText}>
+            {loading ? loadingMessage : 'Build my plan'}
+          </Text>
```

Do not remove the spinner/timed-text branch. It is the flag-off fallback and should remain byte-for-byte as much as practical.

`onCancelExtraction` is specified in `GET_INSPIRED_COMMIT_3_ABORT_SEMANTICS.md`. If Commit 2 lands before Commit 3, use a temporary local handler that clears `loading` and leaves abort plumbing to Commit 3; the preferred order is Commit 3 immediately after Commit 2.

## State Management

- Existing `loading` drives whether the running-state surface renders.
- Existing `inputValue` provides `submittedUrl`.
- Existing `loadingMessage` may continue to update in the background for flag-off fallback; the iOS-register surface uses its own canonical narration lines and does not consume this string.
- The running surface does not need to know the edge-function stage because the pipeline does not emit real progress events yet.

## Result Rendering Unchanged

Do not modify:

- `onComplete(extraction, inputValue.trim(), mode...)`
- `InspirationWizard` step advancement
- `InspirationInterestStep`
- `InspirationBlueprintStep`
- `InspirationSuccessStep`
- `activateInspiration(...)`

The cutover replaces only the waiting UI between submit and extraction completion.

## Error Handling

Commit 2 may leave existing non-abort error alerts in place if Commit 3 has not landed. The intended final state after Commit 3 is canonical `IOSRegisterErrorState` for non-abort failures.

## Verification

- Flag ON: realistic slow extraction renders the iOS-register loading narration.
- Flag OFF: the existing button-local spinner and timed text still render.
- Success still advances to the review-interest step.
- The direct preview route `/get-inspired-ios-running` still renders independently.

## Commit Message

```text
feat(redesign): gate Get Inspired running state behind iOS register flag

Replace the Get Inspired modal's long-running analyze/build-plan wait state
with the staged iOS-register loading narration when
GET_INSPIRED_IOS_REGISTER is enabled.

- flag ON renders the Get Inspired running-state surface staged in 7c2dfeeb
- flag OFF preserves the existing button-local spinner and timed text path
- result rendering and wizard step advancement are unchanged
- scope is limited to the extraction wait state; empty, filled, review, and
  success states stay on their current implementation

Abort and canonical error-state wiring land in the follow-up cutover commit.
```
