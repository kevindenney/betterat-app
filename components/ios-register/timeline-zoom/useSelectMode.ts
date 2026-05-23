/**
 * useSelectMode — multi-select state for Frame 12 bulk edit.
 *
 * Cards / bricks across L3 and L4 share one selection set, so the user
 * can enter mode at L3, scroll into L4, and keep adding without losing
 * what they already picked. State lives in the canvas; child views call
 * `toggle` from their tap handler when `enabled` is true.
 */

import { useCallback, useState } from 'react';

export interface UseSelectModeApi {
  /** True while the user is in multi-select. Drag-reorder is suppressed. */
  enabled: boolean;
  /** Step IDs currently checked. */
  selected: Set<string>;
  enter: () => void;
  exit: () => void;
  toggle: (stepId: string) => void;
  clearSelection: () => void;
  isSelected: (stepId: string) => boolean;
}

export function useSelectMode(): UseSelectModeApi {
  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const enter = useCallback(() => {
    setEnabled(true);
    setSelected(new Set());
  }, []);

  const exit = useCallback(() => {
    setEnabled(false);
    setSelected(new Set());
  }, []);

  const toggle = useCallback((stepId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const isSelected = useCallback(
    (stepId: string) => selected.has(stepId),
    [selected],
  );

  return {
    enabled,
    selected,
    enter,
    exit,
    toggle,
    clearSelection,
    isSelected,
  };
}
