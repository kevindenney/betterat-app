import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ConceptDetail } from '@/components/playbook/ConceptDetail';

export default function PlaybookLifecycleConceptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <ConceptDetail conceptId={id} />;
}
