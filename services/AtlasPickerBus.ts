/**
 * AtlasPickerBus — one-shot callback registry for Atlas commit-mode round-trips.
 *
 * Per the brief's A9 decision, the legacy SelectLocation modal is absorbed
 * into Atlas. PlanWhereCard's "Pick on map" button no longer opens a modal;
 * it pushes to /(tabs)/atlas?fromPlan=1, which forces commit-mode. When the
 * user taps "Use this location" Atlas emits the result here and router.back()s
 * to the caller, whose subscribed listener applies the coords to its step.
 *
 * Why an event bus instead of URL params: PlanWhereCard lives deep inside the
 * step detail route tree. Threading the return result via URL params would
 * require knowing the exact return route (different per call site — Plan tab,
 * Edit Race form, etc.). A one-shot listener decouples the caller from the
 * return navigation.
 *
 * Cardinality: only one listener can wait at a time. Mounting a second
 * `awaitResult` call without unsubscribing the first will overwrite — keep
 * subscriptions tightly scoped to the user gesture (button press → push,
 * unsub on unmount / back-navigation).
 */

export interface AtlasPickerResult {
  lat: number;
  lng: number;
  /** Reverse-geocoded place name; optional, may be absent. */
  place?: string;
}

type Listener = (result: AtlasPickerResult) => void;

let pendingListener: Listener | null = null;
let pendingCancel: (() => void) | null = null;

export const AtlasPickerBus = {
  /**
   * Register a one-shot listener. Returns an unsubscribe. The listener is
   * cleared automatically when emit() or cancel() fires.
   */
  awaitResult(onResult: Listener, onCancel?: () => void): () => void {
    pendingListener = onResult;
    pendingCancel = onCancel ?? null;
    return () => {
      if (pendingListener === onResult) {
        pendingListener = null;
        pendingCancel = null;
      }
    };
  },
  /** Called by Atlas when the user confirms the candidate pin. */
  emit(result: AtlasPickerResult): void {
    const listener = pendingListener;
    pendingListener = null;
    pendingCancel = null;
    listener?.(result);
  },
  /** Called by Atlas when the user cancels commit mode without confirming. */
  cancel(): void {
    const onCancel = pendingCancel;
    pendingListener = null;
    pendingCancel = null;
    onCancel?.();
  },
  /** Test helper / debugging — is a caller currently waiting? */
  isAwaiting(): boolean {
    return pendingListener !== null;
  },
};
