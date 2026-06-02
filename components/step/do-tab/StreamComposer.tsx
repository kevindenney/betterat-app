import React from 'react';
import { DoComposer, type DoComposerProps } from './DoComposer';

export interface StreamComposerProps extends DoComposerProps {
  onAddPress?: () => void;
  onMicPressStart?: () => void;
  onMicPressEnd?: () => void;
  onPhotoCapture?: (uri?: string) => void;
}

export function StreamComposer({
  onAddPress,
  onMicPressStart,
  onMicPressEnd,
  onPhotoCapture,
  onAddPhoto,
  onAddVoiceNote,
  ...props
}: StreamComposerProps) {
  return (
    <DoComposer
      {...props}
      onAddMore={onAddPress}
      onAddPhoto={onAddPhoto ?? (() => onPhotoCapture?.())}
      onAddVoiceNote={onAddVoiceNote ?? onMicPressStart ?? onMicPressEnd}
    />
  );
}
