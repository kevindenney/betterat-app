import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CoPractitionerList } from '@/components/playbook/CoPractitionerList';

export default function CoPractitionersRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <CoPractitionerList blueprintId={id} />;
}
