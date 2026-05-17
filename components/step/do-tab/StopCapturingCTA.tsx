import React from 'react';
import { DoMoveToReflectCTA } from './DoMoveToReflectCTA';
import { DoStopCapturingButton } from './DoStopCapturingButton';

export interface StopCapturingCTAProps {
  state: 'capturing' | 'stopping' | 'complete';
  label?: string;
  readOnly?: boolean;
  onStop?: () => void;
  onMoveToReflect?: () => void;
}

export function StopCapturingCTA({
  state,
  label = 'Stop capturing',
  readOnly,
  onStop,
  onMoveToReflect,
}: StopCapturingCTAProps) {
  if (state === 'complete') {
    return (
      <DoMoveToReflectCTA
        label="Move to Reflect"
        onPress={onMoveToReflect}
        disabled={readOnly}
      />
    );
  }

  return (
    <DoStopCapturingButton
      label={state === 'stopping' ? 'Stopping...' : label}
      onPress={onStop}
      disabled={readOnly || state === 'stopping'}
    />
  );
}
