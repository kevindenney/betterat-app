import React from 'react';
import { ResourcesZone as ResourcesZoneImpl } from '@/components/library/resources/ResourcesZone';

interface Props {
  onOpenCapture?: () => void;
}

export function ResourcesZone({ onOpenCapture }: Props) {
  return <ResourcesZoneImpl onOpenCapture={onOpenCapture} />;
}
