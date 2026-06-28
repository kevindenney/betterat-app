/**
 * ShareIntentGate (web no-op).
 *
 * The OS share-sheet capture path is native-only; the real implementation
 * lives in ShareIntentGate.native.tsx. Web renders nothing.
 */

export function ShareIntentGate() {
  return null;
}
