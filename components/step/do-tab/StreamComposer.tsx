import React from 'react';
import { DoComposer, type DoComposerProps } from './DoComposer';

export interface StreamComposerProps extends DoComposerProps {
  onAddPress?: () => void;
  onTextSubmit?: (text: string) => void;
  onMicPressStart?: () => void;
  onMicPressEnd?: () => void;
  onPhotoCapture?: (uri?: string) => void;
}

export function StreamComposer({
  onAddPress,
  onTextSubmit,
  onMicPressStart,
  onMicPressEnd,
  onPhotoCapture,
  onAddQuickNote,
  onAddPhoto,
  onAddVoiceNote,
  ...props
}: StreamComposerProps) {
  return (
    <DoComposer
      {...props}
      onAddMore={onAddPress}
      onAddQuickNote={onAddQuickNote ?? (() => onTextSubmit?.(''))}
      onAddPhoto={onAddPhoto ?? (() => onPhotoCapture?.())}
      onAddVoiceNote={onAddVoiceNote ?? onMicPressStart ?? onMicPressEnd}
    />
  );
}
